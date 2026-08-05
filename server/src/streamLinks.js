// Dropbox temporary-link cache: memory -> Postgres -> Dropbox.
//
// Links are valid ~4h; we treat them as good for 3h so a link handed to the
// browser never expires mid-playback. Postgres backs the memory tier so a
// restart doesn't cost every listener a fresh round-trip.
import { query } from './db.js';
import { getTemporaryLink } from './dropbox.js';

const TTL_MS = 3 * 60 * 60 * 1000;
/** Dropbox rate-limits hard; resolve batches a few at a time. */
const BATCH_CONCURRENCY = 4;

/** filePath -> { url, expiresAt (ms) } */
const memory = new Map();

/**
 * How often one path may force a cache bypass. `fresh` exists so a player can
 * recover from a dead link once; without a cap it would let any anonymous
 * caller turn every request into a live Dropbox RPC against the app's single
 * credential. Within the window a fresh request degrades to a cached read.
 */
const FRESH_COOLDOWN_MS = 30_000;
/** filePath -> last forced-mint timestamp (ms). */
const lastFresh = new Map();

const live = (entry) => entry && entry.expiresAt > Date.now();

function remember(filePath, url, expiresAt) {
  memory.set(filePath, { url, expiresAt });
}

async function fromDatabase(filePath) {
  const { rows } = await query(
    'SELECT url, expires_at FROM stream_links WHERE file_path = $1 AND expires_at > now()',
    [filePath],
  );
  if (rows.length === 0) return null;
  const entry = { url: rows[0].url, expiresAt: new Date(rows[0].expires_at).getTime() };
  memory.set(filePath, entry);
  return entry.url;
}

async function persist(filePath, url, expiresAt) {
  await query(
    `INSERT INTO stream_links (file_path, url, expires_at)
     VALUES ($1, $2, to_timestamp($3 / 1000.0))
     ON CONFLICT (file_path) DO UPDATE
       SET url = EXCLUDED.url, expires_at = EXCLUDED.expires_at, created_at = now()`,
    [filePath, url, expiresAt],
  );
}

/**
 * Resolve one stream URL, using the cache when it is still live.
 *
 * `fresh` skips both cache tiers and mints a new temporary link — the player
 * asks for that after a link 404s (Dropbox links are bound to a file revision,
 * so replacing the file kills a cached link before it expires).
 */
export async function getStreamUrl(filePath, { fresh = false } = {}) {
  if (fresh) {
    const last = lastFresh.get(filePath) || 0;
    if (Date.now() - last < FRESH_COOLDOWN_MS) fresh = false;
    else lastFresh.set(filePath, Date.now());
  }

  if (!fresh) {
    const hit = memory.get(filePath);
    if (live(hit)) return hit.url;
    memory.delete(filePath);

    const stored = await fromDatabase(filePath).catch((err) => {
      console.warn('[streamLinks] cache read failed:', err.message);
      return null;
    });
    if (stored) return stored;
  }

  const url = await getTemporaryLink(filePath);
  const expiresAt = Date.now() + TTL_MS;
  remember(filePath, url, expiresAt);
  await persist(filePath, url, expiresAt).catch((err) => {
    console.warn('[streamLinks] cache write failed:', err.message);
  });
  return url;
}

/**
 * Resolve many paths for the player's prefetch. Never throws: a path that
 * fails maps to null so one bad track can't break a whole batch.
 */
export async function getStreamUrls(filePaths) {
  const urls = {};
  const queue = [...filePaths];

  const worker = async () => {
    while (queue.length > 0) {
      const filePath = queue.shift();
      try {
        urls[filePath] = await getStreamUrl(filePath);
      } catch (err) {
        console.warn(`[streamLinks] failed to resolve ${filePath}:`, err.message);
        urls[filePath] = null;
      }
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(BATCH_CONCURRENCY, filePaths.length) }, worker),
  );
  return urls;
}

/** Drop expired rows; called periodically from index.js. */
export async function pruneExpired() {
  for (const [path, entry] of memory) {
    if (!live(entry)) memory.delete(path);
  }
  for (const [path, at] of lastFresh) {
    if (Date.now() - at >= FRESH_COOLDOWN_MS) lastFresh.delete(path);
  }
  await query('DELETE FROM stream_links WHERE expires_at <= now()').catch((err) => {
    console.warn('[streamLinks] prune failed:', err.message);
  });
}

/**
 * Forget a path (e.g. after a re-sync replaces or removes it). Clears both
 * cache tiers — leaving the Postgres row would resurrect the stale link on
 * the next request. Best-effort and safe to fire-and-forget.
 */
export function forget(filePath) {
  memory.delete(filePath);
  return query('DELETE FROM stream_links WHERE file_path = $1', [filePath]).catch((err) => {
    console.warn('[streamLinks] forget failed:', err.message);
  });
}
