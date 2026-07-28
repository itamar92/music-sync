// snake_case rows -> the camelCase shapes in src/types/index.ts.
// The frontend consumes these verbatim, so field names here are load-bearing.

export function formatDuration(totalSeconds) {
  const seconds = Math.max(0, Math.round(Number(totalSeconds) || 0));
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, '0')}`;
}

export function toCollection(row) {
  return {
    id: row.id,
    name: row.name,
    displayName: row.display_name || row.name,
    description: row.description || undefined,
    coverImageUrl: row.cover_image_url || undefined,
    isPublic: row.is_public,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toPlaylist(row) {
  const totalTracks = Number(row.total_tracks ?? 0);
  return {
    id: row.id,
    name: row.name,
    displayName: row.display_name || row.name,
    description: row.description || undefined,
    coverImageUrl: row.cover_image_url || undefined,
    artist: row.artist || undefined,
    folderPath: row.folder_path || undefined,
    collectionId: row.collection_id || undefined,
    type: row.type,
    isPublic: row.is_public,
    sortOrder: row.sort_order,
    totalTracks,
    totalDuration: formatDuration(row.total_duration_seconds ?? 0),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toFolderSync(row) {
  return {
    id: row.id,
    dropboxPath: row.dropbox_path,
    name: row.name,
    displayName: row.display_name || row.name,
    syncFrequency: row.sync_frequency,
    isActive: row.is_active,
    status: row.status,
    lastSyncAt: row.last_sync_at,
    lastError: row.last_error || undefined,
    totalFiles: Number(row.total_files ?? 0),
    syncedFiles: Number(row.synced_files ?? 0),
    // Present when the query joins playlist membership.
    playlistIds: row.playlist_ids || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toTrack(row) {
  const durationSeconds = Number(row.duration_seconds ?? 0);
  return {
    id: row.id,
    name: row.display_name || row.name,
    artist: row.display_artist || row.artist || 'Unknown Artist',
    duration: formatDuration(durationSeconds),
    durationSeconds,
    // The player reads `path`; PlaylistView falls back to `filePath`.
    path: row.file_path,
    filePath: row.file_path,
    trackNumber: row.track_number,
    displayName: row.display_name || undefined,
    displayArtist: row.display_artist || undefined,
    // Admin-only curation state; the public routes never emit excluded rows.
    isExcluded: row.is_excluded ?? false,
    sortOrder: row.sort_order ?? row.track_number,
    folderId: row.folder_id || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
