// Future database service for when the app is connected to a backend
// This service will replace localStorage with proper database operations

import { Track, Playlist, Folder } from '../types';

// Database entity interfaces (future implementation)
export interface UserEntity {
  id: string;
  email: string;
  dropboxUserId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface PlaylistEntity {
  id: string;
  userId: string;
  name: string;
  displayName?: string;
  folderId: string;
  folderPath: string;
  type: 'folder' | 'custom';
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface TrackEntity {
  id: string;
  userId: string;
  name: string;
  displayName?: string;
  artist: string;
  displayArtist?: string;
  duration: string;
  durationSeconds: number;
  filePath: string;
  folderId: string;
  playlistId?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface FolderSyncEntity {
  id: string;
  userId: string;
  folderId: string;
  folderPath: string;
  folderName: string;
  displayName?: string;
  isActive: boolean;
  lastSyncAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

// Future database service interface
export interface DatabaseService {
  // User management
  createUser(email: string, dropboxUserId: string): Promise<UserEntity>;
  getUser(userId: string): Promise<UserEntity | null>;
  updateUser(userId: string, updates: Partial<UserEntity>): Promise<UserEntity>;

  // Folder sync management
  syncFolder(userId: string, folder: Folder): Promise<FolderSyncEntity>;
  unsyncFolder(userId: string, folderId: string): Promise<boolean>;
  getSyncedFolders(userId: string): Promise<FolderSyncEntity[]>;
  updateFolderDisplayName(userId: string, folderId: string, displayName: string): Promise<FolderSyncEntity>;

  // Playlist management
  createPlaylist(userId: string, playlist: Playlist): Promise<PlaylistEntity>;
  getPlaylist(userId: string, playlistId: string): Promise<PlaylistEntity | null>;
  getUserPlaylists(userId: string): Promise<PlaylistEntity[]>;
  updatePlaylistDisplayName(userId: string, playlistId: string, displayName: string): Promise<PlaylistEntity>;
  deletePlaylist(userId: string, playlistId: string): Promise<boolean>;

  // Track management
  createTrack(userId: string, track: Track): Promise<TrackEntity>;
  getTrack(userId: string, trackId: string): Promise<TrackEntity | null>;
  getPlaylistTracks(userId: string, playlistId: string): Promise<TrackEntity[]>;
  updateTrackAlias(userId: string, trackId: string, displayName?: string, displayArtist?: string): Promise<TrackEntity>;
  deleteTrack(userId: string, trackId: string): Promise<boolean>;

  // Sync operations
  syncPlaylistTracks(userId: string, playlistId: string, tracks: Track[]): Promise<TrackEntity[]>;
  getLastSyncTime(userId: string, folderId: string): Promise<Date | null>;
  updateLastSyncTime(userId: string, folderId: string): Promise<void>;
}

// Migration helper functions for moving from localStorage to database
export class MigrationService {
  static async migrateLocalStorageToDatabase(userId: string, databaseService: DatabaseService): Promise<void> {
    try {
      // Migrate synced folders
      const syncedFolders = localStorage.getItem('synced_folders');
      if (syncedFolders) {
        const folderIds = JSON.parse(syncedFolders) as string[];
        console.log(`Migrating ${folderIds.length} synced folders for user ${userId}`);
        // Implementation would iterate through folders and sync them
      }

      // Migrate track aliases
      const trackAliases = localStorage.getItem('track_aliases');
      if (trackAliases) {
        const aliases = JSON.parse(trackAliases);
        console.log(`Migrating ${aliases.length} track aliases for user ${userId}`);
        // Implementation would update track aliases in database
      }

      // Migrate playlist aliases
      const playlistAliases = localStorage.getItem('playlist_aliases');
      if (playlistAliases) {
        const aliases = JSON.parse(playlistAliases);
        console.log(`Migrating ${aliases.length} playlist aliases for user ${userId}`);
        // Implementation would update playlist display names in database
      }

      // Migrate custom playlists
      const customPlaylists = localStorage.getItem('custom_playlists');
      if (customPlaylists) {
        const playlists = JSON.parse(customPlaylists) as Playlist[];
        console.log(`Migrating ${playlists.length} custom playlists for user ${userId}`);
        // Implementation would create playlists in database
      }

      console.log('Migration completed successfully');
    } catch (error) {
      console.error('Migration failed:', error);
      throw error;
    }
  }

  static async clearLocalStorage(): Promise<void> {
    // Clear all localStorage data after successful migration
    localStorage.removeItem('synced_folders');
    localStorage.removeItem('track_aliases');
    localStorage.removeItem('playlist_aliases');
    localStorage.removeItem('custom_playlists');
    localStorage.removeItem('dropbox_access_token');
    console.log('Local storage cleared after migration');
  }
}

// Future implementation placeholder
export class DatabaseServiceImpl implements DatabaseService {
  private baseUrl: string;
  private apiKey: string;

  constructor(baseUrl: string, apiKey: string) {
    this.baseUrl = baseUrl;
    this.apiKey = apiKey;
  }

  // All methods would be implemented to make API calls to the backend
  async createUser(email: string, dropboxUserId: string): Promise<UserEntity> {
    throw new Error('Database service not implemented yet');
  }

  async getUser(userId: string): Promise<UserEntity | null> {
    throw new Error('Database service not implemented yet');
  }

  async updateUser(userId: string, updates: Partial<UserEntity>): Promise<UserEntity> {
    throw new Error('Database service not implemented yet');
  }

  async syncFolder(userId: string, folder: Folder): Promise<FolderSyncEntity> {
    throw new Error('Database service not implemented yet');
  }

  async unsyncFolder(userId: string, folderId: string): Promise<boolean> {
    throw new Error('Database service not implemented yet');
  }

  async getSyncedFolders(userId: string): Promise<FolderSyncEntity[]> {
    throw new Error('Database service not implemented yet');
  }

  async updateFolderDisplayName(userId: string, folderId: string, displayName: string): Promise<FolderSyncEntity> {
    throw new Error('Database service not implemented yet');
  }

  async createPlaylist(userId: string, playlist: Playlist): Promise<PlaylistEntity> {
    throw new Error('Database service not implemented yet');
  }

  async getPlaylist(userId: string, playlistId: string): Promise<PlaylistEntity | null> {
    throw new Error('Database service not implemented yet');
  }

  async getUserPlaylists(userId: string): Promise<PlaylistEntity[]> {
    throw new Error('Database service not implemented yet');
  }

  async updatePlaylistDisplayName(userId: string, playlistId: string, displayName: string): Promise<PlaylistEntity> {
    throw new Error('Database service not implemented yet');
  }

  async deletePlaylist(userId: string, playlistId: string): Promise<boolean> {
    throw new Error('Database service not implemented yet');
  }

  async createTrack(userId: string, track: Track): Promise<TrackEntity> {
    throw new Error('Database service not implemented yet');
  }

  async getTrack(userId: string, trackId: string): Promise<TrackEntity | null> {
    throw new Error('Database service not implemented yet');
  }

  async getPlaylistTracks(userId: string, playlistId: string): Promise<TrackEntity[]> {
    throw new Error('Database service not implemented yet');
  }

  async updateTrackAlias(userId: string, trackId: string, displayName?: string, displayArtist?: string): Promise<TrackEntity> {
    throw new Error('Database service not implemented yet');
  }

  async deleteTrack(userId: string, trackId: string): Promise<boolean> {
    throw new Error('Database service not implemented yet');
  }

  async syncPlaylistTracks(userId: string, playlistId: string, tracks: Track[]): Promise<TrackEntity[]> {
    throw new Error('Database service not implemented yet');
  }

  async getLastSyncTime(userId: string, folderId: string): Promise<Date | null> {
    throw new Error('Database service not implemented yet');
  }

  async updateLastSyncTime(userId: string, folderId: string): Promise<void> {
    throw new Error('Database service not implemented yet');
  }
}