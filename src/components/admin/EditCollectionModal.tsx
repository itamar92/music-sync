import React, { useState, useEffect } from 'react';
import { X, FolderOpen, Music, Plus, Save, Maximize2, Minimize2 } from 'lucide-react';
import { doc, updateDoc, collection as firestoreCollection, query, where, getDocs } from 'firebase/firestore';
import { useAuthState } from 'react-firebase-hooks/auth';
import { db, auth } from '../../services/firebase';

interface EditCollectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (collection: any) => void;
  collection: any;
}

export const EditCollectionModal: React.FC<EditCollectionModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  collection
}) => {
  const [user] = useAuthState(auth);
  const [formData, setFormData] = useState({
    displayName: '',
    description: '',
    coverImageUrl: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Available playlists to select from
  const [availablePlaylists, setAvailablePlaylists] = useState<any[]>([]);
  
  // Selected playlists
  const [selectedPlaylists, setSelectedPlaylists] = useState<string[]>([]);
  
  const [currentTab, setCurrentTab] = useState<'details' | 'content'>('details');
  const [isExpanded, setIsExpanded] = useState(false);

  // Initialize form data when collection changes
  useEffect(() => {
    if (collection) {
      setFormData({
        displayName: collection.displayName || collection.name || '',
        description: collection.description || '',
        coverImageUrl: collection.coverImageUrl || ''
      });
      setSelectedPlaylists(collection.playlistIds || []);
    }
  }, [collection]);

  // Load available playlists
  useEffect(() => {
    const loadAvailablePlaylists = async () => {
      if (!user) return;
      
      try {
        // Load playlists
        const playlistsRef = firestoreCollection(db, 'playlists');
        const playlistsQuery = query(playlistsRef, where('userId', '==', user.uid));
        const playlistsSnapshot = await getDocs(playlistsQuery);
        const playlists = playlistsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setAvailablePlaylists(playlists);
      } catch (error) {
        console.error('Error loading available playlists:', error);
      }
    };

    if (isOpen) {
      loadAvailablePlaylists();
    }
  }, [user, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user || !collection) {
      setError('Invalid collection or user');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const collectionRef = doc(db, 'collections', collection.id);
      
      const updatedCollection = {
        ...collection,
        displayName: formData.displayName.trim() || collection.name,
        description: formData.description.trim(),
        coverImageUrl: formData.coverImageUrl.trim(),
        updatedAt: new Date(),
        totalPlaylists: selectedPlaylists.length,
        playlistIds: selectedPlaylists
      };

      await updateDoc(collectionRef, updatedCollection);
      
      onSuccess(updatedCollection);
      handleClose();
    } catch (error) {
      console.error('Error updating collection:', error);
      setError('Failed to update collection. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setError('');
    setCurrentTab('details');
    onClose();
  };

  const togglePlaylistSelection = (playlistId: string) => {
    setSelectedPlaylists(prev => 
      prev.includes(playlistId) 
        ? prev.filter(id => id !== playlistId)
        : [...prev, playlistId]
    );
  };


  if (!isOpen || !collection) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className={`bg-gray-800 rounded-xl p-6 w-full flex flex-col transition-all duration-300 ${
        isExpanded ? 'max-w-6xl max-h-[95vh]' : 'max-w-2xl max-h-[80vh]'
      }`}>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <FolderOpen className="w-6 h-6 text-blue-400" />
            <h2 className="text-xl font-bold text-white">Edit Collection</h2>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
              title={isExpanded ? "Minimize" : "Expand"}
            >
              {isExpanded ? (
                <Minimize2 className="w-5 h-5 text-gray-400" />
              ) : (
                <Maximize2 className="w-5 h-5 text-gray-400" />
              )}
            </button>
            <button
              onClick={handleClose}
              className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex space-x-1 mb-6 bg-gray-700/30 p-1 rounded-lg">
          <button
            onClick={() => setCurrentTab('details')}
            className={`flex-1 px-4 py-2 rounded-lg transition-colors ${
              currentTab === 'details'
                ? 'bg-blue-600 text-white'
                : 'text-gray-300 hover:text-white hover:bg-gray-600/50'
            }`}
          >
            Details
          </button>
          <button
            onClick={() => setCurrentTab('content')}
            className={`flex-1 px-4 py-2 rounded-lg transition-colors ${
              currentTab === 'content'
                ? 'bg-blue-600 text-white'
                : 'text-gray-300 hover:text-white hover:bg-gray-600/50'
            }`}
          >
            Content ({selectedPlaylists.length})
          </button>
        </div>

        <div className="flex-1 overflow-hidden">
          {currentTab === 'details' ? (
            <form onSubmit={handleSubmit} className="h-full flex flex-col space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Collection Name
                </label>
                <input
                  type="text"
                  value={collection.name}
                  disabled
                  className="w-full bg-gray-600/50 text-gray-400 px-4 py-2 rounded-lg border border-gray-600 cursor-not-allowed"
                />
                <p className="text-xs text-gray-500 mt-1">Collection name cannot be changed</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Display Name
                </label>
                <input
                  type="text"
                  value={formData.displayName}
                  onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                  className="w-full bg-gray-700/50 text-white placeholder-gray-400 px-4 py-2 rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none"
                  placeholder="Optional display name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full bg-gray-700/50 text-white placeholder-gray-400 px-4 py-2 rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none"
                  placeholder="Describe your collection..."
                  rows={3}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Cover Image URL
                </label>
                <input
                  type="url"
                  value={formData.coverImageUrl}
                  onChange={(e) => setFormData({ ...formData, coverImageUrl: e.target.value })}
                  className="w-full bg-gray-700/50 text-white placeholder-gray-400 px-4 py-2 rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none"
                  placeholder="https://example.com/image.jpg"
                />
              </div>

              {error && (
                <div className="p-3 bg-red-900/50 text-red-300 rounded-lg text-sm">
                  {error}
                </div>
              )}

              <div className="flex space-x-3 pt-4 mt-auto">
                <button
                  type="button"
                  onClick={handleClose}
                  className="flex-1 px-4 py-2 text-gray-300 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentTab('content')}
                  className="flex-1 px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg transition-colors"
                >
                  Next: Edit Content
                </button>
              </div>
            </form>
          ) : (
            <div className="h-full flex flex-col">
              <div className="flex-1 overflow-y-auto space-y-6">
                {/* Playlists Section */}
                <div>
                  <h3 className="text-lg font-semibold text-white mb-3 flex items-center">
                    <Music className="w-5 h-5 mr-2 text-green-400" />
                    Playlists ({availablePlaylists.length} available, {selectedPlaylists.length} selected)
                  </h3>
                  {availablePlaylists.length === 0 ? (
                    <p className="text-gray-400 text-sm">No playlists available. Create some playlists first.</p>
                  ) : (
                    <div className="space-y-2">
                      {availablePlaylists.map((playlist) => (
                        <div
                          key={playlist.id}
                          className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                            selectedPlaylists.includes(playlist.id)
                              ? 'bg-green-600/20 border-green-500/50'
                              : 'bg-gray-700/50 border-gray-600 hover:bg-gray-600/50'
                          }`}
                          onClick={() => togglePlaylistSelection(playlist.id)}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <h4 className="font-medium text-white">{playlist.displayName || playlist.name}</h4>
                              <p className="text-sm text-gray-400">{playlist.trackCount || 0} tracks</p>
                            </div>
                            <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                              selectedPlaylists.includes(playlist.id)
                                ? 'bg-green-600 border-green-600'
                                : 'border-gray-400'
                            }`}>
                              {selectedPlaylists.includes(playlist.id) && (
                                <Plus className="w-3 h-3 text-white rotate-45" />
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

              </div>

              {error && (
                <div className="p-3 bg-red-900/50 text-red-300 rounded-lg text-sm mb-4">
                  {error}
                </div>
              )}

              <div className="flex space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setCurrentTab('details')}
                  className="flex-1 px-4 py-2 text-gray-300 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={loading}
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg transition-colors flex items-center justify-center space-x-2"
                >
                  <Save className="w-4 h-4" />
                  <span>{loading ? 'Saving...' : 'Save Changes'}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};