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
          audioRef.current.preload = 'metadata'; // Force metadata loading
          audioRef.current.load();
          
          // Immediately try to get duration after a short delay
          setTimeout(() => {
            if (audioRef.current && !isNaN(audioRef.current.duration) && audioRef.current.duration > 0) {
              console.log('Early duration detection:', audioRef.current.duration);
              updateState({ duration: audioRef.current.duration });
            }
          }, 50);
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
    const nextIndex = state.currentTrackIndex + 1;
    if (nextIndex < playlist.length) {
      console.log('Auto-playing next track:', playlist[nextIndex].name);
      loadTrack(playlist[nextIndex], nextIndex);
      // Ensure the track will auto-play when loaded
      updateState({ isPlaying: true });
    } else {
      console.log('Reached end of playlist, stopping playback');
      updateState({ isPlaying: false });
    }
  }, [playlist, loadTrack, updateState, state.currentTrackIndex]);

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
      const clampedTime = Math.max(0, Math.min(time, audioRef.current.duration));
      audioRef.current.currentTime = clampedTime;
      updateState({ currentTime: clampedTime });
    }
  }, [updateState]);

  const playTrackFromPlaylist = useCallback((track: Track, index: number) => {
    updateState({ isPlaying: true });
    loadTrack(track, index);
  }, [loadTrack, updateState]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleEnded = () => {
      playNext();
    };

    const handleCanPlayThrough = () => {
      if (isPlayingRef.current) {
        play();
      }
    };

    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('canplaythrough', handleCanPlayThrough);

    return () => {
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('canplaythrough', handleCanPlayThrough);
    };
  }, [playNext, play]);

  // Handle time updates during playback
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => {
      if (audio && !isNaN(audio.currentTime)) {
        updateState({ currentTime: audio.currentTime });
      }
    };

    const updateDurationIfAvailable = (eventName: string) => {
      if (audio && !isNaN(audio.duration) && audio.duration > 0) {
        console.log(`Duration found on ${eventName}:`, audio.duration);
        updateState({ duration: audio.duration });
      }
    };

    const handleLoadedMetadata = () => updateDurationIfAvailable('loadedmetadata');
    const handleDurationChange = () => updateDurationIfAvailable('durationchange');
    const handleCanPlay = () => updateDurationIfAvailable('canplay');
    const handleLoadedData = () => updateDurationIfAvailable('loadeddata');
    const handleProgress = () => updateDurationIfAvailable('progress');
    const handleSuspend = () => updateDurationIfAvailable('suspend');
    const handleLoadStart = () => {
      console.log('Audio loading started');
      // Force check duration every 100ms during loading
      const checkDuration = () => {
        if (audio && !isNaN(audio.duration) && audio.duration > 0) {
          console.log('Duration found during loading check:', audio.duration);
          updateState({ duration: audio.duration });
        } else if (audio && audio.readyState < 4) {
          // Keep checking if still loading
          setTimeout(checkDuration, 100);
        }
      };
      setTimeout(checkDuration, 100);
    };

    // Add event listeners
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('durationchange', handleDurationChange);
    audio.addEventListener('canplay', handleCanPlay);
    audio.addEventListener('loadeddata', handleLoadedData);
    audio.addEventListener('progress', handleProgress);
    audio.addEventListener('suspend', handleSuspend);
    audio.addEventListener('loadstart', handleLoadStart);

    // Also use interval as fallback for time updates during playback
    let intervalId: NodeJS.Timeout | null = null;
    
    const startTimeTracking = () => {
      if (intervalId) clearInterval(intervalId);
      intervalId = setInterval(() => {
        if (audio && !audio.paused && !audio.ended && !isNaN(audio.currentTime)) {
          const updates: Partial<AudioPlayerState> = { currentTime: audio.currentTime };
          
          // Always check and update duration if available (avoid stale state issues)
          if (audio.duration && !isNaN(audio.duration) && audio.duration > 0) {
            updates.duration = audio.duration;
          }
          
          updateState(updates);
        }
      }, 100); // Update every 100ms for smooth progress
    };

    const stopTimeTracking = () => {
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
    };

    const handlePlay = () => {
      updateState({ isPlaying: true });
      startTimeTracking();
    };

    const handlePause = () => {
      updateState({ isPlaying: false });
      stopTimeTracking();
    };

    const handleEnded = () => {
      stopTimeTracking();
    };

    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('ended', handleEnded);

    // Start tracking if already playing
    if (!audio.paused) {
      startTimeTracking();
    }

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('durationchange', handleDurationChange);
      audio.removeEventListener('canplay', handleCanPlay);
      audio.removeEventListener('loadeddata', handleLoadedData);
      audio.removeEventListener('progress', handleProgress);
      audio.removeEventListener('suspend', handleSuspend);
      audio.removeEventListener('loadstart', handleLoadStart);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('ended', handleEnded);
      stopTimeTracking();
    };
  }, [updateState]);

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