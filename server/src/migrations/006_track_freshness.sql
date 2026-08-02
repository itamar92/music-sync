-- Remember when Dropbox last modified the file behind a track.
--
-- Sync already reads `server_modified` from the Dropbox listing and throws it
-- away; keeping it lets the studio and the players show how fresh a track is.
-- The column is keyed to the row, and rows are keyed by (playlist_id,
-- file_path), so a rename of the *displayed* name never affects it.
--
-- Existing rows stay NULL until their next sync. NULL means "no information",
-- which the UI renders as no indicator at all — never as a false "updated".
ALTER TABLE tracks ADD COLUMN IF NOT EXISTS dropbox_modified timestamptz;
