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
  isActive?: boolean;
  createdBy?: User;
  createdAt?: string;
  updatedAt?: string;
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
