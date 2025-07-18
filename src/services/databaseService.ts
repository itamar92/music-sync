// src/services/databaseService.ts
import { db } from './firebase';
import { collection, addDoc, getDocs, doc, getDoc, updateDoc, deleteDoc, query, where, writeBatch, Timestamp } from 'firebase/firestore';
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
  streamUrl?: string;
  streamUrlExpiresAt?: Date;
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
  
  // Track caching methods
  getCachedTracks(userId: string, folderId: string): Promise<TrackEntity[]>;
  saveCachedTracks(userId: string, folderId: string, tracks: Track[]): Promise<TrackEntity[]>;
  updateTrackStreamUrl(userId: string, trackId: string, streamUrl: string): Promise<void>;
  getTrackStreamUrl(userId: string, trackId: string): Promise<string | null>;
  invalidateExpiredStreamUrls(): Promise<void>;
  cleanupInactiveTracks(): Promise<void>;
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

  // Track caching implementations
  async getCachedTracks(userId: string, folderId: string): Promise<TrackEntity[]> {
    try {
      const tracksQuery = query(
        collection(db, 'tracks'),
        where('userId', '==', userId),
        where('folderId', '==', folderId),
        where('isActive', '==', true)
      );
      
      const querySnapshot = await getDocs(tracksQuery);
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
        updatedAt: doc.data().updatedAt?.toDate() || new Date(),
        streamUrlExpiresAt: doc.data().streamUrlExpiresAt?.toDate()
      })) as TrackEntity[];
    } catch (error) {
      console.error('Error getting cached tracks:', error);
      return [];
    }
  }

  async saveCachedTracks(userId: string, folderId: string, tracks: Track[]): Promise<TrackEntity[]> {
    try {
      const batch = writeBatch(db);
      const savedTracks: TrackEntity[] = [];
      
      // First, get existing tracks for this folder and mark them as inactive
      const existingTracksQuery = query(
        collection(db, 'tracks'),
        where('userId', '==', userId),
        where('folderId', '==', folderId)
      );
      const existingSnapshot = await getDocs(existingTracksQuery);
      
      // Mark existing tracks as inactive
      existingSnapshot.docs.forEach(doc => {
        batch.update(doc.ref, { isActive: false });
      });
      
      // Add new tracks
      for (const track of tracks) {
        const trackRef = doc(collection(db, 'tracks'));
        const trackEntity: Omit<TrackEntity, 'id'> = {
          userId,
          name: track.name,
          artist: track.artist,
          duration: track.duration,
          durationSeconds: track.durationSeconds || 0,
          filePath: track.path || '',
          folderId,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date()
        };
        
        batch.set(trackRef, {
          ...trackEntity,
          createdAt: Timestamp.fromDate(trackEntity.createdAt),
          updatedAt: Timestamp.fromDate(trackEntity.updatedAt)
        });
        
        savedTracks.push({
          id: trackRef.id,
          ...trackEntity
        });
      }
      
      await batch.commit();
      return savedTracks;
    } catch (error) {
      console.error('Error saving cached tracks:', error);
      throw error;
    }
  }

  async updateTrackStreamUrl(userId: string, trackId: string, streamUrl: string): Promise<void> {
    try {
      const trackRef = doc(db, 'tracks', trackId);
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 4); // Dropbox URLs expire after 4 hours
      
      await updateDoc(trackRef, {
        streamUrl,
        streamUrlExpiresAt: Timestamp.fromDate(expiresAt),
        updatedAt: Timestamp.fromDate(new Date())
      });
    } catch (error) {
      console.error('Error updating track stream URL:', error);
      throw error;
    }
  }

  async getTrackStreamUrl(userId: string, trackId: string): Promise<string | null> {
    try {
      const trackDoc = await getDoc(doc(db, 'tracks', trackId));
      if (!trackDoc.exists()) {
        return null;
      }
      
      const data = trackDoc.data();
      const streamUrl = data.streamUrl;
      const expiresAt = data.streamUrlExpiresAt?.toDate();
      
      // Check if URL is expired
      if (!streamUrl || !expiresAt || new Date() > expiresAt) {
        return null;
      }
      
      return streamUrl;
    } catch (error) {
      console.error('Error getting track stream URL:', error);
      return null;
    }
  }

  async invalidateExpiredStreamUrls(): Promise<void> {
    try {
      const expiredQuery = query(
        collection(db, 'tracks'),
        where('streamUrlExpiresAt', '<', Timestamp.now())
      );
      
      const snapshot = await getDocs(expiredQuery);
      const batch = writeBatch(db);
      
      snapshot.docs.forEach(doc => {
        batch.update(doc.ref, {
          streamUrl: null,
          streamUrlExpiresAt: null
        });
      });
      
      await batch.commit();
    } catch (error) {
      console.error('Error invalidating expired stream URLs:', error);
    }
  }

  async cleanupInactiveTracks(): Promise<void> {
    try {
      // Delete tracks that have been inactive for more than 24 hours
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      
      const inactiveQuery = query(
        collection(db, 'tracks'),
        where('isActive', '==', false),
        where('updatedAt', '<', Timestamp.fromDate(yesterday))
      );
      
      const snapshot = await getDocs(inactiveQuery);
      const batch = writeBatch(db);
      
      snapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });
      
      await batch.commit();
      console.log(`Cleaned up ${snapshot.size} inactive tracks`);
    } catch (error) {
      console.error('Error cleaning up inactive tracks:', error);
    }
  }
}

export const databaseService = new DatabaseServiceImpl();
