import { Track, Playlist, Folder } from '../types';

interface TrackAlias {
  trackId: string;
  displayName?: string;
  displayArtist?: string;
}

interface PlaylistAlias {
  playlistId: string;
  displayName: string;
}

class LocalDataService {
  private readonly TRACK_ALIASES_KEY = 'track_aliases';
  private readonly PLAYLIST_ALIASES_KEY = 'playlist_aliases';

  // Track aliases management
  getTrackAliases(): Map<string, TrackAlias> {
    try {
      const stored = localStorage.getItem(this.TRACK_ALIASES_KEY);
      if (stored) {
        const aliases = JSON.parse(stored) as TrackAlias[];
        return new Map(aliases.map(alias => [alias.trackId, alias]));
      }
    } catch (error) {
      console.error('Error loading track aliases:', error);
    }
    return new Map();
  }

  saveTrackAlias(trackId: string, displayName?: string, displayArtist?: string): void {
    try {
      const aliases = this.getTrackAliases();
      
      if (displayName || displayArtist) {
        aliases.set(trackId, { trackId, displayName, displayArtist });
      } else {
        aliases.delete(trackId);
      }

      const aliasArray = Array.from(aliases.values());
      localStorage.setItem(this.TRACK_ALIASES_KEY, JSON.stringify(aliasArray));
    } catch (error) {
      console.error('Error saving track alias:', error);
    }
  }

  // Playlist aliases management
  getPlaylistAliases(): Map<string, PlaylistAlias> {
    try {
      const stored = localStorage.getItem(this.PLAYLIST_ALIASES_KEY);
      if (stored) {
        const aliases = JSON.parse(stored) as PlaylistAlias[];
        return new Map(aliases.map(alias => [alias.playlistId, alias]));
      }
    } catch (error) {
      console.error('Error loading playlist aliases:', error);
    }
    return new Map();
  }

  savePlaylistAlias(playlistId: string, displayName: string): void {
    try {
      const aliases = this.getPlaylistAliases();
      
      if (displayName.trim()) {
        aliases.set(playlistId, { playlistId, displayName: displayName.trim() });
      } else {
        aliases.delete(playlistId);
      }

      const aliasArray = Array.from(aliases.values());
      localStorage.setItem(this.PLAYLIST_ALIASES_KEY, JSON.stringify(aliasArray));
    } catch (error) {
      console.error('Error saving playlist alias:', error);
    }
  }

  // Helper methods to apply aliases to data
  applyTrackAliases(tracks: Track[]): Track[] {
    const aliases = this.getTrackAliases();
    
    return tracks.map(track => {
      const alias = aliases.get(track.id);
      if (alias) {
        return {
          ...track,
          displayName: alias.displayName,
          displayArtist: alias.displayArtist
        };
      }
      return track;
    });
  }

  applyPlaylistAliases(playlists: Playlist[]): Playlist[] {
    const aliases = this.getPlaylistAliases();
    
    return playlists.map(playlist => {
      const alias = aliases.get(playlist.id);
      if (alias) {
        return {
          ...playlist,
          displayName: alias.displayName
        };
      }
      return playlist;
    });
  }

  // Get display names for UI
  getTrackDisplayName(track: Track): string {
    return track.displayName || track.name;
  }

  getTrackDisplayArtist(track: Track): string {
    return track.displayArtist || track.artist;
  }

  getPlaylistDisplayName(playlist: Playlist): string {
    return playlist.displayName || playlist.name;
  }

  getFolderDisplayName(folder: Folder): string {
    const aliases = this.getPlaylistAliases();
    const alias = aliases.get(folder.id);
    return alias?.displayName || folder.name;
  }

  // Clear all data (for logout/reset)
  clearAllData(): void {
    localStorage.removeItem(this.TRACK_ALIASES_KEY);
    localStorage.removeItem(this.PLAYLIST_ALIASES_KEY);
  }
}

export const localDataService = new LocalDataService();