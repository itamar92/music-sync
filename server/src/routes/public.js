// Unauthenticated endpoints for the public site.
// Contract mirrors src/services/publicDataService.ts exactly.
//
// Visibility rule (one place, used by every query below): a playlist is public
// when it is flagged public AND its collection, if it has one, is also public.
// The stream endpoints only ever serve paths belonging to such a playlist.
import express from 'express';
import { query } from '../db.js';
import { toCollection, toPlaylist, toTrack } from '../mappers.js';
import { getStreamUrl, getStreamUrls } from '../streamLinks.js';

const router = express.Router();

const VISIBLE_PLAYLIST = `
  p.is_public AND (p.collection_id IS NULL OR c.is_public)
`;

const PLAYLIST_SELECT = `
  SELECT p.*,
         COUNT(t.id)                                AS total_tracks,
         COALESCE(SUM(t.duration_seconds), 0)       AS total_duration_seconds
  FROM playlists p
  LEFT JOIN collections c ON c.id = p.collection_id
  LEFT JOIN tracks t      ON t.playlist_id = p.id
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
    'SELECT * FROM tracks WHERE playlist_id = $1 ORDER BY track_number, name',
    [req.params.id],
  );
  res.json(rows.map(toTrack));
}));

/** Which of `paths` belong to a publicly visible playlist. */
async function publicPaths(paths) {
  if (paths.length === 0) return new Set();
  const { rows } = await query(
    `SELECT DISTINCT t.file_path
     FROM tracks t
     JOIN playlists p         ON p.id = t.playlist_id
     LEFT JOIN collections c  ON c.id = p.collection_id
     WHERE t.file_path = ANY($1::text[]) AND ${VISIBLE_PLAYLIST}`,
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
