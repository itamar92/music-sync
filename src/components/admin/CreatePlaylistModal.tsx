import React, { useState, useEffect } from 'react';
import { X, Music, Folder, Plus, Maximize2, Minimize2 } from 'lucide-react';
import { doc, setDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { useAuthState } from 'react-firebase-hooks/auth';
import { db, auth } from '../../services/firebase';

interface CreatePlaylistModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (playlist: any) => void;
}

export const CreatePlaylistModal: React.FC<CreatePlaylistModalProps> = ({
  isOpen,
  onClose,
  onSuccess
}) => {
  const [user] = useAuthState(auth);
  const [collections, setCollections] = useState<any[]>([]);
  const [availableFolders, setAvailableFolders] = useState<any[]>([]);
  const [selectedFolders, setSelectedFolders] = useState<string[]>([]);
  const [formData, setFormData] = useState({
    name: '',
    displayName: '',
    description: '',
    coverImageUrl: '',
    collectionId: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [currentTab, setCurrentTab] = useState<'details' | 'folders'>('details');
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      if (!user) return;
      
      try {
        // Load collections
        const collectionsRef = collection(db, 'collections');
        const collectionsQuery = query(collectionsRef, where('userId', '==', user.uid));
        const collectionsSnapshot = await getDocs(collectionsQuery);
        const collectionsData = collectionsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setCollections(collectionsData);

        // Load synced folders
        const foldersRef = collection(db, 'folderSyncs');
        const foldersQuery = query(foldersRef, where('userId', '==', user.uid));
        const foldersSnapshot = await getDocs(foldersQuery);
        const foldersData = foldersSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setAvailableFolders(foldersData);
      } catch (error) {
        console.error('Error loading data:', error);
      }
    };

    if (isOpen) {
      loadData();
    }
  }, [isOpen, user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      setError('You must be logged in to create a playlist');
      return;
    }

    if (!formData.name.trim()) {
      setError('Playlist name is required');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const playlistId = formData.name.toLowerCase().replace(/[^a-z0-9]/g, '_') + '_' + Date.now();
      const playlistRef = doc(db, 'playlists', playlistId);
      
      const newPlaylist = {
        id: playlistId,
        name: formData.name.trim(),
        displayName: formData.displayName.trim() || formData.name.trim(),
        description: formData.description.trim(),
        coverImageUrl: formData.coverImageUrl.trim(),
        collectionId: formData.collectionId || null,
        folderIds: selectedFolders,
        userId: user.uid,
        createdAt: new Date(),
        updatedAt: new Date(),
        isPublic: true,
        totalTracks: 0,
        totalDuration: '0:00'
      };

      await setDoc(playlistRef, newPlaylist);
      
      onSuccess(newPlaylist);
      handleClose();
    } catch (error) {
      console.error('Error creating playlist:', error);
      setError('Failed to create playlist. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setFormData({
      name: '',
      displayName: '',
      description: '',
      coverImageUrl: '',
      collectionId: ''
    });
    setSelectedFolders([]);
    setCurrentTab('details');
    setError('');
    onClose();
  };

  const toggleFolderSelection = (folderId: string) => {
    setSelectedFolders(prev => 
      prev.includes(folderId) 
        ? prev.filter(id => id !== folderId)
        : [...prev, folderId]
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className={`bg-gray-800 rounded-xl p-6 w-full flex flex-col transition-all duration-300 ${
        isExpanded ? 'max-w-6xl max-h-[95vh]' : 'max-w-2xl max-h-[80vh]'
      }`}>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <Music className="w-6 h-6 text-green-400" />
            <h2 className="text-xl font-bold text-white">Create Playlist</h2>
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
                ? 'bg-green-600 text-white'
                : 'text-gray-300 hover:text-white hover:bg-gray-600/50'
            }`}
          >
            Details
          </button>
          <button
            onClick={() => setCurrentTab('folders')}
            className={`flex-1 px-4 py-2 rounded-lg transition-colors ${
              currentTab === 'folders'
                ? 'bg-green-600 text-white'
                : 'text-gray-300 hover:text-white hover:bg-gray-600/50'
            }`}
          >
            Folders ({selectedFolders.length})
          </button>
        </div>

        <div className="flex-1 overflow-hidden">
          {currentTab === 'details' ? (
            <div className="h-full overflow-y-auto pr-2">
              <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Playlist Name *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full bg-gray-700/50 text-white placeholder-gray-400 px-4 py-2 rounded-lg border border-gray-600 focus:border-green-500 focus:outline-none"
              placeholder="e.g., My Favorite Songs"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Display Name
            </label>
            <input
              type="text"
              value={formData.displayName}
              onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
              className="w-full bg-gray-700/50 text-white placeholder-gray-400 px-4 py-2 rounded-lg border border-gray-600 focus:border-green-500 focus:outline-none"
              placeholder="Optional display name"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Collection
            </label>
            <select
              value={formData.collectionId}
              onChange={(e) => setFormData({ ...formData, collectionId: e.target.value })}
              className="w-full bg-gray-700/50 text-white px-4 py-2 rounded-lg border border-gray-600 focus:border-green-500 focus:outline-none"
            >
              <option value="">No collection</option>
              {collections.map((collection) => (
                <option key={collection.id} value={collection.id}>
                  {collection.displayName || collection.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full bg-gray-700/50 text-white placeholder-gray-400 px-4 py-2 rounded-lg border border-gray-600 focus:border-green-500 focus:outline-none"
              placeholder="Describe your playlist..."
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
              className="w-full bg-gray-700/50 text-white placeholder-gray-400 px-4 py-2 rounded-lg border border-gray-600 focus:border-green-500 focus:outline-none"
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
                  onClick={() => setCurrentTab('folders')}
                  className="flex-1 px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg transition-colors"
                >
                  Next: Select Folders
                </button>
              </div>
              </form>
            </div>
          ) : (
            <div className="h-full flex flex-col">
              <div className="flex-1 overflow-y-auto pr-2">
                <h3 className="text-lg font-semibold text-white mb-3 flex items-center">
                  <Folder className="w-5 h-5 mr-2 text-yellow-400" />
                  Select Folders ({availableFolders.length} available, {selectedFolders.length} selected)
                </h3>
                {availableFolders.length === 0 ? (
                  <p className="text-gray-400 text-sm">No synced folders available. Sync some Dropbox folders first.</p>
                ) : (
                  <div className="space-y-2">
                    {availableFolders.map((folder) => (
                      <div
                        key={folder.id}
                        className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                          selectedFolders.includes(folder.id)
                            ? 'bg-yellow-600/20 border-yellow-500/50'
                            : 'bg-gray-700/50 border-gray-600 hover:bg-gray-600/50'
                        }`}
                        onClick={() => toggleFolderSelection(folder.id)}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="font-medium text-white">{folder.displayName || folder.name}</h4>
                            <p className="text-sm text-gray-400">{folder.dropboxPath}</p>
                            <p className="text-xs text-gray-500">{folder.syncedFiles || 0} audio files</p>
                          </div>
                          <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                            selectedFolders.includes(folder.id)
                              ? 'bg-yellow-600 border-yellow-600'
                              : 'border-gray-400'
                          }`}>
                            {selectedFolders.includes(folder.id) && (
                              <Plus className="w-3 h-3 text-white rotate-45" />
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
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
                  className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded-lg transition-colors"
                >
                  {loading ? 'Creating...' : 'Create Playlist'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};