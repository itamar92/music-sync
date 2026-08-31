// Unauthenticated endpoints for a single shared collection.
// Mounted at /api/public/share; the token is always a path segment, never a
// query string, so it stays out of referrers and query-string logging.
//
// Visibility rule here is deliberately different from routes/public.js: holding
// the link grants the whole collection, so `is_public` is ignored on both the
// collection and its playlists. Excluded tracks stay hidden exactly as they are
// on the public site — that's curation, not visibility.
//
// Nothing is cached across requests: every call re-resolves the token, so a
// revoked link stops working immediately.
//
// Mostly reads, with two writes the link deliberately grants: triggering a
// Dropbox re-sync, and reordering a playlist. Both are fenced to the shared
// collection and documented at their routes. Everything else — renaming,
// excluding, publishing — stays with the owner.
import express from 'express';
import { query } from '../db.js';
import { syncPlaylistFolders } from '../folderSync.js';
import { toCollection, toPlaylist, toTrack } from '../mappers.js';
import { getStreamUrl, getStreamUrls } from '../streamLinks.js';
import { parseTrackIds, setTrackOrder } from '../trackOrder.js';

const router = express.Router();

/** A track excluded in the studio is invisible here too. */
const LIVE_TRACK = 't.is_excluded = false';

const PLAYLIST_SELECT = `
  SELECT p.*,
         COUNT(t.id)                          AS total_tracks,
         COALESCE(SUM(t.duration_seconds), 0) AS total_duration_seconds
  FROM playlists p
  LEFT JOIN tracks t ON t.playlist_id = p.id AND ${LIVE_TRACK}
`;

const asyncRoute = (fn) => (req, res, next) => fn(req, res, next).catch(next);

/* ── rate limit ────────────────────────────────────────────────────────── */

// A share token is a bearer credential in a URL, so the only thing standing
// between an attacker and a guess is entropy (256 bits) and how fast they can
// try. This caps attempts per IP; the window is generous enough that listening
// through a long playlist — one stream call per track — never trips it.
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 120;
const hits = new Map();

function rateLimit(req, res, next) {
  const now = Date.now();
  const key = req.ip || 'unknown';
  const entry = hits.get(key);

  if (!entry || now >= entry.resetAt) {
    hits.set(key, { count: 1, resetAt: now + WINDOW_MS });
  } else if (entry.count >= MAX_PER_WINDOW) {
    res.set('Retry-After', String(Math.ceil((entry.resetAt - now) / 1000)));
    return res.status(429).json({ error: 'Too many requests' });
  } else {
    entry.count += 1;
  }

  // Expired buckets are dropped on the way past so the map can't grow without
  // bound on an IP that never comes back.
  if (hits.size > 1000) {
    for (const [ip, bucket] of hits) {
      if (now >= bucket.resetAt) hits.delete(ip);
    }
  }

  next();
}

router.use(rateLimit);

/* ── token resolution ──────────────────────────────────────────────────── */

const NOT_FOUND = { error: 'Share not found' };

/**
 * The collection a token grants, or null.
 *
 * Unknown, revoked and never-existed tokens are indistinguishable to the
 * caller — every one of them produces the same 404.
 */
async function resolveShare(token) {
  if (typeof token !== 'string' || !token) return null;
  const { rows } = await query(
    `SELECT c.* FROM collection_shares s
     JOIN collections c ON c.id = s.collection_id
     WHERE s.token = $1 AND s.revoked_at IS NULL`,
    [token],
  );
  return rows[0] || null;
}

/* ── endpoints ─────────────────────────────────────────────────────────── */

/** The whole shared collection in one response: metadata plus its playlists. */
router.get('/:token', asyncRoute(async (req, res) => {
  const collection = await resolveShare(req.params.token);
  if (!collection) return res.status(404).json(NOT_FOUND);

  const { rows } = await query(
    `${PLAYLIST_SELECT}
     WHERE p.collection_id = $1
     GROUP BY p.id
     ORDER BY p.sort_order, p.name`,
    [collection.id],
  );

  res.json({
    collection: toCollection(collection),
    playlists: rows.map(toPlaylist),
  });
}));

/**
 * Whether `playlistId` is inside the collection `token` grants.
 *
 * The single fence for every per-playlist route below. A playlist outside the
 * shared collection is not addressable through this token, so it answers false
 * and the caller 404s it the same way a missing one is 404'd — a token-holder
 * can't learn that some other collection's playlist exists by probing ids.
 *
 * A malformed id is rejected here rather than passed to Postgres, where it
 * would blow up as a uuid cast error and surface as a 500.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function isSharedPlaylist(collectionId, playlistId) {
  if (typeof playlistId !== 'string' || !UUID.test(playlistId)) return false;
  const { rowCount } = await query(
    'SELECT 1 FROM playlists WHERE id = $1 AND collection_id = $2',
    [playlistId, collectionId],
  );
  return rowCount > 0;
}

/**
 * Resolve token + playlist for one request, answering 404 if either fails.
 *
 * Returns the collection on success and null once it has already responded, so
 * a route reads `if (!collection) return;`.
 */
async function requireSharedPlaylist(req, res) {
  const collection = await resolveShare(req.params.token);
  if (!collection) {
    res.status(404).json(NOT_FOUND);
    return null;
  }
  if (!(await isSharedPlaylist(collection.id, req.params.playlistId))) {
    res.status(404).json({ error: 'Playlist not found' });
    return null;
  }
  return collection;
}

router.get('/:token/playlists/:playlistId/tracks', asyncRoute(async (req, res) => {
  if (!(await requireSharedPlaylist(req, res))) return;

  const { rows } = await query(
    `SELECT * FROM tracks
     WHERE playlist_id = $1 AND is_excluded = false
     ORDER BY COALESCE(sort_order, track_number), name`,
    [req.params.playlistId],
  );
  res.json(rows.map(toTrack));
}));

/**
 * Re-pull a shared playlist's Dropbox folders on demand.
 *
 * The point of the share tier is handing someone a link and letting them hear
 * the current mix; making them wait for the owner to press sync defeats it. The
 * same three fences the public route relies on apply here, with the token
 * standing in for public visibility:
 *
 *  1. the playlist must be inside the collection this token grants;
 *  2. only folders actually linked to that playlist are touched, resolved
 *     server-side so the caller can't name its own;
 *  3. a per-folder cooldown (see SYNC_COOLDOWN_MS) collapses repeat presses
 *     into a 200 that did no Dropbox work at all — on top of this router's
 *     per-IP rate limit.
 *
 * Answers 200 in every non-error case; `synced` says whether anything was
 * actually re-read, so the UI can tell "up to date" from "just refreshed".
 */
router.post('/:token/playlists/:playlistId/sync', asyncRoute(async (req, res) => {
  if (!(await requireSharedPlaylist(req, res))) return;

  const result = await syncPlaylistFolders(req.params.playlistId);
  res.json({ success: true, ...result });
}));

/**
 * Reorder a shared playlist's tracks, for everyone.
 *
 * A deliberate exception to this tier being otherwise read-only: whoever holds
 * the link is trusted enough to arrange the running order, and the order is the
 * shared artifact — a per-recipient one would mean two people on a call
 * looking at different track 3.
 *
 * Last write wins. Two recipients dragging at once is resolved by whoever saves
 * second, with no merge and no locking; anything better needs presence, which
 * this tier doesn't have.
 *
 * The write itself only ever touches `sort_order` on rows already in this
 * playlist (see setTrackOrder), so the worst a token-holder can do is rearrange
 * tracks the link already shows them.
 */
router.put('/:token/playlists/:playlistId/track-order', asyncRoute(async (req, res) => {
  if (!(await requireSharedPlaylist(req, res))) return;

  const trackIds = parseTrackIds(req.body);
  if (!trackIds) return res.status(400).json({ error: 'trackIds array is required' });

  await setTrackOrder(req.params.playlistId, trackIds);
  res.json({ success: true });
}));

/** Which of `paths` belong to a playlist inside the shared collection. */
async function sharedPaths(collectionId, paths) {
  if (paths.length === 0) return new Set();
  const { rows } = await query(
    `SELECT DISTINCT t.file_path
     FROM tracks t
     JOIN playlists p ON p.id = t.playlist_id
     WHERE t.file_path = ANY($1::text[]) AND p.collection_id = $2 AND ${LIVE_TRACK}`,
    [paths, collectionId],
  );
  return new Set(rows.map((r) => r.file_path));
}

router.post('/:token/stream', asyncRoute(async (req, res) => {
  const collection = await resolveShare(req.params.token);
  if (!collection) return res.status(404).json(NOT_FOUND);

  const filePath = typeof req.body?.filePath === 'string' ? req.body.filePath : '';
  if (!filePath) return res.status(400).json({ error: 'filePath is required' });

  const allowed = await sharedPaths(collection.id, [filePath]);
  // Same answer whether the path is outside the share or doesn't exist at all.
  if (!allowed.has(filePath)) return res.status(404).json({ error: 'Track not available' });

  // `fresh` bypasses the link cache — the player sends it after a cached link
  // 404s, which happens when the Dropbox file was replaced since caching.
  const streamUrl = await getStreamUrl(filePath, { fresh: req.body?.fresh === true });
  res.json({ streamUrl });
}));

router.post('/:token/streams', asyncRoute(async (req, res) => {
  const collection = await resolveShare(req.params.token);
  if (!collection) return res.status(404).json(NOT_FOUND);

  const requested = Array.isArray(req.body?.filePaths) ? req.body.filePaths : [];
  const paths = requested.filter((p) => typeof p === 'string' && p).slice(0, 25);
  if (paths.length === 0) return res.json({ urls: {} });

  const allowed = await sharedPaths(collection.id, paths);
  const urls = await getStreamUrls(paths.filter((p) => allowed.has(p)));
  // Paths outside the share resolve to null rather than leaking their existence.
  for (const path of paths) {
    if (!(path in urls)) urls[path] = null;
  }
  res.json({ urls });
}));

export default router;
