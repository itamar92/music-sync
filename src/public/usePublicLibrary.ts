import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../services/firebase';
import { publicDataService } from '../services/publicDataService';
import { isServerMode } from '../services/dataMode';
import { Collection, Playlist } from '../types';

/**
 * Everything the public shells need from the library, in one hook.
 *
 * The desktop and mobile shells are laid out completely differently but browse
 * exactly the same data, so the loading — including the Firestore fallbacks
 * that were previously inline in PublicApp — lives here once. Both data modes
 * behave as they did before: container mode hits the backend's public REST
 * endpoints, Firebase mode queries Firestore for `isPublic` records and falls
 * back to a client-side filter when the indexed query is rejected.
 */

export type PublicView = 'hero' | 'collection' | 'playlist' | 'search';

const readCollections = async (): Promise<Collection[]> => {
  if (isServerMode) return publicDataService.getCollections();

  const collectionsRef = collection(db, 'collections');

  try {
    const snapshot = await getDocs(query(collectionsRef, where('isPublic', '==', true)));
    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as Collection[];
  } catch (queryError) {
    console.error('Public collections query failed:', queryError);

    // Rules or a missing index can reject the filtered query; reading the
    // collection and filtering here still respects read permissions.
    try {
      const snapshot = await getDocs(query(collectionsRef));
      const all = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as Collection[];
      return all.filter((item) => item.isPublic === true);
    } catch (fallbackError) {
      console.error('Fallback collections query also failed:', fallbackError);
      return [];
    }
  }
};

const readCollection = async (collectionId: string): Promise<Collection | null> => {
  if (isServerMode) return publicDataService.getCollection(collectionId);

  const snapshot = await getDocs(
    query(
      collection(db, 'collections'),
      where('__name__', '==', collectionId),
      where('isPublic', '==', true)
    )
  );
  if (snapshot.empty) return null;
  return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as Collection;
};

const readPlaylist = async (playlistId: string): Promise<Playlist | null> => {
  if (isServerMode) return publicDataService.getPlaylist(playlistId);

  const snapshot = await getDocs(
    query(
      collection(db, 'playlists'),
      where('__name__', '==', playlistId),
      where('isPublic', '==', true)
    )
  );
  if (snapshot.empty) return null;
  return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as Playlist;
};

const readPlaylistsByCollection = async (collectionId: string): Promise<Playlist[]> => {
  if (isServerMode) return publicDataService.getPlaylistsByCollection(collectionId);

  const snapshot = await getDocs(
    query(
      collection(db, 'playlists'),
      where('collectionId', '==', collectionId),
      where('isPublic', '==', true)
    )
  );
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as Playlist[];
};

export interface PublicLibrary {
  collections: Collection[];
  filteredCollections: Collection[];
  selectedCollection: Collection | null;
  collectionPlaylists: Playlist[];
  selectedPlaylist: Playlist | null;
  loading: boolean;
  loadingPlaylists: boolean;
  error: string | null;
  search: string;
  setSearch: (value: string) => void;
  view: PublicView;
  selectCollection: (item: Collection) => void;
  openPlaylist: (item: Playlist) => void;
  goHome: () => void;
  backToCollection: () => void;
  openSearch: () => void;
  /** Every playlist across every collection, for search results. */
  allPlaylists: Playlist[];
}

export const usePublicLibrary = (options: { enabled: boolean }): PublicLibrary => {
  const { collectionId, playlistId } = useParams();
  const navigate = useNavigate();

  const [collections, setCollections] = useState<Collection[]>([]);
  const [selectedCollection, setSelectedCollection] = useState<Collection | null>(null);
  const [collectionPlaylists, setCollectionPlaylists] = useState<Playlist[]>([]);
  const [selectedPlaylist, setSelectedPlaylist] = useState<Playlist | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingPlaylists, setLoadingPlaylists] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [allPlaylists, setAllPlaylists] = useState<Playlist[]>([]);

  const loadPlaylistsFor = useCallback(async (target: Collection) => {
    setLoadingPlaylists(true);
    setCollectionPlaylists([]);
    try {
      setCollectionPlaylists(await readPlaylistsByCollection(target.id));
    } catch (err) {
      console.error('Error loading collection playlists:', err);
    } finally {
      setLoadingPlaylists(false);
    }
  }, []);

  // Collections list.
  useEffect(() => {
    if (!options.enabled) return;

    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const list = await readCollections();
        if (!cancelled) setCollections(list);
      } catch (err) {
        console.error('Error loading public collections:', err);
        if (!cancelled) setError('Failed to load collections');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [options.enabled]);

  // Deep link to a collection.
  useEffect(() => {
    if (!collectionId) return;

    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const found = await readCollection(collectionId);
        if (cancelled) return;
        if (!found) {
          setError('Collection not found');
          return;
        }
        setSelectedCollection(found);
        await loadPlaylistsFor(found);
      } catch (err) {
        console.error(err);
        if (!cancelled) setError('Failed to load collection');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [collectionId, loadPlaylistsFor]);

  // Deep link to a playlist — also resolves its collection for context.
  useEffect(() => {
    if (!playlistId) return;

    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const found = await readPlaylist(playlistId);
        if (cancelled) return;
        if (!found) {
          setError('Playlist not found');
          return;
        }
        setSelectedPlaylist(found);

        if (found.collectionId) {
          try {
            const parent = await readCollection(found.collectionId);
            if (!cancelled && parent) setSelectedCollection(parent);
          } catch {
            // Collection context is optional; the playlist still renders.
          }
        }
      } catch (err) {
        console.error(err);
        if (!cancelled) setError('Failed to load playlist');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [playlistId]);

  // Search spans the whole library, so it needs every collection's playlists.
  // That's one request per collection, deferred until search is actually opened.
  useEffect(() => {
    if (!searchOpen || allPlaylists.length || !collections.length) return;

    let cancelled = false;
    (async () => {
      const perCollection = await Promise.all(
        collections.map(async (item) => {
          try {
            return await readPlaylistsByCollection(item.id);
          } catch {
            return [];
          }
        })
      );
      if (!cancelled) setAllPlaylists(perCollection.flat());
    })();

    return () => {
      cancelled = true;
    };
  }, [searchOpen, collections, allPlaylists.length]);

  const filteredCollections = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return collections;
    return collections.filter((item) =>
      (item.displayName || item.name).toLowerCase().includes(needle)
    );
  }, [collections, search]);

  const selectCollection = useCallback(
    (item: Collection) => {
      setSearchOpen(false);
      setSelectedPlaylist(null);
      setSelectedCollection(item);
      loadPlaylistsFor(item);
      navigate(`/collection/${item.id}`);
    },
    [loadPlaylistsFor, navigate]
  );

  const openPlaylist = useCallback(
    (item: Playlist) => {
      setSearchOpen(false);
      setSelectedPlaylist(item);
      navigate(`/playlist/${item.id}`);
    },
    [navigate]
  );

  const openSearch = useCallback(() => setSearchOpen(true), []);

  const goHome = useCallback(() => {
    setSearchOpen(false);
    setSelectedPlaylist(null);
    setSelectedCollection(null);
    setCollectionPlaylists([]);
    navigate('/');
  }, [navigate]);

  const backToCollection = useCallback(() => {
    setSelectedPlaylist(null);
    if (selectedCollection) {
      navigate(`/collection/${selectedCollection.id}`);
    } else {
      navigate('/');
    }
  }, [navigate, selectedCollection]);

  const view: PublicView = searchOpen
    ? 'search'
    : selectedPlaylist
      ? 'playlist'
      : selectedCollection
        ? 'collection'
        : 'hero';

  return {
    collections,
    filteredCollections,
    selectedCollection,
    collectionPlaylists,
    selectedPlaylist,
    loading,
    loadingPlaylists,
    error,
    search,
    setSearch,
    view,
    selectCollection,
    openPlaylist,
    goHome,
    backToCollection,
    openSearch,
    allPlaylists,
  };
};
