import React, { useState, useEffect } from 'react';
import { 
  Music, 
  Folder, 
  ArrowLeft, 
  Share2, 
  RefreshCw, 
  Upload,
  Play
} from 'lucide-react';
import { useDropbox } from './hooks/useDropbox';
import { useAudioPlayer } from './hooks/useAudioPlayer';
import { dropboxService } from './services/dropboxService';
import { AudioPlayer } from './components/AudioPlayer';
import { TrackList } from './components/TrackList';
import { FolderList } from './components/FolderList';
import { FolderBrowser } from './components/FolderBrowser';
import { ConnectionStatus } from './components/ConnectionStatus';
import { Modal, ShareModal } from './components/Modal';
import { FolderManagementModal } from './components/FolderManagementModal';
import { DebugInfo } from './components/DebugInfo';
import { Folder as FolderType, Track, ViewState, Playlist } from './types';
import { generateShareLink, copyToClipboard } from './utils/shareUtils';
import { calculatePlaylistDuration } from './utils/formatTime';
import { localDataService } from './services/localDataService';
import { EditableText } from './components/EditableText';

function App() {
  const {
    isConnected,
    isConnecting,
    folders,
    allFolders,
    syncedFolders,
    currentPath,
    managementFolders,
    managementPath,
    error: dropboxError,
    connect,
    refreshFolders,
    navigateToFolder,
    navigateBack,
    loadManagementFolders,
    navigateToManagementFolder,
    navigateManagementBack,
    toggleFolderSync,
    getTracksFromFolder,
    retry,
    updateFolderDisplayName,
    clearError
  } = useDropbox();

  const {
    audioRef,
    state: playerState,
    playlist,
    setPlaylist,
    togglePlayPause,
    playNext,
    playPrevious,
    setVolume,
    seek,
    playTrackFromPlaylist
  } = useAudioPlayer();

  const [view, setView] = useState<ViewState>('folders');
  const [selectedFolder, setSelectedFolder] = useState<FolderType | null>(null);
  const [albumCover, setAlbumCover] = useState<string | null>(null);
  const [shareModal, setShareModal] = useState(false);
  const [shareUrl, setShareUrl] = useState('');
  const [showFolderSelector, setShowFolderSelector] = useState(false);
  const [customPlaylists, setCustomPlaylists] = useState<Playlist[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingManagement, setIsLoadingManagement] = useState(false);
  const [loadingTracks, setLoadingTracks] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [authUrl, setAuthUrl] = useState('');

  useEffect(() => {
    if (isConnecting) {
      setView('connecting');
    } else {
      setView('folders');
    }
  }, [isConnected, isConnecting]);

  // Load custom playlists from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('custom_playlists');
    if (saved) {
      try {
        setCustomPlaylists(JSON.parse(saved));
      } catch (e) {
        console.error('Error parsing saved playlists:', e);
      }
    }
  }, []);

  // Listen for track duration updates
  useEffect(() => {
    const handleDurationUpdates = (event: CustomEvent) => {
      const { tracks, folderPath } = event.detail;
      console.log('Duration update event received:', { 
        folderPath, 
        selectedFolderPath: selectedFolder?.path,
        tracksCount: tracks.length,
        sampleDurations: tracks.slice(0, 3).map((t: Track) => ({ name: t.name, duration: t.duration }))
      });
      
      if (selectedFolder && selectedFolder.path === folderPath) {
        console.log('Updating playlist with new durations');
        // Update the current playlist with new durations
        const tracksWithAliases = localDataService.applyTrackAliases(tracks);
        setPlaylist(tracksWithAliases);
        console.log('Playlist updated, new durations:', tracksWithAliases.slice(0, 3).map((t: Track) => ({ name: t.name, duration: t.duration })));
      } else {
        console.log('Path mismatch - selectedFolder.path:', selectedFolder?.path, 'folderPath:', folderPath);
      }
    };

    window.addEventListener('trackDurationsUpdated', handleDurationUpdates as EventListener);
    
    return () => {
      window.removeEventListener('trackDurationsUpdated', handleDurationUpdates as EventListener);
    };
  }, [selectedFolder]);

  const handleFolderSelect = async (folder: FolderType) => {
    setSelectedFolder(folder);
    setLoadingTracks(true);
    setView('playlist');
    setAlbumCover(null);
    
    try {
      const tracks = await getTracksFromFolder(folder);
      const tracksWithAliases = localDataService.applyTrackAliases(tracks);
      setPlaylist(tracksWithAliases);
    } catch (error) {
      console.error('Failed to load tracks:', error);
      setPlaylist([]);
    } finally {
      setLoadingTracks(false);
    }
  };

  const handleBackToFolders = () => {
    setView('folders');
    setSelectedFolder(null);
    setPlaylist([]);
    setAlbumCover(null);
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refreshFolders();
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleOpenFolderSelector = async () => {
    setShowFolderSelector(true);
    setIsLoadingManagement(true);
    try {
      await loadManagementFolders('');
    } finally {
      setIsLoadingManagement(false);
    }
  };

  const handleLoadFolderDetails = async (folder: FolderType) => {
    return await dropboxService.getFolderDetails(folder.path);
  };

  const handleNavigateToManagementFolder = async (path: string) => {
    setIsLoadingManagement(true);
    try {
      await navigateToManagementFolder(path);
    } finally {
      setIsLoadingManagement(false);
    }
  };

  const handleShare = (item: Track | FolderType) => {
    const url = generateShareLink(item, selectedFolder?.id);
    setShareUrl(url);
    setShareModal(true);
  };

  const handleCopyShareLink = async () => {
    const success = await copyToClipboard(shareUrl);
    if (success) {
      alert('Share link copied to clipboard!');
    } else {
      alert('Failed to copy link');
    }
    setShareModal(false);
  };

  const playAllTracks = () => {
    if (playlist.length > 0) {
      playTrackFromPlaylist(playlist[0], 0);
    }
  };

  const handleAlbumCoverUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setAlbumCover(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handlePlaylistNameChange = (newName: string) => {
    if (selectedFolder) {
      localDataService.savePlaylistAlias(selectedFolder.id, newName);
      // Update the selected folder to reflect the change
      setSelectedFolder(prev => prev ? { ...prev, displayName: newName } : null);
      // Update the folders list to reflect the change in the main view
      updateFolderDisplayName(selectedFolder.id, newName);
    }
  };

  const handleTrackNameChange = (trackId: string, newName: string) => {
    const track = playlist.find(t => t.id === trackId);
    if (track) {
      localDataService.saveTrackAlias(trackId, newName, track.displayArtist || track.artist);
      // Update the playlist to reflect the change
      setPlaylist(prev => prev.map(t => 
        t.id === trackId ? { ...t, displayName: newName } : t
      ));
    }
  };

  const handleTrackArtistChange = (trackId: string, newArtist: string) => {
    const track = playlist.find(t => t.id === trackId);
    if (track) {
      localDataService.saveTrackAlias(trackId, track.displayName || track.name, newArtist);
      // Update the playlist to reflect the change
      setPlaylist(prev => prev.map(t => 
        t.id === trackId ? { ...t, displayArtist: newArtist } : t
      ));
    }
  };

  const handleConnect = async () => {
    const url = await dropboxService.authenticate(false);
    if (typeof url === 'string') {
      setAuthUrl(url);
    }
  };

  if(authUrl) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center p-4">
        <div className="text-center max-w-2xl">
          <h2 className="text-2xl font-bold mb-4">Dropbox Authentication</h2>
          <p className="mb-6">Please add the following URL to your Dropbox app's redirect URIs:</p>
          <div className="bg-gray-800 p-4 rounded-lg mb-6">
            <p className="text-lg font-mono break-all">{window.location.origin}</p>
          </div>
          <a href={authUrl} className="bg-blue-600 hover:bg-blue-700 px-6 py-3 rounded-lg font-medium transition-colors">
            Continue to Dropbox
          </a>
        </div>
      </div>
    );
  }

  if (view === 'connecting') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-black flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <h2 className="text-2xl font-bold text-white mb-2">Connecting to Dropbox</h2>
          <p className="text-gray-300">Checking connection...</p>
          {dropboxError && (
            <div className="mt-4 p-4 bg-red-900/50 rounded-lg border border-red-500/20">
              <p className="text-red-400 text-sm">{dropboxError}</p>
              <button
                onClick={clearError}
                className="mt-2 text-blue-400 hover:text-blue-300 underline text-sm"
              >
                Dismiss
              </button>
            </div>
          )}
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
                onClick={() => handleShare(selectedFolder)}
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
              <label className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center cursor-pointer">
                <div className="text-center">
                  <Upload className="w-8 h-8 mx-auto mb-2" />
                  <span className="text-sm">Upload Cover</span>
                </div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleAlbumCoverUpload}
                  className="hidden"
                />
              </label>
            </div>
            
            <div className="flex-1 pt-4">
              <EditableText
                text={localDataService.getFolderDisplayName(selectedFolder)}
                onSave={handlePlaylistNameChange}
                className="text-4xl font-bold mb-2 block"
                placeholder="Playlist name..."
                maxLength={50}
              />
              <p className="text-gray-400 mb-6">
                {playlist.length} tracks
                {playlist.length > 0 && `, ${calculatePlaylistDuration(playlist)}`}
              </p>
              
              <div className="flex items-center space-x-4">
                <button 
                  onClick={playAllTracks}
                  disabled={playlist.length === 0 || loadingTracks}
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
              {loadingTracks ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
                  <p className="text-gray-400">Loading tracks...</p>
                </div>
              ) : (
                <TrackList
                  tracks={playlist}
                  currentTrack={playerState.currentTrack}
                  isPlaying={playerState.isPlaying}
                  onTrackSelect={playTrackFromPlaylist}
                  onShare={setShareUrl}
                  onTrackNameChange={handleTrackNameChange}
                  onTrackArtistChange={handleTrackArtistChange}
                />
              )}
            </div>
          </div>
        </div>

        <AudioPlayer
          audioRef={audioRef}
          state={playerState}
          playlist={playlist}
          onPlayPause={togglePlayPause}
          onNext={playNext}
          onPrevious={playPrevious}
          onVolumeChange={setVolume}
          onSeek={seek}
        />
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
            {isConnected && (
              <>
                <button
                  onClick={handleOpenFolderSelector}
                  className="flex items-center space-x-2 px-3 py-2 text-gray-300 hover:text-white transition-colors"
                >
                  <Folder className="w-4 h-4" />
                  <span>Manage Folders</span>
                </button>
                <button
                  onClick={handleRefresh}
                  disabled={isRefreshing}
                  className="flex items-center space-x-2 px-3 py-2 text-gray-300 hover:text-white transition-colors disabled:opacity-50"
                >
                  <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                  <span>Refresh</span>
                </button>
              </>
            )}
            <ConnectionStatus
              isConnected={isConnected}
              isConnecting={isConnecting}
              error={dropboxError}
              onConnect={connect}
              onRetry={retry}
            />
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto p-6">
        {!isConnected ? (
          <div className="text-center py-12">
            <Music className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-4">Welcome to MusicSync</h2>
            <p className="text-gray-400 mb-6">Connect your Dropbox account to sync your music folders</p>
            <button
              onClick={handleConnect}
              className="bg-blue-600 hover:bg-blue-700 px-6 py-3 rounded-lg font-medium transition-colors"
            >
              Connect to Dropbox
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
            {/* Sidebar - Folders */}
            <div className="lg:col-span-1 space-y-6">
              <div className="bg-black/30 backdrop-blur-sm rounded-xl border border-blue-500/20 p-6">
                <h2 className="text-xl font-semibold mb-6 flex items-center">
                  <Folder className="w-5 h-5 mr-2" />
                  {currentPath ? 'Browse Folders' : 'Synced Folders'}
                </h2>
                <FolderBrowser
                  folders={folders}
                  onFolderSelect={handleFolderSelect}
                  onNavigateToFolder={navigateToFolder}
                  onBack={navigateBack}
                  currentPath={currentPath}
                  isLoading={isRefreshing}
                  searchQuery={searchQuery}
                  onSearchChange={setSearchQuery}
                  onLoadFolderDetails={handleLoadFolderDetails}
                />
              </div>
            </div>

            {/* Main Content */}
            <div className="lg:col-span-2">
              <div className="bg-black/30 backdrop-blur-sm rounded-xl border border-blue-500/20 p-6">
                <div className="text-center py-12">
                  <Music className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                  <p className="text-gray-400">Select a folder to start listening</p>
                  <p className="text-sm text-gray-500 mt-2">
                    Use "Manage Folders" to choose which Dropbox folders to sync.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Folder Management Modal */}
      <FolderManagementModal
        isOpen={showFolderSelector}
        onClose={() => setShowFolderSelector(false)}
        folders={managementFolders}
        syncedFolders={syncedFolders}
        onToggleSync={toggleFolderSync}
        onNavigateToFolder={handleNavigateToManagementFolder}
        onNavigateBack={navigateManagementBack}
        currentPath={managementPath}
        isLoading={isLoadingManagement}
        onLoadFolderDetails={handleLoadFolderDetails}
      />

      {/* Share Modal */}
      <ShareModal
        isOpen={shareModal}
        onClose={() => setShareModal(false)}
        shareUrl={shareUrl}
        onCopy={handleCopyShareLink}
      />

      <AudioPlayer
        audioRef={audioRef}
        state={playerState}
        playlist={playlist}
        onPlayPause={togglePlayPause}
        onNext={playNext}
        onPrevious={playPrevious}
        onVolumeChange={setVolume}
        onSeek={seek}
      />

      <DebugInfo
        isConnected={isConnected}
        isConnecting={isConnecting}
        error={dropboxError}
        folders={folders}
        allFolders={allFolders}
        managementFolders={managementFolders}
        managementPath={managementPath}
      />
    </div>
  );
}

export default App;