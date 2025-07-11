import React from 'react';
import { Plus, FolderOpen, RefreshCw } from 'lucide-react';

export const FolderSyncManagement: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Folder Sync</h1>
          <p className="text-gray-400">Manage Dropbox folder synchronization</p>
        </div>
        <button className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg transition-colors">
          <Plus className="w-4 h-4" />
          <span>Add Folder</span>
        </button>
      </div>

      {/* Sync Status */}
      <div className="bg-gray-800/30 backdrop-blur-sm rounded-xl p-6 border border-gray-700/50">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-white">Sync Status</h2>
          <button className="flex items-center space-x-2 bg-green-600 hover:bg-green-700 px-3 py-1 rounded-lg text-sm transition-colors">
            <RefreshCw className="w-4 h-4" />
            <span>Sync Now</span>
          </button>
        </div>
        <div className="text-center py-8">
          <FolderOpen className="w-16 h-16 text-gray-500 mx-auto mb-4" />
          <p className="text-gray-400">No folders configured for sync</p>
        </div>
      </div>
    </div>
  );
};