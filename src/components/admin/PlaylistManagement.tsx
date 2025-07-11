import React from 'react';
import { Plus, Music, Edit, Trash2 } from 'lucide-react';

export const PlaylistManagement: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Playlists</h1>
          <p className="text-gray-400">Manage all playlists across collections</p>
        </div>
        <button className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg transition-colors">
          <Plus className="w-4 h-4" />
          <span>New Playlist</span>
        </button>
      </div>

      {/* Filter and Search */}
      <div className="bg-gray-800/30 backdrop-blur-sm rounded-xl p-6 border border-gray-700/50">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search playlists..."
              className="w-full bg-gray-700/50 text-white placeholder-gray-400 px-4 py-2 rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none"
            />
          </div>
          <select className="bg-gray-700/50 text-white px-4 py-2 rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none">
            <option>All Collections</option>
          </select>
        </div>
      </div>

      {/* Playlists List */}
      <div className="bg-gray-800/30 backdrop-blur-sm rounded-xl border border-gray-700/50">
        <div className="p-6">
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
              <Music className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">No Playlists Yet</h3>
            <p className="text-gray-400 mb-6">Create playlists to organize your music</p>
            <button className="bg-blue-600 hover:bg-blue-700 px-6 py-3 rounded-lg transition-colors">
              Create Playlist
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};