import React, { useState, useEffect } from 'react';
import { Users, Music, FolderOpen, BarChart3, Wifi, WifiOff, AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useDropbox } from '../../hooks/useDropbox';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { useAuthState } from 'react-firebase-hooks/auth';
import { db, auth } from '../../services/firebase';

export const AdminOverview: React.FC = () => {
  const navigate = useNavigate();
  const [user] = useAuthState(auth);
  const { isConnected, isConnecting, error: dropboxError, connect, clearError } = useDropbox();
  
  // Dashboard counts
  const [counts, setCounts] = useState({
    collections: 0,
    playlists: 0,
    syncedFolders: 0,
    totalTracks: 0
  });
  const [loading, setLoading] = useState(true);

  const loadDashboardCounts = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      // Load collections count
      const collectionsRef = collection(db, 'collections');
      const collectionsQuery = query(collectionsRef, where('userId', '==', user.uid));
      const collectionsSnapshot = await getDocs(collectionsQuery);
      
      // Load playlists count
      const playlistsRef = collection(db, 'playlists');
      const playlistsQuery = query(playlistsRef, where('userId', '==', user.uid));
      const playlistsSnapshot = await getDocs(playlistsQuery);
      
      // Load synced folders count
      const foldersRef = collection(db, 'folderSyncs');
      const foldersQuery = query(foldersRef, where('userId', '==', user.uid));
      const foldersSnapshot = await getDocs(foldersQuery);
      
      // Calculate total tracks from playlists
      let totalTracks = 0;
      playlistsSnapshot.docs.forEach(doc => {
        const playlist = doc.data();
        totalTracks += playlist.trackCount || 0;
      });
      
      setCounts({
        collections: collectionsSnapshot.size,
        playlists: playlistsSnapshot.size,
        syncedFolders: foldersSnapshot.size,
        totalTracks
      });
    } catch (error) {
      console.error('Error loading dashboard counts:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardCounts();
  }, [user]);

  const getDropboxStatusInfo = () => {
    if (isConnecting) {
      return {
        icon: <Wifi className="w-5 h-5 text-yellow-400 animate-pulse" />,
        text: 'Connecting...',
        color: 'text-yellow-400',
        bgColor: 'bg-yellow-600/20',
        borderColor: 'border-yellow-500/30'
      };
    }
    
    if (isConnected) {
      return {
        icon: <Wifi className="w-5 h-5 text-green-400" />,
        text: 'Connected',
        color: 'text-green-400',
        bgColor: 'bg-green-600/20',
        borderColor: 'border-green-500/30'
      };
    }
    
    if (dropboxError) {
      return {
        icon: <AlertTriangle className="w-5 h-5 text-red-400" />,
        text: 'Connection Error',
        color: 'text-red-400',
        bgColor: 'bg-red-600/20',
        borderColor: 'border-red-500/30'
      };
    }
    
    return {
      icon: <WifiOff className="w-5 h-5 text-gray-400" />,
      text: 'Not Connected',
      color: 'text-gray-400',
      bgColor: 'bg-gray-600/20',
      borderColor: 'border-gray-500/30'
    };
  };

  const handleDropboxConnect = async () => {
    if (!isConnected && !isConnecting) {
      console.log('AdminOverview: Attempting to connect to Dropbox...');
      clearError(); // Clear any existing errors
      await connect();
    }
  };


  const handleCreateCollection = () => {
    console.log('Create Collection clicked from Overview');
    navigate('/admin/collections');
    // Will trigger the collection creation modal in CollectionManagement
  };

  const handleAddPlaylist = () => {
    console.log('Add Playlist clicked from Overview');
    navigate('/admin/playlists');
    // Will trigger the playlist creation modal in PlaylistManagement
  };

  const handleSyncFolder = () => {
    console.log('Sync Folder clicked from Overview');
    navigate('/admin/folders');
    // Will redirect to folder sync management
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Admin Overview</h1>
        <p className="text-gray-400">Manage your music collections and sync settings</p>
      </div>

      {/* Dropbox Connection Status */}
      <div className={`${getDropboxStatusInfo().bgColor} backdrop-blur-sm rounded-xl p-4 border ${getDropboxStatusInfo().borderColor}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            {getDropboxStatusInfo().icon}
            <div>
              <h3 className="font-semibold text-white">Dropbox Connection</h3>
              <p className={`text-sm ${getDropboxStatusInfo().color}`}>
                {getDropboxStatusInfo().text}
                {dropboxError && (
                  <span className="block text-xs text-red-300 mt-1">{dropboxError}</span>
                )}
              </p>
            </div>
          </div>
          {!isConnected && !isConnecting && (
            <button
              onClick={handleDropboxConnect}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm"
            >
              Connect
            </button>
          )}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-gray-800/30 backdrop-blur-sm rounded-xl p-6 border border-gray-700/50">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Total Collections</p>
              <p className="text-2xl font-bold text-white">
                {loading ? '...' : counts.collections}
              </p>
            </div>
            <FolderOpen className="w-8 h-8 text-blue-500" />
          </div>
        </div>

        <div className="bg-gray-800/30 backdrop-blur-sm rounded-xl p-6 border border-gray-700/50">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Total Playlists</p>
              <p className="text-2xl font-bold text-white">
                {loading ? '...' : counts.playlists}
              </p>
            </div>
            <Music className="w-8 h-8 text-green-500" />
          </div>
        </div>

        <div className="bg-gray-800/30 backdrop-blur-sm rounded-xl p-6 border border-gray-700/50">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Synced Folders</p>
              <p className="text-2xl font-bold text-white">
                {loading ? '...' : counts.syncedFolders}
              </p>
            </div>
            <FolderOpen className="w-8 h-8 text-yellow-500" />
          </div>
        </div>

        <div className="bg-gray-800/30 backdrop-blur-sm rounded-xl p-6 border border-gray-700/50">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Total Tracks</p>
              <p className="text-2xl font-bold text-white">
                {loading ? '...' : counts.totalTracks}
              </p>
            </div>
            <BarChart3 className="w-8 h-8 text-purple-500" />
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-gray-800/30 backdrop-blur-sm rounded-xl p-6 border border-gray-700/50">
        <h2 className="text-xl font-semibold text-white mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <button 
            onClick={handleCreateCollection}
            className="flex items-center space-x-3 p-4 bg-blue-600/20 hover:bg-blue-600/30 rounded-lg border border-blue-500/30 transition-colors"
          >
            <FolderOpen className="w-5 h-5 text-blue-400" />
            <span className="text-white">Create Collection</span>
          </button>
          
          <button 
            onClick={handleAddPlaylist}
            className="flex items-center space-x-3 p-4 bg-green-600/20 hover:bg-green-600/30 rounded-lg border border-green-500/30 transition-colors"
          >
            <Music className="w-5 h-5 text-green-400" />
            <span className="text-white">Add Playlist</span>
          </button>
          
          <button 
            onClick={handleSyncFolder}
            className="flex items-center space-x-3 p-4 bg-yellow-600/20 hover:bg-yellow-600/30 rounded-lg border border-yellow-500/30 transition-colors"
          >
            <FolderOpen className="w-5 h-5 text-yellow-400" />
            <span className="text-white">Sync Folder</span>
          </button>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-gray-800/30 backdrop-blur-sm rounded-xl p-6 border border-gray-700/50">
        <h2 className="text-xl font-semibold text-white mb-4">Recent Activity</h2>
        <div className="text-center py-8">
          <p className="text-gray-400">No recent activity</p>
        </div>
      </div>
    </div>
  );
};