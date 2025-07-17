import React, { useState, useEffect } from 'react';
import { Plus, Music, Edit, Trash2 } from 'lucide-react';
import { CreatePlaylistModal } from './CreatePlaylistModal';
import { EditPlaylistModal } from './EditPlaylistModal';
import { PlaylistView } from '../shared/PlaylistView';
import { collection, query, where, getDocs, doc, deleteDoc } from 'firebase/firestore';
import { dropboxService } from '../../services/dropboxService';
import { useAuthState } from 'react-firebase-hooks/auth';
import { db, auth } from '../../services/firebase';
import { generatePlaylistCover } from '../../utils/generateCover';
import { useToast } from '../../hooks/useToast';
import { ToastContainer } from '../ToastContainer';

export const PlaylistManagement: React.FC = () => {
  const [user] = useAuthState(auth);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCollection, setSelectedCollection] = useState('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingPlaylist, setEditingPlaylist] = useState<any>(null);
  const [playlists, setPlaylists] = useState<any[]>([]);
  const [collections, setCollections] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewingPlaylist, setViewingPlaylist] = useState<any>(null);
  const { toasts, removeToast, success, error } = useToast();

  const loadPlaylists = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const playlistsRef = collection(db, 'playlists');
      const q = query(playlistsRef, where('userId', '==', user.uid));
      const snapshot = await getDocs(q);
      
      const playlistsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      // Calculate track counts for each playlist
      const playlistsWithTrackCounts = await Promise.all(
        playlistsData.map(async (playlist) => {
          const trackCount = await calculatePlaylistTrackCount(playlist);
          return {
            ...playlist,
            trackCount
          };
        })
      );
      
      setPlaylists(playlistsWithTrackCounts);
    } catch (playlistError) {
      console.error('Error loading playlists:', playlistError);
      error('Failed to load playlists. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const calculatePlaylistTrackCount = async (playlist: any): Promise<number> => {
    if (!playlist.folderIds || playlist.folderIds.length === 0) {
      return 0;
    }

    try {
      let totalTracks = 0;
      
      // Get track counts from all folders
      const foldersRef = collection(db, 'folderSyncs');
      const folderPromises = playlist.folderIds.map(async (folderId: string) => {
        try {
          const folderQuery = query(foldersRef, where('__name__', '==', folderId));
          const folderSnapshot = await getDocs(folderQuery);
          
          if (!folderSnapshot.empty) {
            const folderData = folderSnapshot.docs[0].data();
            if (dropboxService.isAuthenticated()) {
              const tracks = await dropboxService.getTracksFromFolder(folderData.dropboxPath);
              return tracks.length;
            }
          }
          return 0;
        } catch (error) {
          console.error(`Error counting tracks for folder ${folderId}:`, error);
          return 0;
        }
      });

      const trackCounts = await Promise.all(folderPromises);
      totalTracks = trackCounts.reduce((sum, count) => sum + count, 0);
      
      // Subtract excluded tracks
      if (playlist.excludedTracks) {
        totalTracks = Math.max(0, totalTracks - playlist.excludedTracks.length);
      }
      
      return totalTracks;
    } catch (error) {
      console.error('Error calculating track count:', error);
      return 0;
    }
  };

  const loadCollections = async () => {
    if (!user) return;
    
    try {
      const collectionsRef = collection(db, 'collections');
      const q = query(collectionsRef, where('userId', '==', user.uid));
      const snapshot = await getDocs(q);
      
      const collectionsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      setCollections(collectionsData);
    } catch (error) {
      console.error('Error loading collections:', error);
    }
  };

  useEffect(() => {
    loadPlaylists();
    loadCollections();
  }, [user]);

  // Check for playlist to open from sessionStorage (from collection double-click)
  useEffect(() => {
    const openPlaylistId = sessionStorage.getItem('openPlaylistId');
    if (openPlaylistId && playlists.length > 0) {
      const playlistToOpen = playlists.find(p => p.id === openPlaylistId);
      if (playlistToOpen) {
        handleViewPlaylist(playlistToOpen);
        sessionStorage.removeItem('openPlaylistId');
      }
    }
  }, [playlists]);

  const handleCreatePlaylist = () => {
    console.log('Create Playlist clicked');
    setShowCreateModal(true);
  };

  const handlePlaylistCreated = (newPlaylist: any) => {
    console.log('Playlist created:', newPlaylist);
    setPlaylists(prev => [...prev, newPlaylist]);
  };

  const handleEditPlaylist = (playlist: any) => {
    setEditingPlaylist(playlist);
    setShowEditModal(true);
  };

  const handlePlaylistUpdated = (updatedPlaylist: any) => {
    setPlaylists(prev => prev.map(p => p.id === updatedPlaylist.id ? updatedPlaylist : p));
    setEditingPlaylist(null);
    setShowEditModal(false);
  };

  const handleDeletePlaylist = async (playlistId: string) => {
    if (!confirm('Are you sure you want to delete this playlist? This action cannot be undone.')) {
      return;
    }

    try {
      await deleteDoc(doc(db, 'playlists', playlistId));
      setPlaylists(prev => prev.filter(p => p.id !== playlistId));
      success('Playlist deleted successfully.');
    } catch (deleteError) {
      console.error('Error deleting playlist:', deleteError);
      error('Failed to delete playlist. Please try again.');
    }
  };

  const handleSearch = (term: string) => {
    setSearchTerm(term);
    console.log('Searching for:', term);
    // TODO: Implement search functionality
  };

  const filteredPlaylists = playlists.filter(playlist => {
    const matchesSearch = playlist.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         playlist.displayName?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCollection = selectedCollection === 'all' || playlist.collectionId === selectedCollection;
    return matchesSearch && matchesCollection;
  });

  const handleViewPlaylist = async (playlist: any) => {
    setViewingPlaylist(playlist);
  };

  const handleBackToPlaylists = () => {
    setViewingPlaylist(null);
  };

  const handlePlaylistUpdatedInView = (updatedPlaylist: any) => {
    setPlaylists(prev => prev.map(p => p.id === updatedPlaylist.id ? updatedPlaylist : p));
    setViewingPlaylist(updatedPlaylist);
  };



  // If viewing a specific playlist, show the playlist view
  if (viewingPlaylist) {
    return (
      <PlaylistView
        playlist={viewingPlaylist}
        onBack={handleBackToPlaylists}
        onPlaylistUpdated={handlePlaylistUpdated}
        isReadOnly={false}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Playlists</h1>
          <p className="text-gray-400">Manage all playlists across collections</p>
        </div>
        <button 
          onClick={handleCreatePlaylist}
          className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>New Playlist</span>
        </button>
      </div>

      {/* Filter and Search */}
      <div className="bg-gray-800/30 backdrop-blur-sm rounded-xl p-6 border border-gray-700/50">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search playlists..."
              value={searchTerm}
              onChange={(e) => handleSearch(e.target.value)}
              className="w-full bg-gray-700/50 text-white placeholder-gray-400 px-4 py-2 rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none"
            />
          </div>
          <select 
            value={selectedCollection}
            onChange={(e) => setSelectedCollection(e.target.value)}
            className="bg-gray-700/50 text-white px-4 py-2 rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none"
          >
            <option value="all">All Collections</option>
            {collections.map((collection) => (
              <option key={collection.id} value={collection.id}>
                {collection.displayName || collection.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Playlists List */}
      <div className="bg-gray-800/30 backdrop-blur-sm rounded-xl border border-gray-700/50">
        <div className="p-6">
          {loading ? (
            <div className="text-center py-12">
              <div className="w-8 h-8 animate-spin rounded-full border-t-2 border-b-2 border-green-500 mx-auto mb-4"></div>
              <p className="text-gray-400">Loading playlists...</p>
            </div>
          ) : filteredPlaylists.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
                <Music className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">
                {searchTerm || selectedCollection !== 'all' ? 'No Matching Playlists' : 'No Playlists Yet'}
              </h3>
              <p className="text-gray-400 mb-6">
                {searchTerm || selectedCollection !== 'all' 
                  ? 'Try adjusting your search or filter criteria' 
                  : 'Create playlists to organize your music'
                }
              </p>
              <button 
                onClick={handleCreatePlaylist}
                className="bg-green-600 hover:bg-green-700 px-6 py-3 rounded-lg transition-colors"
              >
                Create Playlist
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredPlaylists.map((playlist) => (
                <div 
                  key={playlist.id} 
                  className="bg-gray-700/30 rounded-lg p-4 border border-gray-600/50 cursor-pointer hover:bg-gray-700/50 transition-colors"
                  onDoubleClick={() => handleViewPlaylist(playlist)}
                >
                  <div className="aspect-square bg-gradient-to-br from-gray-600 to-black rounded-lg mb-3 overflow-hidden">
                    {playlist.coverImageUrl ? (
                      <img src={playlist.coverImageUrl} alt={playlist.displayName} className="w-full h-full object-cover" />
                    ) : (
                      <img 
                        src={generatePlaylistCover(playlist.displayName || playlist.name, 200)} 
                        alt={playlist.displayName || playlist.name} 
                        className="w-full h-full object-cover" 
                      />
                    )}
                  </div>
                  <h3 className="font-semibold text-white mb-1">{playlist.displayName || playlist.name}</h3>
                  {playlist.description && (
                    <p className="text-sm text-gray-400 mb-3 line-clamp-2">{playlist.description}</p>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">{playlist.trackCount || 0} tracks</span>
                    <div className="flex space-x-1">
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditPlaylist(playlist);
                        }}
                        className="p-1 hover:bg-gray-600 rounded text-gray-400 hover:text-white"
                        title="Edit playlist"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeletePlaylist(playlist.id);
                        }}
                        className="p-1 hover:bg-gray-600 rounded text-gray-400 hover:text-red-400"
                        title="Delete playlist"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <div className="mt-2 text-xs text-gray-500 text-center">
                    Double-click to open
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <CreatePlaylistModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={handlePlaylistCreated}
      />

      <EditPlaylistModal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        onSuccess={handlePlaylistUpdated}
        playlist={editingPlaylist}
      />

      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
};