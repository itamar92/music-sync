import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Music, Play, Heart, Share2, ChevronRight, LogIn, User } from 'lucide-react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { signOut } from 'firebase/auth';
import { useAudioPlayer } from './hooks/useAudioPlayer';
import { AudioPlayer } from './components/AudioPlayer';
import { TrackList } from './components/TrackList';
import { LoadingSpinner } from './components/LoadingSpinner';
import { LoginModal } from './components/LoginModal';
import { AdminSetup } from './components/AdminSetup';
import { FirebaseDebug } from './components/FirebaseDebug';
import { publicDataService } from './services/publicDataService';
import { useAdminRole } from './hooks/useAdminRole';
import { auth } from './services/firebase';
import { Collection, Playlist, Track } from './types';

export const PublicApp: React.FC = () => {
  const { collectionId, playlistId } = useParams();
  const navigate = useNavigate();
  
  const [user, userLoading] = useAuthState(auth);
  const { isAdmin } = useAdminRole(user?.uid);
  
  const [collections, setCollections] = useState<Collection[]>([]);
  const [selectedCollection, setSelectedCollection] = useState<Collection | null>(null);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [selectedPlaylist, setSelectedPlaylist] = useState<Playlist | null>(null);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showLoginModal, setShowLoginModal] = useState(false);

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

  // Load collections on mount
  useEffect(() => {
    const loadCollections = async () => {
      try {
        setLoading(true);
        const data = await publicDataService.getCollections();
        setCollections(data);
      } catch (err) {
        setError('Failed to load collections');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    loadCollections();
  }, []);

  // Load specific collection if collectionId is provided
  useEffect(() => {
    const loadCollection = async () => {
      if (!collectionId) return;

      try {
        setLoading(true);
        const [collection, playlistsData] = await Promise.all([
          publicDataService.getCollection(collectionId),
          publicDataService.getPlaylistsByCollection(collectionId)
        ]);
        setSelectedCollection(collection);
        setPlaylists(playlistsData);
      } catch (err) {
        setError('Failed to load collection');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    loadCollection();
  }, [collectionId]);

  // Load specific playlist if playlistId is provided
  useEffect(() => {
    const loadPlaylist = async () => {
      if (!playlistId) return;

      try {
        setLoading(true);
        const [playlistData, tracksData] = await Promise.all([
          publicDataService.getPlaylist(playlistId),
          publicDataService.getPlaylistTracks(playlistId)
        ]);
        setSelectedPlaylist(playlistData);
        setTracks(tracksData);
        setPlaylist(tracksData);
        
        // Also load the collection for context
        if (playlistData.collection) {
          setSelectedCollection(playlistData.collection);
        }
      } catch (err) {
        setError('Failed to load playlist');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    loadPlaylist();
  }, [playlistId, setPlaylist]);

  const handleCollectionSelect = (collection: Collection) => {
    navigate(`/collection/${collection.id}`);
  };

  const handlePlaylistSelect = (playlist: Playlist) => {
    navigate(`/playlist/${playlist.id}`);
  };

  const handleBackToCollections = () => {
    navigate('/');
  };

  const handleBackToCollection = () => {
    if (selectedCollection) {
      navigate(`/collection/${selectedCollection.id}`);
    } else {
      navigate('/');
    }
  };

  const playAllTracks = () => {
    if (tracks.length > 0) {
      playTrackFromPlaylist(tracks[0], 0);
    }
  };

  const handleShare = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url).then(() => {
      alert('Link copied to clipboard!');
    }).catch(() => {
      alert('Failed to copy link');
    });
  };

  const handleLoginSuccess = () => {
    // After successful login, check if user is admin and redirect if needed
    if (isAdmin) {
      navigate('/admin');
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const renderAuthButton = () => {
    if (userLoading) {
      return (
        <div className="w-8 h-8 animate-spin rounded-full border-t-2 border-b-2 border-blue-500"></div>
      );
    }

    if (user) {
      return (
        <div className="flex items-center space-x-2">
          {isAdmin && (
            <button
              onClick={() => navigate('/admin')}
              className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 px-3 py-2 rounded-lg transition-colors text-sm"
            >
              <User className="w-4 h-4" />
              <span className="hidden sm:inline">Admin</span>
            </button>
          )}
          <button
            onClick={handleLogout}
            className="flex items-center space-x-2 bg-gray-700 hover:bg-gray-600 px-3 py-2 rounded-lg transition-colors text-sm"
            title={user.email || 'Signed in'}
          >
            <User className="w-4 h-4" />
            <span className="hidden sm:inline">Sign Out</span>
          </button>
        </div>
      );
    }

    return (
      <button
        onClick={() => setShowLoginModal(true)}
        className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg transition-colors"
      >
        <LogIn className="w-4 h-4" />
        <span className="hidden sm:inline">Admin Login</span>
      </button>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-black via-blue-900 to-black flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-black via-blue-900 to-black flex items-center justify-center">
        <div className="text-center text-white">
          <h2 className="text-2xl font-bold mb-4">Error</h2>
          <p className="text-gray-300 mb-6">{error}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="bg-blue-600 hover:bg-blue-700 px-6 py-3 rounded-lg font-medium transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // Playlist view
  if (selectedPlaylist && tracks.length > 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-black via-blue-900 to-black text-white">
        <header className="bg-black/50 backdrop-blur-sm border-b border-blue-500/20 p-4">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button 
                onClick={handleBackToCollection}
                className="p-2 hover:bg-blue-500/20 rounded-lg transition-colors"
              >
                <ChevronRight className="w-5 h-5 rotate-180" />
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
                onClick={handleShare}
                className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg transition-colors"
              >
                <Share2 className="w-4 h-4" />
                <span className="hidden sm:inline">Share</span>
              </button>
              {renderAuthButton()}
            </div>
          </div>
        </header>

        <div className="max-w-7xl mx-auto p-4 sm:p-8">
          <div className="flex flex-col lg:flex-row items-start space-y-6 lg:space-y-0 lg:space-x-8 mb-8">
            <div className="w-full lg:w-64 h-64 bg-gradient-to-br from-gray-800 to-black rounded-lg flex items-center justify-center border border-gray-700 overflow-hidden">
              {selectedPlaylist.coverImageUrl ? (
                <img src={selectedPlaylist.coverImageUrl} alt="Playlist Cover" className="w-full h-full object-cover" />
              ) : (
                <Music className="w-24 h-24 text-gray-500" />
              )}
            </div>
            
            <div className="flex-1 pt-4">
              <h1 className="text-3xl sm:text-4xl font-bold mb-2">{selectedPlaylist.displayName || selectedPlaylist.name}</h1>
              {selectedPlaylist.description && (
                <p className="text-gray-300 mb-4">{selectedPlaylist.description}</p>
              )}
              <p className="text-gray-400 mb-6">
                {selectedPlaylist.totalTracks} tracks
                {selectedPlaylist.totalDuration && `, ${selectedPlaylist.totalDuration}`}
              </p>
              
              <div className="flex items-center space-x-4">
                <button 
                  onClick={playAllTracks}
                  disabled={tracks.length === 0}
                  className="flex items-center space-x-2 bg-white text-black px-6 py-3 rounded-lg font-medium hover:bg-gray-100 transition-colors disabled:opacity-50"
                >
                  <Play className="w-5 h-5" />
                  <span>Play</span>
                </button>
                <button 
                  onClick={handleShare}
                  className="flex items-center space-x-2 border border-gray-500 text-gray-300 px-6 py-3 rounded-lg font-medium hover:bg-gray-800 transition-colors"
                >
                  <Heart className="w-5 h-5" />
                  <span className="hidden sm:inline">Like</span>
                </button>
              </div>
            </div>
          </div>

          <div className="bg-black/30 rounded-lg border border-gray-700/50">
            <div className="p-6">
              <TrackList
                tracks={tracks}
                currentTrack={playerState.currentTrack}
                isPlaying={playerState.isPlaying}
                onTrackSelect={playTrackFromPlaylist}
              />
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

  // Collection view
  if (selectedCollection && playlists.length > 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-black via-blue-900 to-black text-white">
        <header className="bg-black/50 backdrop-blur-sm border-b border-blue-500/20 p-4">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button 
                onClick={handleBackToCollections}
                className="p-2 hover:bg-blue-500/20 rounded-lg transition-colors"
              >
                <ChevronRight className="w-5 h-5 rotate-180" />
              </button>
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-lg flex items-center justify-center">
                  <Music className="w-5 h-5" />
                </div>
                <span className="text-lg font-medium">MusicSync</span>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              {renderAuthButton()}
            </div>
          </div>
        </header>

        <div className="max-w-7xl mx-auto p-4 sm:p-8">
          <div className="mb-8">
            <h1 className="text-3xl sm:text-4xl font-bold mb-4">{selectedCollection.displayName || selectedCollection.name}</h1>
            {selectedCollection.description && (
              <p className="text-gray-300 text-lg">{selectedCollection.description}</p>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-6">
            {playlists.map((playlist) => (
              <div
                key={playlist.id}
                onClick={() => handlePlaylistSelect(playlist)}
                className="group cursor-pointer bg-gray-800/30 hover:bg-gray-700/50 p-4 rounded-lg transition-all duration-200 hover:scale-105"
              >
                <div className="aspect-square bg-gradient-to-br from-gray-700 to-black rounded-lg mb-3 overflow-hidden">
                  {playlist.coverImageUrl ? (
                    <img src={playlist.coverImageUrl} alt={playlist.displayName} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Music className="w-8 h-8 text-gray-500" />
                    </div>
                  )}
                </div>
                <h3 className="font-medium text-white text-sm truncate mb-1">{playlist.displayName || playlist.name}</h3>
                <p className="text-xs text-gray-400 truncate">{playlist.totalTracks} tracks</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Home view - collections list
  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-blue-900 to-black text-white">
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
            {renderAuthButton()}
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto p-4 sm:p-8">
        <div className="mb-8">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">Music Collections</h2>
          <p className="text-gray-300 text-lg">Discover curated playlists and music collections</p>
        </div>

        {collections.length === 0 ? (
          <div className="text-center py-12">
            <Music className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <h3 className="text-2xl font-bold mb-4">No Collections Available</h3>
            <p className="text-gray-400">Check back later for new music collections</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {collections.map((collection) => (
              <div
                key={collection.id}
                onClick={() => handleCollectionSelect(collection)}
                className="group cursor-pointer bg-gray-800/30 hover:bg-gray-700/50 p-6 rounded-xl transition-all duration-200 hover:scale-105"
              >
                <div className="aspect-square bg-gradient-to-br from-gray-700 to-black rounded-lg mb-4 overflow-hidden">
                  {collection.coverImageUrl ? (
                    <img src={collection.coverImageUrl} alt={collection.displayName} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Music className="w-12 h-12 text-gray-500" />
                    </div>
                  )}
                </div>
                <h3 className="font-bold text-white text-lg mb-2">{collection.displayName || collection.name}</h3>
                {collection.description && (
                  <p className="text-gray-400 text-sm line-clamp-2">{collection.description}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Login Modal */}
      <LoginModal
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
        onLoginSuccess={handleLoginSuccess}
      />

      {/* Admin Setup - Remove this after setting up admin user */}
      <AdminSetup />

      {/* Firebase Debug - Remove this after fixing config */}
      <FirebaseDebug />
    </div>
  );
};