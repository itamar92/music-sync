# Track freshness — show when a synced file was updated in Dropbox

Date: 2026-08-02 · Approved by Itamar

## Problem

When a file inside a synced Dropbox folder is replaced with a newer version,
nothing in the app reflects that. The admin (and listeners) cannot tell whether
a track is the latest version. Matching by the *current* filename is not an
option because the admin often renames tracks in the app (`display_name`)
for better presentation — the app's name and the Dropbox name diverge on
purpose.

Scope: container/server mode only. Firebase mode is untouched.

## Decisions (from brainstorming)

- **Audience:** both the admin studio and the public players show freshness.
- **Indicator lifecycle:** time window — a track counts as "recently updated"
  while its Dropbox `server_modified` is within the last **7 days**; it clears
  itself, no acknowledge step.
- Both of the admin's original ideas ship, since they share one data source:
  an ⓘ info affordance showing the exact last-modified date, and a small
  green dot ("LED") on recently updated tracks.

## Design

### Data source

`listAudioFiles` in `server/src/dropbox.js` already returns each file's
Dropbox `server_modified` as `modified`; sync currently discards it. Tracks
are keyed by `(playlist_id, file_path)`, so storing the timestamp is fully
independent of display names — renames in the app are unaffected.

### Backend

1. **Migration `006_track_freshness.sql`:**
   `ALTER TABLE tracks ADD COLUMN IF NOT EXISTS dropbox_modified timestamptz;`
   Existing rows stay `NULL` until their next sync (renders as "no info", never
   as a false "updated").
2. **`materialiseFolderTracks`** (`server/src/routes/admin.js`): the folder
   upsert also writes `dropbox_modified` from the listing. Because the
   `DO UPDATE` is deliberately fenced to folder-owned rows (protecting
   hand-picked tracks from rename/renumber), a separate statement updates
   *only* `dropbox_modified` by `(playlist_id, file_path)` with no fence, so
   picked tracks that share a file with the folder get a fresh timestamp too
   without their name or order being touched.
3. **Mapper `toTrack`** (`server/src/mappers.js`) exposes
   `dropboxModified` (ISO string or null).
4. **APIs:** admin `GET /playlists/:id/tracks` and the public playlist/track
   endpoints (`server/src/routes/public.js`) include the field via the shared
   mapper. No new endpoints.

### Frontend

5. **Type:** `Track` gains `dropboxModified?: string | null`.
6. **Shared helper + constant:** `RECENTLY_UPDATED_DAYS = 7` and
   `isRecentlyUpdated(track)` live in one shared util so admin and public
   views cannot drift.
7. **Admin studio track list** (`ServerAdminDashboard` playlist view):
   - small green dot next to tracks where `isRecentlyUpdated` is true;
   - ⓘ info icon per track whose tooltip/title shows
     "File updated: <localized date>" whenever `dropboxModified` exists.
8. **Public player track list** (`shared/PlaylistView.tsx`, server-mode path):
   same green dot with a hover title showing the date. Subtle — a dot, not a
   loud badge.

### Edge cases

- `dropbox_modified IS NULL` (pre-migration rows, picks never covered by a
  sync): no icon, no dot.
- File renamed in Dropbox → new `file_path` → new track row (existing
  behavior); it carries a fresh timestamp and naturally shows as updated.
- Clock basis is Dropbox's `server_modified` vs. browser `Date.now()`; a few
  minutes of skew is irrelevant at a 7-day window.

## Testing / verification

- `npm run typecheck` and `npm run lint` must pass.
- Manual: touch/replace a file in a synced Dropbox folder, run manual sync,
  confirm dot + date appear in studio and on the public playlist; confirm a
  track older than 7 days shows the date via ⓘ but no dot.
