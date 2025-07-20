import { useState, useRef, useCallback, useEffect } from 'react';
import { Track, AudioPlayerState } from '../types';
import { dropboxService } from '../services/dropboxService';
import { cachedTrackService } from '../services/cachedTrackService';
import { playlistPreloader } from '../services/playlistPreloader';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '../services/firebase';
import { useToast } from './useToast';
import { useDocumentTitle } from './useDocumentTitle';
import { trackEvent, trackError, trackPerformance } from '../utils/monitoring';

export const useAudioPlayer = () => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playlist, setPlaylistState] = useState<Track[]>([]);
  const [user] = useAuthState(auth);
  const { showAuthError, showConnectionRestored, toasts, removeToast } = useToast();
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

  // 🎵 Dynamic document title for mobile users
  useDocumentTitle({
    currentTrack: state.currentTrack,
    isPlaying: state.isPlaying,
    defaultTitle: 'Music Sync'
  });

  const updateState = useCallback((updates: Partial<AudioPlayerState>) => {
    setState(prev => ({ ...prev, ...updates }));
  }, []);

  // Enhanced setPlaylist with preloader integration
  const setPlaylist = useCallback(async (newPlaylist: Track[]) => {
    setPlaylistState(newPlaylist);
    
    // Initialize preloader with new playlist
    if (user?.uid && newPlaylist.length > 0) {
      console.log('🎯 Initializing playlist preloader with', newPlaylist.length, 'tracks');
      await playlistPreloader.initializePlaylist(newPlaylist, state.currentTrackIndex, user.uid);
    }
  }, [user?.uid, state.currentTrackIndex]);

  const loadTrack = useCallback(async (track: Track, index: number) => {
    console.log('Loading track:', track.name, 'Duration:', track.duration, 'DurationSeconds:', track.durationSeconds);
    
    // Reset state BEFORE loading new source to prevent race conditions
    updateState({
      currentTrack: track,
      currentTrackIndex: index,
      currentTime: 0,
      duration: 0, // Reset to 0, let metadata loading set the real duration
    });

    if (audioRef.current) {
      audioRef.current.src = '';
      audioRef.current.load();
    }

    try {
      if (track.path) {
        let streamUrl: string;
        
        // 🚀 PERFORMANCE: Try preloader first for instant playback
        if (user?.uid && track.id) {
          try {
            streamUrl = await playlistPreloader.getValidatedStreamUrl(track.id, track.path);
            console.log('⚡ Using preloaded stream URL for instant playback');
          } catch (preloadError) {
            console.warn('Preloader failed, falling back to direct fetch:', preloadError);
            streamUrl = await cachedTrackService.getStreamUrl(user.uid, track.id, track.path);
          }
        } else if (dropboxService.isAuthenticated()) {
          // Fallback to direct Dropbox call
          streamUrl = await dropboxService.getFileStreamUrl(track.path);
        } else {
          // If no authentication, check if track has a cached URL
          if (track.url) {
            streamUrl = track.url;
          } else {
            throw new Error('No stream URL available and not authenticated');
          }
        }
        
        if (audioRef.current) {
          console.log('Setting audio source:', streamUrl);
          console.log('Audio element before loading:', {
            src: audioRef.current.src,
            readyState: audioRef.current.readyState,
            duration: audioRef.current.duration,
            currentTime: audioRef.current.currentTime
          });
          
          audioRef.current.src = streamUrl;
          audioRef.current.preload = 'metadata'; // Force metadata loading
          audioRef.current.load();
          
          // Check immediately after setting src
          setTimeout(() => {
            console.log('Audio element after loading:', {
              src: audioRef.current?.src,
              readyState: audioRef.current?.readyState,
              duration: audioRef.current?.duration,
              networkState: audioRef.current?.networkState,
              error: audioRef.current?.error
            });
          }, 100);
        }
      }
    } catch (error) {
      console.error('Failed to load track:', error);
      
      // 📊 Track error for monitoring
      trackError(error as Error, 'medium', {
        track_id: track.id,
        track_path: track.path,
        user_authenticated: !!user?.uid,
        preloader_available: user?.uid && track.id
      });
      
      // 🔄 RETRY LOGIC: If URL fetch fails, try refreshing nearby URLs and retry
      if (user?.uid && track.id && error instanceof Error && error.message.includes('expired')) {
        console.log('🔄 URL appears expired, refreshing and retrying...');
        try {
          await playlistPreloader.refreshNearbyUrls(2);
          // Retry loading the track
          const retryUrl = await playlistPreloader.getValidatedStreamUrl(track.id, track.path || '');
          if (audioRef.current) {
            audioRef.current.src = retryUrl;
            audioRef.current.load();
          }
          trackEvent('track_retry_success', { track_id: track.id });
          return; // Exit early if retry succeeds
        } catch (retryError) {
          console.error('Retry also failed:', retryError);
          trackError(retryError as Error, 'high', {
            retry_attempt: true,
            track_id: track.id
          });
        }
      }
      
      // 📢 Show user-friendly authentication error
      if (error instanceof Error && error.message.includes('authentication')) {
        trackEvent('auth_error', {
          error_message: error.message,
          context: 'track_loading'
        });
        
        showAuthError(error.message, () => {
          // Retry connection by attempting to re-authenticate
          if (dropboxService.authenticate) {
            dropboxService.authenticate();
          }
        });
      }
      
      updateState({ isPlaying: false });
    }
  }, [updateState, user]);

  const play = useCallback(() => {
    if (audioRef.current && audioRef.current.readyState >= 3) {
      const playPromise = audioRef.current.play();
      
      playPromise.then(() => {
        updateState({ isPlaying: true });
        
        // 📊 Track successful play event
        if (state.currentTrack) {
          trackEvent('track_play', {
            track_id: state.currentTrack.id,
            track_name: state.currentTrack.name,
            artist: state.currentTrack.artist,
            playlist_position: state.currentTrackIndex,
            duration: audioRef.current?.duration
          });
        }
      }).catch(e => {
        console.error("Error playing audio:", e);
        trackError(e, 'medium', {
          track_id: state.currentTrack?.id,
          ready_state: audioRef.current?.readyState
        });
      });
    }
  }, [updateState, state.currentTrack, state.currentTrackIndex]);

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

  const playNext = useCallback(async () => {
    const nextIndex = state.currentTrackIndex + 1;
    if (nextIndex < playlist.length) {
      console.log('Auto-playing next track:', playlist[nextIndex].name);
      
      // Update preloader position
      if (user?.uid) {
        await playlistPreloader.moveToTrack(nextIndex);
      }
      
      loadTrack(playlist[nextIndex], nextIndex);
      // Ensure the track will auto-play when loaded
      updateState({ isPlaying: true });
    } else {
      console.log('Reached end of playlist, stopping playback');
      updateState({ isPlaying: false });
    }
  }, [playlist, loadTrack, updateState, state.currentTrackIndex, user?.uid]);

  const playPrevious = useCallback(async () => {
    const prevIndex = state.currentTrackIndex - 1;
    if (prevIndex >= 0) {
      // Update preloader position
      if (user?.uid) {
        await playlistPreloader.moveToTrack(prevIndex);
      }
      
      loadTrack(playlist[prevIndex], prevIndex);
    }
  }, [playlist, loadTrack, state.currentTrackIndex, user?.uid]);

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

  const playTrackFromPlaylist = useCallback(async (track: Track, index: number) => {
    // Update preloader position when jumping to specific track
    if (user?.uid) {
      await playlistPreloader.moveToTrack(index);
    }
    
    updateState({ isPlaying: true });
    loadTrack(track, index);
  }, [loadTrack, updateState, user?.uid]);

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

  // Listen for custom events from React audio element
  useEffect(() => {
    const handleMetadataLoaded = (event: CustomEvent) => {
      console.log('🎯 Custom audioMetadataLoaded event:', event.detail.duration);
      updateState({ duration: event.detail.duration });
    };

    const handleTimeUpdate = (event: CustomEvent) => {
      updateState({ currentTime: event.detail.currentTime });
    };

    window.addEventListener('audioMetadataLoaded', handleMetadataLoaded as EventListener);
    window.addEventListener('audioTimeUpdate', handleTimeUpdate as EventListener);

    return () => {
      window.removeEventListener('audioMetadataLoaded', handleMetadataLoaded as EventListener);
      window.removeEventListener('audioTimeUpdate', handleTimeUpdate as EventListener);
    };
  }, [updateState]);

  // Handle time updates during playback (keep as fallback)
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => {
      if (audio && !isNaN(audio.currentTime)) {
        console.log('Time update:', audio.currentTime, 'Duration:', audio.duration);
        updateState({ currentTime: audio.currentTime });
      }
    };

    // Simplified duration detection - use only the most reliable events
    const handleDurationReady = (eventName: string) => {
      console.log(`${eventName} event fired - duration:`, audio?.duration, 'readyState:', audio?.readyState);
      if (audio && !isNaN(audio.duration) && audio.duration > 0) {
        console.log(`✅ Duration found on ${eventName}:`, audio.duration);
        updateState({ duration: audio.duration });
      } else {
        console.log(`❌ Duration not ready on ${eventName} - duration:`, audio?.duration);
      }
    };

    const handleLoadedMetadata = () => handleDurationReady('loadedmetadata');
    const handleDurationChange = () => handleDurationReady('durationchange');
    
    // Add more diagnostic events temporarily
    const handleLoadStart = () => console.log('🔄 Audio loadstart event');
    const handleLoadedData = () => console.log('📊 Audio loadeddata event - duration:', audio?.duration);
    const handleCanPlay = () => console.log('▶️ Audio canplay event - duration:', audio?.duration);
    const handleError = (e: Event) => console.error('❌ Audio error event:', e);

    // Detect browser capabilities for time update strategy
    const userAgent = navigator.userAgent.toLowerCase();
    const isSafari = userAgent.includes('safari') && !userAgent.includes('chrome');
    const useNativeTimeUpdate = !isSafari; // Safari has timeupdate issues

    // Add core event listeners
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('durationchange', handleDurationChange);
    
    // Add diagnostic event listeners temporarily
    audio.addEventListener('loadstart', handleLoadStart);
    audio.addEventListener('loadeddata', handleLoadedData);
    audio.addEventListener('canplay', handleCanPlay);
    audio.addEventListener('error', handleError);

    // Use either native timeupdate events OR interval timer based on browser
    let intervalId: number | null = null;
    
    const startTimeTracking = () => {
      if (intervalId) clearInterval(intervalId);
      intervalId = setInterval(() => {
        if (audio && !audio.paused && !audio.ended && !isNaN(audio.currentTime)) {
          console.log('Interval time update:', audio.currentTime);
          updateState({ currentTime: audio.currentTime });
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
      if (!useNativeTimeUpdate) {
        startTimeTracking();
      }
    };

    const handlePause = () => {
      updateState({ isPlaying: false });
      if (!useNativeTimeUpdate) {
        stopTimeTracking();
      }
    };

    const handleEnded = () => {
      if (!useNativeTimeUpdate) {
        stopTimeTracking();
      }
    };

    // Add time update listener based on browser capability
    if (useNativeTimeUpdate) {
      audio.addEventListener('timeupdate', handleTimeUpdate);
    }

    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('ended', handleEnded);

    // Start tracking if already playing and using interval method
    if (!audio.paused && !useNativeTimeUpdate) {
      startTimeTracking();
    }

    return () => {
      // Stop timers FIRST, then remove event listeners
      stopTimeTracking();
      
      if (useNativeTimeUpdate) {
        audio.removeEventListener('timeupdate', handleTimeUpdate);
      }
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('durationchange', handleDurationChange);
      audio.removeEventListener('loadstart', handleLoadStart);
      audio.removeEventListener('loadeddata', handleLoadedData);
      audio.removeEventListener('canplay', handleCanPlay);
      audio.removeEventListener('error', handleError);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [updateState]);

  // Cleanup preloader on unmount
  useEffect(() => {
    return () => {
      playlistPreloader.destroy();
    };
  }, []);

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
    playTrackFromPlaylist,
    // Toast notifications for UI feedback
    toasts,
    removeToast
  };
};