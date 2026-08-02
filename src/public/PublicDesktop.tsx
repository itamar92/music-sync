import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Collection, Playlist, Track } from '../types';
import { calculatePlaylistDuration, formatTime } from '../utils/formatTime';
import { useAudioPlayerContext } from '../context/AudioPlayerContext';
import { usePlaylistTracks } from '../hooks/usePlaylistTracks';
import { Waveform } from '../components/nocturne/Waveform';
import { WaveMark, DisplayMark, CollectionGlyph } from '../components/nocturne/WaveMark';
import { EqBars } from '../components/nocturne/EqBars';
import { FreshnessMark } from '../components/nocturne/FreshnessMark';
import { Icon } from '../components/nocturne/icons';
import { TransportBar, NowPlayingOverlay } from './TransportBar';
import { PublicLibrary } from './usePublicLibrary';

/**
 * The desktop public shell: header, collections rail, main pane, transport.
 *
 * The whole thing is a fixed-height flex column that never scrolls as a page —
 * only the rail and the main pane scroll — so the transport stays put and the
 * waveform in it keeps its width.
 */

interface PublicDesktopProps {
  library: PublicLibrary;
  /** Rendered into the header's right cluster (sync badge, auth buttons). */
  headerActions: React.ReactNode;
  /**
   * What the playlist view's Share button copies. Defaults to the playlist's
   * public URL; a shared collection overrides it with its own link, since the
   * playlist itself isn't reachable without the token.
   */
  playlistLink?: (playlist: Playlist) => string;
}

const label = (item: { displayName?: string; name: string }) => item.displayName || item.name;

const publicPlaylistLink = (playlist: Playlist) =>
  `${window.location.origin}/playlist/${playlist.id}`;

export const PublicDesktop: React.FC<PublicDesktopProps> = ({
  library,
  headerActions,
  playlistLink = publicPlaylistLink,
}) => {
  const { expanded } = useAudioPlayerContext();
  const searchRef = useRef<HTMLInputElement>(null);

  // ⌘K / Ctrl-K focuses search, as the header hint promises.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <div
      className="nc-page"
      style={{
        position: 'relative',
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 20,
          padding: '0 20px',
          height: 58,
          flexShrink: 0,
          borderBottom: '1px solid var(--nc-line)',
          background: 'rgba(16,18,32,0.7)',
          backdropFilter: 'blur(10px)',
        }}
      >
        <div
          onClick={library.goHome}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && library.goHome()}
          title="Back to home"
          style={{ display: 'flex', alignItems: 'center', gap: 11, cursor: 'pointer' }}
        >
          <WaveMark height={24} />
          <span style={{ fontSize: 14, fontWeight: 500, letterSpacing: '0.02em' }}>MusicSync</span>
        </div>

        <div className="nc-search" style={{ width: 280 }}>
          <Icon name="search" size={14} color="var(--nc-mut)" />
          <input
            ref={searchRef}
            type="text"
            value={library.search}
            onChange={(e) => library.setSearch(e.target.value)}
            placeholder="Search collections"
            aria-label="Search collections"
          />
          <span className="nc-kbd">⌘K</span>
        </div>

        <div style={{ flex: 1 }} />
        {headerActions}
      </header>

      <div style={{ flex: 1, minHeight: 0, display: 'flex', gap: 1, background: 'var(--nc-line)' }}>
        <CollectionsRail library={library} />

        <main
          style={{
            flex: 1,
            minWidth: 0,
            background: 'var(--nc-bg)',
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            minHeight: 0,
          }}
        >
          {library.view === 'playlist' && library.selectedPlaylist ? (
            <PlaylistPane
              playlist={library.selectedPlaylist}
              collection={library.selectedCollection}
              onBack={library.backToCollection}
              playlistLink={playlistLink}
            />
          ) : library.view === 'collection' && library.selectedCollection ? (
            <CollectionPane library={library} collection={library.selectedCollection} />
          ) : (
            <HeroPane library={library} />
          )}

          {expanded && <NowPlayingOverlay />}
        </main>
      </div>

      <TransportBar />
    </div>
  );
};

/* ── collections rail ─────────────────────────────────────────────────── */

const CollectionsRail: React.FC<{ library: PublicLibrary }> = ({ library }) => (
  <aside
    style={{
      width: 296,
      flexShrink: 0,
      background: 'var(--nc-bg)',
      display: 'flex',
      flexDirection: 'column',
      minHeight: 0,
    }}
  >
    <div
      style={{
        padding: '18px 18px 12px',
        display: 'flex',
        alignItems: 'baseline',
        justifyContent: 'space-between',
      }}
    >
      <h2 className="nc-section-title">Collections</h2>
      <span className="nc-mono" style={{ fontSize: 11, color: 'var(--nc-dim)' }}>
        {String(library.collections.length).padStart(2, '0')}
      </span>
    </div>

    <div style={{ padding: '0 12px 12px' }}>
      <div className="nc-search" style={{ height: 30, borderRadius: 7 }}>
        <Icon name="search" size={13} color="var(--nc-mut)" />
        <input
          type="text"
          value={library.search}
          onChange={(e) => library.setSearch(e.target.value)}
          placeholder="Filter"
          aria-label="Filter collections"
          style={{ fontSize: 12 }}
        />
      </div>
    </div>

    <div
      className="nc-scroll"
      style={{
        flex: 1,
        minHeight: 0,
        padding: '0 12px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
      }}
    >
      {library.filteredCollections.length === 0 && !library.loading && (
        <p style={{ padding: '10px 12px', fontSize: 12.5, color: 'var(--nc-dim)' }}>
          {library.collections.length ? 'Nothing matches that filter.' : 'No collections yet.'}
        </p>
      )}

      {library.filteredCollections.map((item) => {
        const selected = library.selectedCollection?.id === item.id;
        return (
          <div
            key={item.id}
            onClick={() => library.selectCollection(item)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && library.selectCollection(item)}
            className="nc-row-hover"
            style={{
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              gap: 11,
              padding: '9px 10px 9px 12px',
              borderRadius: 8,
              cursor: 'pointer',
              overflow: 'hidden',
            }}
          >
            {selected && (
              <>
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    background:
                      'linear-gradient(90deg, rgba(34,184,214,0.16), rgba(61,13,96,0.10))',
                  }}
                />
                <div
                  style={{
                    position: 'absolute',
                    left: 0,
                    top: 8,
                    bottom: 8,
                    width: 2,
                    borderRadius: 2,
                    background: 'var(--nc-cy)',
                    boxShadow: '0 0 10px var(--nc-cy)',
                  }}
                />
              </>
            )}
            <CollectionCover collection={item} size={34} />
            <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
              <div
                className="nc-truncate"
                style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--nc-text)' }}
              >
                {label(item)}
              </div>
              <div className="nc-truncate" style={{ fontSize: 11.5, color: 'var(--nc-mut)' }}>
                {item.description || 'Streaming from Dropbox'}
              </div>
            </div>
          </div>
        );
      })}
    </div>

    <div
      style={{
        borderTop: '1px solid var(--nc-line)',
        padding: '12px 18px',
        display: 'flex',
        alignItems: 'center',
        gap: 9,
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#6f63b4' }} />
      <span style={{ fontSize: 11.5, color: 'var(--nc-mut)' }}>
        Everything here streams from Dropbox.
      </span>
    </div>
  </aside>
);

/** Real artwork when the record has it, the generated glyph when it doesn't. */
const CollectionCover: React.FC<{ collection: Collection | Playlist; size: number }> = ({
  collection,
  size,
}) =>
  collection.coverImageUrl ? (
    <img
      src={collection.coverImageUrl}
      alt=""
      style={{
        position: 'relative',
        width: size,
        height: size,
        borderRadius: size * 0.2,
        objectFit: 'cover',
        flexShrink: 0,
        border: '1px solid var(--nc-line)',
      }}
    />
  ) : (
    <div style={{ position: 'relative' }}>
      <CollectionGlyph size={size} />
    </div>
  );

/* ── hero ─────────────────────────────────────────────────────────────── */

const HeroPane: React.FC<{ library: PublicLibrary }> = ({ library }) => {
  const first = library.collections[0];

  return (
    <div
      className="nc-scroll"
      style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', width: '100%' }}
    >
      <div style={{ position: 'relative', overflow: 'hidden', width: '100%', padding: '0 40px 40px' }}>
        <div
          style={{
            position: 'absolute',
            top: -40,
            left: 60,
            width: 680,
            height: 520,
            borderRadius: '50%',
            background:
              'radial-gradient(closest-side, rgba(34,184,214,0.18), rgba(31,111,196,0.09) 45%, transparent 72%)',
            filter: 'blur(20px)',
            pointerEvents: 'none',
            animation: 'ms-halo 6s ease-in-out infinite',
          }}
        />
        <div
          style={{
            position: 'absolute',
            top: 4,
            left: 380,
            width: 622,
            height: 456,
            borderRadius: '50%',
            background: 'radial-gradient(closest-side, rgba(61,13,96,0.30), transparent 70%)',
            filter: 'blur(28px)',
            pointerEvents: 'none',
            animation: 'ms-halo 7.5s ease-in-out 1s infinite',
          }}
        />

        <div
          style={{
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            gap: 30,
            maxWidth: 720,
          }}
        >
          <DisplayMark width={340} height={136} />

          <div>
            <h1
              style={{
                margin: '0 0 14px',
                fontSize: 52,
                fontWeight: 500,
                letterSpacing: '-0.03em',
                lineHeight: 1.04,
                textWrap: 'pretty',
              }}
            >
              Hear the newest version.
              <br />
              Every time.
            </h1>
            <p
              style={{
                margin: 0,
                fontSize: 16,
                lineHeight: 1.6,
                color: 'var(--nc-muted)',
                maxWidth: 520,
                textWrap: 'pretty',
              }}
            >
              Bounce it to Dropbox and it shows up here — waveform and all. One link, always
              current, for the people who need to hear it.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <button
              className="nc-btn nc-btn-play nc-btn-play-lg"
              onClick={() => first && library.selectCollection(first)}
              disabled={!first}
            >
              <Icon name="play" size={15} />
              Start listening
            </button>
            <span
              className="nc-mono"
              style={{ fontSize: 11.5, letterSpacing: '0.06em', color: 'var(--nc-dim)' }}
            >
              {library.loading
                ? 'LOADING LIBRARY…'
                : `${String(library.collections.length).padStart(2, '0')} COLLECTIONS · STREAMING FROM DROPBOX`}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ── collection ───────────────────────────────────────────────────────── */

const CollectionPane: React.FC<{ library: PublicLibrary; collection: Collection }> = ({
  library,
  collection,
}) => {
  const playlists = library.collectionPlaylists;
  const totalTracks = playlists.reduce((sum, p) => sum + (p.totalTracks || 0), 0);

  return (
    <div className="nc-scroll" style={{ flex: 1, minHeight: 0 }}>
      <div style={{ padding: '34px 40px 18px' }}>
        <div className="nc-kicker" style={{ marginBottom: 12 }}>
          Collection
        </div>
        <h1 className="nc-h1" style={{ marginBottom: 10 }}>
          {label(collection)}
        </h1>
        {collection.description && (
          <p
            style={{
              margin: '0 0 18px',
              fontSize: 14.5,
              color: 'var(--nc-mut)',
              maxWidth: 560,
              textWrap: 'pretty',
            }}
          >
            {collection.description}
          </p>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <button
            className="nc-btn nc-btn-play"
            onClick={() => playlists[0] && library.openPlaylist(playlists[0])}
            disabled={!playlists.length}
          >
            <Icon name="play" size={15} />
            Play everything
          </button>
          <div
            className="nc-mono"
            style={{ display: 'flex', alignItems: 'center', gap: 22, fontSize: 11.5, color: 'var(--nc-dim)' }}
          >
            <span>{playlists.length} PLAYLISTS</span>
            {totalTracks > 0 && <span>{totalTracks} TRACKS</span>}
          </div>
        </div>
      </div>

      <div className="nc-rule" style={{ margin: '0 40px' }} />

      <div style={{ padding: '22px 40px 40px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div
          className="nc-mono"
          style={{
            display: 'grid',
            gridTemplateColumns: '38px 1fr 220px 92px 40px',
            alignItems: 'center',
            gap: 16,
            padding: '0 12px 8px',
            fontSize: 10.5,
            letterSpacing: '0.12em',
            color: 'var(--nc-dim)',
          }}
        >
          <span>#</span>
          <span>PLAYLIST</span>
          <span>SHAPE</span>
          <span style={{ textAlign: 'right' }}>TRACKS</span>
          <span />
        </div>

        {library.loadingPlaylists && (
          <div style={{ padding: '28px 12px', display: 'flex', justifyContent: 'center' }}>
            <div className="nc-spinner" />
          </div>
        )}

        {!library.loadingPlaylists && playlists.length === 0 && (
          <p style={{ padding: '28px 12px', fontSize: 13.5, color: 'var(--nc-mut)' }}>
            No playlists in this collection yet.
          </p>
        )}

        {playlists.map((playlist, index) => (
          <div
            key={playlist.id}
            onClick={() => library.openPlaylist(playlist)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && library.openPlaylist(playlist)}
            className="nc-panel nc-panel-hover"
            style={{
              position: 'relative',
              display: 'grid',
              gridTemplateColumns: '38px 1fr 220px 92px 40px',
              alignItems: 'center',
              gap: 16,
              padding: '13px 12px',
              cursor: 'pointer',
              overflow: 'hidden',
            }}
          >
            <span className="nc-mono" style={{ fontSize: 12, color: 'var(--nc-dim)' }}>
              {String(index + 1).padStart(2, '0')}
            </span>
            <div style={{ minWidth: 0 }}>
              <div
                className="nc-truncate"
                style={{ fontSize: 14.5, fontWeight: 500, color: 'var(--nc-text)' }}
              >
                {label(playlist)}
              </div>
              <div className="nc-truncate" style={{ fontSize: 12, color: 'var(--nc-mut)' }}>
                {playlist.description || playlist.folderPath || 'Synced folder'}
              </div>
            </div>
            <Waveform seed={playlist.id + playlist.name} kind="playlist" height={26} />
            <span
              className="nc-mono"
              style={{ fontSize: 12, color: 'var(--nc-muted)', textAlign: 'right' }}
            >
              {playlist.totalTracks ?? '—'}
            </span>
            <div style={{ display: 'flex', justifyContent: 'flex-end', color: 'var(--nc-dim)' }}>
              <Icon name="caretRight" size={16} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

/* ── playlist ─────────────────────────────────────────────────────────── */

const PlaylistPane: React.FC<{
  playlist: Playlist;
  collection: Collection | null;
  onBack: () => void;
  playlistLink: (playlist: Playlist) => string;
}> = ({ playlist, collection, onBack, playlistLink }) => {
  const { tracks, loading, error, reload, canSync } = usePlaylistTracks(playlist);
  const { state, playFromPlaylist, togglePlayPause, progress, seekToFraction, setContext } =
    useAudioPlayerContext();
  const [syncing, setSyncing] = useState(false);

  const context = useMemo(
    () => ({
      playlistId: playlist.id,
      playlistName: label(playlist),
      collectionName: collection ? label(collection) : undefined,
    }),
    [playlist, collection]
  );

  const totalDuration = calculatePlaylistDuration(tracks);
  const isThisPlaylist = state.currentTrack
    ? tracks.some((t) => t.id === state.currentTrack?.id)
    : false;

  const play = (index: number) => playFromPlaylist(tracks, index, context);

  const share = async () => {
    const url = playlistLink(playlist);
    try {
      await navigator.clipboard.writeText(url);
      setContext(context);
    } catch {
      window.prompt('Copy this link', url);
    }
  };

  // Anyone can ask for a re-pull; the backend applies a per-folder cooldown, so
  // a bored visitor holding the button down costs one Dropbox call a minute.
  const sync = async () => {
    setSyncing(true);
    try {
      await reload(true);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="nc-scroll" style={{ flex: 1, minHeight: 0 }}>
      <div style={{ padding: '22px 40px 0' }}>
        <button className="nc-link" onClick={onBack}>
          <Icon name="arrowLeft" size={15} />
          {collection ? label(collection) : 'Back'}
        </button>
      </div>

      <div style={{ display: 'flex', gap: 28, alignItems: 'flex-end', padding: '22px 40px 26px' }}>
        <div
          className="nc-art"
          style={{ width: 168, height: 168, borderRadius: 12, boxShadow: 'var(--nc-shadow-md)' }}
        >
          {playlist.coverImageUrl ? (
            <img
              src={playlist.coverImageUrl}
              alt=""
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            <>
              <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0 }}>
                <Waveform seed={playlist.id + playlist.name} kind="cover" height={78} />
              </div>
              <span
                className="nc-mono"
                style={{
                  position: 'absolute',
                  top: 12,
                  left: 14,
                  fontSize: 10,
                  letterSpacing: '0.14em',
                  color: 'rgba(220,231,245,0.6)',
                }}
              >
                {tracks.length ? `${tracks.length} TRACKS` : 'PLAYLIST'}
              </span>
            </>
          )}
        </div>

        <div style={{ minWidth: 0 }}>
          <div className="nc-kicker" style={{ marginBottom: 10 }}>
            Playlist
          </div>
          <h1 className="nc-h1" style={{ fontSize: 42, marginBottom: 8, lineHeight: 1.05 }}>
            {label(playlist)}
          </h1>
          <p style={{ margin: '0 0 14px', fontSize: 14, color: 'var(--nc-mut)' }}>
            {playlist.description || playlist.folderPath || 'Synced from Dropbox'}
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <button
              className="nc-btn nc-btn-play"
              onClick={() => (isThisPlaylist ? togglePlayPause() : play(0))}
              disabled={!tracks.length}
            >
              <Icon name={isThisPlaylist && state.isPlaying ? 'pause' : 'play'} size={15} />
              {isThisPlaylist && state.isPlaying ? 'Pause' : 'Play'}
            </button>
            <button className="nc-btn" style={{ height: 38, borderRadius: 999 }} onClick={share}>
              <Icon name="share" size={15} />
              Share link
            </button>
            {canSync && (
              <button
                className="nc-btn"
                style={{ height: 38, borderRadius: 999 }}
                onClick={sync}
                disabled={syncing || loading}
                title="Check Dropbox for newer versions of these files"
              >
                <Icon
                  name="refresh"
                  size={15}
                  style={syncing ? { animation: 'ms-spin 0.8s linear infinite' } : undefined}
                />
                {syncing ? 'Syncing…' : 'Sync'}
              </button>
            )}
            <span className="nc-mono" style={{ fontSize: 11.5, color: 'var(--nc-dim)' }}>
              {loading ? 'LOADING…' : `${tracks.length} TRACKS · ${totalDuration}`}
            </span>
          </div>
        </div>
      </div>

      <div style={{ padding: '0 40px 46px' }}>
        {error && (
          <p className="nc-tag nc-tag-danger" style={{ marginBottom: 16 }} role="status">
            <Icon name="warning" size={13} />
            {error}
          </p>
        )}

        <div
          className="nc-mono"
          style={{
            display: 'grid',
            gridTemplateColumns: '44px 1fr 1.35fr 74px',
            alignItems: 'center',
            gap: 18,
            padding: '0 14px 9px',
            fontSize: 10.5,
            letterSpacing: '0.12em',
            color: 'var(--nc-dim)',
            borderBottom: '1px solid var(--nc-line)',
          }}
        >
          <span>#</span>
          <span>TITLE</span>
          <span>WAVEFORM · CLICK TO SCRUB</span>
          <span style={{ textAlign: 'right' }}>TIME</span>
        </div>

        {loading && (
          <div style={{ padding: 40, display: 'flex', justifyContent: 'center' }}>
            <div className="nc-spinner" />
          </div>
        )}

        {!loading && tracks.length === 0 && (
          <p style={{ padding: '40px 14px', fontSize: 13.5, color: 'var(--nc-mut)' }}>
            No tracks in this playlist.
          </p>
        )}

        {tracks.map((track, index) => (
          <TrackRow
            key={track.id || index}
            track={track}
            index={index}
            current={state.currentTrack?.id === track.id}
            playing={state.currentTrack?.id === track.id && state.isPlaying}
            progress={state.currentTrack?.id === track.id ? progress : 0}
            onPlay={() =>
              state.currentTrack?.id === track.id ? togglePlayPause() : play(index)
            }
            onSeek={(fraction) => {
              if (state.currentTrack?.id !== track.id) play(index);
              else seekToFraction(fraction);
            }}
          />
        ))}
      </div>
    </div>
  );
};

interface TrackRowProps {
  track: Track;
  index: number;
  current: boolean;
  playing: boolean;
  progress: number;
  onPlay: () => void;
  onSeek: (fraction: number) => void;
}

const TrackRow: React.FC<TrackRowProps> = ({
  track,
  index,
  current,
  playing,
  progress,
  onPlay,
  onSeek,
}) => (
  <div
    className="nc-row-hover"
    style={{
      position: 'relative',
      display: 'grid',
      gridTemplateColumns: '44px 1fr 1.35fr 74px',
      alignItems: 'center',
      gap: 18,
      padding: '11px 14px',
      borderRadius: 9,
      overflow: 'hidden',
    }}
  >
    {current && (
      <>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(90deg, rgba(34,184,214,0.10), rgba(61,13,96,0.06))',
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
      onClick={onPlay}
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
          transition: 'opacity 0.15s ease',
        }}
      >
        {String(index + 1).padStart(2, '0')}
      </span>
      <EqBars opacity={playing ? 1 : 0} />
    </button>

    <div
      onClick={onPlay}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onPlay()}
      style={{ position: 'relative', minWidth: 0, cursor: 'pointer' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
        <span className="nc-truncate" style={{ fontSize: 14, color: 'var(--nc-text)' }}>
          {track.name}
        </span>
        <FreshnessMark track={track} />
      </div>
      <div
        className="nc-truncate nc-mono"
        style={{ fontSize: 11, color: 'var(--nc-dim)' }}
      >
        {track.artist && track.artist !== 'Unknown Artist' ? track.artist : track.path || ''}
      </div>
    </div>

    <Waveform
      seed={track.name}
      kind="row"
      progress={progress}
      live={current}
      height={34}
      onSeek={onSeek}
      ariaLabel={`Scrub ${track.name}`}
      style={{ position: 'relative' }}
    />

    <span
      className="nc-mono"
      style={{ position: 'relative', fontSize: 12, color: 'var(--nc-muted)', textAlign: 'right' }}
    >
      {track.duration || formatTime(track.durationSeconds || 0)}
    </span>
  </div>
);
