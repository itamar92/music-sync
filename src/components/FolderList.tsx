import React from 'react';
import { Folder as FolderIcon, Music } from 'lucide-react';
import { Folder } from '../types';

interface FolderListProps {
  folders: Folder[];
  onFolderSelect: (folder: Folder) => void;
  isLoading?: boolean;
  emptyMessage?: string;
  emptyAction?: {
    text: string;
    onClick: () => void;
  };
}

export const FolderList: React.FC<FolderListProps> = ({
  folders,
  onFolderSelect,
  isLoading = false,
  emptyMessage = "No folders available",
  emptyAction
}) => {
  if (isLoading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
        <p className="text-gray-400">Loading folders...</p>
      </div>
    );
  }

  if (folders.length === 0) {
    return (
      <div className="text-center py-8">
        <FolderIcon className="w-12 h-12 text-gray-600 mx-auto mb-4" />
        <p className="text-gray-400 mb-4">{emptyMessage}</p>
        {emptyAction && (
          <button
            onClick={emptyAction.onClick}
            className="text-blue-400 hover:text-blue-300 transition-colors"
          >
            {emptyAction.text}
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {folders.map((folder) => (
        <div
          key={folder.id}
          onClick={() => onFolderSelect(folder)}
          className="p-4 rounded-lg cursor-pointer transition-all duration-200 bg-gray-800/30 hover:bg-blue-500/20 border border-transparent hover:border-blue-500/30"
        >
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <h3 className="font-medium text-white truncate">{folder.name}</h3>
              <p className="text-sm text-gray-400">
                {folder.trackCount > 0 
                  ? `${folder.trackCount} tracks` 
                  : 'Click to load tracks'
                }
              </p>
              {folder.path && (
                <p className="text-xs text-gray-500 truncate mt-1">{folder.path}</p>
              )}
            </div>
            <div className="text-blue-400 ml-4">
              <Music className="w-4 h-4" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};