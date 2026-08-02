import { Track } from '../../types';
import { CollectionRecord, PlaylistRecord, FolderRecord } from '../../components/admin/types';

/**
 * The admin's data contract.
 *
 * Firebase mode and container mode store the same library in very different
 * places — Firestore documents scoped to a user, versus Postgres behind a JWT
 * API. Everything above this interface is written once and works in both; only
 * the two implementations below it know which backend they're talking to.
 *
 * The rule: no admin component may import Firestore, adminApi or isServerMode.
 * If a screen needs something a backend can't do, it belongs in `capabilities`
 * rather than in a mode check.
 */

export interface AdminStats {
  collections: number;
  playlists: number;
  folders: number;
  tracks: number;
}

export interface DropboxEntry {
  id: string;
  name: string;
  path: string;
}

export interface FolderStats {
  trackCount: number;
  hasSubfolders: boolean;
}

export interface FolderFile {
  id: string;
  name: string;
  path: string;
  duration?: string;
}

/** One hand-picked Dropbox audio file headed into a playlist. */
export interface PickedFile {
  path: string;
  name: string;
}

/** What a given backend can actually offer, so the UI hides the rest. */
export interface AdminCapabilities {
  /**
   * Whether the browser performs Dropbox OAuth itself. False in container mode,
   * where the backend holds a refresh token and the browser never sees a
   * Dropbox credential — so no connect/reconnect affordance is shown.
   */
  clientDropboxAuth: boolean;
  /** Firestore-only: grant the signed-in account the admin role. */
  grantSelfAdmin: boolean;
  /** Firestore-only: backfill isPublic across legacy documents. */
  publicDataMigration: boolean;
  /**
   * Container-only: a watched folder can pull audio from its whole subtree.
   * Firebase mode reads folders directly from the browser and only sees
   * direct children, so the option is hidden there.
   */
  recursiveFolderSync: boolean;
  /**
   * Container-only: playlists can hold individual hand-picked Dropbox files
   * (no folder sync involved). Hides the Songs tab where unsupported.
   */
  trackPicking: boolean;
}

export interface CollectionInput {
  name: string;
  displayName?: string;
  description?: string;
  coverImageUrl?: string;
  /** Visible on the public site. Defaults to true when omitted. */
  isPublic?: boolean;
  playlistIds?: string[];
}

export interface PlaylistInput {
  name: string;
  displayName?: string;
  description?: string;
  coverImageUrl?: string;
  collectionId?: string | null;
  /** Visible on the public site. Defaults to true when omitted. */
  isPublic?: boolean;
  folderIds?: string[];
  /** Individual Dropbox files to seed the playlist with (see `trackPicking`). */
  tracks?: PickedFile[];
}

export interface FolderInput {
  dropboxPath: string;
  name?: string;
  displayName?: string;
  syncFrequency?: string;
  isActive?: boolean;
  /** Pull audio from the whole subtree, not just direct children. */
  includeSubfolders?: boolean;
}

export interface AdminDataService {
  readonly capabilities: AdminCapabilities;

  stats(): Promise<AdminStats>;

  listCollections(): Promise<CollectionRecord[]>;
  createCollection(input: CollectionInput): Promise<CollectionRecord>;
  updateCollection(id: string, patch: Partial<CollectionRecord>): Promise<CollectionRecord>;
  deleteCollection(id: string): Promise<void>;
  listCollectionPlaylists(collectionId: string): Promise<PlaylistRecord[]>;

  listPlaylists(): Promise<PlaylistRecord[]>;
  createPlaylist(input: PlaylistInput): Promise<PlaylistRecord>;
  updatePlaylist(id: string, patch: Partial<PlaylistRecord>): Promise<PlaylistRecord>;
  deletePlaylist(id: string): Promise<void>;

  listPlaylistTracks(playlistId: string): Promise<Track[]>;
  /** Rename a single track within a playlist. */
  renameTrack(playlistId: string, trackId: string, name: string): Promise<void>;
  /** Persist a hand-picked order. `trackIds` is the full list, in order. */
  setTrackOrder(playlistId: string, trackIds: string[]): Promise<void>;
  /** Hide a track from the playlist without deleting the file. */
  removeTrack(playlistId: string, trackId: string): Promise<void>;
  /**
   * Append hand-picked Dropbox files to a playlist (see `trackPicking`).
   * Returns the playlist with refreshed totals.
   */
  addTracks(playlistId: string, files: PickedFile[]): Promise<PlaylistRecord>;

  listFolders(): Promise<FolderRecord[]>;
  addFolder(input: FolderInput): Promise<FolderRecord>;
  updateFolder(id: string, patch: Partial<FolderRecord>): Promise<FolderRecord>;
  removeFolder(id: string): Promise<void>;
  syncFolder(id: string): Promise<{ trackCount: number }>;
  listFolderFiles(id: string): Promise<FolderFile[]>;

  /** Subfolders of a Dropbox path, for the folder picker. */
  browseDropbox(path: string): Promise<DropboxEntry[]>;
  /** Track count and subfolder presence for one path, fetched per row. */
  folderStats(path: string): Promise<FolderStats>;
  /**
   * Audio files in a Dropbox path that isn't a watched folder yet, so the
   * picker can preview what syncing it would bring in. `recursive` includes
   * the subtree where the backend supports it (see `recursiveFolderSync`).
   */
  previewFolderFiles(path: string, recursive?: boolean): Promise<FolderFile[]>;
}
