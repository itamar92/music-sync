export interface Track {
  id: string;
  name: string;
  artist: string;
  duration: string;
  durationSeconds: number;
  path?: string;
  folderId?: string;
  url?: string;
  // Aliases for custom names (stored locally or in db)
  displayName?: string;
  displayArtist?: string;
}

export interface Folder {
  id: string;
  name:string;
  path: string;
  trackCount: number;
  synced: boolean;
  type?: 'dropbox' | 'custom';
  isFolder?: boolean;
  parentPath?: string;
  hasSubfolders?: boolean;
  // Custom display name (stored locally or in db)
  displayName?: string;
}

export interface Playlist {
  id: string;
  name: string;
  tracks: Track[];
  createdAt: string;
  type: 'folder' | 'custom';
  folderId?: string;
  // Custom display name (stored locally or in db)
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
