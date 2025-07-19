import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, SkipForward, SkipBack, Volume2, Music, X } from 'lucide-react';
import { Track } from '../types';
import { useAudioPlayer } from '../hooks/useAudioPlayer';
import { generatePlaylistCover } from '../utils/generateCover';
import { ToastContainer } from './ui/ToastContainer';
import './GlobalAudioPlayer.css';

export const GlobalAudioPlayer: React.FC = () => {
  const {
    audioRef,
    state,
    playlist,
    setPlaylist,
    togglePlayPause,
    playNext,
    playPrevious,
    setVolume,
    seek,
    playTrackFromPlaylist,
    toasts,
    removeToast
  } = useAudioPlayer();

  const [isVisible, setIsVisible] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragTime, setDragTime] = useState(0);
  const progressRef = useRef<HTMLDivElement>(null);

  // Listen for play events from components
  useEffect(() => {
    const handlePlayTrackFromPlaylist = (event: CustomEvent) => {
      const { track, playlist: newPlaylist, index } = event.detail;
      setPlaylist(newPlaylist);
      playTrackFromPlaylist(track, index);
      setIsVisible(true);
    };

    const handlePauseTrack = () => {
      if (state.isPlaying) {
        togglePlayPause();
      }
    };

    window.addEventListener('playTrackFromPlaylist', handlePlayTrackFromPlaylist as EventListener);
    window.addEventListener('pauseTrack', handlePauseTrack as EventListener);

    return () => {
      window.removeEventListener('playTrackFromPlaylist', handlePlayTrackFromPlaylist as EventListener);
      window.removeEventListener('pauseTrack', handlePauseTrack as EventListener);
    };
  }, [setPlaylist, playTrackFromPlaylist, togglePlayPause, state.isPlaying]);

  // Emit audio player state changes
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('audioPlayerStateChanged', {
      detail: {
        currentTrack: state.currentTrack,
        isPlaying: state.isPlaying,
        currentTime: state.currentTime,
        duration: state.duration
      }
    }));
  }, [state.currentTrack, state.isPlaying, state.currentTime, state.duration]);

  // Add global mouse event listeners for better drag behavior
  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (isDragging && progressRef.current) {
        const rect = progressRef.current.getBoundingClientRect();
        const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
        const width = rect.width;
        const moveTime = (x / width) * state.duration;
        setDragTime(moveTime);
      }
    };

    const handleGlobalMouseUp = () => {
      if (isDragging) {
        seek(dragTime);
        setIsDragging(false);
      }
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleGlobalMouseMove);
      document.addEventListener('mouseup', handleGlobalMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleGlobalMouseMove);
      document.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [isDragging, dragTime, seek, state.duration]);

  const calculateTimeFromPosition = (e: React.MouseEvent<HTMLDivElement>): number => {
    if (!progressRef.current || state.duration === 0) return 0;
    
    const rect = progressRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const width = rect.width;
    return (x / width) * state.duration;
  };

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging) {
      const clickTime = calculateTimeFromPosition(e);
      seek(clickTime);
    }
  };

  const handleProgressMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    setIsDragging(true);
    const clickTime = calculateTimeFromPosition(e);
    setDragTime(clickTime);
    
    // Prevent default to avoid text selection
    e.preventDefault();
  };

  const handleProgressMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isDragging) {
      const moveTime = calculateTimeFromPosition(e);
      setDragTime(moveTime);
    }
  };

  const handleProgressMouseUp = () => {
    if (isDragging) {
      seek(dragTime);
      setIsDragging(false);
    }
  };

  const formatTime = (seconds: number): string => {
    if (!seconds || !isFinite(seconds)) return '0:00';
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };


  const handleClose = () => {
    setIsVisible(false);
  };

  return (
    <>
      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} onDismiss={removeToast} />
      
      {!isVisible || !state.currentTrack ? null : (
    <div className="fixed bottom-0 left-0 right-0 bg-black/95 backdrop-blur-sm border-t border-blue-500/20 p-4 z-50">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between">
          {/* Current Track Info */}
          <div className="flex items-center space-x-4 flex-1 min-w-0">
            <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0">
              <img 
                src={generatePlaylistCover(state.currentTrack.name, 48)} 
                alt={state.currentTrack.name} 
                className="w-full h-full object-cover" 
              />
            </div>
            <div className="min-w-0">
              <h3 className="font-medium text-white truncate">
                {state.currentTrack.name}
              </h3>
              <p className="text-sm text-gray-400 truncate">
                {state.currentTrack.path?.split('/').slice(-2, -1)[0] || 'Unknown Folder'}
              </p>
            </div>
          </div>

          {/* Player Controls */}
          <div className="flex items-center space-x-4 flex-shrink-0">
            <button 
              onClick={playPrevious}
              className="p-2 text-gray-400 hover:text-blue-400 transition-colors disabled:opacity-50"
              disabled={state.currentTrackIndex === 0}
            >
              <SkipBack className="w-5 h-5" />
            </button>
            <button
              onClick={togglePlayPause}
              className="w-12 h-12 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-full flex items-center justify-center hover:from-blue-600 hover:to-cyan-600 transition-all"
            >
              {state.isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6" />}
            </button>
            <button 
              onClick={playNext}
              className="p-2 text-gray-400 hover:text-blue-400 transition-colors disabled:opacity-50"
              disabled={state.currentTrackIndex === playlist.length - 1}
            >
              <SkipForward className="w-5 h-5" />
            </button>
          </div>

          {/* Volume Control */}
          <div className="flex items-center space-x-3 flex-shrink-0">
            <Volume2 className="w-5 h-5 text-gray-400" />
            <div className="relative w-24">
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={state.volume}
                onChange={(e) => setVolume(parseFloat(e.target.value))}
                className="volume-slider w-full h-2 bg-gray-700 rounded-full appearance-none cursor-pointer"
                style={{
                  background: `linear-gradient(to right, #3b82f6 0%, #06b6d4 ${state.volume * 100}%, #374151 ${state.volume * 100}%, #374151 100%)`
                }}
              />
            </div>
            
            <button
              onClick={handleClose}
              className="p-2 text-gray-400 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mt-3 flex items-center space-x-3">
          <span className="text-xs text-gray-400 w-10">
            {formatTime(isDragging ? dragTime : state.currentTime)}
          </span>
          <div 
            ref={progressRef}
            className="flex-1 bg-gray-700 rounded-full h-2 cursor-pointer relative"
            onClick={handleProgressClick}
            onMouseDown={handleProgressMouseDown}
            onMouseMove={handleProgressMouseMove}
            onMouseUp={handleProgressMouseUp}
            onMouseLeave={handleProgressMouseUp}
          >
            <div
              className={`bg-gradient-to-r from-blue-500 to-cyan-500 h-2 rounded-full ${
                isDragging ? '' : 'transition-all duration-300'
              }`}
              style={{ 
                width: `${state.duration > 0 ? ((isDragging ? dragTime : state.currentTime) / state.duration) * 100 : 0}%`
              }}
            />
            <div
              className="progress-thumb"
              style={{ 
                left: `${state.duration > 0 ? ((isDragging ? dragTime : state.currentTime) / state.duration) * 100 : 0}%`,
                opacity: isDragging ? 1 : 0
              }}
            />
          </div>
          <span className="text-xs text-gray-400 w-10">{formatTime(state.duration)}</span>
        </div>
      </div>

      {/* Hidden Audio Element */}
      <audio 
        ref={audioRef} 
        preload="metadata" 
        crossOrigin="anonymous"
        onLoadStart={() => console.log('🔄 Audio onLoadStart (React event)')}
        onLoadedMetadata={() => {
          console.log('📊 Audio onLoadedMetadata (React event)', audioRef.current?.duration);
          // Manually trigger state update since hook listeners aren't firing
          if (audioRef.current?.duration && !isNaN(audioRef.current.duration)) {
            window.dispatchEvent(new CustomEvent('audioMetadataLoaded', {
              detail: { duration: audioRef.current.duration }
            }));
          }
        }}
        onTimeUpdate={() => {
          if (audioRef.current?.currentTime && !isNaN(audioRef.current.currentTime)) {
            window.dispatchEvent(new CustomEvent('audioTimeUpdate', {
              detail: { currentTime: audioRef.current.currentTime }
            }));
          }
        }}
        onCanPlay={() => console.log('▶️ Audio onCanPlay (React event)', audioRef.current?.duration)}
        onError={(e) => console.error('❌ Audio onError (React event):', e)}
      />
    </div>
      )}
    </>
  );
};