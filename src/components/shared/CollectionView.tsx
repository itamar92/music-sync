import React, { useCallback, useEffect, useState } from 'react';
import { useIsMobile } from '../../hooks/useMediaQuery';
import { adminData } from '../../services/adminData';
import { publicDataService } from '../../services/publicDataService';
import { EditCollectionModal } from '../admin/EditCollectionModal';
import { CollectionGlyph } from '../nocturne/WaveMark';
import { Icon } from '../nocturne/icons';
import { CollectionRecord } from '../admin/types';

interface PlaylistRow {
  id: string;
  name: string;
  displayName?: string;
  description?: string;
  coverImageUrl?: string;
  trackCount?: number;
  totalTracks?: number;
}

interface CollectionViewProps {
  collection: CollectionRecord;
  onBack: () => void;
  onPlaylistSelect: (playlist: PlaylistRow) => void;
  /** Public view: only published playlists, no editing affordances. */
  isReadOnly?: boolean;
}

export const CollectionView: React.FC<CollectionViewProps> = ({
  collection: selectedCollection,
  onBack,
  onPlaylistSelect,
  isReadOnly = false,
}) => {
  const isMobile = useIsMobile();
  const [playlists, setPlaylists] = useState<PlaylistRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [showEdit, setShowEdit] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setPlaylists([]);

    try {
      // The public view is limited to published playlists; the studio sees all.
      const rows = isReadOnly
        ? await publicDataService.getPlaylistsByCollection(selectedCollection.id)
        : await adminData.listCollectionPlaylists(selectedCollection.id);
      setPlaylists(rows as PlaylistRow[]);
    } catch (error) {
      console.error('Error loading collection content:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedCollection.id, isReadOnly]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div style={{ maxWidth: 1180 }}>
      <button className="nc-link" style={{ marginBottom: 18 }} onClick={onBack}>
        <Icon name="arrowLeft" size={15} />
        Collections
      </button>

      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          gap: 20,
          marginBottom: 24,
          // Long collection names push the action button to its own line
          // instead of squeezing the heading.
          flexWrap: 'wrap',
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div className="nc-kicker" style={{ marginBottom: 10 }}>
            Collection
          </div>
          <h1 className="nc-h1" dir="auto" style={{ fontSize: 30, overflowWrap: 'anywhere' }}>
            {selectedCollection.displayName || selectedCollection.name}
          </h1>
        </div>
        {!isReadOnly && (
          <button className="nc-btn nc-btn-accent" onClick={() => setShowEdit(true)}>
            <Icon name="plus" size={15} />
            Add playlists
          </button>
        )}
      </div>

      {loading ? (
        <div style={{ padding: 48, display: 'flex', justifyContent: 'center' }}>
          <div className="nc-spinner" />
        </div>
      ) : playlists.length === 0 ? (
        <div className="nc-panel" style={{ padding: '48px 24px', textAlign: 'center' }}>
          <h3 className="nc-h2" style={{ marginBottom: 8 }}>
            No playlists here yet
          </h3>
          <p style={{ margin: 0, fontSize: 13.5, color: 'var(--nc-mut)' }}>
            Sync a Dropbox folder, then assign the playlist to this collection.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {playlists.map((playlist) => (
            <button
              key={playlist.id}
              onClick={() => onPlaylistSelect(playlist)}
              className="nc-panel nc-panel-hover"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 13,
                padding: '12px 14px',
                cursor: 'pointer',
                textAlign: 'left',
                fontFamily: 'inherit',
                color: 'var(--nc-text)',
              }}
            >
              {playlist.coverImageUrl ? (
                <img
                  src={playlist.coverImageUrl}
                  alt=""
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 9,
                    objectFit: 'cover',
                    flexShrink: 0,
                  }}
                />
              ) : (
                <CollectionGlyph size={44} />
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="nc-clamp2" dir="auto" style={{ fontSize: 14, fontWeight: 500, lineHeight: 1.3 }}>
                  {playlist.displayName || playlist.name}
                </div>
                <div className="nc-truncate" dir="auto" style={{ fontSize: 12, color: 'var(--nc-mut)' }}>
                  {playlist.description || 'No description'}
                </div>
                {/* On a phone the count moves under the name so the name gets the row. */}
                {isMobile && (
                  <div className="nc-mono" style={{ fontSize: 10.5, color: 'var(--nc-dim)', marginTop: 2 }}>
                    {playlist.trackCount || playlist.totalTracks || 0} TRACKS
                  </div>
                )}
              </div>
              {!isMobile && (
                <span className="nc-mono" style={{ fontSize: 11, color: 'var(--nc-dim)', flexShrink: 0 }}>
                  {playlist.trackCount || playlist.totalTracks || 0} TRACKS
                </span>
              )}
              <Icon name="caretRight" size={15} color="var(--nc-faint)" />
            </button>
          ))}
        </div>
      )}

      <EditCollectionModal
        isOpen={showEdit}
        onClose={() => setShowEdit(false)}
        onSuccess={() => {
          load();
          setShowEdit(false);
        }}
        collection={selectedCollection}
      />
    </div>
  );
};
