import { useCallback, useEffect, useState } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../services/firebase';
import { cachedTrackService } from '../services/cachedTrackService';
import { publicReader } from '../services/publicReader';
import { publicDataService } from '../services/publicDataService';
import { shareDataService } from '../services/shareDataService';
import { adminApi } from '../services/adminApiService';
import { isServerMode } from '../services/dataMode';
import { useOptionalUser } from './useOptionalUser';
import { Track } from '../types';

/**
 * Loads the tracks behind a playlist.
 *
 * Lifted verbatim out of the playlist view so the public shell, the mobile
 * shell and the admin editor all resolve tracks the same way. Both data modes
 * are preserved: container mode asks the backend for an already-assembled list,
 * Firebase mode fans out over the playlist's synced folders and then applies
 * the playlist's saved order, renames and exclusions on top.
 */

interface PlaylistLike {
  id: string;
  folderIds?: string[];
  trackOrder?: string[];
  trackNames?: Record<string, string>;
  excludedTracks?: string[];
}

/**
 * Trigger a Dropbox re-pull for one playlist: admin, share or public route.
 *
 * A share link syncs through its own token-scoped endpoint — someone handed a
 * new mix shouldn't have to wait for the owner to press sync to hear it.
 *
 * Returns a message to show when the sync itself failed, rather than throwing:
 * the reload has to happen either way, because a stale-but-present list beats
 * wiping the view over a Dropbox hiccup.
 */
const syncPlaylistFolders = async (
  playlistId: string,
  asAdmin: boolean
): Promise<string | null> => {
  try {
    if (asAdmin) await adminApi.syncPlaylist(playlistId);
    else if (shareDataService.isActive()) await shareDataService.syncPlaylist(playlistId);
    else await publicDataService.syncPlaylist(playlistId);
    return null;
  } catch (error) {
    console.error('Playlist sync failed:', error);
    return error instanceof Error ? error.message : 'Could not sync from Dropbox.';
  }
};

/** Applies a playlist's saved ordering to a flat track list, newcomers last. */
const applyOrder = (tracks: Track[], order?: string[]): Track[] => {
  if (!order?.length) return tracks;

  const remaining = new Map(tracks.map((track) => [track.id, track]));
  const ordered: Track[] = [];

  for (const id of order) {
    const track = remaining.get(id);
    if (track) {
      ordered.push(track);
      remaining.delete(id);
    }
  }

  return [...ordered, ...remaining.values()];
};

interface UsePlaylistTracksResult {
  tracks: Track[];
  loading: boolean;
  error: string | null;
  /** Re-reads from the source; pass true to re-pull from Dropbox first. */
  reload: (refreshCache?: boolean) => Promise<void>;
  setTracks: React.Dispatch<React.SetStateAction<Track[]>>;
  /**
   * Whether this view may rearrange the playlist, so it knows whether to render
   * drag handles. True only inside a share link: the link is a deliberate grant
   * of trust, where the public catalogue is open to anyone who finds the URL.
   */
  canReorder: boolean;
  /**
   * Move one track and persist the new running order for everyone.
   *
   * Optimistic — the list settles immediately and reverts if the write fails,
   * because a row that snaps back after a beat reads as a bug, while a row that
   * never moves reads as a dead control.
   *
   * Resolves to an error message on failure, or null on success.
   */
  reorder: (from: number, to: number) => Promise<string | null>;
}

interface UsePlaylistTracksOptions {
  /**
   * Read through the admin API rather than the public one. Container mode's
   * public endpoints only serve published playlists, so the studio must ask as
   * an admin or it can't open anything it has hidden.
   */
  admin?: boolean;
}

export const usePlaylistTracks = (
  playlist: PlaylistLike | null,
  options: UsePlaylistTracksOptions = {},
): UsePlaylistTracksResult => {
  const [user] = useOptionalUser();
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const playlistId = playlist?.id;

  const load = useCallback(
    async (refreshCache = false) => {
      if (!playlist) {
        setTracks([]);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        if (isServerMode) {
          // `refreshCache` here means "go and look at Dropbox again", not "skip
          // a cache": in container mode the track list is materialised in
          // Postgres by a sync, so re-reading it without syncing first would
          // return exactly what is already on screen. That was the bug behind
          // "the Sync button does nothing".
          const syncFailure = refreshCache
            ? await syncPlaylistFolders(playlist.id, Boolean(options.admin))
            : null;

          // Inside a share link the reader is token-scoped; everywhere else it
          // is the public catalogue. The studio asks as an admin either way.
          const reader = publicReader();
          const serverTracks = options.admin
            ? (await adminApi.listPlaylistTracks(playlist.id)).filter((t) => !t.isExcluded)
            : await reader.getPlaylistTracks(playlist.id);
          setTracks(serverTracks);
          // The list still loaded, so this is reported alongside it rather than
          // instead of it.
          if (syncFailure) setError(syncFailure);
          // Warm the stream-link cache for the top of the list so the first
          // press of play doesn't wait on a Dropbox round-trip.
          reader.prefetchStreamUrls(
            serverTracks
              .slice(0, 5)
              .map((track) => track.path || track.filePath || '')
              .filter(Boolean)
          );
          return;
        }

        if (!playlist.folderIds?.length) {
          setTracks([]);
          return;
        }

        const perFolder = await Promise.all(
          playlist.folderIds.map(async (folderId) => {
            try {
              const foldersRef = collection(db, 'folderSyncs');
              const folderSnapshot = await getDocs(
                query(foldersRef, where('__name__', '==', folderId))
              );

              if (folderSnapshot.empty) {
                console.warn(`Folder ${folderId} not found`);
                return [];
              }

              const folderData = folderSnapshot.docs[0].data();
              const userId = user?.uid || null;

              // Anonymous visitors go through the same cached service; it falls
              // back to the server-managed public token when there's no user.
              return refreshCache && userId
                ? await cachedTrackService.refreshFolderCache(
                    userId,
                    folderId,
                    folderData.dropboxPath
                  )
                : await cachedTrackService.getTracksFromFolder(
                    userId,
                    folderId,
                    folderData.dropboxPath
                  );
            } catch (folderError) {
              console.error(`Error loading tracks from folder ${folderId}:`, folderError);
              return [];
            }
          })
        );

        let all = applyOrder(perFolder.flat(), playlist.trackOrder);

        if (playlist.trackNames) {
          const names = playlist.trackNames;
          all = all.map((track) => ({ ...track, name: names[track.id] || track.name }));
        }

        if (playlist.excludedTracks?.length) {
          const excluded = new Set(playlist.excludedTracks);
          all = all.filter((track) => !excluded.has(track.id));
        }

        setTracks(all);
      } catch (err) {
        console.error('Error loading playlist tracks:', err);
        setError('Failed to load playlist contents.');
      } finally {
        setLoading(false);
      }
    },
    [playlist, user?.uid, options.admin]
  );

  useEffect(() => {
    load();
    // `playlist` is a fresh object on most renders; keying on its id keeps this
    // from re-fetching on every parent render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playlistId, user?.uid, options.admin]);

  // Durations are resolved lazily in the background and announced when ready.
  useEffect(() => {
    const handleDurations = (event: Event) => {
      const detail = (event as CustomEvent).detail as { tracks?: Track[] } | undefined;
      if (!detail?.tracks) return;

      const updates = new Map(detail.tracks.map((track) => [track.id, track]));
      setTracks((prev) => prev.map((track) => updates.get(track.id) || track));
    };

    window.addEventListener('trackDurationsUpdated', handleDurations);
    return () => window.removeEventListener('trackDurationsUpdated', handleDurations);
  }, []);

  // There is no `canSync` counterpart to this any more: every context can now
  // re-list Dropbox from a playlist view, so the flag that used to gate the
  // button was always true once the share link stopped being the exception.
  //
  // Reordering stays share-only. The public site is reachable by anyone who
  // finds the URL, and a running order any passer-by can rearrange isn't one
  // the owner can rely on; a share token is at least handed out on purpose.
  const canReorder = isServerMode && shareDataService.isActive();

  const reorder = useCallback(
    async (from: number, to: number): Promise<string | null> => {
      if (!canReorder || from === to || !playlistId) return null;

      if (from < 0 || to < 0 || from >= tracks.length || to >= tracks.length) return null;

      // Held so a failed write can put back exactly what was on screen.
      const previous = tracks;
      const moved = [...tracks];
      const [track] = moved.splice(from, 1);
      moved.splice(to, 0, track);
      setTracks(moved);

      try {
        await shareDataService.setTrackOrder(playlistId, moved);
        return null;
      } catch (err) {
        console.error('Failed to save track order:', err);
        setTracks(previous);
        return 'Could not save the new order. Please try again.';
      }
    },
    [canReorder, playlistId, tracks]
  );

  return { tracks, loading, error, reload: load, setTracks, canReorder, reorder };
};
