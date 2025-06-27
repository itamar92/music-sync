import React from 'react';
import { dropboxService } from '../services/dropboxService';

interface DebugInfoProps {
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  folders: any[];
  allFolders: any[];
  managementFolders?: any[];
  managementPath?: string;
}

export const DebugInfo: React.FC<DebugInfoProps> = ({
  isConnected,
  isConnecting,
  error,
  folders,
  allFolders,
  managementFolders = [],
  managementPath = ''
}) => {
  // Only show in development
  if (import.meta.env.PROD) return null;

  const cacheStats = isConnected ? dropboxService.getCacheStats() : null;

  return (
    <div className="fixed bottom-4 right-4 bg-gray-900 p-4 rounded-lg border border-gray-700 text-xs max-w-sm">
      <h4 className="font-bold text-white mb-2">Debug Info</h4>
      <div className="space-y-1 text-gray-300">
        <div>Connected: {isConnected ? '✅' : '❌'}</div>
        <div>Connecting: {isConnecting ? '🔄' : '✅'}</div>
        <div>Error: {error || 'None'}</div>
        <div>Synced Folders: {folders.length}</div>
        <div>All Folders: {allFolders.length}</div>
        <div>Management Folders: {managementFolders.length}</div>
        <div>Management Path: {managementPath || 'Root'}</div>
        <div>App Key: {import.meta.env.VITE_DROPBOX_APP_KEY ? '✅' : '❌'}</div>
        <div>Token: {localStorage.getItem('dropbox_access_token') ? '✅' : '❌'}</div>
        {cacheStats && (
          <div className="border-t border-gray-600 pt-2 mt-2">
            <div className="text-yellow-400 font-semibold mb-1">Cache Stats:</div>
            <div>Entries: {cacheStats.valid}/{cacheStats.total}</div>
            <div>Size: {cacheStats.size}</div>
            <button 
              onClick={() => dropboxService.clearCache()}
              className="text-red-400 hover:text-red-300 underline text-xs mt-1"
            >
              Clear Cache
            </button>
          </div>
        )}
      </div>
    </div>
  );
};