import { Dropbox, DropboxAuth, files } from 'dropbox';
import { Track, Folder } from '../types';
import { apiService } from './apiService';
import { tokenManager } from './tokenManager';
import { PKCEUtils } from '../utils/pkce';
import { KeyRotationService } from './keyRotation';
import { AuthSecurity } from '../utils/authSecurity';
import { PublicTokenService } from './publicTokenService';

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
  private useServerApi = import.meta.env.VITE_USE_SERVER_API === 'true';

  constructor() {
    this.initializeAuth();
    this.initializeSecurity();
  }

  private async initializeAuth() {
    const clientId = import.meta.env.VITE_DROPBOX_APP_KEY;
    console.log('🔧 Dropbox Init: App Key found:', clientId ? 'YES' : 'NO');
    
    if (!clientId) {
      console.error('❌ Dropbox Init: App Key not found in environment variables');
      console.error('❌ Dropbox Init: Make sure VITE_DROPBOX_APP_KEY is set in your .env.local file');
      return;
    }

    try {
      console.log('🔧 Dropbox Init: Creating DropboxAuth instance...');
      this.dbxAuth = new DropboxAuth({
        clientId,
        fetch: fetch.bind(window)
      });
      console.log('✅ Dropbox Init: DropboxAuth created successfully');

      // Try to get valid access token using TokenManager
      console.log('🔍 Dropbox Init: Checking for valid stored tokens...');
      const validToken = await tokenManager.getValidAccessToken();
      
      if (validToken) {
        console.log('✅ Dropbox Init: Found valid access token, initializing service');
        this.setAccessToken(validToken);
      } else {
        console.log('📋 Dropbox Init: No valid token found - checking for public tokens...');
        
        // Try to get public tokens for anonymous users
        const publicTokens = await PublicTokenService.getPublicTokens();
        if (publicTokens) {
          console.log('🌐 Dropbox Init: Found public tokens, initializing service');
          this.setAccessToken(publicTokens.accessToken);
        } else {
          console.log('📋 Dropbox Init: No public tokens available - checking legacy tokens...');
          // Check for legacy token and migrate if valid
          await this.migrateLegacyToken();
        }
      }
    } catch (error) {
      console.error('❌ Dropbox Init: Failed to initialize authentication:', error);
    }
  }

  /**
   * Migrate legacy localStorage token to new TokenManager system
   */
  private async migrateLegacyToken() {
    try {
      const legacyToken = localStorage.getItem('dropbox_access_token');
      if (legacyToken) {
        console.log('🔄 Found legacy token, attempting migration...');
        
        // Test if legacy token is still valid
        const testDbx = new Dropbox({
          accessToken: legacyToken,
          fetch: fetch.bind(window)
        });
        
        try {
          await testDbx.usersGetCurrentAccount();
          console.log('⚠️ Legacy token is valid but missing refresh capability');
          console.log('⚠️ User will need to re-authenticate for refresh token support');
          
          // Use legacy token temporarily but prompt for re-auth
          this.setAccessToken(legacyToken);
          
          // Clear legacy token to force proper OAuth flow next time
          localStorage.removeItem('dropbox_access_token');
          
        } catch (error) {
          console.log('🗑️ Legacy token is invalid, clearing...');
          localStorage.removeItem('dropbox_access_token');
        }
      }
    } catch (error) {
      console.warn('⚠️ Legacy token migration failed:', error);
    }
  }

  /**
   * Initialize security monitoring and key rotation
   */
  private async initializeSecurity() {
    try {
      console.log('🔒 Initializing security systems...');
      
      // Start security monitoring
      AuthSecurity.startSecurityMonitoring();
      
      // Schedule automatic key rotation
      KeyRotationService.scheduleRotation();
      
      // Perform automatic legacy migration
      await KeyRotationService.migrateLegacyTokens();
      
      // Check for required key rotation
      await KeyRotationService.performAutoRotation();
      
      console.log('✅ Security systems initialized');
    } catch (error) {
      console.error('❌ Security initialization failed:', error);
    }
  }

  async authenticate(redirect: boolean = true): Promise<string | boolean> {
    if (!this.dbxAuth) {
      throw new Error('Dropbox auth not initialized');
    }

    try {
      const redirectUri = window.location.origin;
      
      // Check if PKCE is supported for secure authentication
      if (PKCEUtils.isPKCESupported()) {
        console.log('🔐 Starting secure OAuth flow with PKCE...');
        return await this.authenticateWithPKCE(redirectUri, redirect);
      } else {
        console.warn('⚠️ PKCE not supported, falling back to standard OAuth');
        return await this.authenticateStandard(redirectUri, redirect);
      }
    } catch (error) {
      console.error('❌ Authentication failed:', error);
      return false;
    }
  }

  /**
   * Authenticate using PKCE (most secure, no client secret needed)
   */
  private async authenticateWithPKCE(redirectUri: string, redirect: boolean): Promise<string | boolean> {
    try {
      // Generate PKCE pair
      const pkcePair = await PKCEUtils.generatePKCEPair();
      
      // Store code verifier securely for later use
      PKCEUtils.storePKCEVerifier(pkcePair.codeVerifier);
      
      // Build OAuth URL with PKCE parameters
      const clientId = import.meta.env.VITE_DROPBOX_APP_KEY;
      const authUrl = new URL('https://www.dropbox.com/oauth2/authorize');
      
      authUrl.searchParams.set('client_id', clientId);
      authUrl.searchParams.set('response_type', 'code');
      authUrl.searchParams.set('redirect_uri', redirectUri);
      authUrl.searchParams.set('token_access_type', 'offline'); // For refresh tokens
      authUrl.searchParams.set('code_challenge', pkcePair.codeChallenge);
      authUrl.searchParams.set('code_challenge_method', 'S256');
      
      const finalUrl = authUrl.toString();
      
      if (redirect) {
        console.log('🌐 Redirecting to Dropbox for PKCE authentication...');
        window.location.href = finalUrl;
        return true;
      } else {
        return finalUrl;
      }
    } catch (error) {
      console.error('❌ PKCE authentication setup failed:', error);
      throw error;
    }
  }

  /**
   * Standard OAuth authentication (requires client secret or server-side handling)
   */
  private async authenticateStandard(redirectUri: string, redirect: boolean): Promise<string | boolean> {
    const authUrl = await this.dbxAuth!.getAuthenticationUrl(
      redirectUri, 
      undefined, 
      'code', // Use 'code' instead of 'token' for refresh token support
      'offline' // Request offline access for refresh tokens
    );
    
    if (redirect) {
      console.log('🌐 Redirecting to Dropbox for standard authentication...');
      window.location.href = authUrl as string;
      return true;
    } else {
      return authUrl as string;
    }
  }

  async handleAuthCallback(code: string): Promise<boolean> {
    if (!this.dbxAuth) {
      throw new Error('Dropbox auth not initialized');
    }

    try {
      console.log('🔄 Processing OAuth callback with authorization code...');
      const redirectUri = window.location.origin;
      
      // Retrieve PKCE code verifier if it was stored
      const codeVerifier = PKCEUtils.retrievePKCEVerifier();
      
      if (codeVerifier) {
        console.log('🔐 Using PKCE for secure token exchange');
      } else {
        console.log('⚠️ No PKCE verifier found, using standard exchange');
      }
      
      // Exchange authorization code for tokens using TokenManager
      const tokenData = await tokenManager.exchangeCodeForTokens(code, redirectUri, codeVerifier || undefined);
      
      if (tokenData.accessToken) {
        console.log('✅ OAuth callback successful, tokens obtained');
        this.setAccessToken(tokenData.accessToken);
        
        // Clear any legacy tokens and PKCE data
        localStorage.removeItem('dropbox_access_token');
        PKCEUtils.clearPKCEData();
        
        return true;
      }
      
      console.error('❌ OAuth callback failed - no access token received');
      return false;
    } catch (error) {
      console.error('❌ Auth callback failed:', error);
      // Clean up PKCE data on error
      PKCEUtils.clearPKCEData();
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
    
    // Clean up expired entries occasionally to prevent memory leaks
    if (this.cache.size > 100) {
      this.cleanupExpiredCache();
    }
  }

  private cleanupExpiredCache(): void {
    const now = Date.now();
    for (const [key, cached] of this.cache.entries()) {
      if (now > cached.timestamp + cached.ttl) {
        this.cache.delete(key);
      }
    }
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
        console.log(`⏳ Rate limited, waiting ${retryAfter}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, retryAfter));
        return this.retryRequest(requestFn, retries - 1);
      } else if (error.status === 401 && retries > 0) {
        // Authentication failed - try to refresh token
        console.log('🔄 Authentication failed, attempting token refresh...');
        
        try {
          const validToken = await tokenManager.getValidAccessToken();
          if (validToken && validToken !== this.accessToken) {
            console.log('✅ Token refreshed, retrying request...');
            this.setAccessToken(validToken);
            return this.retryRequest(requestFn, retries - 1);
          }
        } catch (refreshError) {
          console.error('❌ Token refresh failed:', refreshError);
        }
        
        // If refresh failed or no new token, disconnect and throw
        console.error('❌ Authentication failed and refresh unsuccessful');
        await tokenManager.clearStoredTokens();
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
        console.warn('⚠️ Server validation failed:', error);
        return false;
      }
    }

    // Try to get a valid access token (will refresh if needed)
    try {
      console.log('🔍 Validating token...');
      const validToken = await tokenManager.getValidAccessToken();
      
      if (!validToken) {
        console.log('❌ No valid token available');
        return false;
      }

      // Update our instance if token was refreshed
      if (validToken !== this.accessToken) {
        console.log('🔄 Token was refreshed, updating service instance');
        this.setAccessToken(validToken);
      }

      // Test the token by making a simple API call
      if (this.dbx) {
        await this.dbx.usersGetCurrentAccount();
        console.log('✅ Token validation successful');
        return true;
      }
      
      return false;
    } catch (error: any) {
      if (error.status === 401) {
        console.warn('❌ Token validation failed - token is invalid or expired');
        await tokenManager.clearStoredTokens();
        this.disconnect();
        return false;
      }
      // Other errors might be network issues, so don't disconnect
      console.warn('⚠️ Token validation failed with non-auth error:', error);
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

      // Cache the results for 15 minutes
      this.setCache(cacheKey, folders, 15);
      
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
      
      // Cache folder details for 20 minutes
      this.setCache(cacheKey, result, 20);
      
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
    try {
      // Load durations in parallel, but limit concurrency to avoid overwhelming the API
      const BATCH_SIZE = 3;
      
      for (let i = 0; i < tracks.length; i += BATCH_SIZE) {
        const batch = tracks.slice(i, i + BATCH_SIZE);
        
        await Promise.all(batch.map(async (track) => {
          try {
            if(track.path) {
              const durationSeconds = await this.getAudioDuration(track.path);
              track.duration = this.formatDuration(durationSeconds);
              track.durationSeconds = durationSeconds;
            }
          } catch (error) {
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
      window.dispatchEvent(new CustomEvent('trackDurationsUpdated', { 
        detail: { tracks, folderPath: tracks[0]?.folderId } 
      }));
      
    } catch (error) {
      console.error('Failed to load track durations:', error);
    }
  }

  private async getAudioDuration(filePath: string): Promise<number> {
    try {
      // Check cache first for duration
      const durationCacheKey = this.getCacheKey('duration', { filePath });
      const cachedDuration = this.getFromCache<number>(durationCacheKey);
      if (cachedDuration !== null) {
        return cachedDuration;
      }

      // Get a temporary link to the file
      const streamUrl = await this.getFileStreamUrl(filePath);
      
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
            resolved = true;
            cleanup();
            resolve(audio.duration && !isNaN(audio.duration) ? audio.duration : 0);
          }
        };
        
        const onError = (error: any) => {
          if (!resolved) {
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

  async getFileSharedLink(filePath: string): Promise<string> {
    if (this.useServerApi) {
      // TODO: Add server API support for shared links if needed
      return await apiService.getFileStreamUrl(filePath);
    }

    if (!this.dbx) {
      throw new Error('Not authenticated');
    }

    try {
      console.log('Attempting to create/get shared link for:', filePath);
      
      // First, try to get existing shared links for this file
      try {
        const existingLinksResponse = await this.dbx.sharingListSharedLinks({
          path: filePath,
          direct_only: true
        });

        // If a shared link already exists, return it
        if (existingLinksResponse.result.links.length > 0) {
          const sharedLink = existingLinksResponse.result.links[0];
          console.log('Found existing shared link:', sharedLink.url);
          // Convert Dropbox share URL to direct download URL
          return this.convertToDirectLink(sharedLink.url);
        }
      } catch (listError) {
        console.warn('Could not list existing shared links, trying to create new one:', listError);
      }

      // Try a different approach - check if we can create shared links without settings
      try {
        console.log('Attempting simple shared link creation...');
        const simpleResponse = await this.dbx.sharingCreateSharedLink({
          path: filePath
        });
        
        console.log('Created simple shared link:', simpleResponse.result.url);
        return this.convertToDirectLink(simpleResponse.result.url);
      } catch (simpleError) {
        console.warn('Simple shared link creation failed:', simpleError);
        
        // Check if the error is because a link already exists
        if (simpleError.error && simpleError.error['.tag'] === 'shared_link_already_exists') {
          console.log('Shared link already exists, trying to retrieve it...');
          try {
            // Try to get the existing link
            const existingResponse = await this.dbx.sharingListSharedLinks({
              path: filePath
            });
            
            if (existingResponse.result.links.length > 0) {
              const existingLink = existingResponse.result.links[0];
              console.log('Retrieved existing shared link:', existingLink.url);
              return this.convertToDirectLink(existingLink.url);
            }
          } catch (retrieveError) {
            console.warn('Failed to retrieve existing shared link:', retrieveError);
          }
        }
        
        // Final fallback to temporary URL (but warn user)
        console.warn('⚠️ Using temporary URL - will expire in 4 hours!');
        return await this.getFileStreamUrl(filePath);
      }
    } catch (error) {
      console.error('Failed to get shared link, falling back to temporary stream URL:', error);
      return await this.getFileStreamUrl(filePath);
    }
  }

  private convertToDirectLink(dropboxShareUrl: string): string {
    console.log('Converting to direct link:', dropboxShareUrl);
    
    // Method 1: Convert dropbox.com to dl.dropboxusercontent.com
    if (dropboxShareUrl.includes('dropbox.com/s/')) {
      const directUrl = dropboxShareUrl
        .replace('www.dropbox.com', 'dl.dropboxusercontent.com')
        .replace('dropbox.com', 'dl.dropboxusercontent.com')
        .replace('/s/', '/s/raw/')
        .split('?')[0];
      console.log('Method 1 - Direct URL:', directUrl);
      return directUrl;
    }
    
    // Method 2: Add ?dl=1 parameter for direct download
    const directDownloadUrl = dropboxShareUrl.includes('?') 
      ? dropboxShareUrl.replace('?dl=0', '?dl=1').replace(/&dl=0/, '&dl=1')
      : dropboxShareUrl + '?dl=1';
    
    console.log('Method 2 - Direct download URL:', directDownloadUrl);
    return directDownloadUrl;
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

  async disconnect() {
    console.log('🔌 Disconnecting from Dropbox...');
    this.accessToken = null;
    this.dbx = null;
    this.clearCache();
    
    // Clear all tokens using TokenManager
    await tokenManager.clearStoredTokens();
    
    console.log('✅ Dropbox disconnection complete');
  }
}

export const dropboxService = new DropboxService();