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

  /**
   * Backend health, for the public connection indicator.
   * Note: /api/status answers 503 when degraded but still returns a JSON body,
   * so the body is parsed regardless of the status code. Null means the backend
   * could not be reached at all.
   */
  async getServerStatus(): Promise<{ hasToken: boolean; database: boolean } | null> {
    try {
      const response = await fetch(`${this.baseUrl}/status`);
      const data = await response.json();
      return { hasToken: Boolean(data.hasToken), database: Boolean(data.database) };
    } catch (error) {
      console.warn('Backend status check failed:', error);
      return null;
    }
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

  // Stream URLs are cached client-side; the backend caches Dropbox temporary
  // links (~4h validity) so repeat plays and prefetched skips are instant.
  private streamUrlCache = new Map<string, { url: string; expiresAt: number }>();
  private static STREAM_URL_TTL_MS = 3 * 60 * 60 * 1000;

  private getCachedStreamUrl(filePath: string): string | null {
    const hit = this.streamUrlCache.get(filePath);
    if (hit && hit.expiresAt > Date.now()) return hit.url;
    this.streamUrlCache.delete(filePath);
    return null;
  }

  private setCachedStreamUrl(filePath: string, url: string): void {
    this.streamUrlCache.set(filePath, {
      url,
      expiresAt: Date.now() + PublicDataService.STREAM_URL_TTL_MS,
    });
  }

  /**
   * Batch-resolve stream URLs for upcoming tracks so skipping to the next
   * track starts playback immediately. Fire-and-forget friendly.
   */
  async prefetchStreamUrls(filePaths: string[]): Promise<void> {
    const missing = filePaths.filter((p) => p && !this.getCachedStreamUrl(p));
    if (missing.length === 0) return;

    try {
      const response = await fetch(`${this.baseUrl}/public/streams`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePaths: missing.slice(0, 25) }),
      });
      if (!response.ok) return;

      const data = await response.json();
      for (const [path, url] of Object.entries<string | null>(data.urls || {})) {
        if (url) this.setCachedStreamUrl(path, url);
      }
    } catch (error) {
      console.warn('Stream URL prefetch failed (non-fatal):', error);
    }
  }

  async getTrackStreamUrl(filePath: string): Promise<string> {
    const cached = this.getCachedStreamUrl(filePath);
    if (cached) return cached;

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
      this.setCachedStreamUrl(filePath, data.streamUrl);
      return data.streamUrl;
    } catch (error) {
      console.error('Error getting stream URL:', error);
      throw error;
    }
  }

  // Tracks whose duration this session has already reported, so a repeat play
  // doesn't repeat the request.
  private reportedDurations = new Set<string>();

  /**
   * Tell the backend how long a track actually is.
   *
   * The server hands out Dropbox links but never reads the audio, so it can't
   * know a duration at sync time without downloading and parsing every file.
   * The player learns the exact figure from the <audio> element on first load,
   * so it reports it once and everyone after that sees a real time instead of
   * 0:00. Fire-and-forget: the backend ignores anything it already knows, and a
   * failure here must never disturb playback.
   */
  async reportTrackDuration(trackId: string, durationSeconds: number): Promise<void> {
    if (!trackId || this.reportedDurations.has(trackId)) return;
    if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) return;

    this.reportedDurations.add(trackId);
    try {
      await fetch(`${this.baseUrl}/public/tracks/${trackId}/duration`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ durationSeconds: Math.round(durationSeconds) }),
      });
    } catch (error) {
      console.warn('Duration report failed (non-fatal):', error);
    }
  }

  clearCache(): void {
    this.cache.clear();
  }
}

export const publicDataService = new PublicDataService();