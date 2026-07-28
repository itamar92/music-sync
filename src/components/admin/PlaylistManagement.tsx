import React, { useState, useEffect, useMemo } from 'react';
import { CreatePlaylistModal } from './CreatePlaylistModal';
import { EditPlaylistModal } from './EditPlaylistModal';
import { PlaylistView } from '../shared/PlaylistView';
import { adminData } from '../../services/adminData';
import { useToast } from '../../hooks/useToast';
import { ToastContainer } from '../ui/ToastContainer';
import { Waveform } from '../nocturne/Waveform';
import { Icon } from '../nocturne/icons';
import { CollectionRecord, PlaylistRecord } from './types';

export const PlaylistManagement: React.FC = () => {
  const [playlists, setPlaylists] = useState<PlaylistRecord[]>([]);
  const [collections, setCollections] = useState<CollectionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [collectionFilter, setCollectionFilter] = useState('all');
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<PlaylistRecord | null>(null);
  const [viewing, setViewing] = useState<PlaylistRecord | null>(null);

  const { toasts, removeToast, showSuccess, showError, showWarning } = useToast();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [playlistRows, collectionRows] = await Promise.all([
          adminData.listPlaylists(),
          adminData.listCollections(),
        ]);
        if (cancelled) return;
        setPlaylists(playlistRows);
        setCollections(collectionRows);
      } catch (error) {
        console.error('Error loading playlists:', error);
        if (!cancelled) showError('Failed to load playlists', 'Please try again.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [showError]);

  // CollectionManagement hands off a playlist to open through sessionStorage.
  useEffect(() => {
    const pending = sessionStorage.getItem('openPlaylistId');
    if (!pending || !playlists.length) return;

    const match = playlists.find((p) => p.id === pending);
    if (match) {
      setViewing(match);
      sessionStorage.removeItem('openPlaylistId');
    }
  }, [playlists]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return playlists.filter((playlist) => {
      const label = (playlist.displayName || playlist.name).toLowerCase();
      const matchesSearch = !needle || label.includes(needle);
      const matchesCollection =
        collectionFilter === 'all' || playlist.collectionId === collectionFilter;
      return matchesSearch && matchesCollection;
    });
  }, [playlists, search, collectionFilter]);

  /** Saved records may carry a warning — surface it rather than dropping it. */
  const announce = (record: PlaylistRecord) => {
    if (record.warning) showWarning('Saved with a problem', record.warning);
  };

  const applyUpdate = (updated: PlaylistRecord) => {
    setPlaylists((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    setEditing(null);
    if (viewing?.id === updated.id) setViewing(updated);
    announce(updated);
  };

  const remove = async (playlist: PlaylistRecord) => {
    const label = playlist.displayName || playlist.name;
    if (!confirm(`Delete "${label}"? Dropbox files are not affected.`)) return;

    try {
      await adminData.deletePlaylist(playlist.id);
      setPlaylists((prev) => prev.filter((p) => p.id !== playlist.id));
      showSuccess('Playlist deleted');
    } catch (error) {
      console.error('Error deleting playlist:', error);
      showError('Failed to delete playlist', 'Please try again.');
    }
  };

  if (viewing) {
    return (
      <PlaylistView
        playlist={viewing}
        onBack={() => setViewing(null)}
        onPlaylistUpdated={applyUpdate}
        isReadOnly={false}
      />
    );
  }

  const empty = search || collectionFilter !== 'all';

  return (
    <div style={{ maxWidth: 1180 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          gap: 20,
          marginBottom: 22,
        }}
      >
        <div>
          <div className="nc-kicker" style={{ marginBottom: 10 }}>
            Studio
          </div>
          <h1 className="nc-h1" style={{ fontSize: 30, marginBottom: 6 }}>
            Playlists
          </h1>
          <p style={{ margin: 0, fontSize: 14, color: 'var(--nc-mut)' }}>
            Everything synced, across every collection.
          </p>
        </div>
        <button className="nc-btn nc-btn-accent" onClick={() => setShowCreate(true)}>
          <Icon name="plus" size={15} />
          New playlist
        </button>
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        <div className="nc-search" style={{ flex: 1, minWidth: 220, height: 38 }}>
          <Icon name="search" size={14} color="var(--nc-mut)" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search playlists"
            aria-label="Search playlists"
          />
        </div>
        <select
          className="nc-select"
          style={{ width: 220 }}
          value={collectionFilter}
          onChange={(e) => setCollectionFilter(e.target.value)}
          aria-label="Filter by collection"
        >
          <option value="all">All collections</option>
          {collections.map((item) => (
            <option key={item.id} value={item.id}>
              {item.displayName || item.name}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <div style={{ padding: 48, display: 'flex', justifyContent: 'center' }}>
          <div className="nc-spinner" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="nc-panel" style={{ padding: '48px 24px', textAlign: 'center' }}>
          <h3 className="nc-h2" style={{ marginBottom: 8 }}>
            {empty ? 'Nothing matches' : 'No playlists yet'}
          </h3>
          <p style={{ margin: '0 0 20px', fontSize: 13.5, color: 'var(--nc-mut)' }}>
            {empty
              ? 'Try a different search or collection filter.'
              : 'Sync a Dropbox folder to create your first playlist.'}
          </p>
          {!empty && (
            <button className="nc-btn nc-btn-accent" onClick={() => setShowCreate(true)}>
              <Icon name="plus" size={15} />
              Create playlist
            </button>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map((playlist) => (
            <div
              key={playlist.id}
              className="nc-panel nc-panel-hover"
              style={{
                display: 'grid',
                gridTemplateColumns: '56px 1fr 200px 96px 72px',
                alignItems: 'center',
                gap: 16,
                padding: '12px 14px',
              }}
            >
              <button
                onClick={() => setViewing(playlist)}
                className="nc-art"
                style={{ width: 44, height: 44, borderRadius: 9, padding: 0, cursor: 'pointer' }}
                aria-label={`Open ${playlist.displayName || playlist.name}`}
              >
                {playlist.coverImageUrl && (
                  <img
                    src={playlist.coverImageUrl}
                    alt=""
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                )}
              </button>

              <button
                onClick={() => setViewing(playlist)}
                style={{
                  minWidth: 0,
                  textAlign: 'left',
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  color: 'var(--nc-text)',
                }}
              >
                <div className="nc-truncate" style={{ fontSize: 14, fontWeight: 500 }}>
                  {playlist.displayName || playlist.name}
                </div>
                <div className="nc-truncate" style={{ fontSize: 12, color: 'var(--nc-mut)' }}>
                  {playlist.description || 'No description'}
                </div>
              </button>

              <Waveform seed={playlist.id + playlist.name} kind="playlist" height={22} />

              <span
                className="nc-mono"
                style={{ fontSize: 11.5, color: 'var(--nc-dim)', textAlign: 'right' }}
              >
                {playlist.trackCount || 0} TRACKS
              </span>

              <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                <button
                  className="nc-btn nc-btn-ghost nc-btn-icon"
                  onClick={() => setEditing(playlist)}
                  title="Edit playlist"
                >
                  <Icon name="pencil" size={15} />
                </button>
                <button
                  className="nc-btn nc-btn-ghost nc-btn-icon"
                  style={{ color: 'var(--nc-danger)' }}
                  onClick={() => remove(playlist)}
                  title="Delete playlist"
                >
                  <Icon name="trash" size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <CreatePlaylistModal
        isOpen={showCreate}
        onClose={() => setShowCreate(false)}
        onSuccess={(created: PlaylistRecord) => {
          setPlaylists((prev) => [...prev, created]);
          announce(created);
        }}
      />

      <EditPlaylistModal
        isOpen={Boolean(editing)}
        onClose={() => setEditing(null)}
        onSuccess={applyUpdate}
        playlist={editing}
      />

      <ToastContainer toasts={toasts} onDismiss={removeToast} />
    </div>
  );
};
