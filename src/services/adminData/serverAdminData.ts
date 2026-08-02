import { Track } from '../../types';
import { CollectionRecord, PlaylistRecord, FolderRecord } from '../../components/admin/types';
import { adminApi } from '../adminApiService';
import {
  AdminDataService,
  AdminCapabilities,
  AdminStats,
  CollectionInput,
  DropboxEntry,
  FolderFile,
  FolderInput,
  FolderStats,
  PickedFile,
  PlaylistInput,
} from './types';

/**
 * Container mode: everything goes through the JWT-authenticated REST API.
 *
 * The browser never holds a Dropbox credential here — the backend owns a
 * refresh token — so Dropbox browsing is a server call and there is no connect
 * flow to expose.
 */
class ServerAdminData implements AdminDataService {
  readonly capabilities: AdminCapabilities = {
    clientDropboxAuth: false,
    grantSelfAdmin: false,
    publicDataMigration: false,
    recursiveFolderSync: true,
    trackPicking: true,
  };

  async stats(): Promise<AdminStats> {
    const stats = await adminApi.stats();
    return {
      collections: stats.collections,
      playlists: stats.playlists,
      folders: stats.folders,
      tracks: stats.tracks,
    };
  }

  // --- collections -----------------------------------------------------------

  async listCollections(): Promise<CollectionRecord[]> {
    return adminApi.listCollections();
  }

  async createCollection(input: CollectionInput): Promise<CollectionRecord> {
    return adminApi.createCollection(input);
  }

  async updateCollection(id: string, patch: Partial<CollectionRecord>): Promise<CollectionRecord> {
    return adminApi.updateCollection(id, patch);
  }

  async deleteCollection(id: string): Promise<void> {
    await adminApi.deleteCollection(id);
  }

  async listCollectionPlaylists(collectionId: string): Promise<PlaylistRecord[]> {
    const all = await this.listPlaylists();
    return all.filter((playlist) => playlist.collectionId === collectionId);
  }

  // --- playlists -------------------------------------------------------------

  /** The REST API reports `totalTracks`; the admin UI reads `trackCount`. */
  private withTrackCount(playlist: PlaylistRecord): PlaylistRecord {
    return { ...playlist, trackCount: playlist.trackCount ?? playlist.totalTracks ?? 0 };
  }

  async listPlaylists(): Promise<PlaylistRecord[]> {
    const playlists = await adminApi.listPlaylists();
    return playlists.map((playlist) => this.withTrackCount(playlist));
  }

  async createPlaylist(input: PlaylistInput): Promise<PlaylistRecord> {
    return this.withTrackCount(await adminApi.createPlaylist(input));
  }

  async updatePlaylist(id: string, patch: Partial<PlaylistRecord>): Promise<PlaylistRecord> {
    return this.withTrackCount(await adminApi.updatePlaylist(id, patch));
  }

  async deletePlaylist(id: string): Promise<void> {
    await adminApi.deletePlaylist(id);
  }

  // --- tracks ----------------------------------------------------------------

  listPlaylistTracks(playlistId: string): Promise<Track[]> {
    return adminApi.listPlaylistTracks(playlistId);
  }

  async renameTrack(_playlistId: string, trackId: string, name: string): Promise<void> {
    await adminApi.updateTrack(trackId, { displayName: name });
  }

  async setTrackOrder(playlistId: string, trackIds: string[]): Promise<void> {
    await adminApi.setTrackOrder(playlistId, trackIds);
  }

  async removeTrack(playlistId: string, trackId: string): Promise<void> {
    await adminApi.removeTrack(playlistId, trackId);
  }

  async addTracks(playlistId: string, files: PickedFile[]): Promise<PlaylistRecord> {
    return this.withTrackCount(await adminApi.addPlaylistTracks(playlistId, files));
  }

  // --- folders ---------------------------------------------------------------

  async listFolders(): Promise<FolderRecord[]> {
    const folders = await adminApi.listFolders();
    // The UI renders a Firestore-shaped timestamp; normalise the ISO string.
    return folders.map((folder) => ({
      ...folder,
      lastSyncAt: folder.lastSyncAt
        ? { seconds: Math.floor(new Date(folder.lastSyncAt).getTime() / 1000) }
        : null,
    }));
  }

  async addFolder(input: FolderInput): Promise<FolderRecord> {
    return { ...(await adminApi.addFolder(input)), lastSyncAt: null };
  }

  async updateFolder(id: string, patch: Partial<FolderRecord>): Promise<FolderRecord> {
    const folder = await adminApi.updateFolder(id, {
      displayName: patch.displayName,
      syncFrequency: patch.syncFrequency,
      isActive: patch.isActive,
      includeSubfolders: patch.includeSubfolders,
    });
    return { ...folder, lastSyncAt: null };
  }

  async removeFolder(id: string): Promise<void> {
    await adminApi.deleteFolder(id);
  }

  async syncFolder(id: string): Promise<{ trackCount: number }> {
    const result = await adminApi.syncFolderById(id);
    return { trackCount: result.trackCount };
  }

  async listFolderFiles(id: string): Promise<FolderFile[]> {
    const files = await adminApi.listFolderFiles(id);
    return files.map((file) => ({ id: file.id, name: file.name, path: file.path }));
  }

  // --- dropbox ---------------------------------------------------------------

  browseDropbox(path: string): Promise<DropboxEntry[]> {
    return adminApi.listDropboxFolders(path);
  }

  folderStats(path: string): Promise<FolderStats> {
    return adminApi.dropboxFolderStats(path);
  }

  previewFolderFiles(path: string, recursive = false): Promise<FolderFile[]> {
    return adminApi.dropboxFolderFiles(path, recursive);
  }
}

export const serverAdminData = new ServerAdminData();
