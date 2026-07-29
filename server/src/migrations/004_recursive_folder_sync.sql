-- A watched folder may include its subfolders' audio files.
--
-- Off by default, so every existing folder keeps its current behaviour
-- (direct children only) until the admin opts in from the studio.
ALTER TABLE folder_syncs ADD COLUMN IF NOT EXISTS include_subfolders boolean NOT NULL DEFAULT false;
