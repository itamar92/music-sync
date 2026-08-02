-- Heal track names that lost text to the old artist-guessing parser.
--
-- The old sync split filenames on " - " and stored the left side as an
-- artist the UI never shows, so "שיר - Finale.mp3" displayed as "Finale".
-- The parser no longer does this; re-derive every parser-owned name from
-- the file path (basename, minus extension, minus a leading track number).
-- Manual renames live in display_name / display_artist and are untouched.
UPDATE tracks
SET name = COALESCE(
      NULLIF(
        regexp_replace(
          regexp_replace(
            regexp_replace(file_path, '^.*/', ''),
            '\.[^.]+$', ''),
          '^\d{1,3}\s*[-._)]\s*', ''),
        ''),
      name),
    artist = NULL,
    updated_at = now();
