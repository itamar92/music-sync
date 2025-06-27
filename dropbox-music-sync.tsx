import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, SkipForward, SkipBack, Volume2, Share2, Folder, Music, Download, ArrowLeft, MoreHorizontal, Upload, RefreshCw, Copy } from 'lucide-react';

const MusicPlaylistApp = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(true);
  const [folders, setFolders] = useState([]);
  const [selectedFolder, setSelectedFolder] = useState(null);
  const [playlist, setPlaylist] = useState([]);
  const [currentTrack, setCurrentTrack] = useState(null);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [view, setView] = useState('folders');
  const [albumCover, setAlbumCover] = useState(null);
  const [totalDuration, setTotalDuration] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [shareModal, setShareModal] = useState(false);
  const [shareUrl, setShareUrl] = useState('');
  const [showPlaylistCreator, setShowPlaylistCreator] = useState(false);
  const [customPlaylists, setCustomPlaylists] = useState([]);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [selectedTracks, setSelectedTracks] = useState([]);
  const [allFolders, setAllFolders] = useState([]);
  const [syncedFolders, setSyncedFolders] = useState([]);
  const [showFolderSelector, setShowFolderSelector] = useState(false);
  const audioRef = useRef(null);
  const fileInputRef = useRef(null);

  // Mock data for demonstration
  const mockAllFolders = [
    { id: 1, name: 'Latest Beats', path: '/Music/Latest Beats', trackCount: 12, synced: true },
    { id: 2, name: 'Hip Hop Projects', path: '/Music/Hip Hop', trackCount: 8, synced: true },
    { id: 3, name: 'Electronic Mixes', path: '/Music/Electronic', trackCount: 15, synced: false },
    { id: 4, name: 'Client Work', path: '/Music/Client Work', trackCount: 6, synced: true },
    { id: 5, name: 'Demos & Drafts', path: '/Music/Demos', trackCount: 25, synced: false },
    { id: 6, name: 'Collaborations', path: '/Music/Collabs', trackCount: 9, synced: false },
    { id: 7, name: 'Mixing Templates', path: '/Music/Templates', trackCount: 4, synced: false },
    { id: 8, name: 'Archive', path: '/Music/Archive', trackCount: 50, synced: false }
  ];

  const mockTracks = [
    { id: 1, name: 'Track One', artist: 'Artist A', duration: '4:09', durationSeconds: 249 },
    { id: 2, name: 'Track Two', artist: 'Artist B', duration: '3:00', durationSeconds: 180 },
    { id: 3, name: 'Track Three', artist: 'Artist A', duration: '3:42', durationSeconds: 222 },
    { id: 4, name: 'Track Four', artist: 'Artist C', duration: '3:59', durationSeconds: 239 },
    { id: 5, name: 'Track Five', artist: 'Artist B', duration: '3:20', durationSeconds: 200 },
    { id: 6, name: 'Track Six', artist: 'Artist A', duration: '2:16', durationSeconds: 136 },
    { id: 7, name: 'Track Seven', artist: 'Artist C', duration: '4:02', durationSeconds: 242 },
    { id: 8, name: 'Track Eight', artist: 'Artist B', duration: '3:20', durationSeconds: 200 },
  ];

  // Initialize with mock data
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsConnected(true);
      setAllFolders(mockAllFolders);
      setFolders(mockAllFolders.filter(f => f.synced));
      setSyncedFolders(mockAllFolders.filter(f => f.synced).map(f => f.id));
      setIsConnecting(false);
      
      // Load saved playlists from localStorage
      const savedPlaylists = localStorage.getItem('custom_playlists');
      if (savedPlaylists) {
        try {
          setCustomPlaylists(JSON.parse(savedPlaylists));
        } catch (e) {
          console.error('Error parsing saved playlists:', e);
        }
      }
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  // Calculate total duration when playlist changes
  useEffect(() => {
    if (playlist.length > 0) {
      const totalSeconds = playlist.reduce((sum, track) => sum + track.durationSeconds, 0);
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      
      if (hours > 0) {
        setTotalDuration(`${hours}h ${minutes}m`);
      } else {
        setTotalDuration(`${minutes}m`);
      }
    }
  }, [playlist]);

  const handleFolderSelect = async (folder) => {
    setSelectedFolder(folder);
    setView('playlist');
    setAlbumCover(null);
    setPlaylist(mockTracks);
  };

  const handleBackToFolders = () => {
    setView('folders');
    setSelectedFolder(null);
    setPlaylist([]);
    setCurrentTrack(null);
    setIsPlaying(false);
    setAlbumCover(null);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
    }
  };

  const handlePlayPause = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play().catch(e => console.log('Audio play failed:', e));
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleTrackSelect = async (track, index) => {
    try {
      setCurrentTrack(track);
      setCurrentTrackIndex(index);
      setIsPlaying(true);
      
      if (audioRef.current) {
        // Using a demo audio URL
        audioRef.current.src = 'https://www.soundjay.com/misc/sounds/fail-buzzer-02.wav';
        audioRef.current.load();
      }
    } catch (error) {
      console.error('Error playing track:', error);
    }
  };

  const playNextTrack = () => {
    if (currentTrackIndex < playlist.length - 1) {
      const nextIndex = currentTrackIndex + 1;
      handleTrackSelect(playlist[nextIndex], nextIndex);
    } else {
      setIsPlaying(false);
    }
  };

  const playPreviousTrack = () => {
    if (currentTrackIndex > 0) {
      const prevIndex = currentTrackIndex - 1;
      handleTrackSelect(playlist[prevIndex], prevIndex);
    }
  };

  const handleTrackEnd = () => {
    playNextTrack();
  };

  const formatTime = (time) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setAllFolders(mockAllFolders);
      setFolders(mockAllFolders.filter(f => f.synced));
      setIsRefreshing(false);
    }, 1000);
  };

  const toggleFolderSync = (folderId) => {
    setAllFolders(prev => prev.map(folder => 
      folder.id === folderId ? { ...folder, synced: !folder.synced } : folder
    ));
    
    setSyncedFolders(prev => {
      const newSynced = prev.includes(folderId) 
        ? prev.filter(id => id !== folderId)
        : [...prev, folderId];
      
      setFolders(mockAllFolders.filter(f => newSynced.includes(f.id)));
      return newSynced;
    });
  };

  const createCustomPlaylist = () => {
    if (!newPlaylistName.trim() || selectedTracks.length === 0) return;
    
    const newPlaylist = {
      id: Date.now(),
      name: newPlaylistName,
      tracks: selectedTracks,
      createdAt: new Date().toISOString(),
      type: 'custom'
    };
    
    const updatedPlaylists = [...customPlaylists, newPlaylist];
    setCustomPlaylists(updatedPlaylists);
    localStorage.setItem('custom_playlists', JSON.stringify(updatedPlaylists));
    
    setNewPlaylistName('');
    setSelectedTracks([]);
    setShowPlaylistCreator(false);
  };

  const toggleTrackSelection = (track) => {
    setSelectedTracks(prev => {
      const isSelected = prev.find(t => t.id === track.id);
      if (isSelected) {
        return prev.filter(t => t.id !== track.id);
      } else {
        return [...prev, track];
      }
    });
  };

  const handleCustomPlaylistSelect = (playlist) => {
    setSelectedFolder({ ...playlist, trackCount: playlist.tracks.length });
    setPlaylist(playlist.tracks);
    setView('playlist');
  };

  const generateShareLink = (item) => {
    const shareUrl = `${window.location.origin}/share/${btoa(JSON.stringify({
      trackId: item.id,
      folderId: selectedFolder?.id,
      folderName: selectedFolder?.name
    }))}`;
    setShareUrl(shareUrl);
    setShareModal(true);
  };

  const copyShareLink = () => {
    navigator.clipboard.writeText(shareUrl);
    alert('Share link copied to clipboard!');
    setShareModal(false);
  };

  const playAllTracks = () => {
    if (playlist.length > 0) {
      handleTrackSelect(playlist[0], 0);
    }
  };

  const handleAlbumCoverUpload = (event) => {
    const file = event.target.files[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setAlbumCover(e.target.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const triggerFileUpload = () => {
    fileInputRef.current?.click();
  };

  const handleAudioMetadata = (e) => {
    setDuration(e.target.duration);
  };

  if (isConnecting) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-black flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <h2 className="text-2xl font-bold text-white mb-2">Connecting to Dropbox</h2>
          <p className="text-gray-300">Syncing your music folders...</p>
        </div>
      </div>
    );
  }

  if (view === 'playlist' && selectedFolder) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-black via-blue-900 to-black text-white">
        {/* Header */}
        <header className="bg-black/50 backdrop-blur-sm border-b border-blue-500/20 p-4">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button 
                onClick={handleBackToFolders}
                className="p-2 hover:bg-blue-500/20 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-lg flex items-center justify-center">
                  <Music className="w-5 h-5" />
                </div>
                <span className="text-lg font-medium">MusicSync</span>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <button 
                onClick={() => generateShareLink(selectedFolder)}
                className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg transition-colors"
              >
                <Share2 className="w-4 h-4" />
                <span>Share</span>
              </button>
            </div>
          </div>
        </header>

        <div className="max-w-7xl mx-auto p-8">
          {/* Playlist Header */}
          <div className="flex items-start space-x-8 mb-8">
            <div className="relative group">
              <div className="w-64 h-64 bg-gradient-to-br from-gray-800 to-black rounded-lg flex items-center justify-center border border-gray-700 overflow-hidden">
                {albumCover ? (
                  <img src={albumCover} alt="Album Cover" className="w-full h-full object-cover" />
                ) : (
                  <Music className="w-24 h-24 text-gray-500" />
                )}
              </div>
              <button
                onClick={triggerFileUpload}
                className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center"
              >
                <div className="text-center">
                  <Upload className="w-8 h-8 mx-auto mb-2" />
                  <span className="text-sm">Upload Cover</span>
                </div>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleAlbumCoverUpload}
                className="hidden"
              />
            </div>
            
            <div className="flex-1 pt-4">
              <h1 className="text-4xl font-bold mb-2">{selectedFolder.name}</h1>
              <p className="text-gray-400 mb-6">{playlist.length} tracks{totalDuration && `, ${totalDuration}`}</p>
              
              <div className="flex items-center space-x-4">
                <button 
                  onClick={playAllTracks}
                  disabled={playlist.length === 0}
                  className="flex items-center space-x-2 bg-white text-black px-6 py-3 rounded-lg font-medium hover:bg-gray-100 transition-colors disabled:opacity-50"
                >
                  <Play className="w-5 h-5" />
                  <span>Play</span>
                </button>
              </div>
            </div>
          </div>

          {/* Track List */}
          <div className="bg-black/30 rounded-lg border border-gray-700/50">
            <div className="p-6">
              <div className="space-y-1">
                {playlist.map((track, index) => (
                  <div
                    key={track.id}
                    className={`group flex items-center space-x-4 p-3 rounded-lg cursor-pointer transition-all duration-200 ${
                      currentTrack?.id === track.id
                        ? 'bg-blue-600/20'
                        : 'hover:bg-gray-700/30'
                    }`}
                    onClick={() => handleTrackSelect(track, index)}
                  >
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
                    
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-white truncate">{track.name}</h3>
                      <p className="text-sm text-gray-400 truncate">{track.artist}</p>
                    </div>
                    
                    <div className="flex items-center space-x-4">
                      <span className="text-gray-400 text-sm">{track.duration}</span>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          generateShareLink(track);
                        }}
                        className="p-1 text-gray-400 hover:text-white opacity-0 group-hover:opacity-100 transition-all"
                      >
                        <Share2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Audio Player */}
        {currentTrack && (
          <div className="fixed bottom-0 left-0 right-0 bg-black/95 backdrop-blur-sm border-t border-blue-500/20 p-4">
            <div className="max-w-7xl mx-auto">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-lg flex items-center justify-center">
                    <Music className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-medium text-white">{currentTrack.name}</h3>
                    <p className="text-sm text-gray-400">{currentTrack.artist}</p>
                  </div>
                </div>

                <div className="flex items-center space-x-4">
                  <button 
                    onClick={playPreviousTrack}
                    className="p-2 text-gray-400 hover:text-white transition-colors disabled:opacity-50"
                    disabled={currentTrackIndex === 0}
                  >
                    <SkipBack className="w-5 h-5" />
                  </button>
                  <button
                    onClick={handlePlayPause}
                    className="w-12 h-12 bg-white text-black rounded-full flex items-center justify-center hover:bg-gray-100 transition-colors"
                  >
                    {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6" />}
                  </button>
                  <button 
                    onClick={playNextTrack}
                    className="p-2 text-gray-400 hover:text-white transition-colors disabled:opacity-50"
                    disabled={currentTrackIndex === playlist.length - 1}
                  >
                    <SkipForward className="w-5 h-5" />
                  </button>
                </div>

                <div className="flex items-center space-x-3">
                  <Volume2 className="w-5 h-5 text-gray-400" />
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={volume}
                    onChange={(e) => setVolume(parseFloat(e.target.value))}
                    className="w-24 accent-blue-500"
                  />
                </div>
              </div>

              <div className="mt-2 bg-gray-700 rounded-full h-1">
                <div
                  className="bg-gradient-to-r from-blue-500 to-cyan-500 h-1 rounded-full transition-all duration-300"
                  style={{ width: `${(currentTime / duration) * 100 || 0}%` }}
                ></div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Main folders view
  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-blue-900 to-black text-white">
      {/* Header */}
      <header className="bg-black/50 backdrop-blur-sm border-b border-blue-500/20 p-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-lg flex items-center justify-center">
              <Music className="w-6 h-6" />
            </div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
              MusicSync
            </h1>
          </div>
          <div className="flex items-center space-x-4">
            <button
              onClick={() => setShowFolderSelector(true)}
              className="flex items-center space-x-2 px-3 py-2 text-gray-300 hover:text-white transition-colors"
            >
              <Folder className="w-4 h-4" />
              <span>Manage Folders</span>
            </button>
            <button
              onClick={() => setShowPlaylistCreator(true)}
              className="flex items-center space-x-2 px-3 py-2 bg-green-600 hover:bg-green-700 rounded-lg transition-colors"
            >
              <Music className="w-4 h-4" />
              <span>Create Playlist</span>
            </button>
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="flex items-center space-x-2 px-3 py-2 text-gray-300 hover:text-white transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
            <div className="flex items-center space-x-2 text-sm">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span className="text-green-400">Connected to Dropbox</span>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto p-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
          {/* Sidebar - Folders and Playlists */}
          <div className="lg:col-span-1 space-y-6">
            {/* Synced Folders */}
            <div className="bg-black/30 backdrop-blur-sm rounded-xl border border-blue-500/20 p-6">
              <h2 className="text-xl font-semibold mb-6 flex items-center">
                <Folder className="w-5 h-5 mr-2" />
                Synced Folders
              </h2>
              {folders.length === 0 ? (
                <div className="text-center py-8">
                  <Folder className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                  <p className="text-gray-400">No synced folders</p>
                  <button
                    onClick={() => setShowFolderSelector(true)}
                    className="mt-4 text-blue-400 hover:text-blue-300 transition-colors"
                  >
                    Select folders to sync
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {folders.map((folder) => (
                    <div
                      key={folder.id}
                      onClick={() => handleFolderSelect(folder)}
                      className="p-4 rounded-lg cursor-pointer transition-all duration-200 bg-gray-800/30 hover:bg-blue-500/20 border border-transparent hover:border-blue-500/30"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-medium">{folder.name}</h3>
                          <p className="text-sm text-gray-400">
                            {folder.trackCount > 0 ? `${folder.trackCount} tracks` : 'Click to load tracks'}
                          </p>
                        </div>
                        <div className="text-blue-400">
                          <Music className="w-4 h-4" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Custom Playlists */}
            <div className="bg-black/30 backdrop-blur-sm rounded-xl border border-green-500/20 p-6">
              <h2 className="text-xl font-semibold mb-6 flex items-center">
                <Music className="w-5 h-5 mr-2" />
                Custom Playlists
              </h2>
              {customPlaylists.length === 0 ? (
                <div className="text-center py-8">
                  <Music className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                  <p className="text-gray-400">No custom playlists</p>
                  <button
                    onClick={() => setShowPlaylistCreator(true)}
                    className="mt-4 text-green-400 hover:text-green-300 transition-colors"
                  >
                    Create your first playlist
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {customPlaylists.map((playlist) => (
                    <div
                      key={playlist.id}
                      onClick={() => handleCustomPlaylistSelect(playlist)}
                      className="p-4 rounded-lg cursor-pointer transition-all duration-200 bg-gray-800/30 hover:bg-green-500/20 border border-transparent hover:border-green-500/30"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-medium">{playlist.name}</h3>
                          <p className="text-sm text-gray-400">{playlist.tracks.length} tracks</p>
                        </div>
                        <div className="text-green-400">
                          <Music className="w-4 h-4" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-2">
            <div className="bg-black/30 backdrop-blur-sm rounded-xl border border-blue-500/20 p-6">
              <div className="text-center py-12">
                <Music className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                <p className="text-gray-400">Select a folder or playlist to start listening</p>
                <p className="text-sm text-gray-500 mt-2">
                  Use "Manage Folders" to choose which Dropbox folders to sync, or "Create Playlist" to make custom collections.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Folder Selector Modal */}
      {showFolderSelector && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-900 p-6 rounded-lg max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
            <h3 className="text-2xl font-semibold mb-6">Manage Dropbox Folders</h3>
            <p className="text-gray-400 mb-6">Select which folders you want to sync and display in your music library.</p>
            
            <div className="space-y-3 mb-6">
              {allFolders.map((folder) => (
                <div
                  key={folder.id}
                  className="flex items-center justify-between p-4 bg-gray-800/50 rounded-lg border border-gray-700"
                >
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={folder.synced}
                      onChange={() => toggleFolderSync(folder.id)}
                      className="w-5 h-5 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500 focus:ring-2"
                    />
                    <span className="text-sm text-gray-300">
                      {folder.synced ? 'Synced' : 'Not synced'}
                    </span>
                  </label>
                </div>
              ))}
            </div>
            
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowFolderSelector(false)}
                className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => setShowFolderSelector(false)}
                className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded transition-colors"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Playlist Creator Modal */}
      {showPlaylistCreator && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-900 p-6 rounded-lg max-w-4xl w-full mx-4 max-h-[80vh] overflow-y-auto">
            <h3 className="text-2xl font-semibold mb-6">Create Custom Playlist</h3>
            
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Playlist Name
              </label>
              <input
                type="text"
                value={newPlaylistName}
                onChange={(e) => setNewPlaylistName(e.target.value)}
                placeholder="Enter playlist name..."
                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="mb-6">
              <h4 className="text-lg font-medium mb-4">
                Select Tracks ({selectedTracks.length} selected)
              </h4>
              
              {folders.map((folder) => (
                <div key={folder.id} className="mb-6">
                  <h5 className="font-medium text-blue-400 mb-3">{folder.name}</h5>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {mockTracks.map((track) => {
                      const trackId = `${folder.id}-${track.id}`;
                      const isSelected = selectedTracks.find(t => t.id === trackId);
                      
                      return (
                        <div
                          key={trackId}
                          className="flex items-center space-x-3 p-3 bg-gray-800/50 rounded-lg cursor-pointer hover:bg-gray-700/50 transition-colors"
                          onClick={() => toggleTrackSelection({ ...track, folderId: folder.id, id: trackId })}
                        >
                          <input
                            type="checkbox"
                            checked={!!isSelected}
                            onChange={() => {}}
                            className="w-4 h-4 text-green-600 bg-gray-700 border-gray-600 rounded focus:ring-green-500"
                          />
                          <div className="flex-1">
                            <h6 className="text-white font-medium">{track.name}</h6>
                            <p className="text-sm text-gray-400">{track.artist} • {track.duration}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
            
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowPlaylistCreator(false);
                  setNewPlaylistName('');
                  setSelectedTracks([]);
                }}
                className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={createCustomPlaylist}
                disabled={!newPlaylistName.trim() || selectedTracks.length === 0}
                className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Create Playlist
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Share Modal */}
      {shareModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-900 p-6 rounded-lg max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Share Link</h3>
            <div className="flex items-center space-x-2 mb-4">
              <input
                type="text"
                value={shareUrl}
                readOnly
                className="flex-1 bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm"
              />
              <button
                onClick={copyShareLink}
                className="bg-blue-600 hover:bg-blue-700 px-3 py-2 rounded transition-colors"
              >
                <Copy className="w-4 h-4" />
              </button>
            </div>
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => setShareModal(false)}
                className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={copyShareLink}
                className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded transition-colors"
              >
                Copy Link
              </button>
            </div>
          </div>
        </div>
      )}

      <audio
        ref={audioRef}
        onTimeUpdate={(e) => setCurrentTime(e.target.currentTime)}
        onLoadedMetadata={handleAudioMetadata}
        onEnded={handleTrackEnd}
        volume={volume}
        crossOrigin="anonymous"
      />
    </div>
  );
};

export default MusicPlaylistApp;
                