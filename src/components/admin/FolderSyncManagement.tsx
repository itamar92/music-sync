import React, { useState, useEffect } from 'react';
import { Plus, FolderOpen, RefreshCw, Clock, CheckCircle, AlertCircle, Edit3, Trash2, Music, ArrowLeft } from 'lucide-react';
import { AddFolderModal } from './AddFolderModal';
import { collection, query, where, getDocs, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { useAuthState } from 'react-firebase-hooks/auth';
import { db, auth } from '../../services/firebase';
import { dropboxService } from '../../services/dropboxService';
import { Track } from '../../types';

export const FolderSyncManagement: React.FC = () => {
  const [user] = useAuthState(auth);
  const [syncing, setSyncing] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [folders, setFolders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingFolder, setEditingFolder] = useState<any>(null);
  const [syncingFolders, setSyncingFolders] = useState<Set<string>>(new Set());
  const [viewingFolder, setViewingFolder] = useState<any>(null);
  const [folderTracks, setFolderTracks] = useState<Track[]>([]);
  const [loadingTracks, setLoadingTracks] = useState(false);

  const loadFolders = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const foldersRef = collection(db, 'folderSyncs');
      const q = query(foldersRef, where('userId', '==', user.uid));
      const snapshot = await getDocs(q);
      
      const foldersData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      setFolders(foldersData);
    } catch (error) {
      console.error('Error loading folders:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFolders();
  }, [user]);

  useEffect(() => {
    // Listen for Dropbox auth completion to reopen modal
    const handleAuthComplete = (event: CustomEvent) => {
      if (event.detail?.modal === 'folder_add') {
        console.log('FolderSyncManagement: Received auth complete event, reopening Add Folder modal');
        setShowAddModal(true);
      }
    };

    window.addEventListener('dropbox_auth_complete', handleAuthComplete as EventListener);
    
    return () => {
      window.removeEventListener('dropbox_auth_complete', handleAuthComplete as EventListener);
    };
  }, []);

  const handleAddFolder = () => {
    console.log('Add Folder clicked');
    setShowAddModal(true);
  };

  const handleFolderAdded = (newFolder: any) => {
    console.log('Folder added:', newFolder);
    setFolders(prev => [...prev, newFolder]);
  };

  const handleSyncNow = async () => {
    console.log('Global sync clicked');
    setSyncing(true);
    // Simulate sync process for all folders
    setTimeout(() => {
      setSyncing(false);
      alert('All folders sync completed!');
    }, 2000);
  };

  const handleSyncFolder = async (folderId: string) => {
    console.log('Sync folder clicked:', folderId);
    setSyncingFolders(prev => new Set(prev).add(folderId));
    
    try {
      // Update folder status to syncing
      const folderRef = doc(db, 'folderSyncs', folderId);
      await updateDoc(folderRef, {
        status: 'syncing',
        updatedAt: new Date()
      });
      
      // Simulate sync process
      setTimeout(async () => {
        try {
          // Update folder status to synced
          await updateDoc(folderRef, {
            status: 'synced',
            lastSyncAt: new Date(),
            updatedAt: new Date()
          });
          
          // Reload folders to reflect changes
          await loadFolders();
        } catch (error) {
          console.error('Error updating sync status:', error);
        } finally {
          setSyncingFolders(prev => {
            const newSet = new Set(prev);
            newSet.delete(folderId);
            return newSet;
          });
        }
      }, 3000);
    } catch (error) {
      console.error('Error syncing folder:', error);
      setSyncingFolders(prev => {
        const newSet = new Set(prev);
        newSet.delete(folderId);
        return newSet;
      });
    }
  };

  const handleEditFolder = (folder: any) => {
    setEditingFolder(folder);
  };

  const handleDeleteFolder = async (folderId: string) => {
    if (!confirm('Are you sure you want to remove this folder from sync?')) {
      return;
    }
    
    try {
      await deleteDoc(doc(db, 'folderSyncs', folderId));
      await loadFolders();
    } catch (error) {
      console.error('Error deleting folder:', error);
      alert('Failed to remove folder. Please try again.');
    }
  };

  const handleUpdateFolder = async (updatedFolder: any) => {
    try {
      const folderRef = doc(db, 'folderSyncs', updatedFolder.id);
      await updateDoc(folderRef, {
        ...updatedFolder,
        updatedAt: new Date()
      });
      
      setEditingFolder(null);
      await loadFolders();
    } catch (error) {
      console.error('Error updating folder:', error);
      alert('Failed to update folder. Please try again.');
    }
  };

  const handleViewFolder = async (folder: any) => {
    setViewingFolder(folder);
    setLoadingTracks(true);
    setFolderTracks([]);
    
    try {
      if (!dropboxService.isAuthenticated()) {
        throw new Error('Please connect to Dropbox first');
      }
      
      const tracks = await dropboxService.getTracksFromFolder(folder.dropboxPath);
      setFolderTracks(tracks);
    } catch (error) {
      console.error('Error loading folder tracks:', error);
      alert('Failed to load folder contents. Please try again.');
    } finally {
      setLoadingTracks(false);
    }
  };

  const handleBackToFolders = () => {
    setViewingFolder(null);
    setFolderTracks([]);
  };

  // Listen for duration updates
  useEffect(() => {
    const handleDurationUpdates = (event: CustomEvent) => {
      if (viewingFolder && event.detail?.tracks && event.detail?.folderPath === viewingFolder.dropboxPath) {
        setFolderTracks(event.detail.tracks);
      }
    };

    window.addEventListener('trackDurationsUpdated', handleDurationUpdates as EventListener);
    
    return () => {
      window.removeEventListener('trackDurationsUpdated', handleDurationUpdates as EventListener);
    };
  }, [viewingFolder]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'synced':
        return <CheckCircle className="w-4 h-4 text-green-400" />;
      case 'syncing':
        return <RefreshCw className="w-4 h-4 text-blue-400 animate-spin" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-400" />;
      default:
        return <Clock className="w-4 h-4 text-yellow-400" />;
    }
  };

  // If viewing a specific folder, show tracks view
  if (viewingFolder) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={handleBackToFolders}
              className="flex items-center space-x-2 text-gray-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              <span>Back to Folders</span>
            </button>
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">
                {viewingFolder.displayName || viewingFolder.name}
              </h1>
              <p className="text-gray-400">Audio files in this folder</p>
            </div>
          </div>
        </div>

        {/* Tracks List */}
        <div className="bg-gray-800/30 backdrop-blur-sm rounded-xl border border-gray-700/50">
          <div className="p-6">
            {loadingTracks ? (
              <div className="text-center py-12">
                <div className="w-8 h-8 animate-spin rounded-full border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
                <p className="text-gray-400">Loading audio files...</p>
              </div>
            ) : folderTracks.length === 0 ? (
              <div className="text-center py-12">
                <Music className="w-16 h-16 text-gray-500 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-white mb-2">No Audio Files Found</h3>
                <p className="text-gray-400">This folder doesn't contain any supported audio files</p>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold text-white">Audio Files ({folderTracks.length})</h2>
                </div>
                {folderTracks.map((track, index) => (
                  <div key={track.id} className="flex items-center justify-between p-3 bg-gray-700/30 rounded-lg border border-gray-600/50 hover:bg-gray-700/50 transition-colors">
                    <div className="flex items-center space-x-3">
                      <Music className="w-5 h-5 text-blue-400" />
                      <div>
                        <h3 className="font-medium text-white">{track.name}</h3>
                      </div>
                    </div>
                    <div className="text-sm text-gray-400">
                      {track.duration}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Folder Sync</h1>
          <p className="text-gray-400">Manage Dropbox folder synchronization</p>
        </div>
        <button 
          onClick={handleAddFolder}
          className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Add Folder</span>
        </button>
      </div>

      {/* Sync Status */}
      <div className="bg-gray-800/30 backdrop-blur-sm rounded-xl p-6 border border-gray-700/50">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-white">Sync Status</h2>
          <button 
            onClick={handleSyncNow}
            disabled={syncing}
            className="flex items-center space-x-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 px-3 py-1 rounded-lg text-sm transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
            <span>{syncing ? 'Syncing...' : 'Sync Now'}</span>
          </button>
        </div>
        {loading ? (
          <div className="text-center py-8">
            <div className="w-8 h-8 animate-spin rounded-full border-t-2 border-b-2 border-yellow-500 mx-auto mb-4"></div>
            <p className="text-gray-400">Loading folders...</p>
          </div>
        ) : folders.length === 0 ? (
          <div className="text-center py-8">
            <FolderOpen className="w-16 h-16 text-gray-500 mx-auto mb-4" />
            <p className="text-gray-400 mb-4">No folders configured for sync</p>
            <button
              onClick={handleAddFolder}
              className="bg-yellow-600 hover:bg-yellow-700 px-4 py-2 rounded-lg transition-colors"
            >
              Add Your First Folder
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {folders.map((folder) => (
              <div key={folder.id} className="bg-gray-700/30 rounded-lg p-4 border border-gray-600/50">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <FolderOpen className="w-5 h-5 text-yellow-400" />
                      <h3 className="font-semibold text-white">{folder.name}</h3>
                      {getStatusIcon(folder.status)}
                    </div>
                    <p className="text-sm text-gray-400 mb-1">
                      <strong>Path:</strong> {folder.dropboxPath}
                    </p>
                    <div className="flex items-center space-x-4 text-xs text-gray-500">
                      <span>Sync: {folder.syncFrequency}</span>
                      <span>{folder.syncedFiles || 0}/{folder.totalFiles || 0} files</span>
                      {folder.lastSyncAt && (
                        <span>Last sync: {new Date(folder.lastSyncAt.seconds * 1000).toLocaleDateString()}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex space-x-2">
                    <button 
                      onClick={() => handleViewFolder(folder)}
                      className="px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white text-sm rounded transition-colors flex items-center space-x-1"
                    >
                      <FolderOpen className="w-3 h-3" />
                      <span>View</span>
                    </button>
                    <button 
                      onClick={() => handleSyncFolder(folder.id)}
                      disabled={syncingFolders.has(folder.id)}
                      className="px-3 py-1 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-sm rounded transition-colors flex items-center space-x-1"
                    >
                      <RefreshCw className={`w-3 h-3 ${syncingFolders.has(folder.id) ? 'animate-spin' : ''}`} />
                      <span>{syncingFolders.has(folder.id) ? 'Syncing...' : 'Sync'}</span>
                    </button>
                    <button 
                      onClick={() => handleEditFolder(folder)}
                      className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded transition-colors flex items-center space-x-1"
                    >
                      <Edit3 className="w-3 h-3" />
                      <span>Edit</span>
                    </button>
                    <button 
                      onClick={() => handleDeleteFolder(folder.id)}
                      className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-sm rounded transition-colors flex items-center space-x-1"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Remove</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <AddFolderModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSuccess={handleFolderAdded}
      />
      
      {/* Edit Folder Modal */}
      {editingFolder && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-white">Edit Folder Sync</h2>
              <button
                onClick={() => setEditingFolder(null)}
                className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
              >
                <AlertCircle className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Display Name
                </label>
                <input
                  type="text"
                  value={editingFolder.displayName || editingFolder.name}
                  onChange={(e) => setEditingFolder({...editingFolder, displayName: e.target.value})}
                  className="w-full bg-gray-700/50 text-white px-4 py-2 rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Sync Frequency
                </label>
                <select
                  value={editingFolder.syncFrequency}
                  onChange={(e) => setEditingFolder({...editingFolder, syncFrequency: e.target.value})}
                  className="w-full bg-gray-700/50 text-white px-4 py-2 rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none"
                >
                  <option value="manual">Manual</option>
                  <option value="hourly">Every Hour</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                </select>
              </div>
              
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={editingFolder.isActive}
                  onChange={(e) => setEditingFolder({...editingFolder, isActive: e.target.checked})}
                  className="rounded border-gray-600 bg-gray-700 text-blue-600"
                />
                <label htmlFor="isActive" className="text-sm text-gray-300">
                  Active Sync
                </label>
              </div>
            </div>
            
            <div className="flex space-x-3 mt-6">
              <button
                onClick={() => setEditingFolder(null)}
                className="flex-1 px-4 py-2 text-gray-300 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleUpdateFolder(editingFolder)}
                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};