import React from 'react';
import { Plus, Edit, Trash2, Eye } from 'lucide-react';

export const CollectionManagement: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Collections</h1>
          <p className="text-gray-400">Organize your playlists into collections</p>
        </div>
        <button className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg transition-colors">
          <Plus className="w-4 h-4" />
          <span>New Collection</span>
        </button>
      </div>

      {/* Collections List */}
      <div className="bg-gray-800/30 backdrop-blur-sm rounded-xl border border-gray-700/50">
        <div className="p-6">
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
              <Plus className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">No Collections Yet</h3>
            <p className="text-gray-400 mb-6">Create your first collection to organize playlists</p>
            <button className="bg-blue-600 hover:bg-blue-700 px-6 py-3 rounded-lg transition-colors">
              Create Collection
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};