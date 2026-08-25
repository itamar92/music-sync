// Admin client for the container backend (server/). Only used when
// VITE_DATA_MODE=server. Auth is a backend-issued JWT kept in localStorage.
import { PlaylistSyncResult, Track } from '../types';
import { CollectionRecord, PlaylistRecord } from '../components/admin/types';

const TOKEN_KEY = 'musicsync_admin_token';

export interface DropboxFolderEntry {
  id: string;
  name: string;
  path: string;
}

/** A share link for one collection. `revokedAt` set means it is dead. */
export interface CollectionShare {
  id: string;
  token: string;
  createdAt: string;
  revokedAt: string | null;
}

/** A watched Dropbox folder, as the backend reports it. */
export interface FolderSyncEntry {
  id: string;
  dropboxPath: string;
  name: string;
  displayName: string;
  syncFrequency: string;
  isActive: boolean;
  includeSubfolders: boolean;
  status: 'pending' | 'syncing' | 'synced' | 'error';
  lastSyncAt?: string | null;
  lastError?: string;
  totalFiles: number;
  syncedFiles: number;
  playlistIds?: string[];
}

class AdminApiService {
  private baseUrl = import.meta.env.VITE_API_BASE_URL || '/api';

  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }

  isLoggedIn(): boolean {
    const token = this.getToken();
    if (!token) return false;
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return typeof payload.exp !== 'number' || payload.exp * 1000 > Date.now();
    } catch {
      return false;
    }
  }

  async login(email: string, password: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.token) {
      throw new Error(data.error || 'Login failed');
    }
    localStorage.setItem(TOKEN_KEY, data.token);
  }

  logout(): void {
    localStorage.removeItem(TOKEN_KEY);
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const response = await fetch(`${this.baseUrl}/admin${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.getToken() || ''}`,
        ...options.headers,
      },
    });

    if (response.status === 401) {
      this.logout();
      throw new Error('Session expired — please log in again');
    }
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error || `Request failed (${response.status})`);
    }
    return data as T;
  }

  // Collections
  listCollections(): Promise<CollectionRecord[]> {
    return this.request('/collections');
  }

  createCollection(
    input: Partial<CollectionRecord> & { name: string; playlistIds?: string[] },
  ): Promise<CollectionRecord> {
    return this.request('/collections', { method: 'POST', body: JSON.stringify(input) });
  }

  updateCollection(id: string, patch: Partial<CollectionRecord>): Promise<CollectionRecord> {
    return this.request(`/collections/${id}`, { method: 'PATCH', body: JSON.stringify(patch) });
  }

  deleteCollection(id: string): Promise<void> {
    return this.request(`/collections/${id}`, { method: 'DELETE' });
  }

  // Collection share links. "Regenerate" is revokeShare + createCollectionShare;
  // there is no dedicated endpoint, so the old token dies the moment it's replaced.
  listCollectionShares(collectionId: string): Promise<CollectionShare[]> {
    return this.request(`/collections/${collectionId}/shares`);
  }

  createCollectionShare(collectionId: string): Promise<CollectionShare> {
    return this.request(`/collections/${collectionId}/shares`, { method: 'POST' });
  }

  revokeShare(shareId: string): Promise<CollectionShare> {
    return this.request(`/shares/${shareId}`, { method: 'DELETE' });
  }

  // Playlists
  listPlaylists(): Promise<PlaylistRecord[]> {
    return this.request('/playlists');
  }

  updatePlaylist(id: string, patch: Partial<PlaylistRecord>): Promise<PlaylistRecord> {
    return this.request(`/playlists/${id}`, { method: 'PATCH', body: JSON.stringify(patch) });
  }

  deletePlaylist(id: string): Promise<void> {
    return this.request(`/playlists/${id}`, { method: 'DELETE' });
  }

  createPlaylist(
    input: Partial<PlaylistRecord> & {
      name: string;
      folderIds?: string[];
      tracks?: Array<{ path: string; name: string }>;
    },
  ): Promise<PlaylistRecord> {
    return this.request('/playlists', { method: 'POST', body: JSON.stringify(input) });
  }

  /**
   * Re-pull every Dropbox folder behind a playlist. Ignores the cooldown the
   * public route applies — an admin pressing sync means it.
   */
  syncPlaylist(playlistId: string): Promise<PlaylistSyncResult> {
    return this.request(`/playlists/${playlistId}/sync`, { method: 'POST' });
  }

  /** Append hand-picked Dropbox files to a playlist as folder-less tracks. */
  addPlaylistTracks(
    playlistId: string,
    files: Array<{ path: string; name: string }>,
  ): Promise<PlaylistRecord> {
    return this.request(`/playlists/${playlistId}/tracks`, {
      method: 'POST',
      body: JSON.stringify({ files }),
    });
  }

  // Tracks
  listPlaylistTracks(playlistId: string): Promise<Track[]> {
    return this.request(`/playlists/${playlistId}/tracks`);
  }

  updateTrack(
    trackId: string,
    patch: {
      displayName?: string;
      displayArtist?: string;
      isExcluded?: boolean;
      durationSeconds?: number;
    },
  ): Promise<Track> {
    return this.request(`/tracks/${trackId}`, { method: 'PATCH', body: JSON.stringify(patch) });
  }

  setTrackOrder(playlistId: string, trackIds: string[]): Promise<{ success: boolean }> {
    return this.request(`/playlists/${playlistId}/track-order`, {
      method: 'PUT',
      body: JSON.stringify({ trackIds }),
    });
  }

  removeTrack(playlistId: string, trackId: string): Promise<{ success: boolean }> {
    return this.request(`/playlists/${playlistId}/tracks/${trackId}`, { method: 'DELETE' });
  }

  // Studio preview links. Separate from the public stream endpoints because
  // those only serve published playlists — see studioDataService for why the
  // studio needs its own pair.
  getStreamUrl(filePath: string, fresh = false): Promise<{ streamUrl: string }> {
    return this.request('/stream', {
      method: 'POST',
      body: JSON.stringify({ filePath, ...(fresh ? { fresh: true } : {}) }),
    });
  }

  getStreamUrls(filePaths: string[]): Promise<{ urls: Record<string, string | null> }> {
    return this.request('/streams', { method: 'POST', body: JSON.stringify({ filePaths }) });
  }

  // Watched folders
  listFolders(): Promise<FolderSyncEntry[]> {
    return this.request('/folders');
  }

  addFolder(input: {
    dropboxPath: string;
    name?: string;
    displayName?: string;
    syncFrequency?: string;
    isActive?: boolean;
    includeSubfolders?: boolean;
  }): Promise<FolderSyncEntry> {
    return this.request('/folders', { method: 'POST', body: JSON.stringify(input) });
  }

  updateFolder(id: string, patch: Partial<FolderSyncEntry>): Promise<FolderSyncEntry> {
    return this.request(`/folders/${id}`, { method: 'PATCH', body: JSON.stringify(patch) });
  }

  deleteFolder(id: string): Promise<void> {
    return this.request(`/folders/${id}`, { method: 'DELETE' });
  }

  syncFolderById(id: string): Promise<{ success: boolean; trackCount: number }> {
    return this.request(`/folders/${id}/sync`, { method: 'POST' });
  }

  listFolderFiles(id: string): Promise<Array<{ id: string; name: string; path: string }>> {
    return this.request(`/folders/${id}/files`);
  }

  // Stats
  stats(): Promise<{
    collections: number;
    playlists: number;
    folders: number;
    tracks: number;
    publicPlaylists: number;
  }> {
    return this.request('/stats');
  }

  // Dropbox
  listDropboxFolders(path = ''): Promise<DropboxFolderEntry[]> {
    return this.request(`/dropbox/folders?path=${encodeURIComponent(path)}`);
  }

  dropboxFolderStats(
    path: string,
    recursive = false,
  ): Promise<{ trackCount: number; hasSubfolders: boolean }> {
    return this.request(
      `/dropbox/folder-stats?path=${encodeURIComponent(path)}&recursive=${recursive}`,
    );
  }

  /** Audio files in a Dropbox path before it becomes a watched folder. */
  dropboxFolderFiles(
    path: string,
    recursive = false,
  ): Promise<Array<{ id: string; name: string; path: string }>> {
    return this.request(
      `/dropbox/folder-files?path=${encodeURIComponent(path)}&recursive=${recursive}`,
    );
  }

  syncFolder(input: {
    folderPath: string;
    collectionId?: string;
    displayName?: string;
    isPublic?: boolean;
  }): Promise<{ success: boolean; playlistId: string; folderId: string; trackCount: number }> {
    return this.request('/sync-folder', { method: 'POST', body: JSON.stringify(input) });
  }
}

export const adminApi = new AdminApiService();
