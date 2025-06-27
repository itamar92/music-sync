import React, { useState, useEffect } from 'react';
import { 
  Folder as FolderIcon, 
  Music, 
  ArrowLeft, 
  Search, 
  ChevronRight,
  Home,
  Check,
  X
} from 'lucide-react';
import { Folder } from '../types';
import { Modal } from './Modal';

interface FolderManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  folders: Folder[];
  syncedFolders: string[];
  onToggleSync: (folderId: string) => void;
  onNavigateToFolder: (path: string) => void;
  onNavigateBack: () => void;
  currentPath: string;
  isLoading?: boolean;
  onOpen?: () => void;
  onLoadFolderDetails?: (folder: Folder) => Promise<{trackCount: number, hasSubfolders: boolean}>;
}

export const FolderManagementModal: React.FC<FolderManagementModalProps> = ({
  isOpen,
  onClose,
  folders,
  syncedFolders,
  onToggleSync,
  onNavigateToFolder,
  onNavigateBack,
  currentPath,
  isLoading = false,
  onOpen,
  onLoadFolderDetails
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredFolders, setFilteredFolders] = useState<Folder[]>(folders);
  const [loadingDetails, setLoadingDetails] = useState<Set<string>>(new Set());
  const [folderDetails, setFolderDetails] = useState<Map<string, {trackCount: number, hasSubfolders: boolean}>>(new Map());

  useEffect(() => {
    if (searchQuery.trim()) {
      const filtered = folders.filter(folder =>
        folder.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        folder.path.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredFolders(filtered);
    } else {
      setFilteredFolders(folders);
    }
  }, [folders, searchQuery]);



  const getBreadcrumbs = () => {
    if (!currentPath) return ['Home'];
    
    const parts = currentPath.split('/').filter(Boolean);
    return ['Home', ...parts];
  };

  const navigateToBreadcrumb = (index: number) => {
    if (index === 0) {
      onNavigateToFolder('');
    } else {
      const parts = currentPath.split('/').filter(Boolean);
      const newPath = '/' + parts.slice(0, index).join('/');
      onNavigateToFolder(newPath);
    }
  };

  const loadFolderDetailsIfNeeded = async (folder: Folder) => {
    if (!onLoadFolderDetails || folderDetails.has(folder.id) || loadingDetails.has(folder.id)) {
      return;
    }

    setLoadingDetails(prev => new Set([...prev, folder.id]));
    
    try {
      const details = await onLoadFolderDetails(folder);
      setFolderDetails(prev => new Map([...prev, [folder.id, details]]));
    } catch (error) {
      console.error('Failed to load folder details:', error);
    } finally {
      setLoadingDetails(prev => {
        const next = new Set(prev);
        next.delete(folder.id);
        return next;
      });
    }
  };

  const handleFolderDoubleClick = async (folder: Folder) => {
    await loadFolderDetailsIfNeeded(folder);
    const details = folderDetails.get(folder.id);
    
    if (details?.hasSubfolders || folder.hasSubfolders) {
      onNavigateToFolder(folder.path);
    }
  };

  const getFolderTrackCount = (folder: Folder): number => {
    const details = folderDetails.get(folder.id);
    return details?.trackCount ?? folder.trackCount;
  };

  const getFolderHasSubfolders = (folder: Folder): boolean => {
    const details = folderDetails.get(folder.id);
    return details?.hasSubfolders ?? folder.hasSubfolders;
  };

  const isFolderSynced = (folderId: string) => {
    return syncedFolders.includes(folderId);
  };

  const getSyncedCount = () => {
    return filteredFolders.filter(folder => isFolderSynced(folder.id)).length;
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div data-modal="folder-management">
      <Modal isOpen={isOpen} onClose={onClose} title="Manage Dropbox Folders" maxWidth="max-w-4xl">
        <div className="space-y-6">
        <div className="flex items-center justify-between">
          <p className="text-gray-400">
            Select which folders you want to sync. {getSyncedCount()} of {filteredFolders.length} folders selected.
          </p>
          <div className="text-sm text-gray-500">
            Double-click folders to browse subfolders
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input
            type="text"
            placeholder="Search folders..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-10 pr-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
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
                      ? 'text-blue-400 bg-blue-500/10'
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
        {currentPath && !searchQuery && (
          <button
            onClick={onNavigateBack}
            className="flex items-center space-x-2 text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back</span>
          </button>
        )}

        {/* Folders List */}
        <div className="max-h-96 overflow-y-auto">
          {isLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
              <p className="text-gray-400">Loading folders...</p>
            </div>
          ) : filteredFolders.length === 0 ? (
            <div className="text-center py-8">
              <FolderIcon className="w-12 h-12 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400">
                {searchQuery ? 'No folders found matching your search' : 'No folders in this location'}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredFolders.map((folder) => {
                const isSelected = isFolderSynced(folder.id);
                
                return (
                  <div
                    key={folder.id}
                    className={`group flex items-center justify-between p-4 rounded-lg border cursor-pointer transition-all duration-200 ${
                      isSelected
                        ? 'bg-blue-500/20 border-blue-500/50'
                        : 'bg-gray-800/50 border-gray-700 hover:bg-gray-700/50'
                    }`}
                    onDoubleClick={() => handleFolderDoubleClick(folder)}
                  >
                    <div className="flex items-center space-x-3 flex-1 min-w-0">
                      <div className="flex-shrink-0">
                        {getFolderHasSubfolders(folder) ? (
                          <FolderIcon className="w-5 h-5 text-yellow-400" />
                        ) : (
                          <Music className="w-5 h-5 text-blue-400" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-white truncate">{folder.name}</h3>
                        <div className="flex items-center space-x-2 text-sm text-gray-400">
                          {loadingDetails.has(folder.id) ? (
                            <span>Loading...</span>
                          ) : (
                            <span>
                              {getFolderTrackCount(folder) > 0 
                                ? `${getFolderTrackCount(folder)} tracks` 
                                : 'Click to load tracks'
                              }
                            </span>
                          )}
                          {getFolderHasSubfolders(folder) && (
                            <span className="text-yellow-400">• Has subfolders</span>
                          )}
                        </div>
                        {searchQuery && (
                          <p className="text-xs text-gray-500 truncate mt-1">{folder.path}</p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center space-x-3">
                      {getFolderHasSubfolders(folder) && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onNavigateToFolder(folder.path);
                          }}
                          className="p-1 text-gray-400 hover:text-white transition-colors"
                          title="Browse folder"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      )}

                      {/* Sync Toggle */}
                      <label className="flex items-center space-x-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => onToggleSync(folder.id)}
                          className="sr-only"
                        />
                        <div
                          className={`w-6 h-6 rounded border-2 flex items-center justify-center transition-colors ${
                            isSelected
                              ? 'bg-blue-600 border-blue-600'
                              : 'border-gray-600 hover:border-gray-500'
                          }`}
                        >
                          {isSelected && <Check className="w-4 h-4 text-white" />}
                        </div>
                        <span className="text-sm text-gray-300">
                          {isSelected ? 'Synced' : 'Not synced'}
                        </span>
                      </label>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex justify-between items-center pt-4 border-t border-gray-700">
          <div className="text-sm text-gray-400">
            {getSyncedCount()} folder{getSyncedCount() !== 1 ? 's' : ''} selected for sync
          </div>
          <div className="flex space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={onClose}
              className="bg-blue-600 hover:bg-blue-700 px-6 py-2 rounded transition-colors text-white"
            >
              Save Changes
            </button>
          </div>
        </div>
      </div>
      </Modal>
    </div>
  );
};