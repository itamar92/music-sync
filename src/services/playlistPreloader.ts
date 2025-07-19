import { Track } from '../types';
import { cachedTrackService } from './cachedTrackService';
import { dropboxService } from './dropboxService';

interface PreloadTask {
  trackId: string;
  priority: 'immediate' | 'high' | 'medium' | 'low';
  status: 'pending' | 'loading' | 'ready' | 'failed';
  url?: string;
  error?: string;
  timestamp: number;
}

interface PlaylistPreloadStrategy {
  immediatePreload: number;  // Next N tracks to preload immediately
  backgroundPreload: number; // Additional tracks for background loading
  urlValidationInterval: number; // Check URL health every N minutes
  maxConcurrentPreloads: number; // Prevent overwhelming the API
}

/**
 * 🚀 PLAYLIST PRELOADER SERVICE
 * 
 * Intelligent background preloading to eliminate playback delays:
 * - Progressive preloading (next 3-5 tracks)
 * - URL validation and refresh
 * - Failure recovery and retry logic
 * - Performance-optimized scheduling
 */
export class PlaylistPreloaderService {
  private preloadTasks = new Map<string, PreloadTask>();
  private currentPlaylist: Track[] = [];
  private currentTrackIndex = 0;
  private userId: string | null = null;
  private isPreloading = false;
  
  // Performance configuration
  private strategy: PlaylistPreloadStrategy = {
    immediatePreload: 3,      // Next 3 tracks ready immediately
    backgroundPreload: 5,     // Next 5 tracks loading in background
    urlValidationInterval: 30, // Check URLs every 30 minutes
    maxConcurrentPreloads: 2   // Max 2 simultaneous API calls
  };

  private preloadQueue: string[] = [];
  private activePreloads = 0;
  private validationTimer: number | null = null;

  /**
   * Initialize preloader with playlist and user context
   */
  async initializePlaylist(playlist: Track[], startIndex: number, userId: string) {
    console.log(`🎯 Initializing playlist preloader: ${playlist.length} tracks, starting at index ${startIndex}`);
    
    this.currentPlaylist = playlist;
    this.currentTrackIndex = startIndex;
    this.userId = userId;
    this.preloadTasks.clear();
    this.preloadQueue = [];
    
    // Check authentication before starting preloading
    if (!dropboxService.isAuthenticated()) {
      console.log('⏸️ Dropbox not authenticated - preloader will be ready when authentication is restored');
      return;
    }
    
    // Start immediate preloading for next tracks
    await this.startPreloading();
    
    // Start background URL validation
    this.startUrlValidation();
  }

  /**
   * Move to next track and update preloading priorities
   */
  async moveToTrack(newIndex: number) {
    if (newIndex === this.currentTrackIndex) return;
    
    console.log(`🎵 Moving from track ${this.currentTrackIndex} to ${newIndex}`);
    this.currentTrackIndex = newIndex;
    
    // Check authentication and restart preloading if needed
    if (!dropboxService.isAuthenticated()) {
      console.log('⏸️ Dropbox not authenticated - skipping preload priority update');
      return;
    }
    
    // Reprioritize preloading based on new position
    await this.updatePreloadPriorities();
  }

  /**
   * Restart preloading when authentication is restored
   */
  async resumePreloading() {
    if (this.currentPlaylist.length === 0 || !this.userId) {
      return;
    }
    
    if (!dropboxService.isAuthenticated()) {
      console.log('⏸️ Cannot resume preloading - Dropbox still not authenticated');
      return;
    }
    
    console.log('🔄 Resuming preloader after authentication restored');
    await this.startPreloading();
    this.startUrlValidation();
  }

  /**
   * Get validated stream URL for track (instant if preloaded)
   */
  async getValidatedStreamUrl(trackId: string, trackPath: string): Promise<string> {
    const task = this.preloadTasks.get(trackId);
    
    if (task?.status === 'ready' && task.url) {
      console.log(`⚡ Using preloaded URL for track ${trackId}`);
      return task.url;
    }
    
    if (task?.status === 'loading') {
      console.log(`⏳ Waiting for preload to complete for track ${trackId}`);
      return await this.waitForPreload(trackId, trackPath);
    }
    
    // Check authentication before attempting fetch
    if (!dropboxService.isAuthenticated()) {
      throw new Error('Dropbox authentication required to fetch stream URL');
    }
    
    // Fallback to immediate fetch
    console.log(`🔄 Fetching URL immediately for track ${trackId}`);
    return await this.fetchStreamUrl(trackId, trackPath);
  }

  /**
   * Validate that a URL is still accessible
   */
  async validateUrl(url: string): Promise<boolean> {
    try {
      const response = await fetch(url, { 
        method: 'HEAD',
        signal: AbortSignal.timeout(5000) // 5 second timeout
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Force refresh URLs for tracks around current position
   */
  async refreshNearbyUrls(radius: number = 3) {
    const startIndex = Math.max(0, this.currentTrackIndex - radius);
    const endIndex = Math.min(this.currentPlaylist.length - 1, this.currentTrackIndex + radius);
    
    console.log(`🔄 Force refreshing URLs for tracks ${startIndex} to ${endIndex}`);
    
    for (let i = startIndex; i <= endIndex; i++) {
      const track = this.currentPlaylist[i];
      if (track?.id) {
        // Remove cached task and trigger fresh fetch
        this.preloadTasks.delete(track.id);
        await this.preloadTrack(track.id, track.path || '', 'high');
      }
    }
  }

  /**
   * Get preloader status and performance metrics
   */
  getStatus() {
    const readyTracks = Array.from(this.preloadTasks.values()).filter(t => t.status === 'ready').length;
    const loadingTracks = Array.from(this.preloadTasks.values()).filter(t => t.status === 'loading').length;
    const failedTracks = Array.from(this.preloadTasks.values()).filter(t => t.status === 'failed').length;
    
    return {
      totalTracks: this.currentPlaylist.length,
      currentIndex: this.currentTrackIndex,
      preloadedTracks: readyTracks,
      loadingTracks: loadingTracks,
      failedTracks: failedTracks,
      queueLength: this.preloadQueue.length,
      activePreloads: this.activePreloads,
      strategy: this.strategy
    };
  }

  // Private implementation methods

  private async startPreloading() {
    if (this.isPreloading) return;
    this.isPreloading = true;
    
    // Queue immediate preload tracks (next 3)
    for (let i = 1; i <= this.strategy.immediatePreload; i++) {
      const trackIndex = this.currentTrackIndex + i;
      if (trackIndex < this.currentPlaylist.length) {
        const track = this.currentPlaylist[trackIndex];
        if (track?.id) {
          await this.preloadTrack(track.id, track.path || '', 'high');
        }
      }
    }
    
    // Queue background preload tracks (next 4-8)
    for (let i = this.strategy.immediatePreload + 1; i <= this.strategy.backgroundPreload; i++) {
      const trackIndex = this.currentTrackIndex + i;
      if (trackIndex < this.currentPlaylist.length) {
        const track = this.currentPlaylist[trackIndex];
        if (track?.id) {
          this.queuePreload(track.id, track.path || '', 'medium');
        }
      }
    }
    
    // Process background queue
    this.processPreloadQueue();
  }

  private async preloadTrack(trackId: string, trackPath: string, priority: 'immediate' | 'high' | 'medium' | 'low') {
    if (this.preloadTasks.has(trackId)) return;
    
    const task: PreloadTask = {
      trackId,
      priority,
      status: 'loading',
      timestamp: Date.now()
    };
    
    this.preloadTasks.set(trackId, task);
    this.activePreloads++;
    
    try {
      console.log(`🔄 Preloading track ${trackId} with priority ${priority}`);
      const url = await this.fetchStreamUrl(trackId, trackPath);
      
      task.status = 'ready';
      task.url = url;
      console.log(`✅ Preloaded track ${trackId}`);
      
    } catch (error) {
      task.status = 'failed';
      task.error = error instanceof Error ? error.message : 'Unknown error';
      
      // Don't spam console with authentication errors - they're expected
      if (error instanceof Error && error.message.includes('not authenticated')) {
        console.log(`⏸️ Skipping preload for track ${trackId}: Authentication required`);
      } else {
        console.error(`❌ Failed to preload track ${trackId}:`, error);
      }
      
    } finally {
      this.activePreloads--;
    }
  }

  private queuePreload(trackId: string, trackPath: string, priority: 'medium' | 'low') {
    if (!this.preloadTasks.has(trackId) && !this.preloadQueue.includes(trackId)) {
      this.preloadQueue.push(trackId);
    }
  }

  private async processPreloadQueue() {
    while (this.preloadQueue.length > 0 && this.activePreloads < this.strategy.maxConcurrentPreloads) {
      const trackId = this.preloadQueue.shift();
      if (trackId) {
        const track = this.currentPlaylist.find(t => t.id === trackId);
        if (track) {
          await this.preloadTrack(trackId, track.path || '', 'medium');
        }
      }
    }
    
    // Continue processing if queue has items
    if (this.preloadQueue.length > 0) {
      setTimeout(() => this.processPreloadQueue(), 1000);
    }
  }

  private async updatePreloadPriorities() {
    // Clear old low-priority tasks
    const cutoffTime = Date.now() - (10 * 60 * 1000); // 10 minutes ago
    for (const [trackId, task] of this.preloadTasks) {
      if (task.priority === 'low' && task.timestamp < cutoffTime) {
        this.preloadTasks.delete(trackId);
      }
    }
    
    // Start preloading for new position
    await this.startPreloading();
  }

  private async fetchStreamUrl(trackId: string, trackPath: string): Promise<string> {
    if (!this.userId) {
      throw new Error('User not authenticated');
    }
    
    // Check if Dropbox is authenticated before attempting to fetch
    if (!dropboxService.isAuthenticated()) {
      throw new Error('Dropbox not authenticated - skipping preload');
    }
    
    return await cachedTrackService.getStreamUrl(this.userId, trackId, trackPath);
  }

  private async waitForPreload(trackId: string, trackPath: string, timeout: number = 10000): Promise<string> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      const task = this.preloadTasks.get(trackId);
      
      if (task?.status === 'ready' && task.url) {
        return task.url;
      }
      
      if (task?.status === 'failed') {
        // Retry immediately if preload failed
        return await this.fetchStreamUrl(trackId, trackPath);
      }
      
      // Wait 100ms before checking again
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // Timeout - fetch immediately
    return await this.fetchStreamUrl(trackId, trackPath);
  }

  private startUrlValidation() {
    if (this.validationTimer) {
      clearInterval(this.validationTimer);
    }
    
    this.validationTimer = setInterval(async () => {
      await this.validatePreloadedUrls();
    }, this.strategy.urlValidationInterval * 60 * 1000) as unknown as number;
  }

  private async validatePreloadedUrls() {
    console.log('🔍 Validating preloaded URLs...');
    
    for (const [trackId, task] of this.preloadTasks) {
      if (task.status === 'ready' && task.url) {
        const isValid = await this.validateUrl(task.url);
        
        if (!isValid) {
          console.log(`🔄 URL expired for track ${trackId}, refreshing...`);
          task.status = 'pending';
          task.url = undefined;
          
          // Trigger fresh preload
          const track = this.currentPlaylist.find(t => t.id === trackId);
          if (track) {
            await this.preloadTrack(trackId, track.path || '', 'high');
          }
        }
      }
    }
  }

  /**
   * Cleanup when component unmounts
   */
  destroy() {
    if (this.validationTimer) {
      clearInterval(this.validationTimer);
      this.validationTimer = null;
    }
    
    this.preloadTasks.clear();
    this.preloadQueue = [];
    this.isPreloading = false;
  }
}

// Export singleton instance
export const playlistPreloader = new PlaylistPreloaderService();