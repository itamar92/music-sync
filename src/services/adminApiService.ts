// Admin client for the container backend (server/). Only used when
// VITE_DATA_MODE=server. Auth is a backend-issued JWT kept in localStorage.
import { Collection, Playlist } from '../types';

const TOKEN_KEY = 'musicsync_admin_token';

export interface DropboxFolderEntry {
  id: string;
  name: string;
  path: string;
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
  listCollections(): Promise<Collection[]> {
    return this.request('/collections');
  }

  createCollection(input: Partial<Collection> & { name: string }): Promise<Collection> {
    return this.request('/collections', { method: 'POST', body: JSON.stringify(input) });
  }

  updateCollection(id: string, patch: Partial<Collection>): Promise<Collection> {
    return this.request(`/collections/${id}`, { method: 'PATCH', body: JSON.stringify(patch) });
  }

  deleteCollection(id: string): Promise<void> {
    return this.request(`/collections/${id}`, { method: 'DELETE' });
  }

  // Playlists
  listPlaylists(): Promise<Playlist[]> {
    return this.request('/playlists');
  }

  updatePlaylist(id: string, patch: Partial<Playlist>): Promise<Playlist> {
    return this.request(`/playlists/${id}`, { method: 'PATCH', body: JSON.stringify(patch) });
  }

  deletePlaylist(id: string): Promise<void> {
    return this.request(`/playlists/${id}`, { method: 'DELETE' });
  }

  // Dropbox
  listDropboxFolders(path = ''): Promise<DropboxFolderEntry[]> {
    return this.request(`/dropbox/folders?path=${encodeURIComponent(path)}`);
  }

  syncFolder(input: {
    folderPath: string;
    collectionId?: string;
    displayName?: string;
    isPublic?: boolean;
  }): Promise<{ success: boolean; playlistId: string; trackCount: number }> {
    return this.request('/sync-folder', { method: 'POST', body: JSON.stringify(input) });
  }
}

export const adminApi = new AdminApiService();
