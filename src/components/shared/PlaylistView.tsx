import React, { useState, useEffect } from 'react';
import { ArrowLeft, Play, Edit3, Save, X, GripVertical, Pause, Trash2 } from 'lucide-react';
import { doc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { useAuthState } from 'react-firebase-hooks/auth';
import { db, auth } from '../../services/firebase';
import { dropboxService } from '../../services/dropboxService';
import { Track } from '../../types';
import { generatePlaylistCover } from '../../utils/generateCover';

interface PlaylistViewProps {
  playlist: any;
  onBack: () => void;
  onPlaylistUpdated?: (updatedPlaylist: any) => void;
  isReadOnly?: boolean; // For public view
}

export const PlaylistView: React.FC<PlaylistViewProps> = ({
  playlist,
  onBack,
  onPlaylistUpdated,
  isReadOnly = false
}) => {
  const [user] = useAuthState(auth);
  const [playlistTracks, setPlaylistTracks] = useState<Track[]>([]);
  const [loadingTracks, setLoadingTracks] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [editingArtist, setEditingArtist] = useState(false);
  const [editingTrackId, setEditingTrackId] = useState<string | null>(null);
  const [playlistTitle, setPlaylistTitle] = useState(playlist.displayName || playlist.name);
  const [artistName, setArtistName] = useState(playlist.artist || 'Unknown Artist');
  const [editingTrackName, setEditingTrackName] = useState('');
  const [draggedTrack, setDraggedTrack] = useState<number | null>(null);
  const [currentlyPlaying, setCurrentlyPlaying] = useState<string | null>(null);

  useEffect(() => {
    loadPlaylistTracks();
  }, [playlist]);

  const loadPlaylistTracks = async () => {
    setLoadingTracks(true);
    
    try {
      if (!dropboxService.isAuthenticated()) {
        throw new Error('Please connect to Dropbox first');
      }
      
      if (!playlist.folderIds || playlist.folderIds.length === 0) {
        setPlaylistTracks([]);
        return;
      }

      // Load tracks from all folders in parallel
      const trackPromises = playlist.folderIds.map(async (folderId: string) => {
        try {
          // Get folder details first
          const foldersRef = collection(db, 'folderSyncs');
          const folderQuery = query(foldersRef, where('__name__', '==', folderId));
          const folderSnapshot = await getDocs(folderQuery);
          
          if (folderSnapshot.empty) {
            console.warn(`Folder ${folderId} not found`);
            return [];
          }

          const folderData = folderSnapshot.docs[0].data();
          return await dropboxService.getTracksFromFolder(folderData.dropboxPath);
        } catch (error) {
          console.error(`Error loading tracks from folder ${folderId}:`, error);
          return [];
        }
      });

      const trackArrays = await Promise.all(trackPromises);
      let allTracks = trackArrays.flat();
      
      // Apply saved track order if exists
      if (playlist.trackOrder) {
        const orderedTracks = [];
        const trackMap = new Map(allTracks.map(track => [track.id, track]));
        
        for (const trackId of playlist.trackOrder) {
          const track = trackMap.get(trackId);
          if (track) {
            orderedTracks.push(track);
            trackMap.delete(trackId);
          }
        }
        
        // Add any new tracks that aren't in the saved order
        orderedTracks.push(...Array.from(trackMap.values()));
        allTracks = orderedTracks;
      }

      // Apply saved track names if exists
      if (playlist.trackNames) {
        allTracks = allTracks.map(track => ({
          ...track,
          name: playlist.trackNames[track.id] || track.name
        }));
      }

      // Filter out excluded tracks
      if (playlist.excludedTracks) {
        allTracks = allTracks.filter(track => !playlist.excludedTracks.includes(track.id));
      }
      
      setPlaylistTracks(allTracks);
    } catch (error) {
      console.error('Error loading playlist tracks:', error);
      alert('Failed to load playlist contents. Please try again.');
    } finally {
      setLoadingTracks(false);
    }
  };

  // Listen for duration updates
  useEffect(() => {
    const handleDurationUpdates = (event: CustomEvent) => {
      if (event.detail?.tracks) {
        setPlaylistTracks(prev => {
          const trackMap = new Map(event.detail.tracks.map((t: Track) => [t.id, t]));
          return prev.map(track => trackMap.get(track.id) || track);
        });
      }
    };

    window.addEventListener('trackDurationsUpdated', handleDurationUpdates as EventListener);
    
    return () => {
      window.removeEventListener('trackDurationsUpdated', handleDurationUpdates as EventListener);
    };
  }, []);

  // Listen for audio player events
  useEffect(() => {
    const handleAudioPlayerState = (event: CustomEvent) => {
      const { currentTrack, isPlaying } = event.detail;
      if (currentTrack) {
        setCurrentlyPlaying(isPlaying ? currentTrack.id : null);
      }
    };

    window.addEventListener('audioPlayerStateChanged', handleAudioPlayerState as EventListener);
    
    return () => {
      window.removeEventListener('audioPlayerStateChanged', handleAudioPlayerState as EventListener);
    };
  }, []);

  const calculateTotalDuration = () => {
    const totalSeconds = playlistTracks.reduce((sum, track) => sum + (track.durationSeconds || 0), 0);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = Math.floor(totalSeconds % 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m ${seconds}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    } else {
      return `${seconds}s`;
    }
  };

  const handleSaveTitle = async () => {
    if (isReadOnly || !onPlaylistUpdated) return;
    
    try {
      const playlistRef = doc(db, 'playlists', playlist.id);
      const updatedPlaylist = {
        ...playlist,
        displayName: playlistTitle,
        updatedAt: new Date()
      };
      
      await updateDoc(playlistRef, {
        displayName: playlistTitle,
        updatedAt: new Date()
      });
      
      onPlaylistUpdated(updatedPlaylist);
      setEditingTitle(false);
    } catch (error) {
      console.error('Error updating playlist title:', error);
      alert('Failed to update playlist title. Please try again.');
    }
  };

  const handleSaveArtist = async () => {
    if (isReadOnly || !onPlaylistUpdated) return;
    
    try {
      const playlistRef = doc(db, 'playlists', playlist.id);
      const updatedPlaylist = {
        ...playlist,
        artist: artistName,
        updatedAt: new Date()
      };
      
      await updateDoc(playlistRef, {
        artist: artistName,
        updatedAt: new Date()
      });
      
      onPlaylistUpdated(updatedPlaylist);
      setEditingArtist(false);
    } catch (error) {
      console.error('Error updating artist name:', error);
      alert('Failed to update artist name. Please try again.');
    }
  };

  const handleSaveTrackName = async (trackId: string) => {
    if (isReadOnly || !onPlaylistUpdated) return;
    
    try {
      const playlistRef = doc(db, 'playlists', playlist.id);
      const updatedTrackNames = {
        ...playlist.trackNames,
        [trackId]: editingTrackName
      };
      
      await updateDoc(playlistRef, {
        trackNames: updatedTrackNames,
        updatedAt: new Date()
      });
      
      // Update local state
      setPlaylistTracks(prev => prev.map(track => 
        track.id === trackId ? { ...track, name: editingTrackName } : track
      ));
      
      const updatedPlaylist = {
        ...playlist,
        trackNames: updatedTrackNames,
        updatedAt: new Date()
      };
      
      onPlaylistUpdated(updatedPlaylist);
      setEditingTrackId(null);
      setEditingTrackName('');
    } catch (error) {
      console.error('Error updating track name:', error);
      alert('Failed to update track name. Please try again.');
    }
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
    if (isReadOnly) return;
    setDraggedTrack(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    if (isReadOnly) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (e: React.DragEvent, dropIndex: number) => {
    if (isReadOnly || !onPlaylistUpdated) return;
    
    e.preventDefault();
    
    if (draggedTrack === null || draggedTrack === dropIndex) {
      setDraggedTrack(null);
      return;
    }

    const newTracks = [...playlistTracks];
    const draggedItem = newTracks[draggedTrack];
    newTracks.splice(draggedTrack, 1);
    newTracks.splice(dropIndex, 0, draggedItem);

    setPlaylistTracks(newTracks);
    setDraggedTrack(null);

    // Save new order to database
    try {
      const trackOrder = newTracks.map(track => track.id);
      const playlistRef = doc(db, 'playlists', playlist.id);
      
      await updateDoc(playlistRef, {
        trackOrder,
        updatedAt: new Date()
      });
      
      const updatedPlaylist = {
        ...playlist,
        trackOrder,
        updatedAt: new Date()
      };
      
      onPlaylistUpdated(updatedPlaylist);
    } catch (error) {
      console.error('Error saving track order:', error);
      alert('Failed to save track order. Please try again.');
    }
  };

  const handlePlayTrack = async (track: Track) => {
    try {
      if (currentlyPlaying === track.id) {
        // Pause current track
        setCurrentlyPlaying(null);
        window.dispatchEvent(new CustomEvent('pauseTrack'));
        return;
      }

      setCurrentlyPlaying(track.id);
      
      // Emit event to play track with the full playlist
      window.dispatchEvent(new CustomEvent('playTrackFromPlaylist', { 
        detail: { 
          track, 
          playlist: playlistTracks,
          index: playlistTracks.findIndex(t => t.id === track.id)
        } 
      }));
    } catch (error) {
      console.error('Error playing track:', error);
      alert('Failed to play track. Please try again.');
    }
  };

  const handleRemoveTrack = async (trackId: string) => {
    if (isReadOnly || !onPlaylistUpdated) return;
    
    if (!confirm('Are you sure you want to remove this track from the playlist?')) {
      return;
    }

    try {
      // Create a list of excluded tracks
      const excludedTracks = playlist.excludedTracks || [];
      excludedTracks.push(trackId);
      
      const playlistRef = doc(db, 'playlists', playlist.id);
      await updateDoc(playlistRef, {
        excludedTracks,
        updatedAt: new Date()
      });

      // Remove from local state
      setPlaylistTracks(prev => prev.filter(track => track.id !== trackId));
      
      const updatedPlaylist = {
        ...playlist,
        excludedTracks,
        updatedAt: new Date()
      };
      
      onPlaylistUpdated(updatedPlaylist);
    } catch (error) {
      console.error('Error removing track:', error);
      alert('Failed to remove track. Please try again.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            onClick={onBack}
            className="flex items-center space-x-2 text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Back</span>
          </button>
        </div>
      </div>

      {/* Playlist Header */}
      <div className="bg-gray-800/30 backdrop-blur-sm rounded-xl border border-gray-700/50 p-4 sm:p-8">
        <div className="flex flex-col sm:flex-row items-center space-y-4 sm:space-y-0 sm:space-x-6">
          <div className="w-32 h-32 sm:w-48 sm:h-48 rounded-lg overflow-hidden flex-shrink-0">
            {playlist.coverImageUrl ? (
              <img 
                src={playlist.coverImageUrl} 
                alt={playlistTitle} 
                className="w-full h-full object-cover" 
              />
            ) : (
              <img 
                src={generatePlaylistCover(playlistTitle || playlist.name, 192)} 
                alt={playlistTitle || playlist.name} 
                className="w-full h-full object-cover" 
              />
            )}
          </div>
          
          <div className="flex-1 text-center sm:text-left">
            <div className="mb-2">
              {editingTitle && !isReadOnly ? (
                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    value={playlistTitle}
                    onChange={(e) => setPlaylistTitle(e.target.value)}
                    className="text-2xl sm:text-5xl font-bold text-white bg-transparent border-b border-white/50 focus:border-white focus:outline-none w-full max-w-full"
                    autoFocus
                  />
                  <div className="flex space-x-2">
                    <button
                      onClick={handleSaveTitle}
                      className="p-2 text-green-400 hover:text-green-300"
                    >
                      <Save className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => {
                        setEditingTitle(false);
                        setPlaylistTitle(playlist.displayName || playlist.name);
                      }}
                      className="p-2 text-red-400 hover:text-red-300"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center sm:justify-start space-x-2">
                  <h1 className="text-2xl sm:text-5xl font-bold text-white break-words">{playlistTitle}</h1>
                  {!isReadOnly && (
                    <button
                      onClick={() => setEditingTitle(true)}
                      className="p-2 text-gray-400 hover:text-white flex-shrink-0"
                    >
                      <Edit3 className="w-5 h-5" />
                    </button>
                  )}
                </div>
              )}
            </div>
            
            <div className="mb-4">
              {editingArtist && !isReadOnly ? (
                <div className="flex items-center justify-center sm:justify-start space-x-2">
                  <input
                    type="text"
                    value={artistName}
                    onChange={(e) => setArtistName(e.target.value)}
                    className="text-lg sm:text-xl text-gray-300 bg-transparent border-b border-gray-500 focus:border-white focus:outline-none w-full max-w-full"
                    autoFocus
                  />
                  <div className="flex space-x-2">
                    <button
                      onClick={handleSaveArtist}
                      className="p-1 text-green-400 hover:text-green-300"
                    >
                      <Save className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => {
                        setEditingArtist(false);
                        setArtistName(playlist.artist || 'Unknown Artist');
                      }}
                      className="p-1 text-red-400 hover:text-red-300"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center sm:justify-start space-x-2">
                  <p className="text-lg sm:text-xl text-gray-300 break-words">{artistName}</p>
                  {!isReadOnly && (
                    <button
                      onClick={() => setEditingArtist(true)}
                      className="p-1 text-gray-400 hover:text-white flex-shrink-0"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              )}
            </div>
            
            <div className="text-gray-400">
              {loadingTracks ? (
                <p>Loading tracks...</p>
              ) : (
                <p>{playlistTracks.length} tracks • {calculateTotalDuration()}</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tracks List */}
      <div className="bg-gray-800/30 backdrop-blur-sm rounded-xl border border-gray-700/50">
        <div className="p-6">
          {loadingTracks ? (
            <div className="text-center py-12">
              <div className="w-8 h-8 animate-spin rounded-full border-t-2 border-b-2 border-green-500 mx-auto mb-4"></div>
              <p className="text-gray-400">Loading tracks...</p>
            </div>
          ) : playlistTracks.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-400">No tracks in this playlist</p>
            </div>
          ) : (
            <div className="space-y-1">
              {playlistTracks.map((track, index) => (
                <div
                  key={track.id}
                  draggable={!isReadOnly}
                  onDragStart={(e) => handleDragStart(e, index)}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, index)}
                  className={`flex items-center p-3 rounded-lg hover:bg-gray-700/50 transition-colors group ${
                    draggedTrack === index ? 'opacity-50' : ''
                  }`}
                >
                  <div className="flex items-center space-x-3 flex-1">
                    {/* Track Number */}
                    <div className="w-8 text-center">
                      <span className="text-sm text-gray-400 font-mono">{(index + 1).toString().padStart(2, '0')}</span>
                    </div>
                    
                    {!isReadOnly && (
                      <GripVertical className="w-4 h-4 text-gray-500 cursor-move" />
                    )}
                    
                    <button
                      onClick={() => handlePlayTrack(track)}
                      className="w-8 h-8 bg-green-600/20 rounded-full flex items-center justify-center hover:bg-green-600 transition-colors"
                    >
                      {currentlyPlaying === track.id ? (
                        <Pause className="w-4 h-4 text-white" />
                      ) : (
                        <Play className="w-4 h-4 text-green-400 hover:text-white" />
                      )}
                    </button>
                    
                    <div className="flex-1">
                      {editingTrackId === track.id && !isReadOnly ? (
                        <div className="flex items-center space-x-2">
                          <input
                            type="text"
                            value={editingTrackName}
                            onChange={(e) => setEditingTrackName(e.target.value)}
                            className="text-white bg-transparent border-b border-gray-500 focus:border-white focus:outline-none"
                            autoFocus
                          />
                          <button
                            onClick={() => handleSaveTrackName(track.id)}
                            className="p-1 text-green-400 hover:text-green-300"
                          >
                            <Save className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => {
                              setEditingTrackId(null);
                              setEditingTrackName('');
                            }}
                            className="p-1 text-red-400 hover:text-red-300"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center space-x-2">
                          <span className="text-white">{track.name}</span>
                          {!isReadOnly && (
                            <button
                              onClick={() => {
                                setEditingTrackId(track.id);
                                setEditingTrackName(track.name);
                              }}
                              className="p-1 text-gray-400 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <Edit3 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2 ml-4">
                    {!isReadOnly && (
                      <button
                        onClick={() => handleRemoveTrack(track.id)}
                        className="p-1 text-gray-400 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Remove from playlist"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                    <div className="text-sm text-gray-400">
                      {track.duration}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};