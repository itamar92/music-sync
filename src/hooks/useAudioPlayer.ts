import { useState, useRef, useCallback, useEffect } from 'react';
import { Track, AudioPlayerState } from '../types';
import { dropboxService } from '../services/dropboxService';

export const useAudioPlayer = () => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [state, setState] = useState<AudioPlayerState>({
    currentTrack: null,
    currentTrackIndex: 0,
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    volume: 0.8
  });

  const [playlist, setPlaylist] = useState<Track[]>([]);

  const updateState = useCallback((updates: Partial<AudioPlayerState>) => {
    setState(prev => ({ ...prev, ...updates }));
  }, []);

  const loadTrack = useCallback(async (track: Track, index: number) => {
    try {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }

      updateState({
        currentTrack: track,
        currentTrackIndex: index,
        isPlaying: false,
        currentTime: 0
      });

      if (track.path && dropboxService.isAuthenticated()) {
        const streamUrl = await dropboxService.getFileStreamUrl(track.path);
        
        if (audioRef.current) {
          audioRef.current.src = streamUrl;
          audioRef.current.load();
        }
      }
    } catch (error) {
      console.error('Failed to load track:', error);
    }
  }, [updateState]);

  const play = useCallback(async () => {
    if (audioRef.current) {
      try {
        await audioRef.current.play();
        updateState({ isPlaying: true });
      } catch (error) {
        console.error('Failed to play:', error);
      }
    }
  }, [updateState]);

  const pause = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      updateState({ isPlaying: false });
    }
  }, [updateState]);

  const togglePlayPause = useCallback(() => {
    if (state.isPlaying) {
      pause();
    } else {
      play();
    }
  }, [state.isPlaying, play, pause]);

  const playNext = useCallback(() => {
    if (state.currentTrackIndex < playlist.length - 1) {
      const nextIndex = state.currentTrackIndex + 1;
      loadTrack(playlist[nextIndex], nextIndex).then(() => {
        play();
      });
    } else {
      updateState({ isPlaying: false });
    }
  }, [state.currentTrackIndex, playlist, loadTrack, play, updateState]);

  const playPrevious = useCallback(() => {
    if (state.currentTrackIndex > 0) {
      const prevIndex = state.currentTrackIndex - 1;
      loadTrack(playlist[prevIndex], prevIndex).then(() => {
        play();
      });
    }
  }, [state.currentTrackIndex, playlist, loadTrack, play]);

  const setVolume = useCallback((volume: number) => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
      updateState({ volume });
    }
  }, [updateState]);

  const seek = useCallback((time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      updateState({ currentTime: time });
    }
  }, [updateState]);

  const playTrackFromPlaylist = useCallback((track: Track, index: number) => {
    loadTrack(track, index).then(() => {
      play();
    });
  }, [loadTrack, play]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => {
      updateState({ currentTime: audio.currentTime });
    };

    const handleLoadedMetadata = () => {
      updateState({ duration: audio.duration });
    };

    const handleEnded = () => {
      updateState({ isPlaying: false });
      playNext();
    };

    const handleCanPlay = () => {
      audio.volume = state.volume;
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('canplay', handleCanPlay);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('canplay', handleCanPlay);
    };
  }, [updateState, playNext, state.volume]);

  return {
    audioRef,
    state,
    playlist,
    setPlaylist,
    loadTrack,
    play,
    pause,
    togglePlayPause,
    playNext,
    playPrevious,
    setVolume,
    seek,
    playTrackFromPlaylist
  };
};