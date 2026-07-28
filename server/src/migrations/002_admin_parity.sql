-- Admin parity with the Firebase dashboard.
--
-- Three additions, all backward compatible:
--   1. folder_syncs   — watched Dropbox folders as first-class records, so the
--                       studio can show sync frequency, status and last pull
--                       rather than treating a folder as a one-shot import.
--   2. playlist_folders — a playlist may draw on several folders (the Firebase
--                       model). playlists.folder_path is kept and still unique,
--                       so the existing "sync a folder into a playlist"
--                       shortcut keeps working untouched.
--   3. tracks.is_excluded / sort_order — hide a track from a playlist without
--                       deleting it (a re-sync would only bring it back), and
--                       remember a hand-picked order.
--
-- Nothing is dropped or rewritten, so rolling back is redeploying the previous
-- image; the new columns and tables simply stop being read.

-- 1. Watched folders -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS folder_syncs (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dropbox_path   text NOT NULL UNIQUE,
  name           text NOT NULL,
  display_name   text,
  sync_frequency text NOT NULL DEFAULT 'manual',
  is_active      boolean NOT NULL DEFAULT true,
  -- pending | syncing | synced | error
  status         text NOT NULL DEFAULT 'pending',
  last_sync_at   timestamptz,
  last_error     text,
  total_files    integer NOT NULL DEFAULT 0,
  synced_files   integer NOT NULL DEFAULT 0,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

-- 2. Playlist <-> folder membership --------------------------------------------
CREATE TABLE IF NOT EXISTS playlist_folders (
  playlist_id uuid NOT NULL REFERENCES playlists(id)    ON DELETE CASCADE,
  folder_id   uuid NOT NULL REFERENCES folder_syncs(id) ON DELETE CASCADE,
  sort_order  integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (playlist_id, folder_id)
);

CREATE INDEX IF NOT EXISTS playlist_folders_folder_idx ON playlist_folders (folder_id);

-- 3. Playlist artist, matching the Firebase document shape.
ALTER TABLE playlists ADD COLUMN IF NOT EXISTS artist text;

-- 4. Per-track curation ---------------------------------------------------------
ALTER TABLE tracks ADD COLUMN IF NOT EXISTS is_excluded boolean NOT NULL DEFAULT false;
ALTER TABLE tracks ADD COLUMN IF NOT EXISTS sort_order  integer;

-- Which folder a track came from, so removing a folder from a playlist can drop
-- exactly its tracks. Null for rows that predate this migration.
ALTER TABLE tracks ADD COLUMN IF NOT EXISTS folder_id uuid REFERENCES folder_syncs(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS tracks_folder_idx ON tracks (folder_id);
-- Listing a playlist filters excluded rows and orders by the manual sequence.
CREATE INDEX IF NOT EXISTS tracks_playlist_order_idx
  ON tracks (playlist_id, is_excluded, sort_order, track_number);

-- Backfill ----------------------------------------------------------------------
-- Every playlist that already mirrors a Dropbox folder becomes a watched folder,
-- joined to that playlist, with its tracks attributed to it. Existing deployments
-- come out of this migration looking exactly as they did, only now editable.

INSERT INTO folder_syncs (dropbox_path, name, display_name, status, last_sync_at, total_files, synced_files)
SELECT p.folder_path,
       COALESCE(NULLIF(regexp_replace(p.folder_path, '^.*/', ''), ''), p.name),
       p.display_name,
       'synced',
       p.updated_at,
       (SELECT COUNT(*) FROM tracks t WHERE t.playlist_id = p.id),
       (SELECT COUNT(*) FROM tracks t WHERE t.playlist_id = p.id)
FROM playlists p
WHERE p.folder_path IS NOT NULL
ON CONFLICT (dropbox_path) DO NOTHING;

INSERT INTO playlist_folders (playlist_id, folder_id)
SELECT p.id, f.id
FROM playlists p
JOIN folder_syncs f ON f.dropbox_path = p.folder_path
WHERE p.folder_path IS NOT NULL
ON CONFLICT (playlist_id, folder_id) DO NOTHING;

UPDATE tracks t
SET folder_id = f.id
FROM playlists p
JOIN folder_syncs f ON f.dropbox_path = p.folder_path
WHERE t.playlist_id = p.id
  AND t.folder_id IS NULL
  AND p.folder_path IS NOT NULL;

-- Seed the manual order from the order tracks already display in.
UPDATE tracks SET sort_order = track_number WHERE sort_order IS NULL;
