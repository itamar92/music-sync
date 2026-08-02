// Server-side Dropbox client.
//
// The only credential is DROPBOX_REFRESH_TOKEN (env). Access tokens are derived
// from it and shared through Postgres so every replica/restart reuses one token:
//
//   - single-flight refresh, in-process (promise dedup) AND cross-process
//     (SELECT ... FOR UPDATE on the app_state row)
//   - proactive keepalive refresh ~10 min before expiry
//   - exponential backoff + jitter on 429/5xx, honoring Retry-After
//   - one-shot replay of any request that hits a 401
import { withTransaction } from './db.js';

const TOKEN_KEY = 'dropbox_access_token';
const RPC_BASE = 'https://api.dropboxapi.com/2';
const TOKEN_URL = 'https://api.dropbox.com/oauth2/token';

// Refresh this long before the token actually expires.
const REFRESH_MARGIN_MS = 10 * 60 * 1000;
const KEEPALIVE_INTERVAL_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 5;

const APP_KEY = process.env.DROPBOX_APP_KEY || '';
const APP_SECRET = process.env.DROPBOX_APP_SECRET || '';
const REFRESH_TOKEN = process.env.DROPBOX_REFRESH_TOKEN || '';

/** In-process cache: { token, expiresAt (ms) }. */
let cached = null;
/** In-flight refresh, so concurrent callers share one network round-trip. */
let refreshing = null;
/** Last refresh failure, surfaced by /api/status so a revoked token fails loudly. */
let lastError = null;

export function isConfigured() {
  return Boolean(APP_KEY && APP_SECRET && REFRESH_TOKEN);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const fresh = (entry) => entry && entry.expiresAt - REFRESH_MARGIN_MS > Date.now();

/** Tagged so the error handler answers 502 (upstream problem), not a bare 500. */
function dropboxError(message) {
  const err = new Error(message);
  err.dropbox = true;
  return err;
}

/** Exchange the refresh token for a new access token. */
async function mintAccessToken() {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: REFRESH_TOKEN,
  });
  const auth = Buffer.from(`${APP_KEY}:${APP_SECRET}`).toString('base64');

  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });

  const text = await response.text();
  if (!response.ok) {
    throw dropboxError(`Dropbox token refresh failed (${response.status}): ${text.slice(0, 300)}`);
  }

  const data = JSON.parse(text);
  return {
    token: data.access_token,
    // Dropbox returns ~4h; fall back to 3h if the field is ever missing.
    expiresAt: Date.now() + (data.expires_in ? data.expires_in * 1000 : 3 * 60 * 60 * 1000),
  };
}

/**
 * Refresh through a row lock so only one process mints a token at a time.
 * The lock holder re-reads the row first: if a peer already refreshed while we
 * waited, we adopt its token instead of burning another refresh.
 */
async function refreshShared(rejectedToken = null) {
  return withTransaction(async (client) => {
    await client.query(
      `INSERT INTO app_state (key, value) VALUES ($1, '{}'::jsonb)
       ON CONFLICT (key) DO NOTHING`,
      [TOKEN_KEY],
    );
    const { rows } = await client.query(
      'SELECT value FROM app_state WHERE key = $1 FOR UPDATE',
      [TOKEN_KEY],
    );

    const stored = rows[0]?.value;
    // Adopt a peer's token only if it isn't the one Dropbox just rejected —
    // otherwise a 401 replay would retry with the same dead token.
    const usable = stored?.token && stored?.expiresAt && fresh(stored)
      && stored.token !== rejectedToken;
    if (usable) {
      return { token: stored.token, expiresAt: Number(stored.expiresAt) };
    }

    const minted = await mintAccessToken();
    await client.query(
      `UPDATE app_state SET value = $2::jsonb, updated_at = now() WHERE key = $1`,
      [TOKEN_KEY, JSON.stringify(minted)],
    );
    console.log('[dropbox] access token refreshed');
    return minted;
  });
}

/**
 * Current access token, refreshing (once, shared) when stale.
 * `rejectedToken` forces a mint past any cached copy of that exact token.
 */
export async function getAccessToken({ rejectedToken = null } = {}) {
  if (!isConfigured()) {
    throw dropboxError(
      'Dropbox is not configured: set DROPBOX_APP_KEY, DROPBOX_APP_SECRET and DROPBOX_REFRESH_TOKEN',
    );
  }
  if (!rejectedToken && fresh(cached)) return cached.token;

  if (rejectedToken) {
    // Let any in-flight refresh settle first, then re-check: a peer may have
    // already replaced the rejected token while we waited.
    if (refreshing) await refreshing.catch(() => {});
    if (fresh(cached) && cached.token !== rejectedToken) return cached.token;
    cached = null;
  }
  if (!refreshing) {
    refreshing = refreshShared(rejectedToken)
      .then((entry) => {
        cached = entry;
        lastError = null;
        return entry.token;
      })
      .catch((err) => {
        lastError = err.message;
        throw err;
      })
      .finally(() => {
        refreshing = null;
      });
  }
  return refreshing;
}

/**
 * Dropbox RPC call with retry/backoff and a single 401 replay.
 * `body` is JSON-serialized; pass null for endpoints that take no arguments.
 */
export async function rpc(endpoint, body) {
  let replayedAfter401 = false;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    // The 401 branch below already force-refreshed, so a plain read is correct here.
    const token = await getAccessToken();

    let response;
    try {
      response = await fetch(`${RPC_BASE}${endpoint}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          ...(body === null ? {} : { 'Content-Type': 'application/json' }),
        },
        body: body === null ? undefined : JSON.stringify(body),
      });
    } catch (err) {
      // Network-level failure: retry unless we are out of attempts.
      if (attempt === MAX_ATTEMPTS) throw err;
      await sleep(backoffMs(attempt));
      continue;
    }

    if (response.ok) {
      return response.status === 204 ? null : response.json();
    }

    const detail = await response.text();

    // Expired/revoked token: mint a fresh one and replay the request once.
    if (response.status === 401 && !replayedAfter401) {
      replayedAfter401 = true;
      await getAccessToken({ rejectedToken: token });
      continue;
    }

    if ((response.status === 429 || response.status >= 500) && attempt < MAX_ATTEMPTS) {
      const retryAfter = Number(response.headers.get('retry-after'));
      const waitMs = Number.isFinite(retryAfter) && retryAfter > 0
        ? retryAfter * 1000
        : backoffMs(attempt);
      console.warn(`[dropbox] ${endpoint} -> ${response.status}; retrying in ${waitMs}ms`);
      await sleep(waitMs);
      continue;
    }

    throw dropboxError(`Dropbox ${endpoint} failed (${response.status}): ${detail.slice(0, 300)}`);
  }

  throw dropboxError(`Dropbox ${endpoint} failed after ${MAX_ATTEMPTS} attempts`);
}

/** Exponential backoff with full jitter, capped at 8s. */
function backoffMs(attempt) {
  const ceiling = Math.min(8000, 2 ** attempt * 250);
  return Math.floor(Math.random() * ceiling);
}

/** Dropbox wants "" for the root, not "/". */
export function normalizePath(path) {
  if (!path || path === '/') return '';
  return path.startsWith('/') ? path : `/${path}`;
}

async function listFolderEntries(path, recursive = false) {
  const entries = [];
  let result = await rpc('/files/list_folder', {
    path: normalizePath(path),
    recursive,
    include_non_downloadable_files: false,
    limit: 2000,
  });
  entries.push(...result.entries);

  while (result.has_more) {
    result = await rpc('/files/list_folder/continue', { cursor: result.cursor });
    entries.push(...result.entries);
  }
  return entries;
}

/** Subfolders of `path`, sorted by name. */
export async function listFolders(path = '') {
  const entries = await listFolderEntries(path);
  return entries
    .filter((e) => e['.tag'] === 'folder')
    .map((e) => ({ id: e.id, name: e.name, path: e.path_display || e.path_lower }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

const AUDIO_EXTENSIONS = new Set([
  '.mp3', '.m4a', '.wav', '.flac', '.aac', '.ogg', '.oga', '.opus', '.wma', '.aiff', '.aif',
]);

function isAudioFile(name) {
  const dot = name.lastIndexOf('.');
  return dot !== -1 && AUDIO_EXTENSIONS.has(name.slice(dot).toLowerCase());
}

/**
 * Audio files inside `path` — direct children only, or the whole subtree when
 * `recursive` is set. Sorted by full path so a subtree lists folder by folder,
 * which for a flat folder is the same as sorting by name.
 */
export async function listAudioFiles(path, recursive = false) {
  const entries = await listFolderEntries(path, recursive);
  return entries
    .filter((e) => e['.tag'] === 'file' && isAudioFile(e.name))
    .map((e) => ({
      id: e.id,
      name: e.name,
      path: e.path_display || e.path_lower,
      size: e.size,
      modified: e.server_modified,
    }))
    .sort((a, b) => a.path.localeCompare(b.path, undefined, { numeric: true }));
}

/**
 * Direct, Range-capable link (~4h validity). Audio bytes go browser<->Dropbox;
 * they are never proxied through this backend.
 */
export async function getTemporaryLink(filePath) {
  const result = await rpc('/files/get_temporary_link', { path: normalizePath(filePath) });
  return result.link;
}

/** Health snapshot for /api/status. */
export async function tokenStatus() {
  if (!isConfigured()) {
    return { configured: false, hasToken: false, error: 'DROPBOX_REFRESH_TOKEN not set' };
  }
  try {
    await getAccessToken();
    return {
      configured: true,
      hasToken: true,
      expiresAt: cached ? new Date(cached.expiresAt).toISOString() : null,
      error: null,
    };
  } catch (err) {
    return { configured: true, hasToken: false, error: err.message };
  }
}

/**
 * Keep the shared token warm so no user request ever pays for a refresh.
 * Failures are logged, not thrown — /api/status reports the last error.
 */
export function startKeepalive() {
  if (!isConfigured()) {
    console.warn('[dropbox] refresh token not configured; keepalive disabled');
    return;
  }
  const tick = () => {
    getAccessToken().catch((err) => console.error('[dropbox] keepalive refresh failed:', err.message));
  };
  tick();
  const timer = setInterval(tick, KEEPALIVE_INTERVAL_MS);
  timer.unref?.();
  return timer;
}

export function lastRefreshError() {
  return lastError;
}
