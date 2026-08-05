import React, { useEffect, useState } from 'react';
import { useIsMobile } from '../../hooks/useMediaQuery';
import { usePlaylistTracks } from '../../hooks/usePlaylistTracks';
import { useAudioPlayerContext } from '../../context/AudioPlayerContext';
import { adminData } from '../../services/adminData';
import { calculatePlaylistDuration, formatTime } from '../../utils/formatTime';
import { Track } from '../../types';
import { Waveform } from '../nocturne/Waveform';
import { EqBars } from '../nocturne/EqBars';
import { FreshnessMark } from '../nocturne/FreshnessMark';
import { Icon } from '../nocturne/icons';
import { PlaylistRecord } from '../admin/types';

/**
 * The playlist editor.
 *
 * Read-only it's a listening view; for an owner it adds inline renaming of the
 * playlist, artist and each track, drag-to-reorder, track removal, and a cache
 * refresh. All of those write straight to Firestore, exactly as before — only
 * the presentation and the track loading (now a shared hook) have changed.
 */

interface PlaylistViewProps {
  playlist: PlaylistRecord;
  onBack: () => void;
  onPlaylistUpdated?: (updated: PlaylistRecord) => void;
  isReadOnly?: boolean;
}

export const PlaylistView: React.FC<PlaylistViewProps> = ({
  playlist,
  onBack,
  onPlaylistUpdated,
  isReadOnly = false,
}) => {
  const { tracks, loading, error, reload, setTracks, canSync } = usePlaylistTracks(playlist, {
    admin: !isReadOnly,
  });
  const { state, playFromPlaylist, togglePlayPause, progress, seekToFraction } =
    useAudioPlayerContext();
  const isMobile = useIsMobile();

  const [title, setTitle] = useState(playlist.displayName || playlist.name);
  const [artist, setArtist] = useState(playlist.artist || 'Unknown Artist');
  const [editingTitle, setEditingTitle] = useState(false);
  const [editingArtist, setEditingArtist] = useState(false);
  const [editingTrackId, setEditingTrackId] = useState<string | null>(null);
  const [editingTrackName, setEditingTrackName] = useState('');
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    setTitle(playlist.displayName || playlist.name);
    setArtist(playlist.artist || 'Unknown Artist');
  }, [playlist]);

  const canEdit = !isReadOnly && Boolean(onPlaylistUpdated);

  /** Wraps a write so a failure is reported once, in one voice. */
  const attempt = async (write: () => Promise<unknown>, failure: string) => {
    if (!canEdit) return false;
    try {
      await write();
      return true;
    } catch (error) {
      console.error(failure, error);
      alert(`${failure} Please try again.`);
      return false;
    }
  };

  const saveTitle = async () => {
    const ok = await attempt(
      () => adminData.updatePlaylist(playlist.id, { displayName: title }),
      'Failed to update playlist title.'
    );
    if (ok) {
      onPlaylistUpdated?.({ ...playlist, displayName: title });
      setEditingTitle(false);
    }
  };

  const saveArtist = async () => {
    const ok = await attempt(
      () => adminData.updatePlaylist(playlist.id, { artist }),
      'Failed to update artist name.'
    );
    if (ok) {
      onPlaylistUpdated?.({ ...playlist, artist });
      setEditingArtist(false);
    }
  };

  const saveTrackName = async (trackId: string) => {
    const ok = await attempt(
      () => adminData.renameTrack(playlist.id, trackId, editingTrackName),
      'Failed to update track name.'
    );
    if (ok) {
      setTracks((prev) =>
        prev.map((track) => (track.id === trackId ? { ...track, name: editingTrackName } : track))
      );
      setEditingTrackId(null);
      setEditingTrackName('');
    }
  };

  const removeTrack = async (trackId: string) => {
    if (!confirm('Remove this track from the playlist? The Dropbox file is untouched.')) return;

    const ok = await attempt(
      () => adminData.removeTrack(playlist.id, trackId),
      'Failed to remove track.'
    );
    if (ok) setTracks((prev) => prev.filter((track) => track.id !== trackId));
  };

  const drop = async (dropIndex: number) => {
    if (!canEdit || dragIndex === null || dragIndex === dropIndex) {
      setDragIndex(null);
      return;
    }

    const reordered = [...tracks];
    const [moved] = reordered.splice(dragIndex, 1);
    reordered.splice(dropIndex, 0, moved);

    // Optimistic: the list settles immediately, the write follows.
    setTracks(reordered);
    setDragIndex(null);
    await attempt(
      () => adminData.setTrackOrder(playlist.id, reordered.map((track) => track.id)),
      'Failed to save track order.'
    );
  };

  const refresh = async () => {
    setRefreshing(true);
    try {
      await reload(true);
    } finally {
      setRefreshing(false);
    }
  };

  const play = (index: number) =>
    playFromPlaylist(tracks, index, { playlistId: playlist.id, playlistName: title });

  return (
    <div style={{ maxWidth: 1180 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 20,
        }}
      >
        <button className="nc-link" onClick={onBack}>
          <Icon name="arrowLeft" size={15} />
          Back
        </button>

        {canSync && (
          <button className="nc-btn" onClick={refresh} disabled={refreshing || loading}>
            <Icon
              name="refresh"
              size={14}
              style={refreshing ? { animation: 'ms-spin 0.8s linear infinite' } : undefined}
            />
            {refreshing ? 'Syncing…' : 'Sync from Dropbox'}
          </button>
        )}
      </div>

      {error && (
        <p className="nc-tag nc-tag-danger" style={{ marginBottom: 18 }} role="status">
          <Icon name="warning" size={13} />
          {error}
        </p>
      )}

      <div
        style={{
          display: 'flex',
          gap: isMobile ? 16 : 26,
          alignItems: 'flex-end',
          marginBottom: isMobile ? 20 : 28,
        }}
      >
        <div
          className="nc-art"
          style={{
            width: isMobile ? 112 : 168,
            height: isMobile ? 112 : 168,
            borderRadius: 12,
            boxShadow: 'var(--nc-shadow-md)',
          }}
        >
          {playlist.coverImageUrl ? (
            <img
              src={playlist.coverImageUrl}
              alt=""
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0 }}>
              <Waveform seed={playlist.id + playlist.name} kind="cover" height={isMobile ? 52 : 78} />
            </div>
          )}
        </div>

        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="nc-kicker" style={{ marginBottom: 10 }}>
            Playlist
          </div>

          {editingTitle ? (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
              <input
                className="nc-input"
                style={{ fontSize: 20, height: 44 }}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && saveTitle()}
                // eslint-disable-next-line jsx-a11y/no-autofocus
                autoFocus
              />
              <button className="nc-btn nc-btn-accent nc-btn-icon" onClick={saveTitle} title="Save">
                <Icon name="check" size={15} />
              </button>
              <button
                className="nc-btn nc-btn-icon"
                onClick={() => {
                  setEditingTitle(false);
                  setTitle(playlist.displayName || playlist.name);
                }}
                title="Cancel"
              >
                <Icon name="x" size={15} />
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 8 }}>
              <h1
                className="nc-h1"
                dir="auto"
                style={{ fontSize: isMobile ? 24 : 38, overflowWrap: 'anywhere' }}
              >
                {title}
              </h1>
              {canEdit && (
                <button
                  className="nc-btn nc-btn-ghost nc-btn-icon"
                  onClick={() => setEditingTitle(true)}
                  aria-label="Rename playlist"
                >
                  <Icon name="pencil" size={15} />
                </button>
              )}
            </div>
          )}

          {editingArtist ? (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 14 }}>
              <input
                className="nc-input"
                style={{ maxWidth: 320 }}
                value={artist}
                onChange={(e) => setArtist(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && saveArtist()}
                // eslint-disable-next-line jsx-a11y/no-autofocus
                autoFocus
              />
              <button className="nc-btn nc-btn-accent nc-btn-icon" onClick={saveArtist} title="Save">
                <Icon name="check" size={15} />
              </button>
              <button
                className="nc-btn nc-btn-icon"
                onClick={() => {
                  setEditingArtist(false);
                  setArtist(playlist.artist || 'Unknown Artist');
                }}
                title="Cancel"
              >
                <Icon name="x" size={15} />
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 14 }}>
              <p dir="auto" style={{ margin: 0, fontSize: 14, color: 'var(--nc-mut)' }}>{artist}</p>
              {canEdit && (
                <button
                  className="nc-btn nc-btn-ghost nc-btn-icon"
                  style={{ width: 24, height: 24 }}
                  onClick={() => setEditingArtist(true)}
                  aria-label="Rename artist"
                >
                  <Icon name="pencil" size={13} />
                </button>
              )}
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <button
              className="nc-btn nc-btn-play"
              onClick={() => play(0)}
              disabled={!tracks.length}
            >
              <Icon name="play" size={15} />
              Play
            </button>
            <span className="nc-mono" style={{ fontSize: 11.5, color: 'var(--nc-dim)' }}>
              {loading
                ? 'LOADING…'
                : `${tracks.length} TRACKS · ${calculatePlaylistDuration(tracks)}`}
            </span>
          </div>
        </div>
      </div>

      {!isMobile && (
        <div
          className="nc-mono"
          style={{
            display: 'grid',
            gridTemplateColumns: canEdit ? '44px 24px 1fr 1.1fr 74px 34px' : '44px 1fr 1.1fr 74px',
            alignItems: 'center',
            gap: 16,
            padding: '0 14px 9px',
            fontSize: 10.5,
            letterSpacing: '0.12em',
            color: 'var(--nc-dim)',
            borderBottom: '1px solid var(--nc-line)',
          }}
        >
          <span>#</span>
          {canEdit && <span />}
          <span>TITLE</span>
          <span>WAVEFORM</span>
          <span style={{ textAlign: 'right' }}>TIME</span>
          {canEdit && <span />}
        </div>
      )}

      {loading ? (
        <div style={{ padding: 48, display: 'flex', justifyContent: 'center' }}>
          <div className="nc-spinner" />
        </div>
      ) : tracks.length === 0 ? (
        <p style={{ padding: '48px 14px', fontSize: 13.5, color: 'var(--nc-mut)' }}>
          No tracks in this playlist.
        </p>
      ) : (
        tracks.map((track, index) => {
          const current = state.currentTrack?.id === track.id;
          const playing = current && state.isPlaying;

          return (
            <div
              key={track.id}
              draggable={canEdit && !isMobile}
              onDragStart={() => canEdit && setDragIndex(index)}
              onDragOver={(e) => canEdit && e.preventDefault()}
              onDrop={() => drop(index)}
              className="nc-row-hover"
              style={{
                position: 'relative',
                display: 'grid',
                // On a phone the row folds to number · title-with-waveform ·
                // time; the grip and the wide waveform column don't fit.
                gridTemplateColumns: isMobile
                  ? '36px 1fr 52px'
                  : canEdit
                    ? '44px 24px 1fr 1.1fr 74px 34px'
                    : '44px 1fr 1.1fr 74px',
                alignItems: 'center',
                gap: isMobile ? 10 : 16,
                padding: isMobile ? '10px 8px' : '11px 14px',
                borderRadius: 9,
                overflow: 'hidden',
                opacity: dragIndex === index ? 0.5 : 1,
              }}
            >
              {current && (
                <>
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      background:
                        'linear-gradient(90deg, rgba(34,184,214,0.10), rgba(61,13,96,0.06))',
                    }}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      left: 0,
                      top: 6,
                      bottom: 6,
                      width: 2,
                      background: 'var(--nc-cy)',
                      boxShadow: '0 0 10px var(--nc-cy)',
                    }}
                  />
                </>
              )}

              <button
                onClick={() => (current ? togglePlayPause() : play(index))}
                aria-label={playing ? `Pause ${track.name}` : `Play ${track.name}`}
                style={{
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 26,
                  height: 26,
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  cursor: 'pointer',
                }}
              >
                <span
                  className="nc-mono"
                  style={{
                    position: 'absolute',
                    fontSize: 12,
                    color: 'var(--nc-dim)',
                    opacity: playing ? 0 : 1,
                  }}
                >
                  {String(index + 1).padStart(2, '0')}
                </span>
                <EqBars opacity={playing ? 1 : 0} />
              </button>

              {canEdit && !isMobile && (
                <span
                  style={{ position: 'relative', color: 'var(--nc-faint)', cursor: 'grab' }}
                  title="Drag to reorder"
                >
                  <Icon name="grip" size={14} />
                </span>
              )}

              <div style={{ position: 'relative', minWidth: 0 }}>
                {editingTrackId === track.id ? (
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <input
                      className="nc-input"
                      // 16px on mobile: anything smaller makes iOS zoom the page on focus.
                      style={{ height: isMobile ? 34 : 30, fontSize: isMobile ? 16 : 13 }}
                      value={editingTrackName}
                      onChange={(e) => setEditingTrackName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && saveTrackName(track.id)}
                      // eslint-disable-next-line jsx-a11y/no-autofocus
                      autoFocus
                    />
                    <button
                      className="nc-btn nc-btn-accent nc-btn-icon"
                      style={{ width: 26, height: 26 }}
                      onClick={() => saveTrackName(track.id)}
                      title="Save"
                    >
                      <Icon name="check" size={13} />
                    </button>
                    <button
                      className="nc-btn nc-btn-icon"
                      style={{ width: 26, height: 26 }}
                      onClick={() => {
                        setEditingTrackId(null);
                        setEditingTrackName('');
                      }}
                      title="Cancel"
                    >
                      <Icon name="x" size={13} />
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                    <span
                      className={isMobile ? 'nc-clamp2' : 'nc-truncate'}
                      dir="auto"
                      style={{ fontSize: 14, lineHeight: isMobile ? 1.3 : undefined }}
                    >
                      {track.name}
                    </span>
                    <FreshnessMark track={track} />
                    {canEdit && (
                      <button
                        className="nc-btn nc-btn-ghost nc-btn-icon"
                        style={{ width: 22, height: 22 }}
                        onClick={() => {
                          setEditingTrackId(track.id);
                          setEditingTrackName(track.name);
                        }}
                        aria-label={`Rename ${track.name}`}
                      >
                        <Icon name="pencil" size={12} />
                      </button>
                    )}
                    {canEdit && isMobile && (
                      <button
                        className="nc-btn nc-btn-ghost nc-btn-icon"
                        style={{ width: 22, height: 22, color: 'var(--nc-faint)' }}
                        onClick={() => removeTrack(track.id)}
                        aria-label={`Remove ${track.name} from playlist`}
                      >
                        <Icon name="trash" size={12} />
                      </button>
                    )}
                  </div>
                )}
                {isMobile && (
                  <Waveform
                    seed={track.name}
                    kind="row"
                    progress={current ? progress : 0}
                    live={current}
                    height={24}
                    onSeek={(fraction) => (current ? seekToFraction(fraction) : play(index))}
                    ariaLabel={`Scrub ${track.name}`}
                    style={{ marginTop: 4 }}
                  />
                )}
              </div>

              {!isMobile && (
                <Waveform
                  seed={track.name}
                  kind="row"
                  progress={current ? progress : 0}
                  live={current}
                  height={30}
                  onSeek={(fraction) => (current ? seekToFraction(fraction) : play(index))}
                  ariaLabel={`Scrub ${track.name}`}
                  style={{ position: 'relative' }}
                />
              )}

              <span
                className="nc-mono"
                style={{
                  position: 'relative',
                  fontSize: 12,
                  color: 'var(--nc-muted)',
                  textAlign: 'right',
                }}
              >
                {track.duration || formatTime((track as Track).durationSeconds || 0)}
              </span>

              {canEdit && !isMobile && (
                <button
                  className="nc-btn nc-btn-ghost nc-btn-icon"
                  style={{ position: 'relative', width: 26, height: 26, color: 'var(--nc-faint)' }}
                  onClick={() => removeTrack(track.id)}
                  title="Remove from playlist"
                >
                  <Icon name="trash" size={14} />
                </button>
              )}
            </div>
          );
        })
      )}
    </div>
  );
};
