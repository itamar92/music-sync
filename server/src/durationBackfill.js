// The sweep that fills in missing track durations.
//
// Runs on startup and after every sync, so "all the tracks that are already
// here" and "the ones this sync just added" are the same code path. Everything
// it touches is bookkeeping added by migration 007; the measurement itself
// lives in audioDuration.js.
import { probeDuration } from './audioDuration.js';
import { query } from './db.js';
import { isConfigured } from './dropbox.js';

/** Dropbox rate-limits hard, and this is always background work. */
const CONCURRENCY = 3;
/** A file that fails this many times is left to the client-reported fallback. */
const MAX_ATTEMPTS = 3;
const BATCH_SIZE = 100;
/** Backstop against a bug turning the batch loop into a spin. */
const MAX_BATCHES = 200;

const CANDIDATES = `
  SELECT id, file_path
  FROM tracks
  WHERE duration_seconds = 0
    AND is_excluded = false
    AND duration_probe_attempts < $1
    AND (duration_probed_at IS NULL OR duration_probed_at < $2)
  ORDER BY updated_at DESC
  LIMIT $3
`;

let inFlight = null;
/** Set when a trigger arrives mid-run; rows it meant to cover may post-date it. */
let rerunQueued = false;

/** Tracks still showing 0:00, split by whether the sweep has given up on them. */
export async function durationBackfillStatus() {
  const { rows } = await query(
    `SELECT
       COUNT(*) FILTER (WHERE duration_probe_attempts <  $1) AS pending,
       COUNT(*) FILTER (WHERE duration_probe_attempts >= $1) AS unreadable
     FROM tracks
     WHERE duration_seconds = 0 AND is_excluded = false`,
    [MAX_ATTEMPTS],
  );
  return {
    pending: Number(rows[0].pending),
    unreadable: Number(rows[0].unreadable),
    running: inFlight !== null,
  };
}

async function fill(track) {
  const seconds = await probeDuration(track.file_path);
  if (seconds === null) throw new Error('no duration in file');

  // Guarded on duration_seconds = 0 so a value a listener's browser reported
  // while this probe was in flight wins — it came from a real decoder.
  await query(
    `UPDATE tracks
     SET duration_seconds = $2, duration_probed_at = now(), updated_at = now()
     WHERE id = $1 AND duration_seconds = 0`,
    [track.id, seconds],
  );
}

async function markFailed(track) {
  await query(
    `UPDATE tracks
     SET duration_probe_attempts = duration_probe_attempts + 1, duration_probed_at = now()
     WHERE id = $1`,
    [track.id],
  );
}

async function run({ retryUnreadable }) {
  if (!isConfigured()) return { skipped: 'dropbox-not-configured', filled: 0, failed: 0 };

  // An explicit retry is the only thing that revives rows the sweep gave up on;
  // automatic runs must never reopen them or a permanently unreadable file
  // would cost three Dropbox round-trips on every sync forever.
  if (retryUnreadable) {
    await query(
      `UPDATE tracks SET duration_probe_attempts = 0, duration_probed_at = NULL
       WHERE duration_seconds = 0 AND is_excluded = false AND duration_probe_attempts > 0`,
    );
  }

  // Fixed at the top of the run: every row this run touches gets a later
  // duration_probed_at, which is what keeps the batch loop moving forward.
  const startedAt = new Date();
  let filled = 0;
  let failed = 0;

  for (let batch = 0; batch < MAX_BATCHES; batch++) {
    const { rows } = await query(CANDIDATES, [MAX_ATTEMPTS, startedAt, BATCH_SIZE]);
    if (rows.length === 0) break;

    const queue = [...rows];
    const worker = async () => {
      while (queue.length > 0) {
        const track = queue.shift();
        try {
          await fill(track);
          filled += 1;
        } catch (err) {
          failed += 1;
          console.warn(`[duration] could not measure ${track.file_path}: ${err.message}`);
          await markFailed(track).catch((dbErr) => {
            console.error('[duration] failed to record attempt:', dbErr.message);
          });
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, rows.length) }, worker));
  }

  return { filled, failed };
}

/**
 * Measure every track that still has no duration.
 *
 * Single-flight: overlapping callers share one run rather than sending
 * concurrent fleets of requests at Dropbox. A trigger that arrives mid-run
 * queues one more pass, because rows written after the running sweep read its
 * last batch would otherwise be missed until the next restart.
 */
export function backfillDurations({ retryUnreadable = false } = {}) {
  if (inFlight) {
    rerunQueued = true;
    return inFlight;
  }
  inFlight = run({ retryUnreadable })
    .catch((err) => {
      console.error('[duration] sweep failed:', err.message);
      return { filled: 0, failed: 0, error: err.message };
    })
    .finally(() => {
      inFlight = null;
      if (rerunQueued) {
        rerunQueued = false;
        backfillDurations();
      }
    });
  return inFlight;
}

/**
 * Fire-and-forget entry point for callers that must not wait — a sync route
 * answers as soon as the tracks exist, and their durations land shortly after.
 */
export function scheduleDurationBackfill(reason) {
  backfillDurations().then((result) => {
    if (result?.filled || result?.failed) {
      console.log(`[duration] ${reason}: filled ${result.filled}, failed ${result.failed}`);
    }
  });
}
