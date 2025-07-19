import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Music, LogIn, User, Search } from 'lucide-react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { signOut } from 'firebase/auth';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { LoadingSpinner } from './components/LoadingSpinner';
import { LoginModal } from './components/LoginModal';
import { GlobalAudioPlayer } from './components/GlobalAudioPlayer';
import { PlaylistView } from './components/shared/PlaylistView';
import { AuthStatus } from './components/AuthStatus';
import { useAdminRole } from './hooks/useAdminRole';
import { useDropbox } from './hooks/useDropbox';
import { auth, db } from './services/firebase';
import { Collection, Playlist } from './types';
import logoImg from '../Logo_IM icon.png';

export const PublicApp: React.FC = () => {
  const { collectionId, playlistId } = useParams();
  const navigate = useNavigate();
  
  const [user, userLoading] = useAuthState(auth);
  const { isAdmin, loading: adminLoading } = useAdminRole(user?.uid);
  
  
  // Initialize useDropbox hook to handle OAuth callbacks on the root page
  useDropbox();
  
  
  const [collections, setCollections] = useState<Collection[]>([]);
  const [selectedCollection, setSelectedCollection] = useState<Collection | null>(null);
  const [selectedPlaylist, setSelectedPlaylist] = useState<Playlist | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [debugInfo] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [collectionPlaylists, setCollectionPlaylists] = useState<Playlist[]>([]);
  const [loadingPlaylists, setLoadingPlaylists] = useState(false);
  


  // Load collections on mount
  useEffect(() => {
    const loadCollections = async () => {
      try {
        setLoading(true);
        
        // Load collections directly from Firebase
        const collectionsRef = collection(db, 'collections');
        
        // Try to load public collections - attempt multiple approaches
        let collectionsData: Collection[] = [];
        
        try {
          // First try the public collections query
          const collectionsQuery = query(collectionsRef, where('isPublic', '==', true));
          const collectionsSnapshot = await getDocs(collectionsQuery);
          
          collectionsData = collectionsSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          })) as Collection[];
        } catch (queryError) {
          console.error('Public collections query failed:', queryError);
          
          // If the query fails, try to get all collections and filter client-side
          try {
            const allCollectionsQuery = query(collectionsRef);
            const allCollectionsSnapshot = await getDocs(allCollectionsQuery);
            
            const allCollections = allCollectionsSnapshot.docs.map(doc => ({
              id: doc.id,
              ...doc.data()
            })) as Collection[];
            
            // Filter for public collections client-side
            collectionsData = allCollections.filter(collection => collection.isPublic === true);
          } catch (fallbackError) {
            console.error('Fallback collections query also failed:', fallbackError);
          }
        }
        
        setCollections(collectionsData);
      } catch (err) {
        console.error('Error loading public collections:', err);
        setError('Failed to load collections');
      } finally {
        setLoading(false);
      }
    };

    // Always load collections for public view (now the default view)
    if (!adminLoading) {
      loadCollections();
    }
  }, [adminLoading]);

  // Load specific collection if collectionId is provided
  useEffect(() => {
    const loadCollection = async () => {
      if (!collectionId) return;

      try {
        setLoading(true);
        
        // Load collection directly from Firebase
        const collectionsRef = collection(db, 'collections');
        const collectionQuery = query(
          collectionsRef,
          where('__name__', '==', collectionId),
          where('isPublic', '==', true)
        );
        const collectionSnapshot = await getDocs(collectionQuery);
        
        if (collectionSnapshot.empty) {
          setError('Collection not found');
          return;
        }
        
        const collectionData = {
          id: collectionSnapshot.docs[0].id,
          ...collectionSnapshot.docs[0].data()
        } as Collection;
        
        setSelectedCollection(collectionData);
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
        
        // Load playlist directly from Firebase
        const playlistsRef = collection(db, 'playlists');
        const playlistQuery = query(
          playlistsRef,
          where('__name__', '==', playlistId),
          where('isPublic', '==', true)
        );
        const playlistSnapshot = await getDocs(playlistQuery);
        
        if (playlistSnapshot.empty) {
          setError('Playlist not found');
          return;
        }
        
        const playlistData = {
          id: playlistSnapshot.docs[0].id,
          ...playlistSnapshot.docs[0].data()
        } as Playlist;
        
        setSelectedPlaylist(playlistData);
        
        // Also load the collection for context if it exists
        if (playlistData.collectionId) {
          const collectionsRef = collection(db, 'collections');
          const collectionQuery = query(
            collectionsRef,
            where('__name__', '==', playlistData.collectionId),
            where('isPublic', '==', true)
          );
          const collectionSnapshot = await getDocs(collectionQuery);
          
          if (!collectionSnapshot.empty) {
            const collectionData = {
              id: collectionSnapshot.docs[0].id,
              ...collectionSnapshot.docs[0].data()
            } as Collection;
            setSelectedCollection(collectionData);
          }
        }
      } catch (err) {
        setError('Failed to load playlist');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    loadPlaylist();
  }, [playlistId]);

  // Handle Dropbox OAuth callback completion and admin redirect
  useEffect(() => {
    const handleDropboxAuthComplete = () => {
      if (isAdmin && !adminLoading) {
        navigate('/admin');
      }
    };

    window.addEventListener('dropbox_auth_complete', handleDropboxAuthComplete);
    
    return () => {
      window.removeEventListener('dropbox_auth_complete', handleDropboxAuthComplete);
    };
  }, [isAdmin, adminLoading, navigate]);

  // Removed auto-redirect to admin - public view is now the default view

  const handleCollectionSelect = (collection: Collection) => {
    setSelectedCollection(collection);
    loadCollectionPlaylists(collection);
  };

  const loadCollectionPlaylists = async (selectedCol: Collection) => {
    setLoadingPlaylists(true);
    setCollectionPlaylists([]);
    
    try {
      const playlistsRef = collection(db, 'playlists');
      const playlistsQuery = query(
        playlistsRef,
        where('collectionId', '==', selectedCol.id),
        where('isPublic', '==', true)
      );
      
      const playlistsSnapshot = await getDocs(playlistsQuery);
      const playlistsData = playlistsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Playlist[];
      
      setCollectionPlaylists(playlistsData);
    } catch (error) {
      console.error('Error loading collection playlists:', error);
    } finally {
      setLoadingPlaylists(false);
    }
  };

  const handlePlaylistSelect = (playlist: Playlist) => {
    navigate(`/playlist/${playlist.id}`);
  };

  const filteredCollections = collections.filter((collection: Collection) =>
    (collection.displayName || collection.name)
      .toLowerCase()
      .includes(searchTerm.toLowerCase())
  );


  const handleBackToCollection = () => {
    // Clear playlist state and go back to home page to maintain the split-view
    setSelectedPlaylist(null);
    setSelectedCollection(null);
    navigate('/');
  };

  const handleLogoClick = () => {
    // Clear all state and go to home
    setSelectedPlaylist(null);
    setSelectedCollection(null);
    setCollectionPlaylists([]);
    navigate('/');
  };


  const handleLoginSuccess = () => {
    // Check for Dropbox OAuth callback first before redirecting
    const hash = window.location.hash;
    const hasDropboxToken = hash.includes('access_token=');
    
    if (hasDropboxToken) {
      // Don't redirect yet, let the useDropbox hook process the token first
      return;
    }
    
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
    if (userLoading || adminLoading) {
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
  if (selectedPlaylist) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-black via-blue-900 to-black text-white">
        <header className="bg-black/50 backdrop-blur-sm border-b border-blue-500/20 p-4">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div 
              className="flex items-center space-x-3 cursor-pointer hover:opacity-80 transition-opacity"
              onClick={() => handleBackToCollection()}
            >
              <img src={logoImg} alt="App Logo" className="w-20 h-20 object-contain" />
              <span className="text-lg font-medium">MusicSync</span>
            </div>
            
            <div className="flex items-center space-x-4">
              {renderAuthButton()}
            </div>
          </div>
        </header>

        <div className="max-w-7xl mx-auto p-4 sm:p-8">
          <PlaylistView
            playlist={selectedPlaylist}
            onBack={handleBackToCollection}
            isReadOnly={true}
          />
        </div>
        
        <GlobalAudioPlayer />
      </div>
    );
  }

  // Removed full collection view - keeping split view only

  // Home view - split layout with collections list and selected collection playlists
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-blue-900 to-black text-white">
      <header className="bg-black/50 backdrop-blur-sm border-b border-blue-500/20 p-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div 
            className="flex items-center space-x-3 cursor-pointer hover:opacity-80 transition-opacity"
            onClick={handleLogoClick}
          >
            <img src={logoImg} alt="App Logo" className="w-20 h-20 object-contain" />
            <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
              MusicSync
            </h1>
          </div>
          
          <div className="flex items-center space-x-4">
            <AuthStatus />
            {renderAuthButton()}
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto p-4 sm:p-8">
        <div className="mb-8">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">Music Collections</h2>
          <p className="text-gray-300 text-lg">Discover curated playlists and music collections</p>
          {debugInfo && (
            <div className="mt-4 p-3 bg-yellow-900/50 border border-yellow-500/50 rounded-lg">
              <p className="text-yellow-200 text-sm">{debugInfo}</p>
            </div>
          )}
        </div>

        {collections.length === 0 ? (
          <div className="text-center py-12">
            <Music className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <h3 className="text-2xl font-bold mb-4">No Collections Available</h3>
            <p className="text-gray-400">Check back later for new music collections</p>
            <p className="text-yellow-400 text-sm mt-2">Debug: Collections array length is {collections.length}</p>
            <p className="text-yellow-400 text-sm mt-1">Debug: Collections state: {JSON.stringify(collections)}</p>
            <p className="text-yellow-400 text-sm mt-1">Debug: Loading state: {loading.toString()}</p>
          </div>
        ) : (
          <div className="flex flex-col lg:flex-row gap-6 min-h-[600px] lg:h-[calc(100vh-300px)]">
            {/* Left Panel - Collections List */}
            <div className="w-full lg:w-1/3 bg-gray-800/30 backdrop-blur-sm rounded-xl border border-gray-700/50 p-4 lg:p-6">
              <div className="mb-4 lg:mb-6">
                <h3 className="text-lg lg:text-xl font-semibold text-white mb-3 lg:mb-4">Collections</h3>
                {/* Search Input */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    type="text"
                    placeholder="Search collections..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-gray-700/50 border border-gray-600/50 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>
              
              {/* Collections List */}
              <div className="space-y-2 lg:space-y-3 overflow-y-auto max-h-64 lg:h-full">
                {filteredCollections.map((collection) => (
                  <div
                    key={collection.id}
                    onClick={() => handleCollectionSelect(collection)}
                    onDoubleClick={() => navigate(`/collection/${collection.id}`)}
                    className={`cursor-pointer p-3 lg:p-4 rounded-lg border transition-all duration-200 hover:bg-gray-700/50 ${
                      selectedCollection && selectedCollection.id === collection.id
                        ? 'bg-blue-600/20 border-blue-500/50'
                        : 'bg-gray-700/30 border-gray-600/50'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 lg:w-12 lg:h-12 bg-gradient-to-br from-gray-700 to-black rounded-lg overflow-hidden flex-shrink-0">
                        {collection.coverImageUrl ? (
                          <img src={collection.coverImageUrl} alt={collection.displayName || collection.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Music className="w-5 h-5 lg:w-6 lg:h-6 text-gray-500" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-white text-sm lg:text-base truncate">{collection.displayName || collection.name}</h4>
                        {collection.description && (
                          <p className="text-xs lg:text-sm text-gray-400 truncate">{collection.description}</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right Panel - Selected Collection Playlists */}
            <div className="w-full lg:w-2/3 bg-gray-800/30 backdrop-blur-sm rounded-xl border border-gray-700/50 p-4 lg:p-6">
              {selectedCollection ? (
                <div className="h-full">
                  <div className="mb-4 lg:mb-6">
                    <h3 className="text-lg lg:text-xl font-semibold text-white mb-2">
                      {(selectedCollection as Collection).displayName || (selectedCollection as Collection).name}
                    </h3>
                    {(selectedCollection as Collection).description && (
                      <p className="text-sm lg:text-base text-gray-400">{(selectedCollection as Collection).description}</p>
                    )}
                  </div>
                  
                  {loadingPlaylists ? (
                    <div className="flex items-center justify-center h-32">
                      <div className="w-8 h-8 animate-spin rounded-full border-t-2 border-b-2 border-blue-500"></div>
                    </div>
                  ) : collectionPlaylists.length === 0 ? (
                    <div className="text-center py-8 lg:py-12">
                      <Music className="w-10 h-10 lg:w-12 lg:h-12 text-gray-600 mx-auto mb-4" />
                      <p className="text-gray-400">No playlists in this collection</p>
                    </div>
                  ) : (
                    <div className="space-y-2 lg:space-y-3 overflow-y-auto max-h-96 lg:h-full">
                      {collectionPlaylists.map((playlist) => (
                        <div
                          key={playlist.id}
                          onClick={() => handlePlaylistSelect(playlist)}
                          className="cursor-pointer p-3 lg:p-4 rounded-lg bg-gray-700/30 border border-gray-600/50 hover:bg-gray-700/50 transition-colors"
                        >
                          <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 lg:w-12 lg:h-12 bg-gradient-to-br from-green-600 to-green-800 rounded-lg overflow-hidden flex-shrink-0">
                              {playlist.coverImageUrl ? (
                                <img src={playlist.coverImageUrl} alt={playlist.displayName || playlist.name} className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  <Music className="w-5 h-5 lg:w-6 lg:h-6 text-green-200" />
                                </div>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="font-medium text-white text-sm lg:text-base truncate">{playlist.displayName || playlist.name}</h4>
                              {playlist.description && (
                                <p className="text-xs lg:text-sm text-gray-400 truncate">{playlist.description}</p>
                              )}
                              <div className="flex items-center mt-1">
                                <span className="text-xs text-gray-500">{(playlist as any).trackCount || (playlist as any).totalTracks || 0} tracks</span>
                              </div>
                            </div>
                            <div className="text-xs text-green-400 hidden sm:block">
                              Click to play
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center justify-center h-full text-center">
                  <div>
                    <Music className="w-12 h-12 lg:w-16 lg:h-16 text-gray-600 mx-auto mb-4" />
                    <h3 className="text-lg lg:text-xl font-semibold text-white mb-2">Select a Collection</h3>
                    <p className="text-sm lg:text-base text-gray-400">Choose a collection from the left panel to view its playlists</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Login Modal */}
      <LoginModal
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
        onLoginSuccess={handleLoginSuccess}
      />
      
      {/* Global Audio Player */}
      <GlobalAudioPlayer />
    </div>
  );
};