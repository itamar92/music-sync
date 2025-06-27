import React from 'react';
import { Play, Share2 } from 'lucide-react';
import { Track } from '../types';
import { generateShareLink } from '../utils/shareUtils';
import { localDataService } from '../services/localDataService';
import { EditableText } from './EditableText';

interface TrackListProps {
  tracks: Track[];
  currentTrack: Track | null;
  isPlaying: boolean;
  onTrackSelect: (track: Track, index: number) => void;
  onShare?: (shareUrl: string) => void;
  onTrackNameChange?: (trackId: string, newName: string) => void;
  onTrackArtistChange?: (trackId: string, newArtist: string) => void;
}

export const TrackList: React.FC<TrackListProps> = ({
  tracks,
  currentTrack,
  isPlaying,
  onTrackSelect,
  onShare,
  onTrackNameChange,
  onTrackArtistChange
}) => {
  const handleShare = (e: React.MouseEvent, track: Track) => {
    e.stopPropagation();
    if (onShare) {
      const shareUrl = generateShareLink(track);
      onShare(shareUrl);
    }
  };

  if (tracks.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-400">No tracks found in this folder</p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {tracks.map((track, index) => (
        <div
          key={track.id}
          className={`group flex items-center space-x-4 p-3 rounded-lg cursor-pointer transition-all duration-200 ${
            currentTrack?.id === track.id
              ? 'bg-blue-600/20'
              : 'hover:bg-gray-700/30'
          }`}
          onClick={() => onTrackSelect(track, index)}
        >
          {/* Track Number / Play Indicator */}
          <div className="w-8 text-center">
            {currentTrack?.id === track.id && isPlaying ? (
              <div className="w-4 h-4 mx-auto">
                <div className="flex space-x-0.5 items-end h-4">
                  <div className="w-0.5 bg-blue-500 animate-pulse" style={{height: '60%'}}></div>
                  <div className="w-0.5 bg-blue-500 animate-pulse" style={{height: '100%', animationDelay: '0.1s'}}></div>
                  <div className="w-0.5 bg-blue-500 animate-pulse" style={{height: '40%', animationDelay: '0.2s'}}></div>
                  <div className="w-0.5 bg-blue-500 animate-pulse" style={{height: '80%', animationDelay: '0.3s'}}></div>
                </div>
              </div>
            ) : (
              <span className="text-gray-400 group-hover:hidden">{index + 1}</span>
            )}
            {currentTrack?.id !== track.id && (
              <Play className="w-4 h-4 text-white hidden group-hover:block" />
            )}
          </div>
          
          {/* Track Info */}
          <div className="flex-1 min-w-0" onClick={(e) => e.stopPropagation()}>
            {onTrackNameChange ? (
              <EditableText
                text={localDataService.getTrackDisplayName(track)}
                onSave={(newName) => onTrackNameChange(track.id, newName)}
                className="font-medium text-white truncate block"
                placeholder="Track name..."
                maxLength={100}
              />
            ) : (
              <h3 className="font-medium text-white truncate">{localDataService.getTrackDisplayName(track)}</h3>
            )}
            
            {onTrackArtistChange ? (
              <EditableText
                text={localDataService.getTrackDisplayArtist(track)}
                onSave={(newArtist) => onTrackArtistChange(track.id, newArtist)}
                className="text-sm text-gray-400 truncate block"
                placeholder="Artist name..."
                maxLength={50}
              />
            ) : (
              <p className="text-sm text-gray-400 truncate">{localDataService.getTrackDisplayArtist(track)}</p>
            )}
          </div>
          
          {/* Duration and Actions */}
          <div className="flex items-center space-x-4">
            <span className="text-gray-400 text-sm">{track.duration}</span>
            {onShare && (
              <button 
                onClick={(e) => handleShare(e, track)}
                className="p-1 text-gray-400 hover:text-white opacity-0 group-hover:opacity-100 transition-all"
                title="Share track"
              >
                <Share2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};