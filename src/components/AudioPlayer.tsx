import React from 'react';
import { Play, Pause, SkipForward, SkipBack, Volume2, Music } from 'lucide-react';
import { AudioPlayerState, Track } from '../types';
import { formatTime } from '../utils/formatTime';
import { localDataService } from '../services/localDataService';

interface AudioPlayerProps {
  audioRef: React.RefObject<HTMLAudioElement>;
  state: AudioPlayerState;
  playlist: Track[];
  onPlayPause: () => void;
  onNext: () => void;
  onPrevious: () => void;
  onVolumeChange: (volume: number) => void;
  onSeek: (time: number) => void;
}

export const AudioPlayer: React.FC<AudioPlayerProps> = ({
  audioRef,
  state,
  playlist,
  onPlayPause,
  onNext,
  onPrevious,
  onVolumeChange,
  onSeek
}) => {
  if (!state.currentTrack) return null;

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const width = rect.width;
    const clickTime = (x / width) * state.duration;
    onSeek(clickTime);
  };

  return (
    <>
      <div className="fixed bottom-0 left-0 right-0 bg-black/95 backdrop-blur-sm border-t border-blue-500/20 p-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between">
            {/* Current Track Info */}
            <div className="flex items-center space-x-4 flex-1 min-w-0">
              <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-lg flex items-center justify-center flex-shrink-0">
                <Music className="w-6 h-6" />
              </div>
              <div className="min-w-0">
                <h3 className="font-medium text-white truncate">
                  {localDataService.getTrackDisplayName(state.currentTrack)}
                </h3>
                <p className="text-sm text-gray-400 truncate">
                  {localDataService.getTrackDisplayArtist(state.currentTrack)}
                </p>
              </div>
            </div>

            {/* Player Controls */}
            <div className="flex items-center space-x-4 flex-shrink-0">
              <button 
                onClick={onPrevious}
                className="p-2 text-gray-400 hover:text-white transition-colors disabled:opacity-50"
                disabled={state.currentTrackIndex === 0}
              >
                <SkipBack className="w-5 h-5" />
              </button>
              <button
                onClick={onPlayPause}
                className="w-12 h-12 bg-white text-black rounded-full flex items-center justify-center hover:bg-gray-100 transition-colors"
              >
                {state.isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6" />}
              </button>
              <button 
                onClick={onNext}
                className="p-2 text-gray-400 hover:text-white transition-colors disabled:opacity-50"
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
                  onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
                  className="w-full h-1 bg-gray-700 rounded-full appearance-none cursor-pointer slider-thumb"
                  style={{
                    background: `linear-gradient(to right, rgb(59, 130, 246) 0%, rgb(6, 182, 212) ${state.volume * 100}%, rgb(55, 65, 81) ${state.volume * 100}%, rgb(55, 65, 81) 100%)`
                  }}
                />
              </div>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="mt-2 flex items-center space-x-3">
            <span className="text-xs text-gray-400 w-10">{formatTime(state.currentTime)}</span>
            <div 
              className="flex-1 bg-gray-700 rounded-full h-1 cursor-pointer"
              onClick={handleProgressClick}
            >
              <div
                className="bg-gradient-to-r from-blue-500 to-cyan-500 h-1 rounded-full transition-all duration-300"
                style={{ width: `${(state.currentTime / state.duration) * 100 || 0}%` }}
              ></div>
            </div>
            <span className="text-xs text-gray-400 w-10">{formatTime(state.duration)}</span>
          </div>
        </div>
      </div>

      {/* Hidden Audio Element */}
      <audio ref={audioRef} crossOrigin="anonymous" />
    </>
  );
};