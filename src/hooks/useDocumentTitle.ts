import { useEffect } from 'react';

interface UseDocumentTitleProps {
  currentTrack?: {
    name: string;
    artist?: string;
  } | null;
  isPlaying: boolean;
  defaultTitle?: string;
}

/**
 * 🎵 Dynamic Document Title Hook
 * 
 * Updates browser tab title with current playing song
 * Perfect for mobile users - shows song name when phone is locked
 */
export const useDocumentTitle = ({ 
  currentTrack, 
  isPlaying, 
  defaultTitle = 'Music Sync' 
}: UseDocumentTitleProps) => {
  useEffect(() => {
    if (currentTrack) {
      // Format: "🎵 Song Name - Artist | Music Sync" or "⏸️ Song Name - Artist | Music Sync"
      const playIcon = isPlaying ? '🎵' : '⏸️';
      const artist = currentTrack.artist || 'Unknown Artist';
      const songInfo = `${currentTrack.name} - ${artist}`;
      
      // Truncate long titles for mobile compatibility
      const maxLength = 50;
      const truncatedSong = songInfo.length > maxLength 
        ? `${songInfo.substring(0, maxLength)}...` 
        : songInfo;
      
      document.title = `${playIcon} ${truncatedSong} | ${defaultTitle}`;
    } else {
      // Reset to default when no track is playing
      document.title = defaultTitle;
    }
  }, [currentTrack, isPlaying, defaultTitle]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      document.title = defaultTitle;
    };
  }, [defaultTitle]);
};