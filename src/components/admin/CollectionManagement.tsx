import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Eye, FolderOpen } from 'lucide-react';
import { CreateCollectionModal } from './CreateCollectionModal';
import { EditCollectionModal } from './EditCollectionModal';
import { CollectionView } from '../shared/CollectionView';
import { collection, query, where, getDocs, doc, deleteDoc } from 'firebase/firestore';
import { useAuthState } from 'react-firebase-hooks/auth';
import { useNavigate } from 'react-router-dom';
import { db, auth } from '../../services/firebase';
import { useToast } from '../../hooks/useToast';
import { ToastContainer } from '../ToastContainer';

export const CollectionManagement: React.FC = () => {
  const [user] = useAuthState(auth);
  const navigate = useNavigate();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingCollection, setEditingCollection] = useState<any>(null);
  const [collections, setCollections] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewingCollection, setViewingCollection] = useState<any>(null);
  const { toasts, removeToast, success, error } = useToast();

  const loadCollections = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const collectionsRef = collection(db, 'collections');
      const q = query(collectionsRef, where('userId', '==', user.uid));
      const snapshot = await getDocs(q);
      
      const collectionsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      // Calculate playlist counts for each collection
      const collectionsWithCounts = await Promise.all(
        collectionsData.map(async (col) => {
          try {
            let playlistCount = 0;
            
            // First try the playlistIds approach (legacy)
            if (col.playlistIds && col.playlistIds.length > 0) {
              playlistCount = col.playlistIds.length;
            } else {
              // Then try the collectionId approach (new)
              const playlistsRef = collection(db, 'playlists');
              const playlistsQuery = query(
                playlistsRef, 
                where('collectionId', '==', col.id),
                where('userId', '==', user.uid)
              );
              const playlistsSnapshot = await getDocs(playlistsQuery);
              playlistCount = playlistsSnapshot.docs.length;
            }
            
            
            return {
              ...col,
              totalPlaylists: playlistCount
            };
          } catch (error) {
            console.error(`Error loading playlists for collection ${col.id}:`, error);
            return {
              ...col,
              totalPlaylists: 0
            };
          }
        })
      );
      
      setCollections(collectionsWithCounts);
    } catch (loadError) {
      console.error('Error loading collections:', loadError);
      error('Failed to load collections. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCollections();
  }, [user]);

  const handleCreateCollection = () => {
    setShowCreateModal(true);
  };

  const handleCollectionCreated = (newCollection: any) => {
    setCollections(prev => [...prev, newCollection]);
  };

  const handleEditCollection = (collection: any) => {
    setEditingCollection(collection);
    setShowEditModal(true);
  };

  const handleCollectionUpdated = (updatedCollection: any) => {
    setCollections(prev => prev.map(c => c.id === updatedCollection.id ? updatedCollection : c));
    setEditingCollection(null);
    setShowEditModal(false);
  };

  const handleDeleteCollection = async (collectionId: string) => {
    if (!confirm('Are you sure you want to delete this collection? This action cannot be undone.')) {
      return;
    }

    try {
      await deleteDoc(doc(db, 'collections', collectionId));
      setCollections(prev => prev.filter(c => c.id !== collectionId));
      success('Collection deleted successfully.');
    } catch (deleteError) {
      console.error('Error deleting collection:', deleteError);
      error('Failed to delete collection. Please try again.');
    }
  };

  const handleViewCollection = (selectedCollection: any) => {
    setViewingCollection(selectedCollection);
  };

  const handleBackToCollections = () => {
    setViewingCollection(null);
  };

  const handlePlaylistSelect = (playlist: any) => {
    // Navigate to the playlist management page and open the playlist
    navigate('/admin/playlists');
    // Store the playlist to open in sessionStorage so PlaylistManagement can pick it up
    sessionStorage.setItem('openPlaylistId', playlist.id);
  };

  // If viewing a specific collection, show content view
  if (viewingCollection) {
    return (
      <CollectionView
        collection={viewingCollection}
        onBack={handleBackToCollections}
        onPlaylistSelect={handlePlaylistSelect}
        isReadOnly={false}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Collections</h1>
          <p className="text-gray-400">Organize your playlists into collections</p>
        </div>
        <button 
          onClick={handleCreateCollection}
          className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>New Collection</span>
        </button>
      </div>

      {/* Collections List */}
      <div className="bg-gray-800/30 backdrop-blur-sm rounded-xl border border-gray-700/50">
        <div className="p-6">
          {loading ? (
            <div className="text-center py-12">
              <div className="w-8 h-8 animate-spin rounded-full border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
              <p className="text-gray-400">Loading collections...</p>
            </div>
          ) : collections.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
                <Plus className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">No Collections Yet</h3>
              <p className="text-gray-400 mb-6">Create your first collection to organize playlists</p>
              <button 
                onClick={handleCreateCollection}
                className="bg-blue-600 hover:bg-blue-700 px-6 py-3 rounded-lg transition-colors"
              >
                Create Collection
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {collections.map((collection) => (
                <div 
                  key={collection.id} 
                  className="bg-gray-700/30 rounded-lg p-4 border border-gray-600/50 cursor-pointer hover:bg-gray-700/50 transition-colors"
                  onDoubleClick={() => handleViewCollection(collection)}
                >
                  <div className="aspect-square bg-gradient-to-br from-gray-600 to-black rounded-lg mb-3 overflow-hidden">
                    {collection.coverImageUrl ? (
                      <img src={collection.coverImageUrl} alt={collection.displayName} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <FolderOpen className="w-12 h-12 text-gray-500" />
                      </div>
                    )}
                  </div>
                  <h3 className="font-semibold text-white mb-1">{collection.displayName || collection.name}</h3>
                  {collection.description && (
                    <p className="text-sm text-gray-400 mb-3 line-clamp-2">{collection.description}</p>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">{collection.totalPlaylists || 0} playlists</span>
                    <div className="flex space-x-1">
                      <button 
                        onClick={() => handleEditCollection(collection)}
                        className="p-1 hover:bg-gray-600 rounded text-gray-400 hover:text-white"
                        title="Edit collection"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleViewCollection(collection)}
                        className="p-1 hover:bg-gray-600 rounded text-gray-400 hover:text-white"
                        title="View collection"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleDeleteCollection(collection.id)}
                        className="p-1 hover:bg-gray-600 rounded text-gray-400 hover:text-red-400"
                        title="Delete collection"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <CreateCollectionModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={handleCollectionCreated}
      />

      <EditCollectionModal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setEditingCollection(null);
        }}
        onSuccess={handleCollectionUpdated}
        collection={editingCollection}
      />

      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
};