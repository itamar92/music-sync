# Track-level playlist building + Hebrew name support (container mode)

Date: 2026-08-02 · Branch: `feat/track-picker-playlists` · Approved by Itamar

## Problem

1. **Hebrew names disappear.** `parseTrackName` in `server/src/routes/admin.js`
   splits filenames on `" - "` and treats the left side as an *artist*, which the
   UI never displays. `"שיר - Finale.mp3"` therefore shows as just "Finale".
2. **Playlists can only be built from whole folders.** There is no way to pick
   individual songs — neither from a synced folder nor directly from Dropbox.

Scope: container/server mode only. Firebase mode is untouched (feature hidden
via capability flag).

## Design

### 1. Hebrew / name parsing

- `parseTrackName` no longer guesses an artist. Track name = filename minus
  extension minus a leading `"01 -"`-style track number. All scripts preserved.
  Artist remains a playlist-level, manually editable field.
- Migration `005_track_names.sql` re-derives `tracks.name` from `file_path`
  (basename → strip extension → strip leading track number) and clears the
  parser-derived `artist` column. Manual `display_name` / `display_artist`
  overrides are separate columns and stay untouched.
- Track/playlist name elements get `dir="auto"` (admin studio PlaylistView,
  shared PlaylistView, GlobalAudioPlayer, FolderSyncManagement) so RTL names
  render with correct direction.

### 2. Picked tracks — data model & API

A picked track is a normal `tracks` row with `folder_id = NULL`. No schema
change needed: `folder_id` is already nullable and `UNIQUE (playlist_id,
file_path)` already exists. Folder sync (`materialiseFolderTracks`) only
touches rows carrying its own `folder_id`, so picks are static — never added,
updated or removed by a sync.

- `POST /api/admin/playlists/:id/tracks` — body `{ files: [{ path, name? }] }`.
  Inserts picks with `folder_id NULL`, appended to the end of the sort order,
  `ON CONFLICT (playlist_id, file_path) DO NOTHING`. Returns the refreshed
  playlist (with new totals).
- `POST /api/admin/playlists` — accepts optional `tracks` array alongside
  `folderIds`, so a playlist can be created from picks in one request.
- `DELETE /playlists/:playlistId/tracks/:trackId` — hard-deletes when
  `folder_id IS NULL` (nothing can resurrect a pick); keeps the existing
  `is_excluded` soft-hide for folder-synced tracks.
- Streaming: unchanged — public stream endpoints already serve any track that
  belongs to a public playlist.
- Accepted edge case: picking a song, then attaching its parent folder to the
  same playlist, lets the sync adopt the row (no duplicates thanks to the
  unique constraint).

### 3. Picker UI

`CreatePlaylistModal` and `EditPlaylistModal` gain a **Tracks** tab beside the
Folders tab:

- Browse Dropbox from the root using the existing `browseDropbox` +
  `previewFolderFiles` admin endpoints; synced folders offered as shortcuts.
- Checkbox per audio file, selection count, selections may span folders.
- Folder attachments and individual picks coexist in one playlist.
- New `AdminCapabilities.trackPicking` flag (`true` server / `false` Firebase)
  hides the tab in legacy mode. New contract method
  `addTracks(playlistId, files)`; `PlaylistInput.tracks?` for creation.

## Verification

`npm run typecheck`, `npm run lint` (repo has no test suite per CLAUDE.md),
plus a manual studio pass against the local Docker stack.
