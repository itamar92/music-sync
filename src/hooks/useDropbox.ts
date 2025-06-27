import { useState, useEffect, useCallback } from 'react';
import { Folder, Track } from '../types';
import { dropboxService } from '../services/dropboxService';

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

  const checkConnection = useCallback(async () => {
    try {
      setIsConnecting(true);
      const connected = dropboxService.isAuthenticated();
      
      if (connected) {
        setIsConnected(true);
        await loadFolders();
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
  }, []);

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
  }, []);

  // Helper function to load all synced folders (including nested ones)
  const loadAllSyncedFolders = useCallback(async (syncedIds: string[]) => {
    const syncedFolders: Folder[] = [];
    
    // Load each synced folder's details
    for (const folderId of syncedIds) {
      try {
        // Try to find the folder in allFolders first (for root folders)
        const rootFolder = allFolders.find(f => f.id === folderId);
        if (rootFolder) {
          syncedFolders.push(rootFolder);
        } else {
          // For nested folders, we need to get the folder info from the path
          const folderInfo = await dropboxService.getFolderInfo(folderId);
          if (folderInfo) {
            syncedFolders.push(folderInfo);
          }
        }
      } catch (error) {
        console.warn(`Failed to load synced folder ${folderId}:`, error);
      }
    }
    
    setFolders(syncedFolders);
  }, [allFolders]);

  const loadFolders = useCallback(async (path: string = '') => {
    try {
      const folderList = await dropboxService.listFolders(path);
      
      if (path === '') {
        // Root level - update all folders and synced folders
        setAllFolders(folderList);
        
        // Load synced folders from localStorage
        const saved = localStorage.getItem('synced_folders');
        const syncedIds = saved ? JSON.parse(saved) : [];
        setSyncedFolders(syncedIds);
        
        // For root level, show all synced folders (including nested ones)
        await loadAllSyncedFolders(syncedIds);
      } else {
        // Subfolder - show all folders (no filtering by sync status)
        setFolders(folderList);
      }
      
      setCurrentPath(path);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load folders');
    }
  }, [loadAllSyncedFolders]);

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

  // Management folder navigation functions
  const loadManagementFolders = useCallback(async (path: string = '') => {
    try {
      const folderList = await dropboxService.listFolders(path);
      
      // Update synced status based on current synced folders
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

  const toggleFolderSync = useCallback((folderId: string) => {
    setSyncedFolders(prev => {
      const newSynced = prev.includes(folderId)
        ? prev.filter(id => id !== folderId)
        : [...prev, folderId];
      
      localStorage.setItem('synced_folders', JSON.stringify(newSynced));
      
      // Update allFolders to reflect sync status
      setAllFolders(prevAll => 
        prevAll.map(folder => 
          folder.id === folderId 
            ? { ...folder, synced: !folder.synced }
            : folder
        )
      );
      
      // Update management folders to reflect sync status
      setManagementFolders(prevManagement =>
        prevManagement.map(folder =>
          folder.id === folderId
            ? { ...folder, synced: !folder.synced }
            : folder
        )
      );
      
      // Refresh the synced folders display if we're at root level
      if (currentPath === '') {
        loadAllSyncedFolders(newSynced);
      }
      
      return newSynced;
    });
  }, [allFolders, currentPath, loadAllSyncedFolders]);

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
    localStorage.removeItem('synced_folders');
  }, []);

  // Handle auth callback from URL and initial connection check
  useEffect(() => {
    // Check for authorization code (standard flow)
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    
    // Check for access token in hash (implicit flow)
    const hash = window.location.hash;
    const accessTokenMatch = hash.match(/access_token=([^&]+)/);
    const accessToken = accessTokenMatch ? accessTokenMatch[1] : null;
    
    if (code) {
      console.log('Found auth code in URL, processing callback...');
      handleAuthCallback(code);
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (accessToken) {
      console.log('Found access token in URL hash, using directly...');
      // Store the token directly
      dropboxService.setAccessToken(accessToken);
      localStorage.setItem('dropbox_access_token', accessToken);
      setIsConnected(true);
      setIsConnecting(false);
      loadFolders();
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
    } else {
      console.log('No auth code or token in URL, checking existing connection...');
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
    clearError: () => setError(null)
  };
};