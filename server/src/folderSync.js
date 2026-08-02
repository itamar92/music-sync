// Turning Dropbox folders into track rows.
//
// Lifted out of routes/admin.js so the public route can trigger a re-sync
// without importing the admin router. This is the domain logic — routing,
// request validation and auth stay in the route modules.
import { query, withTransaction } from './db.js';
import { listAudioFiles } from './dropbox.js';
import { forget } from './streamLinks.js';

/**
 * "01 - שיר Finale.mp3" -> { name: "שיר Finale", trackNumber: 1 }.
 *
 * Only the extension and a leading track number are stripped — the rest of the
 * filename is the track name verbatim, whatever script it's in. Guessing an
 * artist from " - " separators used to swallow everything left of the dash
 * (invisible in the UI), which read as "Hebrew names get removed".
 */
export function parseTrackName(fileName) {
  const base = fileName.replace(/\.[^.]+$/, '').trim();
  const numbered = base.match(/^(\d{1,3})\s*[-._)]\s*(.+)$/);
  return {
    name: numbered ? numbered[2].trim() : base,
    trackNumber: numbered ? Number(numbered[1]) : null,
  };
}

/**
 * Append hand-picked files to a playlist as folder-less track rows.
 * Numbering continues after the playlist's current tail so picks land at the
 * end in the order they were chosen. Re-picking an existing path is a no-op.
 */
export async function insertPickedTracks(playlistId, files) {
  await withTransaction(async (client) => {
    const { rows } = await client.query(
      `SELECT COALESCE(MAX(GREATEST(COALESCE(sort_order, 0), COALESCE(track_number, 0))), 0) AS tail
       FROM tracks WHERE playlist_id = $1`,
      [playlistId],
    );
    let position = Number(rows[0].tail);

    for (const file of files) {
      const parsed = parseTrackName(file.name || file.path.split('/').pop() || '');
      position += 1;
      await client.query(
        `INSERT INTO tracks (playlist_id, name, file_path, track_number, sort_order)
         VALUES ($1, $2, $3, $4, $4)
         ON CONFLICT (playlist_id, file_path) DO NOTHING`,
        [playlistId, parsed.name || 'Untitled', file.path, position],
      );
    }
  });
}

/**
 * Write a folder's current Dropbox contents into one playlist.
 *
 * Upserts by (playlist_id, file_path) so renames of the display name and any
 * hand-set order survive a re-sync, then drops rows for files that have left
 * the folder. Excluded tracks are left alone — they're a deliberate choice.
 */
export async function materialiseFolderTracks(folderId, playlistId, files = null) {
  const folder = await query('SELECT * FROM folder_syncs WHERE id = $1', [folderId]);
  if (folder.rows.length === 0) return 0;

  const entries =
    files ?? (await listAudioFiles(folder.rows[0].dropbox_path, folder.rows[0].include_subfolders));

  await withTransaction(async (client) => {
    for (const [index, file] of entries.entries()) {
      const parsed = parseTrackName(file.name);
      // The DO UPDATE is fenced to folder-owned rows: a hand-picked track
      // (folder_id NULL) that happens to share a file with this folder stays
      // exactly as the admin picked it — never renamed, renumbered or adopted.
      await client.query(
        `INSERT INTO tracks (playlist_id, folder_id, name, file_path, track_number, sort_order, dropbox_modified)
         VALUES ($1, $2, $3, $4, $5, $5, $6)
         ON CONFLICT (playlist_id, file_path) DO UPDATE
           SET name         = EXCLUDED.name,
               folder_id    = EXCLUDED.folder_id,
               track_number = EXCLUDED.track_number,
               updated_at   = now()
           WHERE tracks.folder_id IS NOT NULL`,
        [
          playlistId,
          folderId,
          parsed.name,
          file.path,
          parsed.trackNumber ?? index + 1,
          file.modified ?? null,
        ],
      );
    }

    const paths = entries.map((f) => f.path);

    // Freshness belongs to the Dropbox file, not to how the row got here, so it
    // is written outside the fence above — a hand-picked track sharing one of
    // these files gets an accurate timestamp without its name or order moving.
    await client.query(
      `UPDATE tracks AS t
       SET dropbox_modified = f.modified
       FROM (SELECT unnest($2::text[]) AS path, unnest($3::timestamptz[]) AS modified) AS f
       WHERE t.playlist_id = $1
         AND t.file_path = f.path
         AND t.dropbox_modified IS DISTINCT FROM f.modified`,
      [playlistId, paths, entries.map((f) => f.modified ?? null)],
    );

    const removed = await client.query(
      `DELETE FROM tracks
       WHERE playlist_id = $1 AND folder_id = $2 AND NOT (file_path = ANY($3::text[]))
       RETURNING file_path`,
      [playlistId, folderId, paths],
    );
    for (const row of removed.rows) forget(row.file_path);
  });

  return entries.length;
}

/**
 * Best-effort pull of several folders into one playlist.
 *
 * Returns a human-readable warning rather than throwing: the caller has already
 * committed the playlist, so a Dropbox outage should degrade to "created, not
 * yet populated" instead of a failed request the user can't tell apart from a
 * write that never happened.
 */
export async function fillFromFolders(folderIds, playlistId) {
  const failures = [];
  for (const folderId of folderIds) {
    try {
      await materialiseFolderTracks(folderId, playlistId);
    } catch (err) {
      console.error(`[sync] could not pull folder ${folderId}:`, err.message);
      failures.push(folderId);
    }
  }
  if (failures.length === 0) return null;
  return `Saved, but ${failures.length} folder(s) could not be read from Dropbox just now. Use Sync to retry.`;
}

/** Sync a watched folder into every playlist that draws on it. */
export async function syncFolderById(folderId) {
  const { rows } = await query('SELECT * FROM folder_syncs WHERE id = $1', [folderId]);
  if (rows.length === 0) return null;
  const folder = rows[0];

  await query(
    "UPDATE folder_syncs SET status = 'syncing', updated_at = now() WHERE id = $1",
    [folderId],
  );

  try {
    const files = await listAudioFiles(folder.dropbox_path, folder.include_subfolders);
    const linked = await query(
      'SELECT playlist_id FROM playlist_folders WHERE folder_id = $1',
      [folderId],
    );

    for (const row of linked.rows) {
      await materialiseFolderTracks(folderId, row.playlist_id, files);
    }

    await query(
      `UPDATE folder_syncs
       SET status = 'synced', last_sync_at = now(), last_error = NULL,
           total_files = $2, synced_files = $2, updated_at = now()
       WHERE id = $1`,
      [folderId, files.length],
    );

    return { trackCount: files.length, playlistCount: linked.rowCount };
  } catch (err) {
    await query(
      "UPDATE folder_syncs SET status = 'error', last_error = $2, updated_at = now() WHERE id = $1",
      [folderId, err.message?.slice(0, 500) || 'Sync failed'],
    );
    throw err;
  }
}

/**
 * How long a playlist's folders are left alone after a sync.
 *
 * The public site can trigger this route, so repeat presses have to collapse
 * into a no-op rather than a burst of calls against Dropbox's rate-limited API.
 * Long enough to stop a hammering visitor, short enough that someone who just
 * replaced a file doesn't feel stuck.
 */
export const SYNC_COOLDOWN_MS = 60_000;

/**
 * Re-pull every Dropbox folder backing one playlist.
 *
 * Resolves the folder list server-side rather than trusting the caller, so a
 * client holding a stale playlist record can't sync folders that are no longer
 * linked — or miss ones that are.
 *
 * `{ synced: false, reason: 'cooldown' }` means every folder was synced within
 * SYNC_COOLDOWN_MS and nothing was asked of Dropbox. `reason: 'no-folders'`
 * means the playlist is entirely hand-picked, so there is nothing to sync.
 * Pass `force` to bypass the cooldown for authenticated callers.
 */
export async function syncPlaylistFolders(playlistId, { force = false } = {}) {
  const { rows: folders } = await query(
    `SELECT f.id, f.last_sync_at
     FROM playlist_folders pf
     JOIN folder_syncs f ON f.id = pf.folder_id
     WHERE pf.playlist_id = $1`,
    [playlistId],
  );

  if (folders.length === 0) return { synced: false, reason: 'no-folders', folderCount: 0 };

  const cutoff = Date.now() - SYNC_COOLDOWN_MS;
  const due = force
    ? folders
    : folders.filter((f) => !f.last_sync_at || new Date(f.last_sync_at).getTime() < cutoff);

  if (due.length === 0) {
    return { synced: false, reason: 'cooldown', folderCount: folders.length, retryAfterMs: nextRetry(folders) };
  }

  let trackCount = 0;
  const failures = [];
  for (const folder of due) {
    try {
      const result = await syncFolderById(folder.id);
      trackCount += result?.trackCount ?? 0;
    } catch (err) {
      console.error(`[sync] playlist ${playlistId} folder ${folder.id}:`, err.message);
      failures.push(folder.id);
    }
  }

  // Every folder failing is a real failure the caller should see; a partial
  // failure still refreshed something, so it reports success with a count.
  if (failures.length === due.length) {
    const err = new Error('Could not read from Dropbox just now. Please try again.');
    err.expose = true;
    err.status = 502;
    throw err;
  }

  return { synced: true, folderCount: due.length, trackCount, failedCount: failures.length };
}

/** Milliseconds until the soonest folder leaves the cooldown window. */
function nextRetry(folders) {
  const newest = Math.max(...folders.map((f) => new Date(f.last_sync_at).getTime()));
  return Math.max(0, newest + SYNC_COOLDOWN_MS - Date.now());
}
