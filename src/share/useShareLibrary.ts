import { useCallback, useEffect, useMemo, useState } from 'react';
import { Collection, Playlist } from '../types';
import { isServerMode } from '../services/dataMode';
import { shareDataService, ShareUnavailableError } from '../services/shareDataService';
import { PublicLibrary, PublicView } from '../public/usePublicLibrary';

/**
 * The public shells' data contract, backed by a single share link.
 *
 * `PublicDesktop` and `PublicMobile` take everything they browse — and every
 * navigation action — from a `PublicLibrary`, so a share view is that same
 * interface over one collection. Two things differ deliberately:
 *
 *  - There is no home: `goHome` returns to the shared collection rather than the
 *    catalogue, and no action here ever navigates out of `/share/:token`. The
 *    recipient sees this collection and nothing else.
 *  - Nothing writes to the URL. A share has one address; sub-views are state.
 */

export type ShareStatus = 'loading' | 'ready' | 'unavailable' | 'error';

export interface ShareLibraryResult {
  library: PublicLibrary;
  status: ShareStatus;
  /** The token in play, for building a copyable link back to this page. */
  token: string;
}

export const useShareLibrary = (token: string): ShareLibraryResult => {
  const [collection, setCollection] = useState<Collection | null>(null);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [selectedPlaylist, setSelectedPlaylist] = useState<Playlist | null>(null);
  const [status, setStatus] = useState<ShareStatus>('loading');
  const [search, setSearch] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    // Firebase mode has no share endpoints at all, so there is nothing to ask.
    if (!isServerMode || !token) {
      setStatus('unavailable');
      return;
    }

    let cancelled = false;
    shareDataService.activate(token);
    setStatus('loading');

    (async () => {
      try {
        const bundle = await shareDataService.getShare();
        if (cancelled) return;
        setCollection(bundle.collection);
        setPlaylists(bundle.playlists);
        setStatus('ready');
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ShareUnavailableError) {
          setStatus('unavailable');
        } else {
          console.error('Error loading shared collection:', err);
          setStatus('error');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token]);

  // Leaving the share view must not leave the token armed: any later public
  // browsing in the same tab has to go back to the public endpoints.
  useEffect(() => () => shareDataService.deactivate(), []);

  const backToCollection = useCallback(() => {
    setSearchOpen(false);
    setSelectedPlaylist(null);
  }, []);

  const openPlaylist = useCallback((item: Playlist) => {
    setSearchOpen(false);
    setSelectedPlaylist(item);
  }, []);

  const filteredCollections = useMemo(() => {
    if (!collection) return [];
    const needle = search.trim().toLowerCase();
    if (!needle) return [collection];
    return (collection.displayName || collection.name).toLowerCase().includes(needle)
      ? [collection]
      : [];
  }, [collection, search]);

  const view: PublicView = searchOpen ? 'search' : selectedPlaylist ? 'playlist' : 'collection';

  const library = useMemo<PublicLibrary>(
    () => ({
      collections: collection ? [collection] : [],
      filteredCollections,
      selectedCollection: collection,
      collectionPlaylists: playlists,
      selectedPlaylist,
      loading: status === 'loading',
      loadingPlaylists: false,
      error: null,
      search,
      setSearch,
      view,
      selectCollection: backToCollection,
      openPlaylist,
      goHome: backToCollection,
      backToCollection,
      openSearch: () => setSearchOpen(true),
      allPlaylists: playlists,
    }),
    [collection, filteredCollections, playlists, selectedPlaylist, status, search, view, backToCollection, openPlaylist],
  );

  return { library, status, token };
};
