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
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
