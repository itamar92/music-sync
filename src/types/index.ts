export interface User {
  id: string;
  email: string;
  dropboxUserId?: string;
  role: 'admin' | 'user';
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Collection {
  id: string;
  name: string;
  displayName: string;
  description?: string;
  coverImageUrl?: string;
  isPublic: boolean;
  sortOrder: number;
  createdBy?: User;
  createdAt: string;
  updatedAt: string;
}

export interface Track {
  id: string;
  name: string;
  artist: string;
  duration: string;
  durationSeconds: number;
  path?: string;
  folderId?: string;
  url?: string;
  filePath?: string;
  trackNumber?: number;
  playlist?: Playlist;
  // Aliases for custom names (stored locally or in db)
  displayName?: string;
  displayArtist?: string;
  // Curation state, reported by the container backend's admin API.
  isExcluded?: boolean;
  sortOrder?: number;
  /**
   * When Dropbox last modified the underlying file, as of the last sync.
   * Container mode only; null or absent means "no information".
   */
  dropboxModified?: string | null;
  isActive?: boolean;
  createdBy?: User;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Outcome of asking the backend to re-pull a playlist's Dropbox folders.
 *
 * `synced: false` is a success, not a failure: `no-folders` means the playlist
 * is entirely hand-picked, and `cooldown` means the folders were re-read too
 * recently to ask Dropbox again. Container mode only.
 */
export interface PlaylistSyncResult {
  success: boolean;
  synced: boolean;
  reason?: 'no-folders' | 'cooldown';
  folderCount: number;
  trackCount?: number;
  failedCount?: number;
  retryAfterMs?: number;
}

export interface Folder {
  id: string;
  name: string;
  path: string;
  trackCount: number;
  synced: boolean;
  type?: 'dropbox' | 'custom';
  isFolder?: boolean;
  parentPath?: string;
  hasSubfolders?: boolean;
  collection?: Collection;
  // Custom display name (stored locally or in db)
  displayName?: string;
  isActive?: boolean;
  createdBy?: User;
  createdAt?: string;
  updatedAt?: string;
}

export interface Playlist {
  id: string;
  name: string;
  displayName?: string;
  description?: string;
  coverImageUrl?: string;
  tracks?: Track[];
  folderId?: string;
  folderPath?: string;
  collection?: Collection;
  collectionId?: string; // ID reference to collection
  type: 'folder' | 'custom';
  isPublic: boolean;
  sortOrder: number;
  totalTracks: number;
  totalDuration?: string;
  // Custom display name (stored locally or in db)
  isActive?: boolean;
  createdBy?: User;
  createdAt?: string;
  updatedAt?: string;
}

export interface DropboxFile {
  id: string;
  name: string;
  path_lower: string;
  path_display: string;
  size: number;
  server_modified: string;
  is_folder: boolean;
}

export interface AudioPlayerState {
  currentTrack: Track | null;
  currentTrackIndex: number;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
}
