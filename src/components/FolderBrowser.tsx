import React, { useState, useEffect } from 'react';
import { 
  Folder as FolderIcon, 
  Music, 
  ArrowLeft, 
  Search, 
  ChevronRight,
  Home
} from 'lucide-react';
import { Folder } from '../types';
import { localDataService } from '../services/localDataService';

interface FolderBrowserProps {
  folders: Folder[];
  onFolderSelect: (folder: Folder) => void;
  onNavigateToFolder: (path: string) => void;
  onBack: () => void;
  currentPath: string;
  isLoading?: boolean;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onLoadFolderDetails?: (folder: Folder) => Promise<{trackCount: number, hasSubfolders: boolean}>;
}

export const FolderBrowser: React.FC<FolderBrowserProps> = ({
  folders,
  onFolderSelect,
  onNavigateToFolder,
  onBack,
  currentPath,
  isLoading = false,
  searchQuery,
  onSearchChange,
  onLoadFolderDetails
}) => {
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
    } else {
      onFolderSelect(folder);
    }
  };

  const handleFolderClick = async (folder: Folder) => {
    await loadFolderDetailsIfNeeded(folder);
    onFolderSelect(folder);
  };

  const getFolderTrackCount = (folder: Folder): number => {
    const details = folderDetails.get(folder.id);
    return details?.trackCount ?? folder.trackCount;
  };

  const getFolderHasSubfolders = (folder: Folder): boolean => {
    const details = folderDetails.get(folder.id);
    return details?.hasSubfolders ?? folder.hasSubfolders;
  };

  if (isLoading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
        <p className="text-gray-400">Loading folders...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
        <input
          type="text"
          placeholder="Search folders..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
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
          onClick={onBack}
          className="flex items-center space-x-2 text-gray-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back</span>
        </button>
      )}

      {/* Folders List */}
      {filteredFolders.length === 0 ? (
        <div className="text-center py-8">
          <FolderIcon className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400">
            {searchQuery ? 'No folders found matching your search' : 'No folders in this location'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredFolders.map((folder) => (
            <div
              key={folder.id}
              className="group p-3 rounded-lg cursor-pointer transition-all duration-200 bg-gray-800/30 hover:bg-blue-500/20 border border-transparent hover:border-blue-500/30"
              onClick={() => handleFolderClick(folder)}
              onDoubleClick={() => handleFolderDoubleClick(folder)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3 flex-1 min-w-0">
                  <div className="flex-shrink-0">
                    {getFolderHasSubfolders(folder) ? (
                      <FolderIcon className="w-5 h-5 text-yellow-400" />
                    ) : (
                      <Music className="w-5 h-5 text-blue-400" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-white truncate">{localDataService.getFolderDisplayName(folder)}</h3>
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
                <div className="flex items-center space-x-2">
                  {getFolderHasSubfolders(folder) && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onNavigateToFolder(folder.path);
                      }}
                      className="p-1 text-gray-400 hover:text-white opacity-0 group-hover:opacity-100 transition-all"
                      title="Browse folder"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleFolderClick(folder);
                    }}
                    className="p-1 text-gray-400 hover:text-blue-400 opacity-0 group-hover:opacity-100 transition-all"
                    title="Play tracks"
                  >
                    <Music className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};