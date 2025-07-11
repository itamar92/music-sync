// src/hooks/useDropbox.ts
import { useState, useEffect, useCallback } from 'react';
import { Folder, Track } from '../types';
import { dropboxService } from '../services/dropboxService';
import { databaseService } from '../services/databaseService';
import { auth } from '../services/firebase';

export const useDropbox = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(true);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [allFolders, setAllFolders] = useState<Folder[]>([]);
  const [syncedFolders, setSyncedFolders] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [currentPath, setCurrentPath] = useState<string>('');
  const [managementFolders, setManagementFolders] = useState<Folder[]>([]);
  const [managementPath, setManagementPath] = useState<string>('');
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(user => {
      if (user) {
        setUserId(user.uid);
      } else {
        setUserId(null);
      }
    });
    return unsubscribe;
  }, []);

  const loadAllSyncedFolders = useCallback(async (syncedIds: string[]) => {
    const syncedFolders: Folder[] = [];
    
    // Load custom display names for anonymous users
    const localNames = !userId ? localStorage.getItem('folderDisplayNames') : null;
    const folderNames = localNames ? JSON.parse(localNames) : {};
    
    for (const folderId of syncedIds) {
      try {
        let folder = allFolders.find(f => f.id === folderId);
        if (!folder) {
          folder = await dropboxService.getFolderInfo(folderId);
        }
        
        if (folder) {
          // Apply custom display name if available
          if (!userId && folderNames[folderId]) {
            folder = { ...folder, displayName: folderNames[folderId] };
          }
          syncedFolders.push(folder);
        }
      } catch (error) {
        console.warn(`Failed to load synced folder ${folderId}:`, error);
      }
    }
    setFolders(syncedFolders);
  }, [allFolders, userId]);

  const loadFolders = useCallback(async (path: string = '') => {
    try {
      const folderList = await dropboxService.listFolders(path);
      if (path === '') {
        setAllFolders(folderList);
        let syncedIds: string[] = [];
        
        if (userId) {
          // Authenticated user - use database
          const synced = await databaseService.getSyncedFolders(userId);
          syncedIds = synced.map(f => f.folderId);
        } else {
          // Anonymous user - use localStorage
          const localSynced = localStorage.getItem('syncedFolders');
          syncedIds = localSynced ? JSON.parse(localSynced) : [];
        }
        
        setSyncedFolders(syncedIds);
        await loadAllSyncedFolders(syncedIds);
      } else {
        setFolders(folderList);
      }
      setCurrentPath(path);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load folders');
    }
  }, [userId, loadAllSyncedFolders]);

  const checkConnection = useCallback(async () => {
    try {
      setIsConnecting(true);
      const connected = dropboxService.isAuthenticated();
      if (connected) {
        const isValid = await dropboxService.validateToken();
        if (isValid) {
          setIsConnected(true);
          await loadFolders();
        } else {
          setIsConnected(false);
          setError('Your Dropbox session has expired. Please reconnect.');
        }
      } else {
        setIsConnected(false);
      }
    } catch (err) {
      console.error('Connection check failed:', err);
      setError(err instanceof Error ? err.message : 'Connection failed');
      setIsConnected(false);
    } finally {
      setIsConnecting(false);
    }
  }, [loadFolders]);

  const connect = useCallback(async () => {
    try {
      setError(null);
      await dropboxService.authenticate();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed');
    }
  }, []);

  const handleAuthCallback = useCallback(async (code: string) => {
    try {
      setIsConnecting(true);
      const success = await dropboxService.handleAuthCallback(code);
      if (success) {
        setIsConnected(true);
        await loadFolders();
      } else {
        setError('Authentication failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setIsConnecting(false);
    }
  }, [loadFolders]);

  const refreshFolders = useCallback(async () => {
    if (isConnected) {
      await loadFolders(currentPath);
    }
  }, [isConnected, loadFolders, currentPath]);

  const navigateToFolder = useCallback(async (path: string) => {
    if (isConnected) {
      await loadFolders(path);
    }
  }, [isConnected, loadFolders]);

  const navigateBack = useCallback(() => {
    if (currentPath) {
      const parentPath = currentPath.split('/').slice(0, -1).join('/');
      navigateToFolder(parentPath);
    }
  }, [currentPath, navigateToFolder]);

  const loadManagementFolders = useCallback(async (path: string = '') => {
    try {
      const folderList = await dropboxService.listFolders(path);
      const foldersWithSyncStatus = folderList.map(folder => ({
        ...folder,
        synced: syncedFolders.includes(folder.id)
      }));
      setManagementFolders(foldersWithSyncStatus);
      setManagementPath(path);
    } catch (err) {
      console.error('Error loading management folders:', err);
      setError(err instanceof Error ? err.message : 'Failed to load management folders');
    }
  }, [syncedFolders]);

  const navigateToManagementFolder = useCallback(async (path: string) => {
    if (isConnected) {
      await loadManagementFolders(path);
    }
  }, [isConnected, loadManagementFolders]);

  const navigateManagementBack = useCallback(() => {
    if (managementPath) {
      const parentPath = managementPath.split('/').slice(0, -1).join('/');
      navigateToManagementFolder(parentPath);
    }
  }, [managementPath, navigateToManagementFolder]);

  const toggleFolderSync = useCallback(async (folder: Folder) => {
    try {
      const isCurrentlySynced = syncedFolders.includes(folder.id);
      let newSyncedIds: string[];

      if (isCurrentlySynced) {
        // Remove from synced
        newSyncedIds = syncedFolders.filter(id => id !== folder.id);
      } else {
        // Add to synced
        newSyncedIds = [...syncedFolders, folder.id];
      }

      if (userId) {
        // Authenticated user - update database
        if (isCurrentlySynced) {
          await databaseService.unsyncFolder(userId, folder.id);
        } else {
          await databaseService.syncFolder(userId, folder);
        }
      } else {
        // Anonymous user - update localStorage
        localStorage.setItem('syncedFolders', JSON.stringify(newSyncedIds));
      }

      // Update local state
      setSyncedFolders(newSyncedIds);
      await loadAllSyncedFolders(newSyncedIds);
    } catch (error) {
      console.error('Error toggling folder sync:', error);
      setError('Failed to update sync status');
    }
  }, [userId, syncedFolders, loadAllSyncedFolders]);

  const getTracksFromFolder = useCallback(async (folder: Folder): Promise<Track[]> => {
    try {
      return await dropboxService.getTracksFromFolder(folder.path);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tracks');
      return [];
    }
  }, []);

  const searchTracks = useCallback(async (query: string): Promise<Track[]> => {
    try {
      return await dropboxService.searchAudioFiles(query);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
      return [];
    }
  }, []);

  const disconnect = useCallback(() => {
    dropboxService.disconnect();
    setIsConnected(false);
    setFolders([]);
    setAllFolders([]);
    setSyncedFolders([]);
  }, []);

  const updateFolderDisplayName = useCallback(async (folderId: string, displayName: string) => {
    try {
      if (userId) {
        // Authenticated user - update database
        await databaseService.updateFolderDisplayName(userId, folderId, displayName);
      } else {
        // Anonymous user - store in localStorage
        const localNames = localStorage.getItem('folderDisplayNames');
        const folderNames = localNames ? JSON.parse(localNames) : {};
        folderNames[folderId] = displayName;
        localStorage.setItem('folderDisplayNames', JSON.stringify(folderNames));
      }

      // Update local state
      setFolders(prevFolders => 
        prevFolders.map(folder => 
          folder.id === folderId 
            ? { ...folder, displayName }
            : folder
        )
      );
      setAllFolders(prevAll => 
        prevAll.map(folder => 
          folder.id === folderId 
            ? { ...folder, displayName }
            : folder
        )
      );
    } catch (error) {
      console.error('Error updating folder display name:', error);
      setError('Failed to update folder name');
    }
  }, [userId]);

  const retry = useCallback(async () => {
    try {
      setError(null);
      setIsConnecting(true);
      const token = localStorage.getItem('dropbox_access_token');
      if (token) {
        dropboxService.setAccessToken(token);
        const isValid = await dropboxService.validateToken();
        if (isValid) {
          setIsConnected(true);
          await loadFolders();
          setIsConnecting(false);
        } else {
          await connect();
        }
      } else {
        await connect();
      }
    } catch (err) {
      console.error('Retry failed:', err);
      setError(err instanceof Error ? err.message : 'Retry failed');
      setIsConnected(false);
      setIsConnecting(false);
    }
  }, [connect, loadFolders]);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const hash = window.location.hash;
    const accessTokenMatch = hash.match(/access_token=([^&]+)/);
    const accessToken = accessTokenMatch ? accessTokenMatch[1] : null;

    if (code) {
      handleAuthCallback(code);
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (accessToken) {
      dropboxService.setAccessToken(accessToken);
      localStorage.setItem('dropbox_access_token', accessToken);
      setIsConnected(true);
      setIsConnecting(false);
      loadFolders();
      window.history.replaceState({}, document.title, window.location.pathname);
    } else {
      checkConnection();
    }
  }, [handleAuthCallback, checkConnection, loadFolders]);

  return {
    isConnected,
    isConnecting,
    folders,
    allFolders,
    syncedFolders,
    currentPath,
    managementFolders,
    managementPath,
    error,
    connect,
    refreshFolders,
    navigateToFolder,
    navigateBack,
    loadManagementFolders,
    navigateToManagementFolder,
    navigateManagementBack,
    toggleFolderSync,
    getTracksFromFolder,
    searchTracks,
    disconnect,
    retry,
    updateFolderDisplayName,
    clearError: () => setError(null)
  };
};