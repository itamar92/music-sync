// Unauthenticated endpoints for the public site.
// Contract mirrors src/services/publicDataService.ts exactly.
//
// Visibility rule (one place, used by every query below): a playlist is public
// when it is flagged public AND its collection, if it has one, is also public.
// The stream endpoints only ever serve paths belonging to such a playlist.
import express from 'express';
import { query } from '../db.js';
import { syncPlaylistFolders } from '../folderSync.js';
import { toCollection, toPlaylist, toTrack } from '../mappers.js';
import { getStreamUrl, getStreamUrls } from '../streamLinks.js';

const router = express.Router();

const VISIBLE_PLAYLIST = `
  p.is_public AND (p.collection_id IS NULL OR c.is_public)
`;

// A track excluded in the studio is invisible to the public site: it drops out
// of listings, out of the counts and totals, and out of the stream allow-list.
const LIVE_TRACK = 't.is_excluded = false';

const PLAYLIST_SELECT = `
  SELECT p.*,
         COUNT(t.id)                                AS total_tracks,
         COALESCE(SUM(t.duration_seconds), 0)       AS total_duration_seconds
  FROM playlists p
  LEFT JOIN collections c ON c.id = p.collection_id
  LEFT JOIN tracks t      ON t.playlist_id = p.id AND ${LIVE_TRACK}
`;

const asyncRoute = (fn) => (req, res, next) => fn(req, res, next).catch(next);

router.get('/collections', asyncRoute(async (_req, res) => {
  const { rows } = await query(
    `SELECT * FROM collections
     WHERE is_public = true
     ORDER BY sort_order, name`,
  );
  res.json(rows.map(toCollection));
}));

router.get('/collections/:id', asyncRoute(async (req, res) => {
  const { rows } = await query(
    'SELECT * FROM collections WHERE id = $1 AND is_public = true',
    [req.params.id],
  );
  if (rows.length === 0) return res.status(404).json({ error: 'Collection not found' });
  res.json(toCollection(rows[0]));
}));

router.get('/collections/:id/playlists', asyncRoute(async (req, res) => {
  const { rows } = await query(
    `${PLAYLIST_SELECT}
     WHERE p.collection_id = $1 AND ${VISIBLE_PLAYLIST}
     GROUP BY p.id, c.is_public
     ORDER BY p.sort_order, p.name`,
    [req.params.id],
  );
  res.json(rows.map(toPlaylist));
}));

router.get('/playlists', asyncRoute(async (_req, res) => {
  const { rows } = await query(
    `${PLAYLIST_SELECT}
     WHERE ${VISIBLE_PLAYLIST}
     GROUP BY p.id, c.is_public
     ORDER BY p.sort_order, p.name`,
  );
  res.json(rows.map(toPlaylist));
}));

router.get('/playlists/:id', asyncRoute(async (req, res) => {
  const { rows } = await query(
    `${PLAYLIST_SELECT}
     WHERE p.id = $1 AND ${VISIBLE_PLAYLIST}
     GROUP BY p.id, c.is_public`,
    [req.params.id],
  );
  if (rows.length === 0) return res.status(404).json({ error: 'Playlist not found' });
  res.json(toPlaylist(rows[0]));
}));

router.get('/playlists/:id/tracks', asyncRoute(async (req, res) => {
  const visible = await query(
    `SELECT 1 FROM playlists p
     LEFT JOIN collections c ON c.id = p.collection_id
     WHERE p.id = $1 AND ${VISIBLE_PLAYLIST}`,
    [req.params.id],
  );
  if (visible.rowCount === 0) return res.status(404).json({ error: 'Playlist not found' });

  const { rows } = await query(
    `SELECT * FROM tracks
     WHERE playlist_id = $1 AND is_excluded = false
     ORDER BY COALESCE(sort_order, track_number), name`,
    [req.params.id],
  );
  res.json(rows.map(toTrack));
}));

/**
 * Re-pull a public playlist's Dropbox folders on demand.
 *
 * Unauthenticated by product decision — a listener who has just been handed a
 * new mix shouldn't have to wait for the owner to press sync. Three fences keep
 * that from being a way to abuse Dropbox on the owner's behalf:
 *
 *  1. the playlist must be publicly visible, same rule as every route here;
 *  2. only folders actually linked to that playlist are touched, resolved
 *     server-side so the caller can't name its own;
 *  3. a per-folder cooldown (see SYNC_COOLDOWN_MS) collapses repeat presses
 *     into a 200 that did no Dropbox work at all.
 *
 * Answers 200 in every non-error case; `synced` says whether anything was
 * actually re-read, so the UI can tell "up to date" from "just refreshed".
 */
router.post('/playlists/:id/sync', asyncRoute(async (req, res) => {
  const visible = await query(
    `SELECT 1 FROM playlists p
     LEFT JOIN collections c ON c.id = p.collection_id
     WHERE p.id = $1 AND ${VISIBLE_PLAYLIST}`,
    [req.params.id],
  );
  if (visible.rowCount === 0) return res.status(404).json({ error: 'Playlist not found' });

  const result = await syncPlaylistFolders(req.params.id);
  res.json({ success: true, ...result });
}));

/**
 * Durations are learned, not parsed.
 *
 * The backend never downloads audio — it only hands out Dropbox links — so it
 * can't know how long a track is at sync time without fetching and decoding
 * headers. The player already learns the exact duration from the <audio>
 * element on first load, so it reports it back here once and every later
 * visitor sees it. Writes only ever fill a zero, so a listener can't overwrite
 * a known duration with a bad number, and the row must belong to a public
 * playlist to be addressable at all.
 */
router.post('/tracks/:id/duration', asyncRoute(async (req, res) => {
  const seconds = Math.round(Number(req.body?.durationSeconds));
  // 24h ceiling rejects Infinity and nonsense from a mis-seeked stream.
  if (!Number.isFinite(seconds) || seconds <= 0 || seconds > 86_400) {
    return res.status(400).json({ error: 'durationSeconds must be a positive number of seconds' });
  }

  const { rowCount } = await query(
    `UPDATE tracks t
     SET duration_seconds = $2, updated_at = now()
     FROM playlists p
     LEFT JOIN collections c ON c.id = p.collection_id
     WHERE t.id = $1
       AND p.id = t.playlist_id
       AND t.duration_seconds = 0
       AND ${LIVE_TRACK}
       AND ${VISIBLE_PLAYLIST}`,
    [req.params.id, seconds],
  );

  // Nothing updated means it was already known, hidden, or not public — all
  // uninteresting to the caller, so this is a no-op rather than an error.
  res.json({ success: true, updated: rowCount > 0 });
}));

/** Which of `paths` belong to a publicly visible playlist. */
async function publicPaths(paths) {
  if (paths.length === 0) return new Set();
  const { rows } = await query(
    `SELECT DISTINCT t.file_path
     FROM tracks t
     JOIN playlists p         ON p.id = t.playlist_id
     LEFT JOIN collections c  ON c.id = p.collection_id
     WHERE t.file_path = ANY($1::text[]) AND ${LIVE_TRACK} AND ${VISIBLE_PLAYLIST}`,
    [paths],
  );
  return new Set(rows.map((r) => r.file_path));
}

router.post('/stream', asyncRoute(async (req, res) => {
  const filePath = typeof req.body?.filePath === 'string' ? req.body.filePath : '';
  if (!filePath) return res.status(400).json({ error: 'filePath is required' });

  const allowed = await publicPaths([filePath]);
  if (!allowed.has(filePath)) {
    return res.status(404).json({ error: 'Track not available' });
  }

  const streamUrl = await getStreamUrl(filePath);
  res.json({ streamUrl });
}));

router.post('/streams', asyncRoute(async (req, res) => {
  const requested = Array.isArray(req.body?.filePaths) ? req.body.filePaths : [];
  const paths = requested.filter((p) => typeof p === 'string' && p).slice(0, 25);
  if (paths.length === 0) return res.json({ urls: {} });

  const allowed = await publicPaths(paths);
  const urls = await getStreamUrls(paths.filter((p) => allowed.has(p)));
  // Paths that aren't public resolve to null rather than leaking their existence.
  for (const path of paths) {
    if (!(path in urls)) urls[path] = null;
  }
  res.json({ urls });
}));

export default router;
