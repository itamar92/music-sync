import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Collection, Playlist, Track } from '../types';
import { calculatePlaylistDuration, formatTime } from '../utils/formatTime';
import { useAudioPlayerContext } from '../context/AudioPlayerContext';
import { usePlaylistTracks } from '../hooks/usePlaylistTracks';
import { Waveform } from '../components/nocturne/Waveform';
import { WaveMark, DisplayMark, CollectionGlyph } from '../components/nocturne/WaveMark';
import { EqBars } from '../components/nocturne/EqBars';
import { FreshnessMark } from '../components/nocturne/FreshnessMark';
import { Icon, IconName } from '../components/nocturne/icons';
import { MiniPlayer, NowPlayingSheet } from './MobilePlayer';
import { PublicLibrary } from './usePublicLibrary';

/**
 * The mobile public shell: a single scrolling column between a compact header
 * and a tab bar, with the mini player floating between the two.
 *
 * Everything sits inside a 430px-max column so the layout holds on a tablet in
 * portrait without stretching the line lengths.
 */

interface PublicMobileProps {
  library: PublicLibrary;
  /** The Dropbox connection pill; rendered in the header beside the mark. */
  syncBadge: React.ReactNode;
  /** Off inside a shared collection: the recipient has no studio to go to. */
  showStudioTab?: boolean;
  /**
   * What the playlist view's share button offers. Defaults to the playlist's
   * public URL; a shared collection overrides it with its own link, since the
   * playlist itself isn't reachable without the token.
   */
  playlistLink?: (playlist: Playlist) => string;
}

const label = (item: { displayName?: string; name: string }) => item.displayName || item.name;

const publicPlaylistLink = (playlist: Playlist) =>
  `${window.location.origin}/playlist/${playlist.id}`;

export const PublicMobile: React.FC<PublicMobileProps> = ({
  library,
  syncBadge,
  showStudioTab = true,
  playlistLink = publicPlaylistLink,
}) => {
  const navigate = useNavigate();
  const { expanded } = useAudioPlayerContext();

  return (
    <div
      className="nc-page"
      style={{
        position: 'relative',
        width: '100%',
        height: '100dvh',
        maxHeight: '100dvh',
        maxWidth: 430,
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <header
        style={{
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '14px 18px 10px',
        }}
      >
        <div
          onClick={library.goHome}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && library.goHome()}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 9,
            cursor: 'pointer',
            flex: 1,
            minWidth: 0,
          }}
        >
          <WaveMark height={20} />
          <span style={{ fontSize: 14, fontWeight: 500, letterSpacing: '0.02em' }}>MusicSync</span>
        </div>
        {syncBadge}
        <button
          className="nc-btn nc-btn-icon"
          style={{ width: 34, height: 34, borderRadius: 9 }}
          onClick={library.openSearch}
          aria-label="Search"
        >
          <Icon name="search" size={16} />
        </button>
      </header>

      <div className="nc-scroll" style={{ flex: 1, minHeight: 0, WebkitOverflowScrolling: 'touch' }}>
        {library.view === 'playlist' && library.selectedPlaylist ? (
          <MobilePlaylist
            playlist={library.selectedPlaylist}
            collection={library.selectedCollection}
            onBack={library.backToCollection}
            playlistLink={playlistLink}
          />
        ) : library.view === 'search' ? (
          <MobileSearch library={library} />
        ) : library.view === 'collection' && library.selectedCollection ? (
          <MobileCollection library={library} collection={library.selectedCollection} />
        ) : (
          <MobileHome library={library} />
        )}
      </div>

      <MiniPlayer />

      <nav
        style={{
          flexShrink: 0,
          display: 'grid',
          gridTemplateColumns: `repeat(${showStudioTab ? 3 : 2}, 1fr)`,
          borderTop: '1px solid var(--nc-line)',
          background: 'rgba(11,13,22,0.92)',
          backdropFilter: 'blur(14px)',
          padding: '6px 0 14px',
        }}
      >
        <Tab
          icon="home"
          text="Home"
          active={library.view !== 'search'}
          onClick={library.goHome}
        />
        <Tab
          icon="search"
          text="Search"
          active={library.view === 'search'}
          onClick={library.openSearch}
        />
        {showStudioTab && (
          <Tab icon="studio" text="Studio" active={false} onClick={() => navigate('/admin')} />
        )}
      </nav>

      {expanded && <NowPlayingSheet />}
    </div>
  );
};

const Tab: React.FC<{
  icon: IconName;
  text: string;
  active: boolean;
  onClick: () => void;
}> = ({ icon, text, active, onClick }) => (
  <button
    onClick={onClick}
    aria-current={active ? 'page' : undefined}
    style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 4,
      padding: '8px 0',
      background: 'none',
      border: 'none',
      cursor: 'pointer',
      color: active ? 'var(--nc-accent-text-bright)' : '#6b7288',
      fontFamily: 'inherit',
    }}
  >
    <Icon name={icon} size={21} />
    <span style={{ fontSize: 10.5, letterSpacing: '0.02em' }}>{text}</span>
  </button>
);

/* ── home ─────────────────────────────────────────────────────────────── */

const MobileHome: React.FC<{ library: PublicLibrary }> = ({ library }) => {
  const first = library.collections[0];

  return (
    <div style={{ padding: '6px 18px 24px' }}>
      <div style={{ position: 'relative', overflow: 'hidden', padding: '18px 0 26px' }}>
        <div
          style={{
            position: 'absolute',
            top: -70,
            left: -40,
            width: 340,
            height: 300,
            borderRadius: '50%',
            background:
              'radial-gradient(closest-side, rgba(34,184,214,0.20), rgba(31,111,196,0.10) 45%, transparent 72%)',
            filter: 'blur(18px)',
            pointerEvents: 'none',
            animation: 'ms-halo 6s ease-in-out infinite',
          }}
        />
        <div
          style={{
            position: 'absolute',
            top: 20,
            right: -90,
            width: 300,
            height: 260,
            borderRadius: '50%',
            background: 'radial-gradient(closest-side, rgba(61,13,96,0.34), transparent 70%)',
            filter: 'blur(24px)',
            pointerEvents: 'none',
            animation: 'ms-halo 7.5s ease-in-out 1s infinite',
          }}
        />

        <div style={{ position: 'relative' }}>
          <div style={{ marginBottom: 24 }}>
            <DisplayMark width={196} height={80} glowGround="rgba(15,17,32,0.95)" />
          </div>
          <h1
            style={{
              margin: '0 0 12px',
              fontSize: 32,
              fontWeight: 500,
              letterSpacing: '-0.03em',
              lineHeight: 1.08,
              textWrap: 'pretty',
            }}
          >
            Hear the newest version. Every time.
          </h1>
          <p
            style={{
              margin: '0 0 20px',
              fontSize: 14.5,
              lineHeight: 1.6,
              color: 'var(--nc-muted)',
              textWrap: 'pretty',
            }}
          >
            Bounce it to Dropbox and it lands here — waveform and all.
          </p>
          <button
            className="nc-btn nc-btn-play nc-btn-play-lg"
            style={{ height: 46, padding: '0 22px', fontSize: 14.5 }}
            onClick={() => first && library.selectCollection(first)}
            disabled={!first}
          >
            <Icon name="play" size={15} />
            Start listening
          </button>
        </div>
      </div>

      <div
        className="nc-mono"
        style={{ fontSize: 10, letterSpacing: '0.14em', color: 'var(--nc-dim)', margin: '6px 0 12px' }}
      >
        {library.loading
          ? 'LOADING LIBRARY…'
          : `${String(library.collections.length).padStart(2, '0')} COLLECTIONS · STREAMING FROM DROPBOX`}
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          margin: '16px 0 12px',
        }}
      >
        <h2 className="nc-section-title" style={{ fontSize: 11.5 }}>
          Collections
        </h2>
        <span className="nc-mono" style={{ fontSize: 11, color: 'var(--nc-dim)' }}>
          {String(library.collections.length).padStart(2, '0')}
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {!library.loading && library.collections.length === 0 && (
          <p style={{ fontSize: 13, color: 'var(--nc-mut)' }}>No collections published yet.</p>
        )}
        {library.collections.map((item) => (
          <button
            key={item.id}
            onClick={() => library.selectCollection(item)}
            className="nc-panel nc-panel-hover"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 13,
              padding: '12px 14px',
              borderRadius: 12,
              cursor: 'pointer',
              minHeight: 48,
              textAlign: 'left',
              fontFamily: 'inherit',
              color: 'var(--nc-text)',
            }}
          >
            <CollectionGlyph size={44} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="nc-truncate" style={{ fontSize: 14.5, fontWeight: 500 }}>
                {label(item)}
              </div>
              <div className="nc-truncate" style={{ fontSize: 12, color: 'var(--nc-mut)' }}>
                {item.description || 'Streaming from Dropbox'}
              </div>
            </div>
            <Icon name="caretRight" size={15} color="var(--nc-faint)" />
          </button>
        ))}
      </div>
    </div>
  );
};

/* ── collection ───────────────────────────────────────────────────────── */

const MobileCollection: React.FC<{ library: PublicLibrary; collection: Collection }> = ({
  library,
  collection,
}) => {
  const playlists = library.collectionPlaylists;
  const totalTracks = playlists.reduce((sum, p) => sum + (p.totalTracks || 0), 0);

  return (
    <div style={{ padding: '2px 18px 24px', animation: 'ms-rise 0.28s ease-out' }}>
      <button className="nc-link" style={{ padding: '6px 0 14px' }} onClick={library.goHome}>
        <Icon name="arrowLeft" size={15} />
        Collections
      </button>

      <div className="nc-kicker" style={{ fontSize: 10, marginBottom: 10 }}>
        Collection
      </div>
      <h1 className="nc-h1" style={{ fontSize: 28, marginBottom: 10, lineHeight: 1.12 }}>
        {label(collection)}
      </h1>
      {collection.description && (
        <p
          style={{
            margin: '0 0 16px',
            fontSize: 13.5,
            lineHeight: 1.6,
            color: 'var(--nc-mut)',
            textWrap: 'pretty',
          }}
        >
          {collection.description}
        </p>
      )}

      <button
        className="nc-btn nc-btn-play"
        style={{ height: 44, padding: '0 20px', fontSize: 14, marginBottom: 8 }}
        onClick={() => playlists[0] && library.openPlaylist(playlists[0])}
        disabled={!playlists.length}
      >
        <Icon name="play" size={14} />
        Play everything
      </button>

      <div
        className="nc-mono"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          fontSize: 10.5,
          color: 'var(--nc-dim)',
          marginBottom: 18,
        }}
      >
        <span>{playlists.length} PLAYLISTS</span>
        {totalTracks > 0 && <span>{totalTracks} TRACKS</span>}
      </div>

      <div className="nc-rule nc-rule-tight" style={{ marginBottom: 16 }} />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {library.loadingPlaylists && (
          <div style={{ padding: 24, display: 'flex', justifyContent: 'center' }}>
            <div className="nc-spinner" />
          </div>
        )}
        {!library.loadingPlaylists && playlists.length === 0 && (
          <p style={{ fontSize: 13, color: 'var(--nc-mut)' }}>No playlists in this collection.</p>
        )}
        {playlists.map((playlist, index) => (
          <button
            key={playlist.id}
            onClick={() => library.openPlaylist(playlist)}
            className="nc-panel nc-panel-hover"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 13,
              padding: '12px 14px',
              borderRadius: 12,
              cursor: 'pointer',
              minHeight: 48,
              textAlign: 'left',
              fontFamily: 'inherit',
              color: 'var(--nc-text)',
            }}
          >
            <span className="nc-mono" style={{ fontSize: 11.5, color: 'var(--nc-dim)' }}>
              {String(index + 1).padStart(2, '0')}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="nc-truncate" style={{ fontSize: 14.5, fontWeight: 500 }}>
                {label(playlist)}
              </div>
              <div
                className="nc-truncate"
                style={{ fontSize: 12, color: 'var(--nc-mut)', marginBottom: 6 }}
              >
                {playlist.description || playlist.folderPath || 'Synced folder'}
              </div>
              <Waveform seed={playlist.id + playlist.name} kind="playlist" height={18} />
            </div>
            <span className="nc-mono" style={{ fontSize: 11, color: 'var(--nc-muted)' }}>
              {playlist.totalTracks ?? ''}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
};

/* ── playlist ─────────────────────────────────────────────────────────── */

const MobilePlaylist: React.FC<{
  playlist: Playlist;
  collection: Collection | null;
  onBack: () => void;
  playlistLink: (playlist: Playlist) => string;
}> = ({ playlist, collection, onBack, playlistLink }) => {
  const { tracks, loading } = usePlaylistTracks(playlist);
  const { state, playFromPlaylist, togglePlayPause, progress, seekToFraction } =
    useAudioPlayerContext();

  const context = useMemo(
    () => ({
      playlistId: playlist.id,
      playlistName: label(playlist),
      collectionName: collection ? label(collection) : undefined,
    }),
    [playlist, collection]
  );

  const play = (index: number) => playFromPlaylist(tracks, index, context);
  const isThisPlaylist = state.currentTrack
    ? tracks.some((t) => t.id === state.currentTrack?.id)
    : false;

  const share = async () => {
    const url = playlistLink(playlist);
    if (navigator.share) {
      try {
        await navigator.share({ title: label(playlist), url });
        return;
      } catch {
        // Share sheet dismissed — fall through to the clipboard.
      }
    }
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      window.prompt('Copy this link', url);
    }
  };

  return (
    <div style={{ padding: '2px 0 24px', animation: 'ms-rise 0.28s ease-out' }}>
      <div style={{ padding: '0 18px' }}>
        <button className="nc-link" style={{ padding: '6px 0 14px' }} onClick={onBack}>
          <Icon name="arrowLeft" size={15} />
          {collection ? label(collection) : 'Back'}
        </button>

        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end', marginBottom: 18 }}>
          <div
            className="nc-art"
            style={{ width: 112, height: 112, borderRadius: 12, boxShadow: '0 14px 40px rgba(0,0,0,0.45)' }}
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
                  <Waveform seed={playlist.id + playlist.name} kind="cover" height={52} />
                </div>
                <span
                  className="nc-mono"
                  style={{
                    position: 'absolute',
                    top: 10,
                    left: 11,
                    fontSize: 9,
                    letterSpacing: '0.14em',
                    color: 'rgba(220,231,245,0.6)',
                  }}
                >
                  {tracks.length || ''}
                </span>
              </>
            )}
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="nc-kicker" style={{ fontSize: 10, marginBottom: 8 }}>
              Playlist
            </div>
            <h1
              style={{
                margin: '0 0 6px',
                fontSize: 22,
                fontWeight: 500,
                letterSpacing: '-0.02em',
                lineHeight: 1.15,
                textWrap: 'pretty',
              }}
            >
              {label(playlist)}
            </h1>
            <div className="nc-truncate" style={{ fontSize: 12.5, color: 'var(--nc-mut)' }}>
              {playlist.description || playlist.folderPath || 'Synced from Dropbox'}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <button
            className="nc-btn nc-btn-play"
            style={{ height: 44, padding: '0 22px', fontSize: 14 }}
            onClick={() => (isThisPlaylist ? togglePlayPause() : play(0))}
            disabled={!tracks.length}
          >
            <Icon name={isThisPlaylist && state.isPlaying ? 'pause' : 'play'} size={14} />
            {isThisPlaylist && state.isPlaying ? 'Pause' : 'Play'}
          </button>
          <button
            className="nc-btn"
            style={{ width: 44, height: 44, borderRadius: 999, padding: 0 }}
            onClick={share}
            aria-label="Share playlist link"
          >
            <Icon name="share" size={16} />
          </button>
          <span className="nc-mono" style={{ fontSize: 10.5, color: 'var(--nc-dim)' }}>
            {loading ? 'LOADING…' : `${tracks.length} · ${calculatePlaylistDuration(tracks)}`}
          </span>
        </div>
      </div>

      <div style={{ padding: '14px 8px 0', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {loading && (
          <div style={{ padding: 32, display: 'flex', justifyContent: 'center' }}>
            <div className="nc-spinner" />
          </div>
        )}
        {!loading && tracks.length === 0 && (
          <p style={{ padding: '32px 12px', fontSize: 13, color: 'var(--nc-mut)' }}>
            No tracks in this playlist.
          </p>
        )}
        {tracks.map((track, index) => (
          <MobileTrackRow
            key={track.id || index}
            track={track}
            index={index}
            current={state.currentTrack?.id === track.id}
            playing={state.currentTrack?.id === track.id && state.isPlaying}
            progress={state.currentTrack?.id === track.id ? progress : 0}
            onPlay={() => (state.currentTrack?.id === track.id ? togglePlayPause() : play(index))}
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

const MobileTrackRow: React.FC<{
  track: Track;
  index: number;
  current: boolean;
  playing: boolean;
  progress: number;
  onPlay: () => void;
  onSeek: (fraction: number) => void;
}> = ({ track, index, current, playing, progress, onPlay, onSeek }) => (
  <div
    className="nc-row-hover"
    style={{
      position: 'relative',
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: 10,
      borderRadius: 11,
      overflow: 'hidden',
      minHeight: 56,
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
        width: 30,
        height: 44,
        flexShrink: 0,
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
    <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
        <div
          onClick={onPlay}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && onPlay()}
          className="nc-truncate"
          style={{ fontSize: 13.5, color: 'var(--nc-text)', cursor: 'pointer' }}
        >
          {track.name}
        </div>
        <FreshnessMark track={track} />
      </div>
      <Waveform
        seed={track.name}
        kind="row"
        progress={progress}
        live={current}
        height={26}
        onSeek={onSeek}
        ariaLabel={`Scrub ${track.name}`}
        style={{ marginTop: 4 }}
      />
    </div>
    <span
      className="nc-mono"
      style={{ position: 'relative', fontSize: 11.5, color: 'var(--nc-muted)' }}
    >
      {track.duration || formatTime(track.durationSeconds || 0)}
    </span>
  </div>
);

/* ── search ───────────────────────────────────────────────────────────── */

const MobileSearch: React.FC<{ library: PublicLibrary }> = ({ library }) => {
  const needle = library.search.trim().toLowerCase();

  const playlistMatches = useMemo(() => {
    if (!needle) return library.allPlaylists.slice(0, 8);
    return library.allPlaylists
      .filter((item) => label(item).toLowerCase().includes(needle))
      .slice(0, 12);
  }, [library.allPlaylists, needle]);

  return (
    <div style={{ padding: '2px 18px 24px', animation: 'ms-rise 0.28s ease-out' }}>
      <div className="nc-search" style={{ height: 44, borderRadius: 11, marginBottom: 20 }}>
        <Icon name="search" size={15} color="var(--nc-mut)" />
        <input
          type="text"
          value={library.search}
          onChange={(e) => library.setSearch(e.target.value)}
          placeholder="Search collections and playlists"
          aria-label="Search"
          style={{ fontSize: 14 }}
          // eslint-disable-next-line jsx-a11y/no-autofocus
          autoFocus
        />
      </div>

      {library.filteredCollections.length > 0 && (
        <>
          <h2 className="nc-section-title" style={{ fontSize: 11.5, marginBottom: 12 }}>
            Collections
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginBottom: 22 }}>
            {library.filteredCollections.map((item) => (
              <button
                key={item.id}
                onClick={() => library.selectCollection(item)}
                className="nc-row-hover"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: 10,
                  borderRadius: 11,
                  minHeight: 52,
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontFamily: 'inherit',
                  color: 'var(--nc-text)',
                }}
              >
                <CollectionGlyph size={38} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="nc-truncate" style={{ fontSize: 13.5 }}>
                    {label(item)}
                  </div>
                  <div
                    className="nc-truncate nc-mono"
                    style={{ fontSize: 10.5, color: 'var(--nc-dim)' }}
                  >
                    COLLECTION
                  </div>
                </div>
                <Icon name="caretRight" size={14} color="var(--nc-faint)" />
              </button>
            ))}
          </div>
        </>
      )}

      <h2 className="nc-section-title" style={{ fontSize: 11.5, marginBottom: 12 }}>
        {needle ? 'Playlists' : 'Recently synced'}
      </h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {playlistMatches.length === 0 && (
          <p style={{ fontSize: 13, color: 'var(--nc-mut)' }}>
            {needle ? 'Nothing matches that.' : 'Nothing synced yet.'}
          </p>
        )}
        {playlistMatches.map((item) => (
          <button
            key={item.id}
            onClick={() => library.openPlaylist(item)}
            className="nc-row-hover"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: 10,
              borderRadius: 11,
              minHeight: 52,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              textAlign: 'left',
              fontFamily: 'inherit',
              color: 'var(--nc-text)',
            }}
          >
            <div className="nc-art" style={{ width: 38, height: 38, borderRadius: 8 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="nc-truncate" style={{ fontSize: 13.5 }}>
                {label(item)}
              </div>
              <div
                className="nc-truncate nc-mono"
                style={{ fontSize: 10.5, color: 'var(--nc-dim)' }}
              >
                {(item.folderPath || 'PLAYLIST').toUpperCase()}
              </div>
            </div>
            <span className="nc-mono" style={{ fontSize: 11, color: 'var(--nc-dim)' }}>
              {item.totalTracks ?? ''}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
};
