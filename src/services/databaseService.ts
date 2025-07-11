// src/services/databaseService.ts
import { db } from './firebase';
import { collection, addDoc, getDocs, doc, getDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { Track, Playlist, Folder } from '../types';

// Database entity interfaces
export interface UserEntity {
  id: string;
  email: string;
  dropboxUserId: string;
  role: 'admin' | 'user';
  isActive: boolean;
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

// Database service interface
export interface DatabaseService {
  createUser(email: string, dropboxUserId: string): Promise<UserEntity>;
  getUser(userId: string): Promise<UserEntity | null>;
  updateUser(userId: string, updates: Partial<UserEntity>): Promise<UserEntity>;
  syncFolder(userId: string, folder: Folder): Promise<FolderSyncEntity>;
  unsyncFolder(userId: string, folderId: string): Promise<boolean>;
  getSyncedFolders(userId: string): Promise<FolderSyncEntity[]>;
  updateFolderDisplayName(userId: string, folderId: string, displayName: string): Promise<FolderSyncEntity>;
  createPlaylist(userId: string, playlist: Playlist): Promise<PlaylistEntity>;
  getPlaylist(userId: string, playlistId: string): Promise<PlaylistEntity | null>;
  getUserPlaylists(userId: string): Promise<PlaylistEntity[]>;
  updatePlaylistDisplayName(userId: string, playlistId: string, displayName: string): Promise<PlaylistEntity>;
  deletePlaylist(userId: string, playlistId: string): Promise<boolean>;
  createTrack(userId: string, track: Track): Promise<TrackEntity>;
  getTrack(userId: string, trackId: string): Promise<TrackEntity | null>;
  getPlaylistTracks(userId: string, playlistId: string): Promise<TrackEntity[]>;
  updateTrackAlias(userId: string, trackId: string, displayName?: string, displayArtist?: string): Promise<TrackEntity>;
  deleteTrack(userId: string, trackId: string): Promise<boolean>;
  syncPlaylistTracks(userId: string, playlistId: string, tracks: Track[]): Promise<TrackEntity[]>;
  getLastSyncTime(userId: string, folderId: string): Promise<Date | null>;
  updateLastSyncTime(userId: string, folderId: string): Promise<void>;
}

// Firebase implementation of the database service
class DatabaseServiceImpl implements DatabaseService {
  async createUser(email: string, dropboxUserId: string): Promise<UserEntity> {
    const userRef = await addDoc(collection(db, 'users'), {
      email,
      dropboxUserId,
      role: 'user',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    return { 
      id: userRef.id, 
      email, 
      dropboxUserId, 
      role: 'user', 
      isActive: true, 
      createdAt: new Date(), 
      updatedAt: new Date() 
    };
  }

  async getUser(userId: string): Promise<UserEntity | null> {
    const userDoc = await getDoc(doc(db, 'users', userId));
    if (userDoc.exists()) {
      return { id: userDoc.id, ...userDoc.data() } as UserEntity;
    }
    return null;
  }

  async updateUser(userId: string, updates: Partial<UserEntity>): Promise<UserEntity> {
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, { ...updates, updatedAt: new Date() });
    const updatedDoc = await getDoc(userRef);
    return { id: updatedDoc.id, ...updatedDoc.data() } as UserEntity;
  }

    // All methods would be implemented to make API calls to the backend
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

export const databaseService = new DatabaseServiceImpl();
