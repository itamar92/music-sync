import React, { useState, useEffect } from 'react';
import { ArrowLeft, Music, Plus } from 'lucide-react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { useAuthState } from 'react-firebase-hooks/auth';
import { db, auth } from '../../services/firebase';
import { EditCollectionModal } from '../admin/EditCollectionModal';

interface CollectionViewProps {
  collection: any;
  onBack: () => void;
  onPlaylistSelect: (playlist: any) => void;
  isReadOnly?: boolean; // For public view
}

export const CollectionView: React.FC<CollectionViewProps> = ({
  collection: selectedCollection,
  onBack,
  onPlaylistSelect,
  isReadOnly = false
}) => {
  const [user] = useAuthState(auth);
  const [playlists, setPlaylists] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

  useEffect(() => {
    loadCollectionContent();
  }, [selectedCollection]);

  const loadCollectionContent = async () => {
    setLoading(true);
    setPlaylists([]);
    
    try {
      // Load playlists in this collection - check both approaches
      let playlistsData: any[] = [];
      
      // First try the playlistIds approach (legacy)
      if (selectedCollection.playlistIds && selectedCollection.playlistIds.length > 0) {
        const playlistsRef = collection(db, 'playlists');
        const playlistPromises = selectedCollection.playlistIds.map(async (playlistId: string) => {
          const playlistQuery = query(playlistsRef, where('__name__', '==', playlistId));
          const playlistSnapshot = await getDocs(playlistQuery);
          return playlistSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        });
        const playlistArrays = await Promise.all(playlistPromises);
        playlistsData = playlistArrays.flat();
      }
      
      // Then try the collectionId approach (new)
      if (playlistsData.length === 0) {
        const playlistsRef = collection(db, 'playlists');
        let playlistsQuery;
        
        if (isReadOnly) {
          // For public view, only load public playlists
          playlistsQuery = query(
            playlistsRef, 
            where('collectionId', '==', selectedCollection.id),
            where('isPublic', '==', true)
          );
        } else {
          // For admin view, load all playlists owned by user
          playlistsQuery = query(
            playlistsRef, 
            where('collectionId', '==', selectedCollection.id),
            where('userId', '==', user?.uid)
          );
        }
        
        const playlistsSnapshot = await getDocs(playlistsQuery);
        playlistsData = playlistsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
      }
      
      setPlaylists(playlistsData);

      // Collections no longer support folders - only playlists
    } catch (error) {
      console.error('Error loading collection content:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCollectionUpdated = (updatedCollection: any) => {
    // Reload the collection content to reflect the changes
    loadCollectionContent();
    setShowEditModal(false);
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
            <span>Back to Collections</span>
          </button>
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">
              {selectedCollection.displayName || selectedCollection.name}
            </h1>
            <p className="text-gray-400">Collection contents</p>
          </div>
        </div>
        {!isReadOnly && (
          <button
            onClick={() => setShowEditModal(true)}
            className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Add Playlists</span>
          </button>
        )}
      </div>

      {/* Collection Content */}
      <div className="bg-gray-800/30 backdrop-blur-sm rounded-xl border border-gray-700/50">
        <div className="p-6">
          {loading ? (
            <div className="text-center py-12">
              <div className="w-8 h-8 animate-spin rounded-full border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
              <p className="text-gray-400">Loading collection content...</p>
            </div>
          ) : (
            <div>
              {/* Playlists List - Styled like PlaylistView */}
              {playlists.length === 0 ? (
              <div className="text-center py-12">
                <Music className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                <h3 className="text-2xl font-bold mb-4">No Playlists Available</h3>
                <p className="text-gray-400">This collection doesn't contain any playlists yet</p>
              </div>
            ) : (
              <div className="space-y-1">
                {playlists.map((playlist, index) => (
                  <div
                    key={playlist.id}
                    onClick={() => onPlaylistSelect(playlist)}
                    className="flex items-center p-3 rounded-lg hover:bg-gray-700/50 transition-colors group cursor-pointer"
                  >
                    <div className="flex items-center space-x-3 flex-1">
                      <div className="w-12 h-12 bg-gradient-to-br from-green-600 to-green-800 rounded-lg overflow-hidden flex-shrink-0">
                        {playlist.coverImageUrl ? (
                          <img src={playlist.coverImageUrl} alt={playlist.displayName || playlist.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Music className="w-6 h-6 text-green-200" />
                          </div>
                        )}
                      </div>
                      
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <span className="text-white font-medium">{playlist.displayName || playlist.name}</span>
                        </div>
                        {playlist.description && (
                          <p className="text-sm text-gray-400 mt-1 line-clamp-2">{playlist.description}</p>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-4 ml-4">
                      <div className="text-sm text-gray-400">
                        {playlist.trackCount || playlist.totalTracks || 0} tracks
                      </div>
                      <div className="text-xs text-green-400 opacity-0 group-hover:opacity-100 transition-opacity">
                        Click to open
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            </div>
          )}
        </div>
      </div>

      {/* Edit Collection Modal */}
      <EditCollectionModal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        onSuccess={handleCollectionUpdated}
        collection={selectedCollection}
      />
    </div>
  );
};