// API service for communicating with the backend
import { Track, Folder } from '../types';

class ApiService {
  private baseUrl: string;
  private cache = new Map<string, { data: any; timestamp: number; ttl: number }>();

  constructor() {
    // Use Firebase Functions URLs
    this.baseUrl = import.meta.env.VITE_API_BASE_URL || 'https://us-central1-music-sync-99dbb.cloudfunctions.net';
  }

  private getCacheKey(endpoint: string, params?: any): string {
    return `${endpoint}:${JSON.stringify(params || {})}`;
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

  private setCache<T>(key: string, data: T, ttlMinutes: number = 5): void {
    const ttl = ttlMinutes * 60 * 1000;
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    });
  }

  private async makeRequest<T>(endpoint: string, options?: RequestInit): Promise<T> {
    try {
      const url = `${this.baseUrl}${endpoint}`;
      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          ...options?.headers,
        },
        ...options,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'API request failed');
      }

      return result.data;
    } catch (error) {
      console.error(`API Error - ${endpoint}:`, error);
      
      if (error instanceof Error) {
        // Handle specific error types
        if (error.message.includes('Failed to fetch') || error.message.includes('ERR_NETWORK')) {
          throw new Error('Unable to connect to server. Please check if the server is running.');
        }
        throw error;
      }
      
      throw new Error('Unknown API error occurred');
    }
  }

  // Check if the backend service is available and authenticated
  async checkStatus(): Promise<{
    isInitialized: boolean;
    hasToken: boolean;
    serverTime: string;
  }> {
    return this.makeRequest('/apiStatus');
  }

  // List folders
  async listFolders(path: string = ''): Promise<Folder[]> {
    const cacheKey = this.getCacheKey('/listFolders', { path });
    const cached = this.getFromCache<Folder[]>(cacheKey);
    
    if (cached) {
      return cached;
    }

    const endpoint = `/listFolders${path ? `?path=${encodeURIComponent(path)}` : ''}`;
    const folders = await this.makeRequest<Folder[]>(endpoint);
    
    // Cache for 10 minutes
    this.setCache(cacheKey, folders, 10);
    
    return folders;
  }

  // Get tracks from folder
  async getTracksFromFolder(folderPath: string): Promise<Track[]> {
    const cacheKey = this.getCacheKey('/getTracks', { folderPath });
    const cached = this.getFromCache<Track[]>(cacheKey);
    
    if (cached) {
      return cached;
    }

    const tracks = await this.makeRequest<Track[]>(`/getTracks?path=${encodeURIComponent(folderPath)}`);
    
    // Cache for 20 minutes
    this.setCache(cacheKey, tracks, 20);
    
    return tracks;
  }

  // Get folder details (track count, has subfolders)
  async getFolderDetails(folderPath: string): Promise<{trackCount: number, hasSubfolders: boolean}> {
    // For now, we'll implement this by getting tracks and checking for subfolders
    const tracks = await this.getTracksFromFolder(folderPath);
    const folders = await this.listFolders(folderPath);
    
    return {
      trackCount: tracks.length,
      hasSubfolders: folders.length > 0
    };
  }

  // Get file stream URL
  async getFileStreamUrl(filePath: string): Promise<string> {
    const result = await this.makeRequest<{streamUrl: string}>(`/getStreamUrl?path=${encodeURIComponent(filePath)}`);
    return result.streamUrl;
  }

  // Clear cache
  clearCache(): void {
    this.cache.clear();
  }

  // Get cache stats
  getCacheStats() {
    const now = Date.now();
    const entries = Array.from(this.cache.entries());
    const validEntries = entries.filter(([_, cached]) => now <= cached.timestamp + cached.ttl);
    const expiredEntries = entries.length - validEntries.length;
    
    return {
      total: entries.length,
      valid: validEntries.length,
      expired: expiredEntries,
      size: Math.round(JSON.stringify(entries).length / 1024) + 'KB'
    };
  }

  // Set base URL (useful for different environments)
  setBaseUrl(url: string): void {
    this.baseUrl = url;
  }

  getBaseUrl(): string {
    return this.baseUrl;
  }
}

export const apiService = new ApiService();