import { Collection, Playlist, Track } from '../types';

// This service handles public data access without authentication
class PublicDataService {
  private baseUrl = import.meta.env.VITE_API_BASE_URL || '/api';
  
  // Cache for better performance
  private cache = new Map<string, { data: any; timestamp: number; ttl: number }>();

  private getCacheKey(method: string, params: any): string {
    return `${method}:${JSON.stringify(params)}`;
  }

  private getFromCache<T>(key: string): T | null {
    const cached = this.cache.get(key);
    if (!cached) return null;
    
    const now = Date.now();
    if (now > cached.timestamp + cached.ttl) {
      this.cache.delete(key);
      return null;
    }
    
    return cached.data;
  }

  private setCache<T>(key: string, data: T, ttlMinutes: number = 10): void {
    const ttl = ttlMinutes * 60 * 1000;
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    });
  }

  async getCollections(): Promise<Collection[]> {
    const cacheKey = this.getCacheKey('getCollections', {});
    const cached = this.getFromCache<Collection[]>(cacheKey);
    
    if (cached) {
      return cached;
    }

    try {
      const response = await fetch(`${this.baseUrl}/public/collections`);
      if (!response.ok) {
        throw new Error('Failed to fetch collections');
      }
      
      const data = await response.json();
      this.setCache(cacheKey, data, 15); // Cache for 15 minutes
      return data;
    } catch (error) {
      console.error('Error fetching collections:', error);
      // Return mock data for development
      const mockData: Collection[] = [];
      this.setCache(cacheKey, mockData, 1); // Short cache for mock data
      return mockData;
    }
  }

  async getCollection(collectionId: string): Promise<Collection> {
    const cacheKey = this.getCacheKey('getCollection', { collectionId });
    const cached = this.getFromCache<Collection>(cacheKey);
    
    if (cached) {
      return cached;
    }

    try {
      const response = await fetch(`${this.baseUrl}/public/collections/${collectionId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch collection');
      }
      
      const data = await response.json();
      this.setCache(cacheKey, data, 15);
      return data;
    } catch (error) {
      console.error('Error fetching collection:', error);
      throw error;
    }
  }

  async getPlaylistsByCollection(collectionId: string): Promise<Playlist[]> {
    const cacheKey = this.getCacheKey('getPlaylistsByCollection', { collectionId });
    const cached = this.getFromCache<Playlist[]>(cacheKey);
    
    if (cached) {
      return cached;
    }

    try {
      const response = await fetch(`${this.baseUrl}/public/collections/${collectionId}/playlists`);
      if (!response.ok) {
        throw new Error('Failed to fetch playlists');
      }
      
      const data = await response.json();
      this.setCache(cacheKey, data, 10);
      return data;
    } catch (error) {
      console.error('Error fetching playlists:', error);
      throw error;
    }
  }

  async getPlaylist(playlistId: string): Promise<Playlist> {
    const cacheKey = this.getCacheKey('getPlaylist', { playlistId });
    const cached = this.getFromCache<Playlist>(cacheKey);
    
    if (cached) {
      return cached;
    }

    try {
      const response = await fetch(`${this.baseUrl}/public/playlists/${playlistId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch playlist');
      }
      
      const data = await response.json();
      this.setCache(cacheKey, data, 15);
      return data;
    } catch (error) {
      console.error('Error fetching playlist:', error);
      throw error;
    }
  }

  async getPlaylistTracks(playlistId: string): Promise<Track[]> {
    const cacheKey = this.getCacheKey('getPlaylistTracks', { playlistId });
    const cached = this.getFromCache<Track[]>(cacheKey);
    
    if (cached) {
      return cached;
    }

    try {
      const response = await fetch(`${this.baseUrl}/public/playlists/${playlistId}/tracks`);
      if (!response.ok) {
        throw new Error('Failed to fetch tracks');
      }
      
      const data = await response.json();
      this.setCache(cacheKey, data, 10);
      return data;
    } catch (error) {
      console.error('Error fetching tracks:', error);
      throw error;
    }
  }

  async getTrackStreamUrl(filePath: string): Promise<string> {
    try {
      const response = await fetch(`${this.baseUrl}/public/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ filePath }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to get stream URL');
      }
      
      const data = await response.json();
      return data.streamUrl;
    } catch (error) {
      console.error('Error getting stream URL:', error);
      throw error;
    }
  }

  clearCache(): void {
    this.cache.clear();
  }
}

export const publicDataService = new PublicDataService();