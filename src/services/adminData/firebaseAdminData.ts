import {
  collection,
  deleteDoc,
  doc,
  DocumentData,
  getDocs,
  query,
  QuerySnapshot,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { Track } from '../../types';
import { CollectionRecord, PlaylistRecord, FolderRecord } from '../../components/admin/types';
import { auth, db } from '../firebase';
import { dropboxService } from '../dropboxService';
import { cachedTrackService } from '../cachedTrackService';
import {
  AdminDataService,
  AdminCapabilities,
  AdminStats,
  CollectionInput,
  DropboxEntry,
  FolderFile,
  FolderInput,
  FolderStats,
  PlaylistInput,
} from './types';

/**
 * Firebase mode: Firestore documents scoped to the signed-in admin, with
 * Dropbox reached directly from the browser using the user's own OAuth token.
 *
 * The queries here are lifted from the admin components they used to live in,
 * including the legacy shapes — a collection may list its members inline via
 * `playlistIds`, or playlists may point back with `collectionId`.
 */

const uid = (): string => {
  const user = auth?.currentUser;
  if (!user) throw new Error('You must be signed in to manage the library');
  return user.uid;
};

const owned = (name: string) =>
  getDocs(query(collection(db, name), where('userId', '==', uid())));

const rowsOf = <T,>(snapshot: QuerySnapshot<DocumentData>): T[] =>
  snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as T);

/** Firestore ids can't hold slashes; a Dropbox path collapses into a slug. */
const folderIdFromPath = (path: string): string =>
  path
    .replace(/^\/+|\/+$/g, '')
    .replace(/[/\s]+/g, '_')
    .replace(/[^a-zA-Z0-9_-]/g, '')
    .toLowerCase();

class FirebaseAdminData implements AdminDataService {
  readonly capabilities: AdminCapabilities = {
    clientDropboxAuth: true,
    grantSelfAdmin: true,
    publicDataMigration: true,
    recursiveFolderSync: false,
  };

  async stats(): Promise<AdminStats> {
    const [collections, playlists, folders] = await Promise.all([
      owned('collections'),
      owned('playlists'),
      owned('folderSyncs'),
    ]);

    return {
      collections: collections.size,
      playlists: playlists.size,
      folders: folders.size,
      tracks: playlists.docs.reduce((sum, d) => sum + (d.data().trackCount || 0), 0),
    };
  }

  // --- collections -----------------------------------------------------------

  async listCollections(): Promise<CollectionRecord[]> {
    const rows = rowsOf<CollectionRecord>(await owned('collections'));

    return Promise.all(
      rows.map(async (row) => {
        try {
          // Legacy collections carry membership inline; newer playlists point back.
          if (row.playlistIds?.length) {
            return { ...row, totalPlaylists: row.playlistIds.length };
          }
          const playlists = await getDocs(
            query(
              collection(db, 'playlists'),
              where('collectionId', '==', row.id),
              where('userId', '==', uid()),
            ),
          );
          return { ...row, totalPlaylists: playlists.size };
        } catch (error) {
          console.error(`Error counting playlists for collection ${row.id}:`, error);
          return { ...row, totalPlaylists: 0 };
        }
      }),
    );
  }

  async createCollection(input: CollectionInput): Promise<CollectionRecord> {
    // The slugged name doubles as the document id so public URLs stay readable.
    const id = input.name.toLowerCase().replace(/[^a-z0-9]/g, '_');
    const record: CollectionRecord = {
      id,
      name: input.name.trim(),
      displayName: input.displayName?.trim() || input.name.trim(),
      description: input.description?.trim() || '',
      coverImageUrl: input.coverImageUrl?.trim() || '',
      userId: uid(),
      createdAt: new Date(),
      updatedAt: new Date(),
      isPublic: input.isPublic ?? true,
      totalPlaylists: input.playlistIds?.length || 0,
      playlistIds: input.playlistIds || [],
      folderIds: [],
    };

    await setDoc(doc(db, 'collections', id), record);
    return record;
  }

  async updateCollection(id: string, patch: Partial<CollectionRecord>): Promise<CollectionRecord> {
    const updated = { ...patch, updatedAt: new Date() };
    await updateDoc(doc(db, 'collections', id), updated);
    return { id, ...updated } as CollectionRecord;
  }

  async deleteCollection(id: string): Promise<void> {
    await deleteDoc(doc(db, 'collections', id));
  }

  async listCollectionPlaylists(collectionId: string): Promise<PlaylistRecord[]> {
    const snapshot = await getDocs(
      query(
        collection(db, 'playlists'),
        where('collectionId', '==', collectionId),
        where('userId', '==', uid()),
      ),
    );
    return rowsOf<PlaylistRecord>(snapshot);
  }

  // --- playlists -------------------------------------------------------------

  async listPlaylists(): Promise<PlaylistRecord[]> {
    const rows = rowsOf<PlaylistRecord>(await owned('playlists'));

    // Counts come from Dropbox, so they're only available while connected.
    return Promise.all(
      rows.map(async (row) => ({ ...row, trackCount: await this.countTracks(row) })),
    );
  }

  private async countTracks(playlist: PlaylistRecord): Promise<number> {
    if (!playlist.folderIds?.length || !dropboxService.isAuthenticated()) return 0;

    try {
      const perFolder = await Promise.all(
        playlist.folderIds.map(async (folderId) => {
          try {
            const snapshot = await getDocs(
              query(collection(db, 'folderSyncs'), where('__name__', '==', folderId)),
            );
            if (snapshot.empty) return 0;
            const tracks = await dropboxService.getTracksFromFolder(
              snapshot.docs[0].data().dropboxPath,
            );
            return tracks.length;
          } catch (error) {
            console.error(`Error counting tracks for folder ${folderId}:`, error);
            return 0;
          }
        }),
      );

      const total = perFolder.reduce((sum, count) => sum + count, 0);
      return Math.max(0, total - (playlist.excludedTracks?.length || 0));
    } catch (error) {
      console.error('Error calculating track count:', error);
      return 0;
    }
  }

  async createPlaylist(input: PlaylistInput): Promise<PlaylistRecord> {
    // Timestamp suffix: two playlists may legitimately share a name.
    const id = `${input.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${Date.now()}`;
    const record: PlaylistRecord = {
      id,
      name: input.name.trim(),
      displayName: input.displayName?.trim() || input.name.trim(),
      description: input.description?.trim() || '',
      coverImageUrl: input.coverImageUrl?.trim() || '',
      collectionId: input.collectionId || null,
      folderIds: input.folderIds || [],
      userId: uid(),
      createdAt: new Date(),
      updatedAt: new Date(),
      isPublic: input.isPublic ?? true,
      totalTracks: 0,
      totalDuration: '0:00',
    };

    await setDoc(doc(db, 'playlists', id), record);
    return record;
  }

  async updatePlaylist(id: string, patch: Partial<PlaylistRecord>): Promise<PlaylistRecord> {
    const updated = { ...patch, updatedAt: new Date() };
    await updateDoc(doc(db, 'playlists', id), updated);
    return { id, ...updated } as PlaylistRecord;
  }

  async deletePlaylist(id: string): Promise<void> {
    await deleteDoc(doc(db, 'playlists', id));
  }

  // --- tracks ----------------------------------------------------------------

  /**
   * Tracks live in Dropbox, not Firestore. The playlist document only holds the
   * curation layered on top: which folders to read, a hand-set order, renames,
   * and exclusions. This resolves the folders and then applies that layer.
   */
  async listPlaylistTracks(playlistId: string): Promise<Track[]> {
    const snapshot = await getDocs(
      query(collection(db, 'playlists'), where('__name__', '==', playlistId)),
    );
    if (snapshot.empty) return [];

    const playlist = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as PlaylistRecord;
    if (!playlist.folderIds?.length) return [];

    const perFolder = await Promise.all(
      playlist.folderIds.map(async (folderId) => {
        try {
          const folder = await getDocs(
            query(collection(db, 'folderSyncs'), where('__name__', '==', folderId)),
          );
          if (folder.empty) return [];
          return await cachedTrackService.getTracksFromFolder(
            auth?.currentUser?.uid || null,
            folderId,
            folder.docs[0].data().dropboxPath,
          );
        } catch (error) {
          console.error(`Error loading tracks from folder ${folderId}:`, error);
          return [];
        }
      }),
    );

    let tracks = perFolder.flat();

    if (playlist.trackOrder?.length) {
      const remaining = new Map(tracks.map((t) => [t.id, t]));
      const ordered: Track[] = [];
      for (const id of playlist.trackOrder) {
        const track = remaining.get(id);
        if (track) {
          ordered.push(track);
          remaining.delete(id);
        }
      }
      tracks = [...ordered, ...remaining.values()];
    }

    if (playlist.trackNames) {
      const names = playlist.trackNames;
      tracks = tracks.map((track) => ({ ...track, name: names[track.id] || track.name }));
    }

    if (playlist.excludedTracks?.length) {
      const excluded = new Set(playlist.excludedTracks);
      tracks = tracks.filter((track) => !excluded.has(track.id));
    }

    return tracks;
  }

  private async readPlaylist(id: string): Promise<PlaylistRecord | null> {
    const snapshot = await getDocs(query(collection(db, 'playlists'), where('__name__', '==', id)));
    if (snapshot.empty) return null;
    return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as PlaylistRecord;
  }

  async renameTrack(playlistId: string, trackId: string, name: string): Promise<void> {
    const playlist = await this.readPlaylist(playlistId);
    await updateDoc(doc(db, 'playlists', playlistId), {
      trackNames: { ...(playlist?.trackNames || {}), [trackId]: name },
      updatedAt: new Date(),
    });
  }

  async setTrackOrder(playlistId: string, trackIds: string[]): Promise<void> {
    await updateDoc(doc(db, 'playlists', playlistId), {
      trackOrder: trackIds,
      updatedAt: new Date(),
    });
  }

  async removeTrack(playlistId: string, trackId: string): Promise<void> {
    const playlist = await this.readPlaylist(playlistId);
    await updateDoc(doc(db, 'playlists', playlistId), {
      excludedTracks: [...(playlist?.excludedTracks || []), trackId],
      updatedAt: new Date(),
    });
  }

  // --- folders ---------------------------------------------------------------

  async listFolders(): Promise<FolderRecord[]> {
    return rowsOf<FolderRecord>(await owned('folderSyncs'));
  }

  async addFolder(input: FolderInput): Promise<FolderRecord> {
    const id = folderIdFromPath(input.dropboxPath);
    const name = input.name || input.dropboxPath.split('/').filter(Boolean).pop() || 'Folder';

    const record: FolderRecord = {
      id,
      name,
      displayName: input.displayName || name,
      dropboxPath: input.dropboxPath,
      syncFrequency: input.syncFrequency || 'manual',
      userId: uid(),
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSyncAt: null,
      status: 'pending',
      totalFiles: 0,
      syncedFiles: 0,
      isActive: input.isActive ?? true,
    };

    await setDoc(doc(db, 'folderSyncs', id), record);
    return record;
  }

  async updateFolder(id: string, patch: Partial<FolderRecord>): Promise<FolderRecord> {
    const updated = { ...patch, updatedAt: new Date() };
    await updateDoc(doc(db, 'folderSyncs', id), updated);
    return { id, ...updated } as FolderRecord;
  }

  async removeFolder(id: string): Promise<void> {
    await deleteDoc(doc(db, 'folderSyncs', id));
  }

  /**
   * Firebase mode has no server-side sync job — tracks are read from Dropbox on
   * demand. "Syncing" therefore means refreshing the cached listing and
   * recording the result on the folder document.
   */
  async syncFolder(id: string): Promise<{ trackCount: number }> {
    const snapshot = await getDocs(
      query(collection(db, 'folderSyncs'), where('__name__', '==', id)),
    );
    if (snapshot.empty) throw new Error('Folder not found');

    const folderRef = doc(db, 'folderSyncs', id);
    await updateDoc(folderRef, { status: 'syncing', updatedAt: new Date() });

    try {
      const tracks = await cachedTrackService.refreshFolderCache(
        uid(),
        id,
        snapshot.docs[0].data().dropboxPath,
      );
      await updateDoc(folderRef, {
        status: 'synced',
        lastSyncAt: new Date(),
        totalFiles: tracks.length,
        syncedFiles: tracks.length,
        updatedAt: new Date(),
      });
      return { trackCount: tracks.length };
    } catch (error) {
      await updateDoc(folderRef, { status: 'error', updatedAt: new Date() }).catch(() => {});
      throw error;
    }
  }

  async listFolderFiles(id: string): Promise<FolderFile[]> {
    const snapshot = await getDocs(
      query(collection(db, 'folderSyncs'), where('__name__', '==', id)),
    );
    if (snapshot.empty) return [];

    if (!dropboxService.isAuthenticated()) {
      throw new Error('Connect to Dropbox to browse this folder');
    }

    const tracks = await dropboxService.getTracksFromFolder(snapshot.docs[0].data().dropboxPath);
    return tracks.map((track) => ({
      id: track.id,
      name: track.name,
      path: track.path || '',
      duration: track.duration,
    }));
  }

  // --- dropbox ---------------------------------------------------------------

  async browseDropbox(path: string): Promise<DropboxEntry[]> {
    const folders = await dropboxService.listFolders(path);
    return folders.map((folder) => ({ id: folder.id, name: folder.name, path: folder.path }));
  }

  folderStats(path: string): Promise<FolderStats> {
    return dropboxService.getFolderDetails(path);
  }

  /** Direct children only — the client-side Dropbox listing isn't recursive. */
  async previewFolderFiles(path: string): Promise<FolderFile[]> {
    const tracks = await dropboxService.getTracksFromFolder(path);
    return tracks.map((track) => ({
      id: track.id,
      name: track.name,
      path: track.path || '',
      duration: track.duration,
    }));
  }
}

export const firebaseAdminData = new FirebaseAdminData();
