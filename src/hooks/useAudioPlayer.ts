import { useState, useRef, useCallback, useEffect } from 'react';
import { Track, AudioPlayerState } from '../types';
import { dropboxService } from '../services/dropboxService';

export const useAudioPlayer = () => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playlist, setPlaylist] = useState<Track[]>([]);
  const [state, setState] = useState<AudioPlayerState>({
    currentTrack: null,
    currentTrackIndex: 0,
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    volume: 0.8,
  });

  const isPlayingRef = useRef(state.isPlaying);
  useEffect(() => {
    isPlayingRef.current = state.isPlaying;
  }, [state.isPlaying]);

  const updateState = useCallback((updates: Partial<AudioPlayerState>) => {
    setState(prev => ({ ...prev, ...updates }));
  }, []);

  const loadTrack = useCallback(async (track: Track, index: number) => {
    if (audioRef.current) {
      audioRef.current.src = '';
      audioRef.current.load();
    }
    
    updateState({
      currentTrack: track,
      currentTrackIndex: index,
      currentTime: 0,
      duration: 0,
    });

    try {
      if (track.path && dropboxService.isAuthenticated()) {
        const streamUrl = await dropboxService.getFileStreamUrl(track.path);
        if (audioRef.current) {
          audioRef.current.src = streamUrl;
          audioRef.current.load();
        }
      }
    } catch (error) {
      console.error('Failed to load track:', error);
      updateState({ isPlaying: false });
    }
  }, [updateState]);

  const play = useCallback(() => {
    if (audioRef.current && audioRef.current.readyState >= 3) {
      audioRef.current.play().catch(e => console.error("Error playing audio:", e));
      updateState({ isPlaying: true });
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
    setState(s => {
      const nextIndex = s.currentTrackIndex + 1;
      if (nextIndex < playlist.length) {
        loadTrack(playlist[nextIndex], nextIndex);
      } else {
        updateState({ isPlaying: false });
      }
      return s;
    });
  }, [playlist, loadTrack, updateState]);

  const playPrevious = useCallback(() => {
    setState(s => {
      const prevIndex = s.currentTrackIndex - 1;
      if (prevIndex >= 0) {
        loadTrack(playlist[prevIndex], prevIndex);
      }
      return s;
    });
  }, [playlist, loadTrack]);

  const setVolume = useCallback((volume: number) => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
      updateState({ volume });
    }
  }, [updateState]);

  const seek = useCallback((time: number) => {
    if (audioRef.current && isFinite(audioRef.current.duration)) {
      audioRef.current.currentTime = time;
    }
  }, []);

  const playTrackFromPlaylist = useCallback((track: Track, index: number) => {
    updateState({ isPlaying: true });
    loadTrack(track, index);
  }, [loadTrack, updateState]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleLoadedMetadata = () => {
      updateState({ duration: audio.duration || 0 });
    };

    const handleEnded = () => {
      playNext();
    };

    const handleCanPlayThrough = () => {
      if (isPlayingRef.current) {
        play();
      }
    };

    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('canplaythrough', handleCanPlayThrough);

    let animationFrameId: number;
    const animate = () => {
      updateState({ currentTime: audio.currentTime });
      animationFrameId = requestAnimationFrame(animate);
    };

    if (state.isPlaying) {
      animationFrameId = requestAnimationFrame(animate);
    } else {
      cancelAnimationFrame(animationFrameId!);
    }

    return () => {
      cancelAnimationFrame(animationFrameId);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('canplaythrough', handleCanPlayThrough);
    };
  }, [state.isPlaying, playNext, play, updateState]);

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