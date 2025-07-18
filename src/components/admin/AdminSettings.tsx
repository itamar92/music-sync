import React, { useState } from 'react';
import { Settings, Database, Key, Shield, RefreshCw } from 'lucide-react';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { useAuthState } from 'react-firebase-hooks/auth';
import { db, auth } from '../../services/firebase';
import { migrateCollectionsToPublic, migratePlaylistsToPublic } from '../../utils/migratePublicData';
import { debugCollectionsAndPlaylists, debugDatabase } from '../../utils/debugDatabase';
import { useToast } from '../../hooks/useToast';
import { ToastContainer } from '../ToastContainer';

export const AdminSettings: React.FC = () => {
  const [user] = useAuthState(auth);
  const [adminEmail, setAdminEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [migrationLoading, setMigrationLoading] = useState(false);
  const { toasts, removeToast, success, error, info } = useToast();

  const handleMakeSelfAdmin = async () => {
    if (!user) {
      setMessage('You must be logged in to grant admin access');
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      const userDocRef = doc(db, 'users', user.uid);
      
      await setDoc(userDocRef, {
        email: user.email,
        role: 'admin',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }, { merge: true });

      setMessage(`Admin role granted to ${user.email}`);
      
      // Refresh the page to update the admin status
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (error) {
      console.error('Error adding admin:', error);
      setMessage('Failed to add admin. Check console for details.');
    } finally {
      setLoading(false);
    }
  };

  const handleMigratePublicData = async () => {
    if (!user) {
      error('You must be logged in to run migration');
      return;
    }

    setMigrationLoading(true);
    info('Starting migration...');

    try {
      // First, debug the current state
      await debugCollectionsAndPlaylists(user.uid);
      
      const collectionsCount = await migrateCollectionsToPublic(user.uid);
      const playlistsCount = await migratePlaylistsToPublic(user.uid);
      
      // Debug again after migration
      await debugCollectionsAndPlaylists(user.uid);
      
      success(`Migration completed! Updated ${collectionsCount} collections and ${playlistsCount} playlists to public.`);
    } catch (migrationError) {
      console.error('Error running migration:', migrationError);
      error('Failed to run migration. Check console for details.');
    } finally {
      setMigrationLoading(false);
    }
  };

  const handleDebugDatabase = async () => {
    if (!user) {
      error('You must be logged in to debug database');
      return;
    }

    info('Debugging database state...');
    await debugCollectionsAndPlaylists(user.uid);
    await debugDatabase(user.uid);
    info('Check console for debug information.');
  };

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
          <div className="p-4 bg-blue-900/20 rounded-lg border border-blue-500/30">
            <p className="text-sm text-blue-300 mb-3">
              Currently logged in as: <span className="font-medium">{user?.email || 'Not logged in'}</span>
            </p>
            <p className="text-xs text-blue-400">
              Click the button below to grant admin access to your current account.
            </p>
          </div>
          
          {message && (
            <div className={`p-3 rounded-lg ${message.includes('Failed') ? 'bg-red-900/50 text-red-300' : 'bg-green-900/50 text-green-300'}`}>
              {message}
            </div>
          )}
          
          <button 
            onClick={handleMakeSelfAdmin}
            disabled={loading || !user}
            className="bg-yellow-600 hover:bg-yellow-700 disabled:opacity-50 px-4 py-2 rounded-lg transition-colors"
          >
            {loading ? 'Granting Admin Access...' : 'Make Me Admin'}
          </button>
        </div>
      </div>

      {/* Data Migration */}
      <div className="bg-gray-800/30 backdrop-blur-sm rounded-xl p-6 border border-gray-700/50">
        <div className="flex items-center space-x-3 mb-4">
          <RefreshCw className="w-5 h-5 text-purple-400" />
          <h2 className="text-xl font-semibold text-white">Data Migration</h2>
        </div>
        <div className="space-y-4">
          <div className="p-4 bg-purple-900/20 rounded-lg border border-purple-500/30">
            <p className="text-sm text-purple-300 mb-3">
              If you're experiencing issues with public site access, run this migration to mark existing collections and playlists as public.
            </p>
            <p className="text-xs text-purple-400">
              This will update existing data to work with the new public access system.
            </p>
          </div>
          
          
          <div className="flex space-x-3">
            <button 
              onClick={handleDebugDatabase}
              disabled={!user}
              className="bg-gray-600 hover:bg-gray-700 disabled:opacity-50 px-4 py-2 rounded-lg transition-colors"
            >
              Debug Database
            </button>
            <button 
              onClick={handleMigratePublicData}
              disabled={migrationLoading || !user}
              className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50 px-4 py-2 rounded-lg transition-colors"
            >
              {migrationLoading ? 'Running Migration...' : 'Migrate to Public Access'}
            </button>
          </div>
        </div>
      </div>

      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
};