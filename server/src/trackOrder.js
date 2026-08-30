// Writing a playlist's hand-set track order.
//
// Lifted out of routes/admin.js so the share route can reorder without
// importing the admin router — the same reason folderSync.js exists.

import { query } from './db.js';

/**
 * How many tracks one reorder may touch.
 *
 * The share route is unauthenticated, so the request body is attacker-controlled
 * and needs a ceiling. Far above any real playlist; it exists to bound the
 * array, not to limit anyone.
 */
export const MAX_TRACK_ORDER = 5000;

/**
 * Lay `trackIds` out as positions 1..n on one playlist.
 *
 * A single statement rather than one UPDATE per track: the ids come off the
 * wire, so a long list must cost one round trip, not hundreds. `playlist_id` in
 * the WHERE clause is the fence — ids belonging to another playlist match
 * nothing and are silently ignored, so a caller cannot reach outside the
 * playlist it was allowed to reorder, and cannot drag a track between playlists.
 *
 * Positions are assigned from the caller's array order, so ids that don't
 * resolve still consume a slot. That keeps the surviving rows in the order the
 * caller asked for, with gaps, instead of silently resequencing around a track
 * someone else deleted mid-drag.
 *
 * Returns how many rows actually moved.
 */
export async function setTrackOrder(playlistId, trackIds) {
  if (trackIds.length === 0) return 0;

  const { rowCount } = await query(
    `UPDATE tracks AS t
     SET sort_order = o.position, updated_at = now()
     FROM unnest($2::uuid[]) WITH ORDINALITY AS o(id, position)
     WHERE t.id = o.id AND t.playlist_id = $1`,
    [playlistId, trackIds],
  );

  return rowCount;
}

/**
 * The `trackIds` a reorder request carries, or null when the body is unusable.
 *
 * Non-uuid strings are rejected here rather than left to Postgres, where they
 * would abort the statement as a cast error — a 400 is the honest answer to a
 * malformed id, and it keeps a bad request from reading as a server fault.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function parseTrackIds(body) {
  const trackIds = Array.isArray(body?.trackIds) ? body.trackIds : null;
  if (!trackIds || trackIds.length > MAX_TRACK_ORDER) return null;
  if (!trackIds.every((id) => typeof id === 'string' && UUID.test(id))) return null;
  return trackIds;
}
