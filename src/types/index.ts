export interface Track {
  id: string;
  name: string;
  artist: string;
  duration: string;
  durationSeconds: number;
  path?: string;
  folderId?: string;
  url?: string;
  // Aliases for custom names (stored locally)
  displayName?: string;
  displayArtist?: string;
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
}

export interface Playlist {
  id: string;
  name: string;
  tracks: Track[];
  createdAt: string;
  type: 'folder' | 'custom';
  folderId?: string;
  // Custom display name (stored locally)
  displayName?: string;
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

export type ViewState = 'folders' | 'playlist' | 'connecting';