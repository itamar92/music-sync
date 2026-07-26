// JWT-authenticated admin API.
// Contract mirrors src/services/adminApiService.ts exactly.
import { timingSafeEqual } from 'node:crypto';
import bcrypt from 'bcryptjs';
import express from 'express';
import jwt from 'jsonwebtoken';
import { query, withTransaction } from '../db.js';
import { listAudioFiles, listFolders, normalizePath } from '../dropbox.js';
import { toCollection, toPlaylist } from '../mappers.js';
import { forget } from '../streamLinks.js';

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || '';
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH || '';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const TOKEN_TTL = '12h';

const asyncRoute = (fn) => (req, res, next) => fn(req, res, next).catch(next);

const PLAYLIST_SELECT = `
  SELECT p.*,
         COUNT(t.id)                          AS total_tracks,
         COALESCE(SUM(t.duration_seconds), 0) AS total_duration_seconds
  FROM playlists p
  LEFT JOIN tracks t ON t.playlist_id = p.id
`;

/** Constant-time compare that doesn't leak length via an early return. */
function safeEqual(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

async function passwordMatches(password) {
  if (ADMIN_PASSWORD_HASH) return bcrypt.compare(password, ADMIN_PASSWORD_HASH);
  if (ADMIN_PASSWORD) return safeEqual(password, ADMIN_PASSWORD);
  return false;
}

router.post('/login', asyncRoute(async (req, res) => {
  if (!JWT_SECRET || !ADMIN_EMAIL || (!ADMIN_PASSWORD_HASH && !ADMIN_PASSWORD)) {
    return res.status(503).json({ error: 'Admin login is not configured on the server' });
  }

  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');

  // Always run the password check so a wrong email isn't faster than a wrong password.
  const passwordOk = await passwordMatches(password);
  if (!safeEqual(email, ADMIN_EMAIL) || !passwordOk) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const token = jwt.sign({ sub: email, role: 'admin' }, JWT_SECRET, { expiresIn: TOKEN_TTL });
  res.json({ token });
}));

/** Everything below this line requires a valid admin JWT. */
router.use((req, res, next) => {
  const header = req.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token || !JWT_SECRET) return res.status(401).json({ error: 'Authentication required' });
  try {
    req.admin = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Session expired — please log in again' });
  }
});

// --- collections -------------------------------------------------------------

router.get('/collections', asyncRoute(async (_req, res) => {
  const { rows } = await query('SELECT * FROM collections ORDER BY sort_order, name');
  res.json(rows.map(toCollection));
}));

router.post('/collections', asyncRoute(async (req, res) => {
  const name = String(req.body?.name || '').trim();
  if (!name) return res.status(400).json({ error: 'name is required' });

  const { rows } = await query(
    `INSERT INTO collections (name, display_name, description, is_public, sort_order)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [
      name,
      req.body?.displayName || name,
      req.body?.description || null,
      Boolean(req.body?.isPublic),
      Number(req.body?.sortOrder) || 0,
    ],
  );
  res.status(201).json(toCollection(rows[0]));
}));

/** Map camelCase patch keys to columns; unknown keys are ignored. */
function buildPatch(body, columns) {
  const sets = [];
  const values = [];
  for (const [key, column] of Object.entries(columns)) {
    if (body?.[key] === undefined) continue;
    values.push(body[key] === '' ? null : body[key]);
    sets.push(`${column} = $${values.length}`);
  }
  return { sets, values };
}

router.patch('/collections/:id', asyncRoute(async (req, res) => {
  const { sets, values } = buildPatch(req.body, {
    name: 'name',
    displayName: 'display_name',
    description: 'description',
    coverImageUrl: 'cover_image_url',
    isPublic: 'is_public',
    sortOrder: 'sort_order',
  });
  if (sets.length === 0) return res.status(400).json({ error: 'No supported fields to update' });

  values.push(req.params.id);
  const { rows } = await query(
    `UPDATE collections SET ${sets.join(', ')}, updated_at = now()
     WHERE id = $${values.length} RETURNING *`,
    values,
  );
  if (rows.length === 0) return res.status(404).json({ error: 'Collection not found' });
  res.json(toCollection(rows[0]));
}));

router.delete('/collections/:id', asyncRoute(async (req, res) => {
  // Playlists survive: collection_id is ON DELETE SET NULL.
  const result = await query('DELETE FROM collections WHERE id = $1', [req.params.id]);
  if (result.rowCount === 0) return res.status(404).json({ error: 'Collection not found' });
  res.json({ success: true });
}));

// --- playlists ---------------------------------------------------------------

router.get('/playlists', asyncRoute(async (_req, res) => {
  const { rows } = await query(
    `${PLAYLIST_SELECT} GROUP BY p.id ORDER BY p.sort_order, p.name`,
  );
  res.json(rows.map(toPlaylist));
}));

router.patch('/playlists/:id', asyncRoute(async (req, res) => {
  const { sets, values } = buildPatch(req.body, {
    name: 'name',
    displayName: 'display_name',
    description: 'description',
    coverImageUrl: 'cover_image_url',
    collectionId: 'collection_id',
    isPublic: 'is_public',
    sortOrder: 'sort_order',
  });
  if (sets.length === 0) return res.status(400).json({ error: 'No supported fields to update' });

  values.push(req.params.id);
  const updated = await query(
    `UPDATE playlists SET ${sets.join(', ')}, updated_at = now()
     WHERE id = $${values.length} RETURNING id`,
    values,
  );
  if (updated.rowCount === 0) return res.status(404).json({ error: 'Playlist not found' });

  const { rows } = await query(`${PLAYLIST_SELECT} WHERE p.id = $1 GROUP BY p.id`, [req.params.id]);
  res.json(toPlaylist(rows[0]));
}));

router.delete('/playlists/:id', asyncRoute(async (req, res) => {
  // Tracks cascade; Dropbox files are never touched.
  const result = await query('DELETE FROM playlists WHERE id = $1', [req.params.id]);
  if (result.rowCount === 0) return res.status(404).json({ error: 'Playlist not found' });
  res.json({ success: true });
}));

// --- dropbox -----------------------------------------------------------------

router.get('/dropbox/folders', asyncRoute(async (req, res) => {
  const folders = await listFolders(String(req.query.path || ''));
  res.json(folders);
}));

/** "01 - Artist - Title.mp3" -> { name, artist, trackNumber }. */
function parseTrackName(fileName) {
  const base = fileName.replace(/\.[^.]+$/, '').trim();
  const numbered = base.match(/^(\d{1,3})\s*[-._)]\s*(.+)$/);
  const trackNumber = numbered ? Number(numbered[1]) : null;
  const rest = numbered ? numbered[2].trim() : base;

  const split = rest.split(/\s+-\s+/);
  if (split.length >= 2) {
    return { artist: split[0].trim(), name: split.slice(1).join(' - ').trim(), trackNumber };
  }
  return { artist: null, name: rest, trackNumber };
}

router.post('/sync-folder', asyncRoute(async (req, res) => {
  const folderPath = normalizePath(String(req.body?.folderPath || ''));
  if (!folderPath) return res.status(400).json({ error: 'folderPath is required' });

  const files = await listAudioFiles(folderPath);
  const folderName = folderPath.split('/').filter(Boolean).pop() || 'Playlist';
  const displayName = String(req.body?.displayName || '').trim() || folderName;
  const collectionId = req.body?.collectionId || null;
  const isPublic = req.body?.isPublic === undefined ? true : Boolean(req.body.isPublic);

  const playlistId = await withTransaction(async (client) => {
    // Re-syncing the same folder updates the existing playlist in place.
    const { rows } = await client.query(
      `INSERT INTO playlists (name, display_name, folder_path, collection_id, type, is_public)
       VALUES ($1, $2, $3, $4, 'folder', $5)
       ON CONFLICT (folder_path) DO UPDATE
         SET name          = EXCLUDED.name,
             collection_id = COALESCE(EXCLUDED.collection_id, playlists.collection_id),
             updated_at    = now()
       RETURNING id`,
      [folderName, displayName, folderPath, collectionId, isPublic],
    );
    const id = rows[0].id;

    for (const [index, file] of files.entries()) {
      const parsed = parseTrackName(file.name);
      await client.query(
        `INSERT INTO tracks (playlist_id, name, artist, file_path, track_number)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (playlist_id, file_path) DO UPDATE
           SET name         = EXCLUDED.name,
               artist       = EXCLUDED.artist,
               track_number = EXCLUDED.track_number,
               updated_at   = now()`,
        [id, parsed.name, parsed.artist, file.path, parsed.trackNumber ?? index + 1],
      );
    }

    // Tracks removed from Dropbox disappear from the playlist too.
    const paths = files.map((f) => f.path);
    const removed = await client.query(
      `DELETE FROM tracks
       WHERE playlist_id = $1 AND NOT (file_path = ANY($2::text[]))
       RETURNING file_path`,
      [id, paths],
    );
    for (const row of removed.rows) forget(row.file_path);

    return id;
  });

  res.json({ success: true, playlistId, trackCount: files.length });
}));

export default router;
