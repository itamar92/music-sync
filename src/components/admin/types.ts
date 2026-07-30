/**
 * Record shapes shared between the admin panels, their dialogs and the two
 * data-service implementations.
 *
 * These are supersets of the public `Collection` / `Playlist` types: the studio
 * sees ownership and curation fields that visitors never do, and the two
 * backends spell a few of them differently (a Firestore `Timestamp` versus an
 * ISO string). Everything the UI doesn't require is optional, so a record from
 * either backend satisfies the same interface.
 */

/** Firestore hands back a Timestamp, Postgres an ISO string, forms a Date. */
export type RecordTimestamp = Date | string | { seconds: number } | null;

interface OwnedRecord {
  userId?: string;
  createdAt?: RecordTimestamp;
  updatedAt?: RecordTimestamp;
}

export interface CollectionRecord extends OwnedRecord {
  id: string;
  name: string;
  displayName?: string;
  description?: string;
  coverImageUrl?: string;
  isPublic?: boolean;
  sortOrder?: number;
  /** Legacy shape: membership stored on the collection rather than the playlist. */
  playlistIds?: string[];
  folderIds?: string[];
  totalPlaylists?: number;
}

export interface PlaylistRecord extends OwnedRecord {
  id: string;
  name: string;
  displayName?: string;
  description?: string;
  coverImageUrl?: string;
  artist?: string;
  collectionId?: string | null;
  /** Dropbox folders this playlist draws its tracks from. */
  folderIds?: string[];
  folderPath?: string;
  type?: string;
  isPublic?: boolean;
  sortOrder?: number;
  /** Curation layered over the folder contents. */
  excludedTracks?: string[];
  trackOrder?: string[];
  trackNames?: Record<string, string>;
  trackCount?: number;
  totalTracks?: number;
  totalDuration?: string;
  /**
   * Set when the record saved but a folder's contents couldn't be pulled — a
   * Dropbox outage shouldn't fail the write, but it shouldn't pass silently
   * either.
   */
  warning?: string;
}

export interface FolderRecord extends OwnedRecord {
  id: string;
  name: string;
  displayName?: string;
  dropboxPath: string;
  status?: 'synced' | 'syncing' | 'error' | 'pending' | string;
  syncFrequency?: string;
  isActive?: boolean;
  /** Pull audio from the whole subtree, not just direct children. */
  includeSubfolders?: boolean;
  syncedFiles?: number;
  totalFiles?: number;
  lastSyncAt?: RecordTimestamp;
  lastError?: string;
  /** Playlists drawing on this folder, when the backend reports them. */
  playlistIds?: string[];
}

/** A row in a picker list — enough to label it, no more. */
export interface PickerOption {
  id: string;
  name: string;
  displayName?: string;
  dropboxPath?: string;
  trackCount?: number;
}
