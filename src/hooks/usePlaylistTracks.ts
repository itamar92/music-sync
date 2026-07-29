import { useCallback, useEffect, useState } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../services/firebase';
import { cachedTrackService } from '../services/cachedTrackService';
import { publicReader } from '../services/publicReader';
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
  /** Re-reads from the source; pass true to bypass the folder cache. */
  reload: (refreshCache?: boolean) => Promise<void>;
  setTracks: React.Dispatch<React.SetStateAction<Track[]>>;
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
          // Inside a share link the reader is token-scoped; everywhere else it
          // is the public catalogue. The studio asks as an admin either way.
          const reader = publicReader();
          const serverTracks = options.admin
            ? (await adminApi.listPlaylistTracks(playlist.id)).filter((t) => !t.isExcluded)
            : await reader.getPlaylistTracks(playlist.id);
          setTracks(serverTracks);
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

  return { tracks, loading, error, reload: load, setTracks };
};
