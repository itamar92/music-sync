import { databaseService } from './databaseService';
import { dropboxService } from './dropboxService';
import { Track } from '../types';

export class CachedTrackService {
  
  /**
   * Get tracks with database-first approach
   * 1. Try to get from database cache
   * 2. If not found or cache is old, fetch from Dropbox
   * 3. Save to database for future use
   */
  async getTracksFromFolder(userId: string, folderId: string, folderPath: string): Promise<Track[]> {
    try {
      // First, try to get from database cache
      const cachedTracks = await databaseService.getCachedTracks(userId, folderId);
      
      if (cachedTracks.length > 0) {
        console.log(`Found ${cachedTracks.length} cached tracks for folder ${folderId}`);
        // Convert database entities to Track format
        const tracks = cachedTracks.map(track => ({
          id: track.id,
          name: track.name,
          artist: track.artist,
          duration: track.duration || '0:00',
          durationSeconds: track.durationSeconds || 0,
          path: track.filePath,
          folderId: track.folderId,
          // Add url field for playback - will be populated when needed
          url: track.streamUrl || undefined
        }));
        
        // Load durations for tracks that don't have them (only if we have proper permissions)
        if (userId) {
          this.loadMissingDurations(userId, tracks);
        }
        
        return tracks;
      }
      
      // If no cache, fetch from Dropbox
      console.log(`No cached tracks found for folder ${folderId}, fetching from Dropbox...`);
      return await this.syncTracksFromDropbox(userId, folderId, folderPath);
      
    } catch (error) {
      console.error('Error getting tracks from folder:', error);
      // Check if it's a permission error
      if (error.code === 'permission-denied') {
        console.warn('Database permission denied, falling back to Dropbox only');
      }
      // Fallback to Dropbox on any error
      return await this.fetchFromDropboxFallback(folderPath);
    }
  }

  /**
   * Sync tracks from Dropbox and save to database
   */
  async syncTracksFromDropbox(userId: string, folderId: string, folderPath: string): Promise<Track[]> {
    try {
      // Fetch fresh data from Dropbox
      const dropboxTracks = await dropboxService.getTracksFromFolder(folderPath);
      
      if (dropboxTracks.length === 0) {
        return [];
      }
      
      // Try to save to database cache, but don't fail if permissions are insufficient
      if (userId) {
        try {
          await databaseService.saveCachedTracks(userId, folderId, dropboxTracks);
          console.log(`Synced ${dropboxTracks.length} tracks to database for folder ${folderId}`);
        } catch (dbError) {
          console.warn('Failed to cache tracks in database:', dbError);
          // Continue without caching - the tracks are still valid
        }
      }
      
      return dropboxTracks;
      
    } catch (error) {
      console.error('Error syncing tracks from Dropbox:', error);
      throw error;
    }
  }

  /**
   * Get stream URL with caching
   * 1. Try to get cached URL from database
   * 2. If not found or expired, fetch from Dropbox
   * 3. Save to database for future use
   */
  async getStreamUrl(userId: string, trackId: string, trackPath: string): Promise<string> {
    try {
      // First, try to get from database cache
      const cachedUrl = await databaseService.getTrackStreamUrl(userId, trackId);
      
      if (cachedUrl) {
        console.log(`Using cached stream URL for track ${trackId}`);
        return cachedUrl;
      }
      
      // If no cache or expired, fetch from Dropbox
      console.log(`No cached stream URL for track ${trackPath}, fetching from Dropbox...`);
      const streamUrl = await dropboxService.getFileStreamUrl(trackPath);
      
      // Try to save to database cache, but don't fail if permissions are insufficient
      try {
        await databaseService.updateTrackStreamUrl(userId, trackId, streamUrl);
      } catch (dbError) {
        console.warn('Failed to cache stream URL in database:', dbError);
        // Continue without caching - the stream URL is still valid
      }
      
      return streamUrl;
      
    } catch (error) {
      console.error('Error getting stream URL:', error);
      // Fallback to direct Dropbox call
      if (dropboxService.isAuthenticated()) {
        return await dropboxService.getFileStreamUrl(trackPath);
      }
      throw error; // Re-throw if no fallback available
    }
  }

  /**
   * Force refresh cache from Dropbox
   */
  async refreshFolderCache(userId: string, folderId: string, folderPath: string): Promise<Track[]> {
    try {
      // Clear existing cache by marking tracks as inactive
      const existingTracks = await databaseService.getCachedTracks(userId, folderId);
      
      // Fetch fresh data from Dropbox
      const freshTracks = await dropboxService.getTracksFromFolder(folderPath);
      
      // Save new cache
      await databaseService.saveCachedTracks(userId, folderId, freshTracks);
      
      console.log(`Refreshed cache for folder ${folderId}: ${freshTracks.length} tracks`);
      return freshTracks;
      
    } catch (error) {
      console.error('Error refreshing folder cache:', error);
      throw error;
    }
  }

  /**
   * Fallback to Dropbox without caching
   */
  private async fetchFromDropboxFallback(folderPath: string): Promise<Track[]> {
    try {
      console.log('Using Dropbox fallback for folder:', folderPath);
      return await dropboxService.getTracksFromFolder(folderPath);
    } catch (error) {
      console.error('Dropbox fallback failed:', error);
      return [];
    }
  }

  /**
   * Load missing durations for tracks that don't have them
   */
  private loadMissingDurations(userId: string, tracks: Track[]): void {
    // Load durations asynchronously for tracks that don't have them
    const tracksWithoutDuration = tracks.filter(track => 
      !track.duration || track.duration === '0:00' || track.durationSeconds === 0
    );
    
    if (tracksWithoutDuration.length > 0) {
      console.log(`Loading durations for ${tracksWithoutDuration.length} tracks`);
      
      // Load durations in the background
      setTimeout(() => {
        this.loadDurationsFromAudio(userId, tracksWithoutDuration);
      }, 100);
    }
  }

  /**
   * Load durations from audio metadata
   */
  private async loadDurationsFromAudio(userId: string, tracks: Track[]): Promise<void> {
    try {
      const updatedTracks: Track[] = [];
      
      for (const track of tracks) {
        if (!track.path) continue;
        
        try {
          let streamUrl: string;
          
          // Try to get stream URL from cache first, then Dropbox
          if (track.id && userId) {
            // Try to get cached stream URL
            streamUrl = await databaseService.getTrackStreamUrl(userId, track.id);
            if (!streamUrl && dropboxService.isAuthenticated()) {
              // Fallback to fresh Dropbox URL
              streamUrl = await dropboxService.getFileStreamUrl(track.path);
            }
          } else if (dropboxService.isAuthenticated()) {
            streamUrl = await dropboxService.getFileStreamUrl(track.path);
          } else {
            // Skip if no way to get stream URL
            console.warn(`Cannot load duration for ${track.name} - no stream URL available`);
            continue;
          }
          
          if (!streamUrl) {
            console.warn(`No stream URL available for ${track.name}`);
            continue;
          }
          
          // Create audio element to get duration
          const audio = new Audio();
          audio.preload = 'metadata';
          
          await new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(() => {
              reject(new Error('Timeout loading metadata'));
            }, 5000);
            
            audio.onloadedmetadata = () => {
              clearTimeout(timeout);
              if (audio.duration && !isNaN(audio.duration)) {
                const durationSeconds = Math.round(audio.duration);
                const minutes = Math.floor(durationSeconds / 60);
                const seconds = durationSeconds % 60;
                const duration = `${minutes}:${seconds.toString().padStart(2, '0')}`;
                
                track.duration = duration;
                track.durationSeconds = durationSeconds;
                updatedTracks.push(track);
                
                console.log(`Updated duration for ${track.name}: ${duration}`);
              }
              resolve();
            };
            
            audio.onerror = () => {
              clearTimeout(timeout);
              console.warn(`Failed to load metadata for ${track.name}`);
              resolve(); // Don't reject, just continue
            };
            
            audio.src = streamUrl;
          });
        } catch (error) {
          console.warn(`Failed to load duration for ${track.name}:`, error);
        }
      }
      
      // Dispatch event to update UI with new durations
      if (updatedTracks.length > 0) {
        window.dispatchEvent(new CustomEvent('trackDurationsUpdated', {
          detail: { tracks: updatedTracks }
        }));
      }
    } catch (error) {
      console.error('Error loading durations:', error);
    }
  }

  /**
   * Clean up expired stream URLs and inactive tracks
   */
  async cleanupExpiredUrls(): Promise<void> {
    try {
      await databaseService.invalidateExpiredStreamUrls();
      await databaseService.cleanupInactiveTracks();
      console.log('Cleaned up expired stream URLs and inactive tracks');
    } catch (error) {
      console.error('Error cleaning up expired URLs:', error);
    }
  }
}

export const cachedTrackService = new CachedTrackService();