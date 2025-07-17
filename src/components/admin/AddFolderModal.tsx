import React, { useState, useEffect } from 'react';
import { 
  X, 
  FolderOpen as FolderIcon, 
  Music, 
  ArrowLeft, 
  Search, 
  ChevronRight,
  Home,
  Check,
  Maximize2,
  Minimize2
} from 'lucide-react';
import { doc, setDoc } from 'firebase/firestore';
import { useAuthState } from 'react-firebase-hooks/auth';
import { db, auth } from '../../services/firebase';
import { useDropbox } from '../../hooks/useDropbox';
import { Folder } from '../../types';

interface AddFolderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (folder: any) => void;
}

export const AddFolderModal: React.FC<AddFolderModalProps> = ({
  isOpen,
  onClose,
  onSuccess
}) => {
  const [user] = useAuthState(auth);
  const [selectedFolder, setSelectedFolder] = useState<Folder | null>(null);
  const [syncFrequency, setSyncFrequency] = useState('manual');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showBrowser, setShowBrowser] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const {
    isConnected,
    isConnecting,
    managementFolders,
    managementPath,
    navigateToManagementFolder,
    navigateManagementBack,
    loadManagementFolders,
    connect,
    retry,
    error: dropboxError
  } = useDropbox();

  useEffect(() => {
    if (isOpen) {
      // Check if we're connected first, then try to load folders
      if (isConnected) {
        loadManagementFolders('').then(() => {
          setShowBrowser(true);
        }).catch((err) => {
          console.log('Folder load failed despite connection:', err);
          setError('Failed to load folders. Please try reconnecting.');
        });
      } else {
        // If not connected, the modal will show the connection prompt
        console.log('Not connected to Dropbox, showing connection prompt');
      }
    }
  }, [isOpen, isConnected, loadManagementFolders]);

  const filteredFolders = managementFolders.filter(folder =>
    folder.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    folder.path.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getBreadcrumbs = () => {
    if (!managementPath) return ['Home'];
    
    const parts = managementPath.split('/').filter(Boolean);
    return ['Home', ...parts];
  };

  const navigateToBreadcrumb = (index: number) => {
    if (index === 0) {
      navigateToManagementFolder('');
    } else {
      const parts = managementPath.split('/').filter(Boolean);
      const newPath = '/' + parts.slice(0, index).join('/');
      navigateToManagementFolder(newPath);
    }
  };

  const handleFolderSelect = (folder: Folder) => {
    setSelectedFolder(folder);
  };

  const handleFolderDoubleClick = (folder: Folder) => {
    if (folder.hasSubfolders) {
      navigateToManagementFolder(folder.path);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      setError('You must be logged in to add a folder');
      return;
    }

    if (!selectedFolder) {
      setError('Please select a folder to sync');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Generate a valid Firestore document ID from the folder path
      const folderId = selectedFolder.path
        .replace(/^\/+|\/+$/g, '') // Remove leading/trailing slashes
        .replace(/[\/\s]+/g, '_') // Replace slashes and spaces with underscores
        .replace(/[^a-zA-Z0-9_-]/g, '') // Remove invalid characters
        .toLowerCase();
      
      const folderRef = doc(db, 'folderSyncs', folderId);
      
      const newFolder = {
        id: folderId,
        name: selectedFolder.name,
        displayName: selectedFolder.displayName || selectedFolder.name,
        dropboxPath: selectedFolder.path,
        dropboxId: selectedFolder.id,
        syncFrequency: syncFrequency,
        userId: user.uid,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSyncAt: null,
        status: 'pending',
        totalFiles: selectedFolder.trackCount || 0,
        syncedFiles: 0,
        isActive: true,
        hasSubfolders: selectedFolder.hasSubfolders
      };

      await setDoc(folderRef, newFolder);
      
      onSuccess(newFolder);
      handleClose();
    } catch (error) {
      console.error('Error adding folder:', error);
      setError('Failed to add folder. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setSelectedFolder(null);
    setSyncFrequency('manual');
    setSearchQuery('');
    setError('');
    setShowBrowser(false);
    onClose();
  };

  const handleConnect = async () => {
    setError('');
    console.log('Add Folder Modal: Initiating Dropbox connection...');
    console.log('Add Folder Modal: Current URL:', window.location.href);
    console.log('Add Folder Modal: Origin for redirect:', window.location.origin);
    
    // Use the same method as the test but with automatic redirect
    try {
      const { dropboxService } = await import('../../services/dropboxService');
      const authUrl = await dropboxService.authenticate(false);
      if (authUrl && typeof authUrl === 'string') {
        console.log('Add Folder Modal: Redirecting to auth URL...');
        // Store the current modal state so we can restore it after auth
        localStorage.setItem('dropbox_auth_in_progress', 'true');
        localStorage.setItem('dropbox_auth_modal', 'folder_add');
        window.location.href = authUrl;
      }
    } catch (err) {
      console.error('Add Folder Modal: Failed to get auth URL:', err);
      setError(`Failed to start authentication: ${err}`);
    }
  };

  const handleTestAuth = async () => {
    try {
      const { dropboxService } = await import('../../services/dropboxService');
      console.log('Test: Getting auth URL without redirect...');
      const authUrl = await dropboxService.authenticate(false);
      console.log('Test: Generated auth URL:', authUrl);
      
      if (authUrl && typeof authUrl === 'string') {
        // Show the URL in an alert so you can see it
        alert(`Generated auth URL:\n\n${authUrl}\n\nThis will open in a new tab. After you authenticate, copy the URL you're redirected to and paste it here.`);
        console.log('Test: Opening auth URL in new tab...');
        window.open(authUrl, '_blank');
      } else {
        alert('Failed to generate auth URL. Check console for errors.');
      }
    } catch (err) {
      console.error('Test: Failed to generate auth URL:', err);
      alert(`Error generating auth URL: ${err}`);
    }
  };

  const handleRetry = () => {
    setError('');
    retry();
  };

  const handleManualCallback = () => {
    const callbackUrl = prompt('Paste the full URL you were redirected to after Dropbox authentication:');
    if (callbackUrl) {
      console.log('Manual callback URL:', callbackUrl);
      const url = new URL(callbackUrl);
      const code = url.searchParams.get('code');
      const accessToken = url.hash.match(/access_token=([^&]+)/)?.[1];
      
      console.log('Extracted code:', code);
      console.log('Extracted access token:', accessToken);
      
      if (code) {
        handleAuthCallback(code);
      } else if (accessToken) {
        localStorage.setItem('dropbox_access_token', accessToken);
        setShowBrowser(true);
        loadManagementFolders('');
      } else {
        alert('No authorization code or access token found in the URL');
      }
    }
  };

  const handleAuthCallback = async (code: string) => {
    try {
      setLoading(true);
      const { dropboxService } = await import('../../services/dropboxService');
      const success = await dropboxService.handleAuthCallback(code);
      if (success) {
        setShowBrowser(true);
        await loadManagementFolders('');
      } else {
        setError('Failed to exchange authorization code for access token');
      }
    } catch (err) {
      setError(`Authentication failed: ${err}`);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  // Show loading while checking connection or loading folders
  if (isConnecting || (isConnected && !showBrowser && managementFolders.length === 0 && !dropboxError)) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-gray-800 rounded-xl p-6 w-full max-w-md">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <FolderIcon className="w-6 h-6 text-yellow-400" />
              <h2 className="text-xl font-bold text-white">Loading Dropbox Folders</h2>
            </div>
            <button
              onClick={handleClose}
              className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>

          <div className="text-center py-6">
            <div className="w-8 h-8 animate-spin rounded-full border-t-2 border-b-2 border-yellow-500 mx-auto mb-4"></div>
            <p className="text-gray-400">Connecting to Dropbox and loading folders...</p>
          </div>
        </div>
      </div>
    );
  }

  // Show connection prompt only if we have an error or definitely not connected
  if (!isConnected && !showBrowser && (dropboxError || managementFolders.length === 0)) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-gray-800 rounded-xl p-6 w-full max-w-md">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <FolderIcon className="w-6 h-6 text-yellow-400" />
              <h2 className="text-xl font-bold text-white">Connect to Dropbox</h2>
            </div>
            <button
              onClick={handleClose}
              className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>

          <div className="text-center py-6">
            <FolderIcon className="w-16 h-16 text-gray-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">
              {dropboxError?.includes('expired') ? 'Dropbox Session Expired' : 'Connect to Dropbox'}
            </h3>
            <p className="text-gray-400 mb-4">
              {dropboxError ? dropboxError : 'Connect your Dropbox account to browse and sync folders.'}
            </p>
            <p className="text-sm text-gray-500 mb-6">
              {dropboxError?.includes('expired') 
                ? 'Your session has expired. Please reconnect to continue.' 
                : 'This will open Dropbox authentication in a new tab.'}
            </p>
            
            <div className="flex space-x-3">
              <button
                onClick={handleClose}
                className="flex-1 px-4 py-2 text-gray-300 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleRetry}
                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >
                Retry
              </button>
              <button
                onClick={handleConnect}
                className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
              >
                Connect Dropbox
              </button>
            </div>
            
            <div className="mt-4 pt-4 border-t border-gray-700 space-y-2">
              <button
                onClick={handleTestAuth}
                className="w-full px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg transition-colors text-sm"
              >
                🔧 Test Auth URL (Debug)
              </button>
              <button
                onClick={handleManualCallback}
                className="w-full px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors text-sm"
              >
                🔗 Manual Callback (Paste URL)
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className={`bg-gray-800 rounded-xl p-6 w-full flex flex-col transition-all duration-300 ${
        isExpanded ? 'max-w-7xl max-h-[95vh]' : 'max-w-4xl max-h-[80vh]'
      }`}>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <FolderIcon className="w-6 h-6 text-yellow-400" />
            <h2 className="text-xl font-bold text-white">Browse Dropbox Folders</h2>
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

        <div className="flex-1 flex flex-col space-y-6 overflow-hidden">
          {/* Selected folder display */}
          {selectedFolder && (
            <div className="bg-blue-900/20 p-4 rounded-lg border border-blue-500/30">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <FolderIcon className="w-5 h-5 text-yellow-400" />
                  <div>
                    <h3 className="font-medium text-white">{selectedFolder.name}</h3>
                    <p className="text-sm text-gray-400">{selectedFolder.path}</p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedFolder(null)}
                  className="text-gray-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search folders..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-gray-700/50 border border-gray-600 rounded-lg pl-10 pr-4 py-2 text-white placeholder-gray-400 focus:outline-none focus:border-yellow-500"
            />
          </div>

          {/* Breadcrumb Navigation */}
          {!searchQuery && (
            <div className="flex items-center space-x-2 text-sm">
              {getBreadcrumbs().map((crumb, index) => (
                <React.Fragment key={index}>
                  {index > 0 && <ChevronRight className="w-4 h-4 text-gray-500" />}
                  <button
                    onClick={() => navigateToBreadcrumb(index)}
                    className={`flex items-center space-x-1 px-2 py-1 rounded transition-colors ${
                      index === getBreadcrumbs().length - 1
                        ? 'text-yellow-400 bg-yellow-500/10'
                        : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
                    }`}
                  >
                    {index === 0 && <Home className="w-3 h-3" />}
                    <span>{crumb}</span>
                  </button>
                </React.Fragment>
              ))}
            </div>
          )}

          {/* Back Button */}
          {managementPath && !searchQuery && (
            <button
              onClick={navigateManagementBack}
              className="flex items-center space-x-2 text-gray-400 hover:text-white transition-colors w-fit"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back</span>
            </button>
          )}

          {/* Folders List */}
          <div className="flex-1 overflow-y-auto">
            {filteredFolders.length === 0 ? (
              <div className="text-center py-8">
                <FolderIcon className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                <p className="text-gray-400">
                  {searchQuery ? 'No folders found matching your search' : 'No folders in this location'}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredFolders.map((folder) => {
                  const isSelected = selectedFolder?.id === folder.id;
                  
                  return (
                    <div
                      key={folder.id}
                      className={`group flex items-center justify-between p-4 rounded-lg border cursor-pointer transition-all duration-200 ${
                        isSelected
                          ? 'bg-yellow-500/20 border-yellow-500/50'
                          : 'bg-gray-700/50 border-gray-600 hover:bg-gray-600/50'
                      }`}
                      onClick={() => handleFolderSelect(folder)}
                      onDoubleClick={() => handleFolderDoubleClick(folder)}
                    >
                      <div className="flex items-center space-x-3 flex-1 min-w-0">
                        <div className="flex-shrink-0">
                          {folder.hasSubfolders ? (
                            <FolderIcon className="w-5 h-5 text-yellow-400" />
                          ) : (
                            <Music className="w-5 h-5 text-blue-400" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium text-white truncate">{folder.name}</h3>
                          <div className="flex items-center space-x-2 text-sm text-gray-400">
                            <span>
                              {(folder.trackCount === 0 && folder.hasSubfolders === true) || folder.trackCount === undefined
                                ? (
                                  <span className="flex items-center space-x-1">
                                    <div className="w-3 h-3 animate-spin rounded-full border border-t-transparent border-gray-400"></div>
                                    <span>Loading...</span>
                                  </span>
                                )
                                : folder.trackCount > 0 
                                  ? `${folder.trackCount} tracks` 
                                  : 'No tracks'
                              }
                            </span>
                            {folder.hasSubfolders && folder.trackCount !== 0 && (
                              <span className="text-yellow-400">• Has subfolders</span>
                            )}
                          </div>
                          {searchQuery && (
                            <p className="text-xs text-gray-500 truncate mt-1">{folder.path}</p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center space-x-3">
                        {folder.hasSubfolders && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              navigateToManagementFolder(folder.path);
                            }}
                            className="p-1 text-gray-400 hover:text-white transition-colors"
                            title="Browse folder"
                          >
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        )}

                        {/* Selection indicator */}
                        <div
                          className={`w-6 h-6 rounded border-2 flex items-center justify-center transition-colors ${
                            isSelected
                              ? 'bg-yellow-600 border-yellow-600'
                              : 'border-gray-600'
                          }`}
                        >
                          {isSelected && <Check className="w-4 h-4 text-white" />}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Configuration */}
          <div className="border-t border-gray-700 pt-4">
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Sync Frequency
              </label>
              <select
                value={syncFrequency}
                onChange={(e) => setSyncFrequency(e.target.value)}
                className="w-full bg-gray-700/50 text-white px-4 py-2 rounded-lg border border-gray-600 focus:border-yellow-500 focus:outline-none"
              >
                <option value="manual">Manual</option>
                <option value="hourly">Every Hour</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
              </select>
            </div>

            {error && (
              <div className="p-3 bg-red-900/50 text-red-300 rounded-lg text-sm mb-4">
                {error}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex space-x-3">
              <button
                onClick={handleClose}
                className="flex-1 px-4 py-2 text-gray-300 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={loading || !selectedFolder}
                className="flex-1 px-4 py-2 bg-yellow-600 hover:bg-yellow-700 disabled:opacity-50 text-white rounded-lg transition-colors"
              >
                {loading ? 'Adding...' : `Add "${selectedFolder?.name || 'Folder'}"`}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};