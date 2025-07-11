import { Dropbox, DropboxAuth, files } from 'dropbox';
import { Track, Folder } from '../types';
import { apiService } from './apiService';

class DropboxService {
  private dbx: Dropbox | null = null;
  private dbxAuth: DropboxAuth | null = null;
  private accessToken: string | null = null;
  private requestQueue: Array<() => Promise<any>> = [];
  private isProcessingQueue = false;
  private lastRequestTime = 0;
  private minRequestInterval = 100; // Minimum 100ms between requests
  private cache = new Map<string, { data: any; timestamp: number; ttl: number }>();
  private maxRetries = 3;
  private useServerApi = import.meta.env.VITE_USE_SERVER_API === 'true' || true; // Default to server-side

  constructor() {
    this.initializeAuth();
  }

  private initializeAuth() {
    const clientId = import.meta.env.VITE_DROPBOX_APP_KEY;
    console.log('Initializing Dropbox with App Key:', clientId ? 'Found' : 'Missing');
    
    if (!clientId) {
      console.error('Dropbox App Key not found in environment variables');
      console.error('Make sure VITE_DROPBOX_APP_KEY is set in your .env.local file');
      return;
    }

    try {
      this.dbxAuth = new DropboxAuth({
        clientId,
        fetch: fetch.bind(window)
      });

      const token = localStorage.getItem('dropbox_access_token');
      if (token) {
        console.log('Found existing access token, attempting to use it');
        this.setAccessToken(token);
      } else {
        console.log('No existing access token found');
        // Try the verified working token as fallback
        const workingToken = 'sl.u.AF0I7QpxhrUBD1y106f9IBr0-RohvhkF_d68wUBUzRiCI0XHYg4GisAi_UZ8bUDloRKBAQGuyQhjCPUy-tGwcJQvX0cAJ6Y50jL_mKTH2-VBeTvUu6c05DZBwLUGpcvrKOkJDKGc-ZrSWZiqfc8GMzXt9FL5KsqnwIsOrCTSW2iVmhWDMs_CrFpV-HgjqpB4jlAf0siY8txIjiNhStWJxfykUnYAx87PaRAcUC6rGgAOIGadDxTUjdP1-L6y0W55ksQqyKU6avhl_MFNzruqVJtu1TJLDuuCgUEZIMY0wf64_EoUOlDQGq1kaGuP4VTbEusY0wexBjBhgpMaNXk6agvhR-WsjNi8K4yyg6_blqfMdu8PlfJgIUzehAs39je2pP-WT8lz4Q_IpL6VoWrha55Jwieefm8p9rK1dSoAxMr-LDfZEusy4AEYkGOpwpWa-lhfhKMnVSmym64BsvDrBP4UdeA-0C54QJFrVY_oFTNkM1HtsSU7FTsPkejtRJCkupsbfkGV0-QqpUAc8IB6t_4-5IGsjsxrctuUYA6r923mYR4vWj_80PD6j_enCvTkDicY540otqacwMF1o6MeCbIVpw7YORPtjuEnDwKpSPqqeu01A3lsU_EjLNgbcFjA3Xc0viY4JOmIsXYrF29yKlBY8esNnnpVfumj8UYmPdpHcyOaFGqJubNBhGr4iGr1IaalJbyFmrlpligAmHxUjTlI3FKzNbcQiSIIYc6yjxUSaZ9F249UzigQbGY2z5J5n5bNJxW6rD8y9Hu7AaEJjsHf3LYdKKDMJhWOKj_8cKZQxrjhJhu03kld-1mLZ9Fd2ogkv0X1OLWu11meSX2WYwr-Tq1RhL-p1ZI5DqiJBQXQc_TSKakP4sY6t6H2KyytnVeyyJ37WymEhiyq1xIlcTFopy5AV2gZ7zP44YYGwWE7Fj3UgN6mqo2Mj601xxHE-ImzeW4uAFTD393KWaOzxImq0CCX13v_vNoZ3jw7XKgegI_IvB-0vpEGwO9c4axtMbadYtk7WoLSHzDrUApOXYGyHPO3et0EkIehIZuTHmOsW61efELr1RM_G3Tuv05VDMhiHfTOOwmyUtM6iv6XCs3Gh6qdS67pQG_8yvu-AH9FYZ95MyGFLDYsohNXR-c9_twNxiyQzk_5w5Y9R9pNnvX_qGDqYsulqx6mlaVNQZx2iWqMQHui9olUULKgnBgLHbwc26yL1EHes9c0MKs8sdu2ycbbWGaLmkFlOxkDPDvdHIfPSb432za7wI_HsN3opxEdZGUBToGvgZBjj6Xz3Cbr';
        console.log('Using fallback working token');
        this.setAccessToken(workingToken);
        localStorage.setItem('dropbox_access_token', workingToken);
      }
    } catch (error) {
      console.error('Failed to initialize DropboxAuth:', error);
    }
  }

  async authenticate(redirect: boolean = true): Promise<string | boolean> {
    if (!this.dbxAuth) {
      throw new Error('Dropbox auth not initialized');
    }

    try {
      const redirectUri = window.location.origin;
      const authUrl = await this.dbxAuth.getAuthenticationUrl(redirectUri);
      
      if (redirect) {
        window.location.href = authUrl as string;
        return true;
      } else {
        return authUrl as string;
      }
    } catch (error) {
      console.error('Authentication failed:', error);
      return false;
    }
  }

  async handleAuthCallback(code: string): Promise<boolean> {
    if (!this.dbxAuth) {
      throw new Error('Dropbox auth not initialized');
    }

    try {
      console.log('Handling auth callback with code:', code);
      const redirectUri = window.location.origin;
      await this.dbxAuth.getAccessTokenFromCode(redirectUri, code);
      const token = this.dbxAuth.getAccessToken();
      
      if (token) {
        console.log('Successfully obtained access token');
        this.setAccessToken(token);
        localStorage.setItem('dropbox_access_token', token);
        return true;
      }
      console.error('No access token received');
      return false;
    } catch (error) {
      console.error('Auth callback failed:', error);
      return false;
    }
  }

  setAccessToken(token: string) {
    this.accessToken = token;
    this.dbx = new Dropbox({
      accessToken: token,
      fetch: fetch.bind(window)
    });
  }

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

  private setCache<T>(key: string, data: T, ttlMinutes: number = 5): void {
    const ttl = ttlMinutes * 60 * 1000; // Convert to milliseconds
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    });
  }

  private async throttledRequest<T>(requestFn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.requestQueue.push(async () => {
        try {
          const result = await requestFn();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });
      
      this.processQueue();
    });
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessingQueue || this.requestQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;

    while (this.requestQueue.length > 0) {
      const now = Date.now();
      const timeSinceLastRequest = now - this.lastRequestTime;
      
      if (timeSinceLastRequest < this.minRequestInterval) {
        await new Promise(resolve => 
          setTimeout(resolve, this.minRequestInterval - timeSinceLastRequest)
        );
      }

      const request = this.requestQueue.shift();
      if (request) {
        this.lastRequestTime = Date.now();
        await request();
      }
    }

    this.isProcessingQueue = false;
  }

  private async retryRequest<T>(requestFn: () => Promise<T>, retries: number = this.maxRetries): Promise<T> {
    try {
      return await requestFn();
    } catch (error: any) {
      if (error.status === 429 && retries > 0) {
        // Rate limited - wait and retry
        const retryAfter = error.headers?.['retry-after'] ? parseInt(error.headers['retry-after']) * 1000 : 2000;
        await new Promise(resolve => setTimeout(resolve, retryAfter));
        return this.retryRequest(requestFn, retries - 1);
      } else if (error.status === 401) {
        // Authentication failed - clear token and throw specific error
        console.error('Authentication failed (401) - token may be expired or invalid');
        this.disconnect();
        throw new Error('Authentication failed. Please reconnect to Dropbox.');
      }
      throw error;
    }
  }

  isAuthenticated(): boolean {
    if (this.useServerApi) {
      return true; // Server handles authentication
    }
    return !!this.accessToken && !!this.dbx;
  }

  async validateToken(): Promise<boolean> {
    if (this.useServerApi) {
      try {
        return await apiService.checkStatus().then(status => status.isInitialized && status.hasToken);
      } catch (error) {
        console.warn('Server validation failed:', error);
        return false;
      }
    }

    if (!this.dbx || !this.accessToken) {
      return false;
    }

    try {
      // Test the token by making a simple API call
      await this.dbx.usersGetCurrentAccount();
      return true;
    } catch (error: any) {
      if (error.status === 401) {
        console.warn('Token validation failed - token is invalid or expired');
        this.disconnect();
        return false;
      }
      // Other errors might be network issues, so don't disconnect
      console.warn('Token validation failed with non-auth error:', error);
      return false;
    }
  }

  async listFolders(path: string = ''): Promise<Folder[]> {
    if (this.useServerApi) {
      return await apiService.listFolders(path);
    }

    if (!this.dbx) {
      throw new Error('Not connected to Dropbox. Please reconnect.');
    }

    const cacheKey = this.getCacheKey('listFolders', { path });
    const cached = this.getFromCache<Folder[]>(cacheKey);
    
    if (cached) {
      return cached;
    }

    try {
      const response = await this.throttledRequest(async () => 
        this.retryRequest(async () => 
          await this.dbx!.filesListFolder({
            path: path || '',
            recursive: false
          })
        )
      );

      const folders: Folder[] = [];
      
      // Check for subfolders and audio files in a single pass
      const folderEntries = response.result.entries.filter(entry => entry['.tag'] === 'folder');

      for (const entry of folderEntries) {
        if(entry.path_lower) {
          folders.push({
            id: entry.path_lower,
            name: entry.name,
            path: entry.path_lower,
            trackCount: 0, // Will be loaded when needed
            synced: false,
            type: 'dropbox',
            isFolder: true,
            parentPath: path || '',
            hasSubfolders: true // Assume true for faster loading, will be verified when clicked
          });
        }
      }

      // Cache the results for 10 minutes
      this.setCache(cacheKey, folders, 10);
      
      return folders;
    } catch (error: any) {
      console.error('Failed to list folders:', error);
      if (error.status === 401) {
        throw new Error('Authentication failed. Please reconnect to Dropbox.');
      } else if (error.status === 429) {
        throw new Error('Too many requests. Please wait a moment and try again.');
      } else if (error.status >= 500) {
        throw new Error('Dropbox service is temporarily unavailable. Please try again later.');
      } else if (!navigator.onLine) {
        throw new Error('No internet connection. Please check your network and try again.');
      }
      throw new Error('Failed to load folders. Please try again.');
    }
  }

  async listFoldersWithCounts(path: string = ''): Promise<Folder[]> {
    if (!this.dbx) {
      throw new Error('Not authenticated');
    }

    try {
      const response = await this.dbx.filesListFolder({
        path: path || '',
        recursive: false
      });

      const folders: Folder[] = [];
      const folderEntries = response.result.entries.filter(entry => entry['.tag'] === 'folder');
      
      // Process folders in parallel for better performance
      const folderPromises = folderEntries.map(async (entry) => {
        if(!entry.path_lower) {
          return null;
        }
        const [trackCount, hasSubfolders] = await Promise.all([
          this.getAudioFileCount(entry.path_lower),
          this.hasSubfolders(entry.path_lower)
        ]);
        
        return {
          id: entry.path_lower,
          name: entry.name,
          path: entry.path_lower,
          trackCount,
          synced: false,
          type: 'dropbox' as const,
          isFolder: true,
          parentPath: path || '',
          hasSubfolders
        };
      });

      const resolvedFolders = (await Promise.all(folderPromises)).filter(f => f !== null);
      folders.push(...resolvedFolders);

      return folders;
    } catch (error) {
      console.error('Failed to list folders with counts:', error);
      throw error;
    }
  }

  async hasSubfolders(folderPath: string): Promise<boolean> {
    if (!this.dbx) {
      throw new Error('Not authenticated');
    }

    try {
      const response = await this.dbx.filesListFolder({
        path: folderPath,
        recursive: false
      });

      return response.result.entries.some(entry => entry['.tag'] === 'folder');
    } catch (error) {
      console.error('Failed to check subfolders:', error);
      return false;
    }
  }

  async getAudioFileCount(folderPath: string): Promise<number> {
    if (!this.dbx) {
      throw new Error('Not authenticated');
    }

    try {
      const response = await this.dbx.filesListFolder({
        path: folderPath,
        recursive: false // Only count direct files, not recursive
      });

      const audioExtensions = ['.mp3', '.wav', '.flac', '.m4a', '.aac', '.ogg'];
      return response.result.entries.filter(entry => 
        entry['.tag'] === 'file' && 
        audioExtensions.some(ext => entry.name.toLowerCase().endsWith(ext))
      ).length;
    } catch (error) {
      console.error('Failed to count audio files:', error);
      return 0;
    }
  }

  async getFolderDetails(folderPath: string): Promise<{trackCount: number, hasSubfolders: boolean}> {
    if (this.useServerApi) {
      return await apiService.getFolderDetails(folderPath);
    }

    if (!this.dbx) {
      throw new Error('Not authenticated');
    }

    const cacheKey = this.getCacheKey('getFolderDetails', { folderPath });
    const cached = this.getFromCache<{trackCount: number, hasSubfolders: boolean}>(cacheKey);
    
    if (cached) {
      return cached;
    }

    try {
      const response = await this.throttledRequest(async () => 
        this.retryRequest(async () => 
          await this.dbx!.filesListFolder({
            path: folderPath,
            recursive: false
          })
        )
      );

      const audioExtensions = ['.mp3', '.wav', '.flac', '.m4a', '.aac', '.ogg'];
      const trackCount = response.result.entries.filter(entry => 
        entry['.tag'] === 'file' && 
        audioExtensions.some(ext => entry.name.toLowerCase().endsWith(ext))
      ).length;

      const hasSubfolders = response.result.entries.some(entry => entry['.tag'] === 'folder');

      const result = { trackCount, hasSubfolders };
      
      // Cache folder details for 15 minutes
      this.setCache(cacheKey, result, 15);
      
      return result;
    } catch (error) {
      console.error('Failed to get folder details:', error);
      return { trackCount: 0, hasSubfolders: false };
    }
  }

  async getTracksFromFolder(folderPath: string): Promise<Track[]> {
    if (this.useServerApi) {
      return await apiService.getTracksFromFolder(folderPath);
    }

    if (!this.dbx) {
      throw new Error('Not authenticated');
    }

    const cacheKey = this.getCacheKey('getTracksFromFolder', { folderPath });
    const cached = this.getFromCache<Track[]>(cacheKey);
    
    if (cached) {
      return cached;
    }

    try {
      const response = await this.throttledRequest(async () => 
        this.retryRequest(async () => 
          await this.dbx!.filesListFolder({
            path: folderPath,
            recursive: false
          })
        )
      );

      const audioExtensions = ['.mp3', '.wav', '.flac', '.m4a', '.aac', '.ogg'];
      const tracks: Track[] = [];

      // First, create tracks without duration for immediate display
      for (const entry of response.result.entries) {
        if (entry['.tag'] === 'file' && 
            entry.path_lower &&
            audioExtensions.some(ext => entry.name.toLowerCase().endsWith(ext))) {
          
          const track: Track = {
            id: entry.path_lower,
            name: this.getFileNameWithoutExtension(entry.name),
            artist: 'Unknown Artist',
            duration: '0:00', // Will be updated asynchronously
            durationSeconds: 0,
            path: entry.path_lower,
            folderId: folderPath
          };

          tracks.push(track);
        }
      }

      // Cache tracks immediately for fast loading
      this.setCache(cacheKey, tracks, 20);
      
      // Load durations asynchronously in background
      this.loadTrackDurationsAsync(tracks, cacheKey).catch(error => {
        console.error('Duration loading failed:', error);
      });
      
      return tracks;
    } catch (error) {
      console.error('Failed to get tracks from folder:', error);
      throw error;
    }
  }

  private async loadTrackDurationsAsync(tracks: Track[], cacheKey: string): Promise<void> {
    console.log('loadTrackDurationsAsync called with', tracks.length, 'tracks');
    try {
      // Load durations in parallel, but limit concurrency to avoid overwhelming the API
      const BATCH_SIZE = 3;
      
      for (let i = 0; i < tracks.length; i += BATCH_SIZE) {
        const batch = tracks.slice(i, i + BATCH_SIZE);
        
        await Promise.all(batch.map(async (track) => {
          try {
            console.log(`Getting duration for ${track.name}...`);
            if(track.path) {
              const durationSeconds = await this.getAudioDuration(track.path);
              console.log(`Got duration for ${track.name}: ${durationSeconds}s`);
              track.duration = this.formatDuration(durationSeconds);
              track.durationSeconds = durationSeconds;
            }
          } catch (error) {
            console.warn(`Failed to load duration for ${track.name}:`, error);
            // Keep default 0:00 duration on error
          }
        }));
        
        // Small delay between batches to avoid rate limiting
        if (i + BATCH_SIZE < tracks.length) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
      
      // Update cache with durations
      this.setCache(cacheKey, tracks, 20);
      
      // Emit custom event to notify UI about duration updates
      console.log('Emitting trackDurationsUpdated event:', { 
        folderPath: tracks[0]?.folderId, 
        tracksCount: tracks.length,
        sampleDurations: tracks.slice(0, 3).map(t => ({ name: t.name, duration: t.duration }))
      });
      window.dispatchEvent(new CustomEvent('trackDurationsUpdated', { 
        detail: { tracks, folderPath: tracks[0]?.folderId } 
      }));
      
    } catch (error) {
      console.error('Failed to load track durations:', error);
    }
  }

  private async getAudioDuration(filePath: string): Promise<number> {
    console.log(`getAudioDuration called for: ${filePath}`);
    try {
      // Check cache first for duration
      const durationCacheKey = this.getCacheKey('duration', { filePath });
      const cachedDuration = this.getFromCache<number>(durationCacheKey);
      if (cachedDuration !== null) {
        console.log(`Using cached duration for ${filePath}: ${cachedDuration}s`);
        return cachedDuration;
      }

      // Get a temporary link to the file
      console.log(`Getting stream URL for: ${filePath}`);
      const streamUrl = await this.getFileStreamUrl(filePath);
      console.log(`Got stream URL: ${streamUrl.substring(0, 50)}...`);
      
      // Create audio element to get metadata
      const duration = await new Promise<number>((resolve) => {
        const audio = new Audio();
        // Remove crossOrigin as it might cause CORS issues with Dropbox
        // audio.crossOrigin = 'anonymous';
        audio.preload = 'metadata';
        
        let resolved = false;
        
        const cleanup = () => {
          if (!resolved) {
            resolved = true;
            audio.removeEventListener('loadedmetadata', onLoadedMetadata);
            audio.removeEventListener('error', onError);
            audio.src = '';
          }
        };
        
        const onLoadedMetadata = () => {
          if (!resolved) {
            console.log(`loadedmetadata event for ${filePath}, duration: ${audio.duration}`);
            resolved = true;
            cleanup();
            resolve(audio.duration && !isNaN(audio.duration) ? audio.duration : 0);
          }
        };
        
        const onError = (error: any) => {
          if (!resolved) {
            console.warn(`Audio error for ${filePath}:`, error, audio.error);
            resolved = true;
            cleanup();
            resolve(0);
          }
        };
        
        audio.addEventListener('loadedmetadata', onLoadedMetadata);
        audio.addEventListener('error', onError);
        
        // Set timeout to avoid hanging
        setTimeout(() => {
          if (!resolved) {
            console.warn(`Timeout loading audio metadata for ${filePath}`);
            resolved = true;
            cleanup();
            resolve(0);
          }
        }, 10000);
        
        console.log(`Setting audio src for ${filePath}`);
        audio.src = streamUrl;
      });

      // Cache the duration for 1 hour
      if (duration > 0) {
        this.setCache(durationCacheKey, duration, 60);
      }
      
      return duration;
    } catch (error) {
      console.warn(`Failed to get duration for ${filePath}:`, error);
      return 0;
    }
  }

  private formatDuration(seconds: number): string {
    if (!seconds || seconds === 0) return '0:00';
    
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }

  async getFileStreamUrl(filePath: string): Promise<string> {
    if (this.useServerApi) {
      return await apiService.getFileStreamUrl(filePath);
    }

    if (!this.dbx) {
      throw new Error('Not authenticated');
    }

    try {
      const response = await this.dbx.filesGetTemporaryLink({
        path: filePath
      });

      return response.result.link;
    } catch (error) {
      console.error('Failed to get file stream URL:', error);
      throw error;
    }
  }

  async downloadFile(filePath: string): Promise<Blob> {
    if (!this.dbx) {
      throw new Error('Not authenticated');
    }

    try {
      const response = await this.dbx.filesDownload({
        path: filePath
      });

      return (response.result as any).fileBinary as Blob;
    } catch (error) {
      console.error('Failed to download file:', error);
      throw error;
    }
  }

  private getFileNameWithoutExtension(fileName: string): string {
    return fileName.replace(/\.[^/.]+$/, '');
  }

  async searchAudioFiles(query: string, limit: number = 20): Promise<Track[]> {
    if (!this.dbx) {
      throw new Error('Not authenticated');
    }

    try {
      const response = await this.dbx.filesSearchV2({
        query,
        options: {
          max_results: limit,
          file_extensions: ['mp3', 'wav', 'flac', 'm4a', 'aac', 'ogg']
        }
      });

      const tracks: Track[] = [];

      for (const match of response.result.matches) {
        if (match.metadata['.tag'] === 'metadata' && 
            match.metadata.metadata['.tag'] === 'file') {
          
          const file = match.metadata.metadata as files.FileMetadataReference;

          if(file.path_lower) {
            tracks.push({
              id: file.path_lower,
              name: this.getFileNameWithoutExtension(file.name),
              artist: 'Unknown Artist',
              duration: '0:00',
              durationSeconds: 0,
              path: file.path_lower
            });
          }
        }
      }

      return tracks;
    } catch (error) {
      console.error('Failed to search audio files:', error);
      throw error;
    }
  }

  clearCache() {
    this.cache.clear();
  }

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

  async getFolderInfo(folderPath: string): Promise<Folder | null> {
    if (!this.dbx) {
      throw new Error('Not authenticated');
    }

    try {
      const response = await this.throttledRequest(async () => 
        this.retryRequest(async () => 
          await this.dbx!.filesGetMetadata({
            path: folderPath
          })
        )
      );

      if (response.result['.tag'] === 'folder') {
        const folder = response.result as files.FolderMetadataReference;
        if(folder.path_lower) {
          return {
            id: folder.path_lower,
            name: folder.name,
            path: folder.path_lower,
            trackCount: 0,
            synced: false,
            type: 'dropbox',
            isFolder: true,
            parentPath: folder.path_lower.split('/').slice(0, -1).join('/'),
            hasSubfolders: true
          };
        }
      }
      return null;
    } catch (error) {
      console.error('Failed to get folder info:', error);
      return null;
    }
  }

  disconnect() {
    this.accessToken = null;
    this.dbx = null;
    this.clearCache();
    localStorage.removeItem('dropbox_access_token');
  }
}

export const dropboxService = new DropboxService();