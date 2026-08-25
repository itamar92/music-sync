// JWT-authenticated admin API.
// Contract mirrors src/services/adminApiService.ts exactly.
import { randomBytes, timingSafeEqual } from 'node:crypto';
import bcrypt from 'bcryptjs';
import express from 'express';
import jwt from 'jsonwebtoken';
import { query, withTransaction } from '../db.js';
import { listAudioFiles, listFolders, normalizePath } from '../dropbox.js';
import {
  fillFromFolders,
  insertPickedTracks,
  materialiseFolderTracks,
  syncFolderById,
  syncPlaylistFolders,
} from '../folderSync.js';
import { toCollection, toFolderSync, toPlaylist, toTrack } from '../mappers.js';
import { forget, getStreamUrl, getStreamUrls } from '../streamLinks.js';

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || '';
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH || '';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const TOKEN_TTL = '12h';

const asyncRoute = (fn) => (req, res, next) => fn(req, res, next).catch(next);

// Excluded tracks stay in the table (a re-sync would only bring them back) but
// must not count toward a playlist's totals anywhere they're reported.
const LIVE_TRACK = 't.is_excluded = false';

const PLAYLIST_SELECT = `
  SELECT p.*,
         COUNT(t.id)                          AS total_tracks,
         COALESCE(SUM(t.duration_seconds), 0) AS total_duration_seconds
  FROM playlists p
  LEFT JOIN tracks t ON t.playlist_id = p.id AND ${LIVE_TRACK}
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

const reloadPlaylist = async (id) => {
  const { rows } = await query(`${PLAYLIST_SELECT} WHERE p.id = $1 GROUP BY p.id`, [id]);
  return rows[0] ? toPlaylist(rows[0]) : null;
};

// --- stats -------------------------------------------------------------------

router.get('/stats', asyncRoute(async (_req, res) => {
  const { rows } = await query(`
    SELECT
      (SELECT COUNT(*) FROM collections)                      AS collections,
      (SELECT COUNT(*) FROM playlists)                        AS playlists,
      (SELECT COUNT(*) FROM folder_syncs)                     AS folders,
      (SELECT COUNT(*) FROM tracks WHERE is_excluded = false) AS tracks,
      (SELECT COUNT(*) FROM playlists WHERE is_public)        AS public_playlists
  `);
  const row = rows[0];
  res.json({
    collections: Number(row.collections),
    playlists: Number(row.playlists),
    folders: Number(row.folders),
    tracks: Number(row.tracks),
    publicPlaylists: Number(row.public_playlists),
  });
}));

// --- collections -------------------------------------------------------------

router.get('/collections', asyncRoute(async (_req, res) => {
  const { rows } = await query(`
    SELECT c.*, COUNT(p.id) AS total_playlists
    FROM collections c
    LEFT JOIN playlists p ON p.collection_id = c.id
    GROUP BY c.id
    ORDER BY c.sort_order, c.name
  `);
  res.json(rows.map((row) => ({
    ...toCollection(row),
    totalPlaylists: Number(row.total_playlists ?? 0),
  })));
}));

router.post('/collections', asyncRoute(async (req, res) => {
  const name = String(req.body?.name || '').trim();
  if (!name) return res.status(400).json({ error: 'name is required' });

  const { rows } = await query(
    `INSERT INTO collections (name, display_name, description, cover_image_url, is_public, sort_order)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [
      name,
      req.body?.displayName || name,
      req.body?.description || null,
      req.body?.coverImageUrl || null,
      req.body?.isPublic === undefined ? true : Boolean(req.body.isPublic),
      Number(req.body?.sortOrder) || 0,
    ],
  );

  const collection = toCollection(rows[0]);

  // A collection may be created with its playlists already chosen.
  const playlistIds = Array.isArray(req.body?.playlistIds) ? req.body.playlistIds : [];
  if (playlistIds.length) {
    await query('UPDATE playlists SET collection_id = $1, updated_at = now() WHERE id = ANY($2::uuid[])',
      [collection.id, playlistIds]);
  }

  res.status(201).json({ ...collection, totalPlaylists: playlistIds.length });
}));

router.patch('/collections/:id', asyncRoute(async (req, res) => {
  const { sets, values } = buildPatch(req.body, {
    name: 'name',
    displayName: 'display_name',
    description: 'description',
    coverImageUrl: 'cover_image_url',
    isPublic: 'is_public',
    sortOrder: 'sort_order',
  });

  const playlistIds = Array.isArray(req.body?.playlistIds) ? req.body.playlistIds : null;
  if (sets.length === 0 && !playlistIds) {
    return res.status(400).json({ error: 'No supported fields to update' });
  }

  if (sets.length > 0) {
    values.push(req.params.id);
    const updated = await query(
      `UPDATE collections SET ${sets.join(', ')}, updated_at = now()
       WHERE id = $${values.length} RETURNING id`,
      values,
    );
    if (updated.rowCount === 0) return res.status(404).json({ error: 'Collection not found' });
  }

  // Membership is authoritative: anything not listed is detached.
  if (playlistIds) {
    await withTransaction(async (client) => {
      await client.query(
        'UPDATE playlists SET collection_id = NULL, updated_at = now() WHERE collection_id = $1',
        [req.params.id],
      );
      if (playlistIds.length) {
        await client.query(
          'UPDATE playlists SET collection_id = $1, updated_at = now() WHERE id = ANY($2::uuid[])',
          [req.params.id, playlistIds],
        );
      }
    });
  }

  const { rows } = await query(`
    SELECT c.*, COUNT(p.id) AS total_playlists
    FROM collections c
    LEFT JOIN playlists p ON p.collection_id = c.id
    WHERE c.id = $1
    GROUP BY c.id
  `, [req.params.id]);
  if (rows.length === 0) return res.status(404).json({ error: 'Collection not found' });
  res.json({ ...toCollection(rows[0]), totalPlaylists: Number(rows[0].total_playlists ?? 0) });
}));

router.delete('/collections/:id', asyncRoute(async (req, res) => {
  // Playlists survive: collection_id is ON DELETE SET NULL.
  const result = await query('DELETE FROM collections WHERE id = $1', [req.params.id]);
  if (result.rowCount === 0) return res.status(404).json({ error: 'Collection not found' });
  res.json({ success: true });
}));

// --- collection share links --------------------------------------------------

/**
 * Share links let one person hear one collection without it becoming public.
 *
 * The token is the whole credential, so it is minted here (256 bits of
 * randomness, url-safe) and never derived from anything guessable. Revoking
 * stamps `revoked_at` instead of deleting: the row is the record that a link
 * existed, and "regenerate" in the studio is revoke + create.
 */
const toShare = (row) => ({
  id: row.id,
  token: row.token,
  createdAt: row.created_at,
  revokedAt: row.revoked_at,
});

router.get('/collections/:id/shares', asyncRoute(async (req, res) => {
  const { rows } = await query(
    `SELECT * FROM collection_shares
     WHERE collection_id = $1
     ORDER BY created_at DESC`,
    [req.params.id],
  );
  res.json(rows.map(toShare));
}));

router.post('/collections/:id/shares', asyncRoute(async (req, res) => {
  const collection = await query('SELECT 1 FROM collections WHERE id = $1', [req.params.id]);
  if (collection.rowCount === 0) return res.status(404).json({ error: 'Collection not found' });

  const { rows } = await query(
    'INSERT INTO collection_shares (collection_id, token) VALUES ($1, $2) RETURNING *',
    [req.params.id, randomBytes(32).toString('base64url')],
  );
  res.status(201).json(toShare(rows[0]));
}));

/** Revoke a link. Idempotent — re-revoking keeps the original timestamp. */
router.delete('/shares/:id', asyncRoute(async (req, res) => {
  const { rows } = await query(
    `UPDATE collection_shares
     SET revoked_at = COALESCE(revoked_at, now())
     WHERE id = $1 RETURNING *`,
    [req.params.id],
  );
  if (rows.length === 0) return res.status(404).json({ error: 'Share not found' });
  res.json(toShare(rows[0]));
}));

// --- playlists ---------------------------------------------------------------

/** Attached folder ids, for the edit dialog's folder picker. */
const withFolderIds = async (playlists) => {
  if (playlists.length === 0) return playlists;
  const { rows } = await query(
    'SELECT playlist_id, folder_id FROM playlist_folders WHERE playlist_id = ANY($1::uuid[])',
    [playlists.map((p) => p.id)],
  );
  const byPlaylist = new Map();
  for (const row of rows) {
    if (!byPlaylist.has(row.playlist_id)) byPlaylist.set(row.playlist_id, []);
    byPlaylist.get(row.playlist_id).push(row.folder_id);
  }
  return playlists.map((p) => ({ ...p, folderIds: byPlaylist.get(p.id) || [] }));
};

router.get('/playlists', asyncRoute(async (_req, res) => {
  const { rows } = await query(`${PLAYLIST_SELECT} GROUP BY p.id ORDER BY p.sort_order, p.name`);
  res.json(await withFolderIds(rows.map(toPlaylist)));
}));

router.post('/playlists', asyncRoute(async (req, res) => {
  const name = String(req.body?.name || '').trim();
  if (!name) return res.status(400).json({ error: 'name is required' });

  const folderIds = Array.isArray(req.body?.folderIds) ? req.body.folderIds : [];
  const picks = cleanPickedFiles(req.body?.tracks);

  const id = await withTransaction(async (client) => {
    const { rows } = await client.query(
      `INSERT INTO playlists (name, display_name, description, cover_image_url, collection_id, type, is_public)
       VALUES ($1, $2, $3, $4, $5, 'custom', $6)
       RETURNING id`,
      [
        name,
        req.body?.displayName || name,
        req.body?.description || null,
        req.body?.coverImageUrl || null,
        req.body?.collectionId || null,
        req.body?.isPublic === undefined ? true : Boolean(req.body.isPublic),
      ],
    );
    const playlistId = rows[0].id;

    for (const folderId of folderIds) {
      await client.query(
        'INSERT INTO playlist_folders (playlist_id, folder_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [playlistId, folderId],
      );
    }
    return playlistId;
  });

  // Pulling the folders' current contents is a convenience, not part of the
  // creation. Dropbox being unreachable must not fail a request whose record
  // has already been written — the folder just stays unsynced until next time.
  const warning = await fillFromFolders(folderIds, id);
  if (picks.length) await insertPickedTracks(id, picks);

  const playlist = await reloadPlaylist(id);
  res.status(201).json({ ...playlist, folderIds, ...(warning ? { warning } : {}) });
}));

router.patch('/playlists/:id', asyncRoute(async (req, res) => {
  const { sets, values } = buildPatch(req.body, {
    name: 'name',
    displayName: 'display_name',
    description: 'description',
    coverImageUrl: 'cover_image_url',
    artist: 'artist',
    collectionId: 'collection_id',
    isPublic: 'is_public',
    sortOrder: 'sort_order',
  });

  const folderIds = Array.isArray(req.body?.folderIds) ? req.body.folderIds : null;
  if (sets.length === 0 && !folderIds) {
    return res.status(400).json({ error: 'No supported fields to update' });
  }

  let warning = null;

  if (sets.length > 0) {
    values.push(req.params.id);
    const updated = await query(
      `UPDATE playlists SET ${sets.join(', ')}, updated_at = now()
       WHERE id = $${values.length} RETURNING id`,
      values,
    );
    if (updated.rowCount === 0) return res.status(404).json({ error: 'Playlist not found' });
  }

  if (folderIds) {
    // Detaching a folder takes its tracks with it; the files stay in Dropbox.
    const removed = await withTransaction(async (client) => {
      const dropped = await client.query(
        `DELETE FROM playlist_folders
         WHERE playlist_id = $1 AND NOT (folder_id = ANY($2::uuid[]))
         RETURNING folder_id`,
        [req.params.id, folderIds],
      );
      for (const folderId of folderIds) {
        await client.query(
          'INSERT INTO playlist_folders (playlist_id, folder_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [req.params.id, folderId],
        );
      }
      if (dropped.rowCount > 0) {
        await client.query(
          'DELETE FROM tracks WHERE playlist_id = $1 AND folder_id = ANY($2::uuid[])',
          [req.params.id, dropped.rows.map((r) => r.folder_id)],
        );
      }
      return dropped.rowCount;
    });

    if (removed >= 0) {
      warning = await fillFromFolders(folderIds, req.params.id);
    }
  }

  const playlist = await reloadPlaylist(req.params.id);
  if (!playlist) return res.status(404).json({ error: 'Playlist not found' });
  const [withFolders] = await withFolderIds([playlist]);
  res.json({ ...withFolders, ...(warning ? { warning } : {}) });
}));

router.delete('/playlists/:id', asyncRoute(async (req, res) => {
  // Tracks cascade; Dropbox files are never touched.
  const result = await query('DELETE FROM playlists WHERE id = $1', [req.params.id]);
  if (result.rowCount === 0) return res.status(404).json({ error: 'Playlist not found' });
  res.json({ success: true });
}));

/**
 * Re-pull every Dropbox folder behind one playlist.
 *
 * What the "Sync from Dropbox" button in the playlist view calls. Distinct from
 * `POST /folders/:id/sync`, which starts from a folder; this starts from what
 * the admin is looking at. The cooldown is bypassed — an admin pressing the
 * button means it.
 */
router.post('/playlists/:id/sync', asyncRoute(async (req, res) => {
  const exists = await query('SELECT 1 FROM playlists WHERE id = $1', [req.params.id]);
  if (exists.rowCount === 0) return res.status(404).json({ error: 'Playlist not found' });

  const result = await syncPlaylistFolders(req.params.id, { force: true });
  res.json({ success: true, ...result });
}));

// --- tracks ------------------------------------------------------------------

router.get('/playlists/:id/tracks', asyncRoute(async (req, res) => {
  const { rows } = await query(
    `SELECT * FROM tracks
     WHERE playlist_id = $1
     ORDER BY is_excluded, COALESCE(sort_order, track_number), name`,
    [req.params.id],
  );
  res.json(rows.map(toTrack));
}));

/**
 * Add hand-picked Dropbox files to a playlist. Picked tracks carry no
 * folder_id, so no folder sync will ever add to, rename, or prune them —
 * the playlist holds exactly what the admin chose.
 */
router.post('/playlists/:id/tracks', asyncRoute(async (req, res) => {
  const files = cleanPickedFiles(req.body?.files);
  if (files.length === 0) {
    return res.status(400).json({ error: 'files array with Dropbox paths is required' });
  }

  const playlist = await query('SELECT 1 FROM playlists WHERE id = $1', [req.params.id]);
  if (playlist.rowCount === 0) return res.status(404).json({ error: 'Playlist not found' });

  await insertPickedTracks(req.params.id, files);

  const reloaded = await reloadPlaylist(req.params.id);
  const [withFolders] = await withFolderIds([reloaded]);
  res.status(201).json(withFolders);
}));

router.patch('/tracks/:id', asyncRoute(async (req, res) => {
  const { sets, values } = buildPatch(req.body, {
    displayName: 'display_name',
    displayArtist: 'display_artist',
    durationSeconds: 'duration_seconds',
    isExcluded: 'is_excluded',
  });
  if (sets.length === 0) return res.status(400).json({ error: 'No supported fields to update' });

  values.push(req.params.id);
  const { rows } = await query(
    `UPDATE tracks SET ${sets.join(', ')}, updated_at = now()
     WHERE id = $${values.length} RETURNING *`,
    values,
  );
  if (rows.length === 0) return res.status(404).json({ error: 'Track not found' });
  res.json(toTrack(rows[0]));
}));

/**
 * Remove a track from a playlist. Folder-synced tracks are hidden, not
 * deleted — a re-sync would only restore them. Hand-picked tracks (no
 * folder_id) have nothing that could bring them back, so the row goes.
 */
router.delete('/playlists/:playlistId/tracks/:trackId', asyncRoute(async (req, res) => {
  const existing = await query(
    'SELECT folder_id, file_path FROM tracks WHERE id = $1 AND playlist_id = $2',
    [req.params.trackId, req.params.playlistId],
  );
  if (existing.rows.length === 0) return res.status(404).json({ error: 'Track not found' });

  if (existing.rows[0].folder_id) {
    await query('UPDATE tracks SET is_excluded = true, updated_at = now() WHERE id = $1',
      [req.params.trackId]);
  } else {
    await query('DELETE FROM tracks WHERE id = $1', [req.params.trackId]);
  }
  forget(existing.rows[0].file_path);
  res.json({ success: true });
}));

router.put('/playlists/:id/track-order', asyncRoute(async (req, res) => {
  const trackIds = Array.isArray(req.body?.trackIds) ? req.body.trackIds : null;
  if (!trackIds) return res.status(400).json({ error: 'trackIds array is required' });

  await withTransaction(async (client) => {
    for (const [index, trackId] of trackIds.entries()) {
      await client.query(
        'UPDATE tracks SET sort_order = $1, updated_at = now() WHERE id = $2 AND playlist_id = $3',
        [index + 1, trackId, req.params.id],
      );
    }
  });

  res.json({ success: true });
}));

// --- streaming ---------------------------------------------------------------

/**
 * Which of `paths` exist as a track row at all.
 *
 * The one fence on the routes below. It deliberately ignores `is_public` and
 * `is_excluded`: those describe what the *public site* may serve, and the studio
 * has to be able to listen to a playlist before deciding to publish it, or to an
 * excluded track before deciding to bring it back. Requiring a row still stops
 * an authenticated session from minting links for arbitrary Dropbox paths.
 */
async function knownPaths(paths) {
  if (paths.length === 0) return new Set();
  const { rows } = await query(
    'SELECT DISTINCT file_path FROM tracks WHERE file_path = ANY($1::text[])',
    [paths],
  );
  return new Set(rows.map((r) => r.file_path));
}

/**
 * Stream links for the studio's preview player.
 *
 * A mirror of `POST /api/public/stream` with the visibility rule dropped. The
 * studio can't share the public endpoint: that one only serves tracks on a
 * published playlist, so every play button on an unpublished one — which is
 * every freshly synced folder — came back 404 with nothing to hear.
 */
router.post('/stream', asyncRoute(async (req, res) => {
  const filePath = typeof req.body?.filePath === 'string' ? req.body.filePath : '';
  if (!filePath) return res.status(400).json({ error: 'filePath is required' });

  const known = await knownPaths([filePath]);
  if (!known.has(filePath)) return res.status(404).json({ error: 'Track not found' });

  // `fresh` bypasses the link cache — the player sends it after a cached link
  // 404s, which happens when the Dropbox file was replaced since caching.
  const streamUrl = await getStreamUrl(filePath, { fresh: req.body?.fresh === true });
  res.json({ streamUrl });
}));

/** Batch form for the player's prefetch of upcoming tracks. */
router.post('/streams', asyncRoute(async (req, res) => {
  const requested = Array.isArray(req.body?.filePaths) ? req.body.filePaths : [];
  const paths = requested.filter((p) => typeof p === 'string' && p).slice(0, 25);
  if (paths.length === 0) return res.json({ urls: {} });

  const known = await knownPaths(paths);
  const urls = await getStreamUrls(paths.filter((p) => known.has(p)));
  // A path with no track row resolves to null, same shape as one that failed.
  for (const path of paths) {
    if (!(path in urls)) urls[path] = null;
  }
  res.json({ urls });
}));

// --- watched folders ---------------------------------------------------------

router.get('/folders', asyncRoute(async (_req, res) => {
  const { rows } = await query(`
    SELECT f.*, COALESCE(ARRAY_AGG(pf.playlist_id) FILTER (WHERE pf.playlist_id IS NOT NULL), '{}') AS playlist_ids
    FROM folder_syncs f
    LEFT JOIN playlist_folders pf ON pf.folder_id = f.id
    GROUP BY f.id
    ORDER BY f.display_name, f.name
  `);
  res.json(rows.map(toFolderSync));
}));

router.post('/folders', asyncRoute(async (req, res) => {
  const dropboxPath = normalizePath(String(req.body?.dropboxPath || ''));
  if (!dropboxPath) return res.status(400).json({ error: 'dropboxPath is required' });

  const name = String(req.body?.name || '').trim()
    || dropboxPath.split('/').filter(Boolean).pop()
    || 'Folder';

  const { rows } = await query(
    `INSERT INTO folder_syncs (dropbox_path, name, display_name, sync_frequency, is_active, include_subfolders)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (dropbox_path) DO UPDATE
       SET display_name = EXCLUDED.display_name,
           include_subfolders = EXCLUDED.include_subfolders,
           updated_at = now()
     RETURNING *`,
    [
      dropboxPath,
      name,
      req.body?.displayName || name,
      req.body?.syncFrequency || 'manual',
      req.body?.isActive === undefined ? true : Boolean(req.body.isActive),
      Boolean(req.body?.includeSubfolders),
    ],
  );
  res.status(201).json(toFolderSync(rows[0]));
}));

router.patch('/folders/:id', asyncRoute(async (req, res) => {
  const { sets, values } = buildPatch(req.body, {
    displayName: 'display_name',
    syncFrequency: 'sync_frequency',
    isActive: 'is_active',
    includeSubfolders: 'include_subfolders',
  });
  if (sets.length === 0) return res.status(400).json({ error: 'No supported fields to update' });

  values.push(req.params.id);
  const { rows } = await query(
    `UPDATE folder_syncs SET ${sets.join(', ')}, updated_at = now()
     WHERE id = $${values.length} RETURNING *`,
    values,
  );
  if (rows.length === 0) return res.status(404).json({ error: 'Folder not found' });
  res.json(toFolderSync(rows[0]));
}));

router.delete('/folders/:id', asyncRoute(async (req, res) => {
  // playlist_folders cascades; tracks attributed to the folder go with it.
  const result = await withTransaction(async (client) => {
    await client.query('DELETE FROM tracks WHERE folder_id = $1', [req.params.id]);
    return client.query('DELETE FROM folder_syncs WHERE id = $1', [req.params.id]);
  });
  if (result.rowCount === 0) return res.status(404).json({ error: 'Folder not found' });
  res.json({ success: true });
}));

/** Audio files currently in a watched folder, straight from Dropbox. */
router.get('/folders/:id/files', asyncRoute(async (req, res) => {
  const { rows } = await query(
    'SELECT dropbox_path, include_subfolders FROM folder_syncs WHERE id = $1',
    [req.params.id],
  );
  if (rows.length === 0) return res.status(404).json({ error: 'Folder not found' });

  const files = await listAudioFiles(rows[0].dropbox_path, rows[0].include_subfolders);
  res.json(files.map((file, index) => ({
    id: file.id || file.path,
    name: file.name,
    path: file.path,
    size: file.size,
    modified: file.modified,
    trackNumber: index + 1,
  })));
}));

router.post('/folders/:id/sync', asyncRoute(async (req, res) => {
  const result = await syncFolderById(req.params.id);
  if (!result) return res.status(404).json({ error: 'Folder not found' });
  res.json({ success: true, ...result });
}));

// --- dropbox browsing --------------------------------------------------------

router.get('/dropbox/folders', asyncRoute(async (req, res) => {
  const folders = await listFolders(String(req.query.path || ''));
  res.json(folders);
}));

/**
 * Track count and subfolder presence for one path. The browser asks per row as
 * it renders, rather than paying for a listing of every subfolder up front.
 */
router.get('/dropbox/folder-stats', asyncRoute(async (req, res) => {
  const path = normalizePath(String(req.query.path || ''));
  const recursive = req.query.recursive === 'true';
  const [files, subfolders] = await Promise.all([listAudioFiles(path, recursive), listFolders(path)]);
  res.json({ path, trackCount: files.length, hasSubfolders: subfolders.length > 0 });
}));

/**
 * Audio files in a Dropbox path that isn't (yet) a watched folder, so the
 * picker can show what a candidate would sync before the admin commits to it.
 */
router.get('/dropbox/folder-files', asyncRoute(async (req, res) => {
  const path = normalizePath(String(req.query.path || ''));
  if (!path) return res.status(400).json({ error: 'path is required' });

  const files = await listAudioFiles(path, req.query.recursive === 'true');
  res.json(files.map((file) => ({
    id: file.id || file.path,
    name: file.name,
    path: file.path,
  })));
}));

// --- syncing -----------------------------------------------------------------

/** Validate a request's picked-file list down to { path, name } rows. */
function cleanPickedFiles(input) {
  if (!Array.isArray(input)) return [];
  return input
    .map((file) => ({
      path: normalizePath(String(file?.path || '').trim()),
      name: String(file?.name || '').trim(),
    }))
    .filter((file) => file.path);
}

/**
 * The one-shot shortcut: point at a Dropbox folder and get a playlist mirroring
 * it. Registers the folder as watched on the way through, so what it creates is
 * editable afterwards like anything else.
 */
router.post('/sync-folder', asyncRoute(async (req, res) => {
  const folderPath = normalizePath(String(req.body?.folderPath || ''));
  if (!folderPath) return res.status(400).json({ error: 'folderPath is required' });

  const includeSubfolders = Boolean(req.body?.includeSubfolders);
  const files = await listAudioFiles(folderPath, includeSubfolders);
  const folderName = folderPath.split('/').filter(Boolean).pop() || 'Playlist';
  const displayName = String(req.body?.displayName || '').trim() || folderName;
  const collectionId = req.body?.collectionId || null;
  const isPublic = req.body?.isPublic === undefined ? true : Boolean(req.body.isPublic);

  const { playlistId, folderId } = await withTransaction(async (client) => {
    const folder = await client.query(
      `INSERT INTO folder_syncs (dropbox_path, name, display_name, status, last_sync_at, total_files, synced_files, include_subfolders)
       VALUES ($1, $2, $3, 'synced', now(), $4, $4, $5)
       ON CONFLICT (dropbox_path) DO UPDATE
         SET status = 'synced', last_sync_at = now(), last_error = NULL,
             total_files = EXCLUDED.total_files, synced_files = EXCLUDED.synced_files,
             include_subfolders = EXCLUDED.include_subfolders,
             updated_at = now()
       RETURNING id`,
      [folderPath, folderName, displayName, files.length, includeSubfolders],
    );

    // Re-syncing the same folder updates the existing playlist in place.
    const playlist = await client.query(
      `INSERT INTO playlists (name, display_name, folder_path, collection_id, type, is_public)
       VALUES ($1, $2, $3, $4, 'folder', $5)
       ON CONFLICT (folder_path) DO UPDATE
         SET name          = EXCLUDED.name,
             collection_id = COALESCE(EXCLUDED.collection_id, playlists.collection_id),
             updated_at    = now()
       RETURNING id`,
      [folderName, displayName, folderPath, collectionId, isPublic],
    );

    await client.query(
      'INSERT INTO playlist_folders (playlist_id, folder_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [playlist.rows[0].id, folder.rows[0].id],
    );

    return { playlistId: playlist.rows[0].id, folderId: folder.rows[0].id };
  });

  await materialiseFolderTracks(folderId, playlistId, files);

  res.json({ success: true, playlistId, folderId, trackCount: files.length });
}));

export default router;
