-- Bookkeeping for server-measured track durations.
--
-- Durations used to be learned only from the browser: a listener played a
-- track, the <audio> element reported its length, and the backend stored it.
-- Every track nobody had played yet therefore rendered as "0:00" — which is
-- every track in a folder that was just synced. The backend can now measure a
-- duration itself by reading a few byte ranges of the file (see
-- audioDuration.js), so these columns exist to run that sweep exactly once per
-- track rather than on every pass.
--
-- `duration_probe_attempts` caps retries so a file the parser can't read (an
-- unusual codec, a truncated upload) stops costing a Dropbox round-trip
-- forever. `duration_probed_at` fences a single sweep: a row touched by the
-- current run is skipped by that run's later batches, whether it succeeded
-- or failed.
--
-- Existing rows start at zero attempts and NULL, so the first sweep after this
-- migration fills in every duration the site has been missing.
ALTER TABLE tracks ADD COLUMN IF NOT EXISTS duration_probe_attempts integer NOT NULL DEFAULT 0;
ALTER TABLE tracks ADD COLUMN IF NOT EXISTS duration_probed_at      timestamptz;

-- The sweep's candidate query: unmeasured, still visible, not yet given up on.
CREATE INDEX IF NOT EXISTS tracks_duration_pending_idx
  ON tracks (duration_probe_attempts, updated_at DESC)
  WHERE duration_seconds = 0 AND is_excluded = false;
