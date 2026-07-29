import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CreateCollectionModal } from './CreateCollectionModal';
import { EditCollectionModal } from './EditCollectionModal';
import { ShareLinksModal } from './ShareLinksModal';
import { CollectionView } from '../shared/CollectionView';
import { adminData } from '../../services/adminData';
import { isServerMode } from '../../services/dataMode';
import { useToast } from '../../hooks/useToast';
import { ToastContainer } from '../ui/ToastContainer';
import { CollectionGlyph } from '../nocturne/WaveMark';
import { Icon } from '../nocturne/icons';
import { CollectionRecord } from './types';

export const CollectionManagement: React.FC = () => {
  const navigate = useNavigate();

  const [collections, setCollections] = useState<CollectionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<CollectionRecord | null>(null);
  const [viewing, setViewing] = useState<CollectionRecord | null>(null);
  // Share links are a container-mode feature; Firebase mode has no endpoints.
  const [sharing, setSharing] = useState<CollectionRecord | null>(null);

  const { toasts, removeToast, showSuccess, showError } = useToast();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const rows = await adminData.listCollections();
        if (!cancelled) setCollections(rows);
      } catch (loadError) {
        console.error('Error loading collections:', loadError);
        if (!cancelled) showError('Failed to load collections', 'Please try again.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [showError]);

  const remove = async (id: string, name: string) => {
    if (!confirm(`Delete "${name}"? This cannot be undone. Playlists inside it are kept.`)) return;

    try {
      await adminData.deleteCollection(id);
      setCollections((prev) => prev.filter((item) => item.id !== id));
      showSuccess('Collection deleted');
    } catch (deleteError) {
      console.error('Error deleting collection:', deleteError);
      showError('Failed to delete collection', 'Please try again.');
    }
  };

  if (viewing) {
    return (
      <CollectionView
        collection={viewing}
        onBack={() => setViewing(null)}
        onPlaylistSelect={(playlist: { id: string }) => {
          // PlaylistManagement reads this on mount and opens the playlist.
          sessionStorage.setItem('openPlaylistId', playlist.id);
          navigate('/admin/playlists');
        }}
        isReadOnly={false}
      />
    );
  }

  return (
    <div style={{ maxWidth: 1180 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          gap: 20,
          marginBottom: 24,
        }}
      >
        <div>
          <div className="nc-kicker" style={{ marginBottom: 10 }}>
            Studio
          </div>
          <h1 className="nc-h1" style={{ fontSize: 30, marginBottom: 6 }}>
            Collections
          </h1>
          <p style={{ margin: 0, fontSize: 14, color: 'var(--nc-mut)' }}>
            Group playlists into what a listener sees first.
          </p>
        </div>
        <button className="nc-btn nc-btn-accent" onClick={() => setShowCreate(true)}>
          <Icon name="plus" size={15} />
          New collection
        </button>
      </div>

      {loading ? (
        <div style={{ padding: 48, display: 'flex', justifyContent: 'center' }}>
          <div className="nc-spinner" />
        </div>
      ) : collections.length === 0 ? (
        <div
          className="nc-panel"
          style={{ padding: '48px 24px', textAlign: 'center' }}
        >
          <h3 className="nc-h2" style={{ marginBottom: 8 }}>
            No collections yet
          </h3>
          <p style={{ margin: '0 0 20px', fontSize: 13.5, color: 'var(--nc-mut)' }}>
            Create one to organise your playlists.
          </p>
          <button className="nc-btn nc-btn-accent" onClick={() => setShowCreate(true)}>
            <Icon name="plus" size={15} />
            Create collection
          </button>
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
            gap: 14,
          }}
        >
          {collections.map((item) => (
            <div key={item.id} className="nc-panel nc-panel-hover" style={{ padding: 16 }}>
              <div
                className="nc-art"
                style={{
                  aspectRatio: '1 / 1',
                  borderRadius: 'var(--nc-r)',
                  marginBottom: 14,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {item.coverImageUrl ? (
                  <img
                    src={item.coverImageUrl}
                    alt=""
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  <CollectionGlyph size={64} />
                )}
              </div>

              <h3
                className="nc-truncate"
                style={{ margin: '0 0 4px', fontSize: 14.5, fontWeight: 500 }}
              >
                {item.displayName || item.name}
              </h3>
              <p
                className="nc-truncate"
                style={{ margin: '0 0 14px', fontSize: 12.5, color: 'var(--nc-mut)' }}
              >
                {item.description || 'No description'}
              </p>

              <div
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
              >
                <span className="nc-mono" style={{ fontSize: 11, color: 'var(--nc-dim)' }}>
                  {item.totalPlaylists || 0} PLAYLISTS
                  {item.isPublic === false && (
                    <span style={{ color: 'var(--nc-warn, var(--nc-mut))' }}> · PRIVATE</span>
                  )}
                </span>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button
                    className="nc-btn nc-btn-ghost nc-btn-icon"
                    onClick={() => setViewing(item)}
                    title="Open collection"
                  >
                    <Icon name="eye" size={15} />
                  </button>
                  <button
                    className="nc-btn nc-btn-ghost nc-btn-icon"
                    onClick={() => setEditing(item)}
                    title="Edit collection"
                  >
                    <Icon name="pencil" size={15} />
                  </button>
                  {isServerMode && (
                    <button
                      className="nc-btn nc-btn-ghost nc-btn-icon"
                      onClick={() => setSharing(item)}
                      title="Share links"
                    >
                      <Icon name="share" size={15} />
                    </button>
                  )}
                  <button
                    className="nc-btn nc-btn-ghost nc-btn-icon"
                    style={{ color: 'var(--nc-danger)' }}
                    onClick={() => remove(item.id, item.displayName || item.name)}
                    title="Delete collection"
                  >
                    <Icon name="trash" size={15} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <CreateCollectionModal
        isOpen={showCreate}
        onClose={() => setShowCreate(false)}
        onSuccess={(created: CollectionRecord) => setCollections((prev) => [...prev, created])}
      />

      <EditCollectionModal
        isOpen={Boolean(editing)}
        onClose={() => setEditing(null)}
        onSuccess={(updated: CollectionRecord) => {
          setCollections((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
          setEditing(null);
        }}
        collection={editing}
      />

      <ShareLinksModal
        isOpen={Boolean(sharing)}
        onClose={() => setSharing(null)}
        collection={sharing}
      />

      <ToastContainer toasts={toasts} onDismiss={removeToast} />
    </div>
  );
};
