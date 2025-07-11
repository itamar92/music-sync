import React from 'react';
import { Settings, Database, Key, Shield } from 'lucide-react';

export const AdminSettings: React.FC = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Settings</h1>
        <p className="text-gray-400">Configure application settings and integrations</p>
      </div>

      {/* Dropbox Integration */}
      <div className="bg-gray-800/30 backdrop-blur-sm rounded-xl p-6 border border-gray-700/50">
        <div className="flex items-center space-x-3 mb-4">
          <Key className="w-5 h-5 text-blue-400" />
          <h2 className="text-xl font-semibold text-white">Dropbox Integration</h2>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">App Key</label>
            <input
              type="text"
              placeholder="Your Dropbox App Key"
              className="w-full bg-gray-700/50 text-white placeholder-gray-400 px-4 py-2 rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">App Secret</label>
            <input
              type="password"
              placeholder="Your Dropbox App Secret"
              className="w-full bg-gray-700/50 text-white placeholder-gray-400 px-4 py-2 rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none"
            />
          </div>
          <button className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg transition-colors">
            Save Credentials
          </button>
        </div>
      </div>

      {/* Database Settings */}
      <div className="bg-gray-800/30 backdrop-blur-sm rounded-xl p-6 border border-gray-700/50">
        <div className="flex items-center space-x-3 mb-4">
          <Database className="w-5 h-5 text-green-400" />
          <h2 className="text-xl font-semibold text-white">Database</h2>
        </div>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-gray-300">Connection Status</span>
            <span className="text-green-400">Connected</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-300">Last Backup</span>
            <span className="text-gray-400">Never</span>
          </div>
          <button className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded-lg transition-colors">
            Backup Now
          </button>
        </div>
      </div>

      {/* User Management */}
      <div className="bg-gray-800/30 backdrop-blur-sm rounded-xl p-6 border border-gray-700/50">
        <div className="flex items-center space-x-3 mb-4">
          <Shield className="w-5 h-5 text-yellow-400" />
          <h2 className="text-xl font-semibold text-white">User Management</h2>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Admin Email</label>
            <input
              type="email"
              placeholder="admin@example.com"
              className="w-full bg-gray-700/50 text-white placeholder-gray-400 px-4 py-2 rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none"
            />
          </div>
          <button className="bg-yellow-600 hover:bg-yellow-700 px-4 py-2 rounded-lg transition-colors">
            Add Admin
          </button>
        </div>
      </div>
    </div>
  );
};