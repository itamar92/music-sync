import React from 'react';
import { Users, Music, FolderOpen, BarChart3 } from 'lucide-react';

export const AdminOverview: React.FC = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Admin Overview</h1>
        <p className="text-gray-400">Manage your music collections and sync settings</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-gray-800/30 backdrop-blur-sm rounded-xl p-6 border border-gray-700/50">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Total Collections</p>
              <p className="text-2xl font-bold text-white">0</p>
            </div>
            <FolderOpen className="w-8 h-8 text-blue-500" />
          </div>
        </div>

        <div className="bg-gray-800/30 backdrop-blur-sm rounded-xl p-6 border border-gray-700/50">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Total Playlists</p>
              <p className="text-2xl font-bold text-white">0</p>
            </div>
            <Music className="w-8 h-8 text-green-500" />
          </div>
        </div>

        <div className="bg-gray-800/30 backdrop-blur-sm rounded-xl p-6 border border-gray-700/50">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Synced Folders</p>
              <p className="text-2xl font-bold text-white">0</p>
            </div>
            <FolderOpen className="w-8 h-8 text-yellow-500" />
          </div>
        </div>

        <div className="bg-gray-800/30 backdrop-blur-sm rounded-xl p-6 border border-gray-700/50">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Total Tracks</p>
              <p className="text-2xl font-bold text-white">0</p>
            </div>
            <BarChart3 className="w-8 h-8 text-purple-500" />
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-gray-800/30 backdrop-blur-sm rounded-xl p-6 border border-gray-700/50">
        <h2 className="text-xl font-semibold text-white mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <button className="flex items-center space-x-3 p-4 bg-blue-600/20 hover:bg-blue-600/30 rounded-lg border border-blue-500/30 transition-colors">
            <FolderOpen className="w-5 h-5 text-blue-400" />
            <span className="text-white">Create Collection</span>
          </button>
          
          <button className="flex items-center space-x-3 p-4 bg-green-600/20 hover:bg-green-600/30 rounded-lg border border-green-500/30 transition-colors">
            <Music className="w-5 h-5 text-green-400" />
            <span className="text-white">Add Playlist</span>
          </button>
          
          <button className="flex items-center space-x-3 p-4 bg-yellow-600/20 hover:bg-yellow-600/30 rounded-lg border border-yellow-500/30 transition-colors">
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