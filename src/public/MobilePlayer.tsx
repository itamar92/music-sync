import React, { useState } from 'react';
import { formatTime } from '../utils/formatTime';
import { useAudioPlayerContext } from '../context/AudioPlayerContext';
import { Waveform } from '../components/nocturne/Waveform';
import { Icon } from '../components/nocturne/icons';
import { QueueRow } from './TransportBar';

/**
 * The mobile mini player and the sheet it opens into.
 *
 * The mini player is a floating card rather than an edge-to-edge bar — it sits
 * above the tab bar with the page scrolling behind it, and carries the progress
 * as a 2px hairline along its top edge.
 */

const CENTER = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
} as const;

export const MiniPlayer: React.FC = () => {
  const { state, context, hasTrack, progress, togglePlayPause, playNext, setExpanded } =
    useAudioPlayerContext();

  if (!hasTrack) return null;

  const subtitle = [context.playlistName, context.collectionName].filter(Boolean).join(' · ');

  return (
    <div
      onClick={() => setExpanded(true)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && setExpanded(true)}
      style={{
        flexShrink: 0,
        position: 'relative',
        margin: '0 10px 6px',
        borderRadius: 14,
        border: '1px solid var(--nc-line)',
        background: 'rgba(23,26,41,0.94)',
        backdropFilter: 'blur(14px)',
        boxShadow: 'var(--nc-shadow-sm)',
        overflow: 'hidden',
        cursor: 'pointer',
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          height: 2,
          width: `${progress * 100}%`,
          background: 'linear-gradient(90deg, var(--nc-cy), var(--nc-bl), #7a4fb5)',
        }}
      />
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px' }}>
        <div className="nc-art" style={{ width: 42, height: 42, borderRadius: 9 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="nc-truncate" dir="auto" style={{ fontSize: 13, fontWeight: 500 }}>
            {state.currentTrack?.name}
          </div>
          <div
            className="nc-truncate nc-mono"
            dir="auto"
            style={{ fontSize: 10.5, color: 'var(--nc-mut)' }}
          >
            {subtitle}
          </div>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            togglePlayPause();
          }}
          aria-label={state.isPlaying ? 'Pause' : 'Play'}
          style={{
            width: 44,
            height: 44,
            flexShrink: 0,
            borderRadius: '50%',
            ...CENTER,
            background: 'transparent',
            border: '1px solid rgba(34,199,214,0.55)',
            color: 'var(--nc-accent-text-bright)',
            cursor: 'pointer',
          }}
        >
          <Icon
            name={state.isPlaying ? 'pause' : 'play'}
            size={16}
            style={state.isPlaying ? undefined : { marginLeft: 2 }}
          />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            playNext();
          }}
          aria-label="Next track"
          style={{
            width: 40,
            height: 44,
            flexShrink: 0,
            ...CENTER,
            background: 'none',
            border: 'none',
            color: 'var(--nc-muted)',
            cursor: 'pointer',
          }}
        >
          <Icon name="next" size={17} />
        </button>
      </div>
    </div>
  );
};

/**
 * The full-screen now-playing sheet. Two faces — the player and the queue —
 * toggled by the list button in its header.
 */
export const NowPlayingSheet: React.FC = () => {
  const {
    state,
    playlist,
    context,
    progress,
    seekToFraction,
    togglePlayPause,
    playNext,
    playPrevious,
    playTrackFromPlaylist,
    setExpanded,
  } = useAudioPlayerContext();

  const [queueOpen, setQueueOpen] = useState(false);
  const track = state.currentTrack;
  if (!track) return null;

  const remaining = Math.max(0, state.duration - state.currentTime);

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 30,
        background: 'linear-gradient(180deg, #141930 0%, #0c0e1c 100%)',
        display: 'flex',
        flexDirection: 'column',
        animation: 'ms-sheet 0.3s cubic-bezier(0.2,0.8,0.2,1)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 18px',
        }}
      >
        <button
          className="nc-btn nc-btn-icon"
          style={{ width: 40, height: 40, borderRadius: 10 }}
          onClick={() => {
            setExpanded(false);
            setQueueOpen(false);
          }}
          aria-label="Close now playing"
        >
          <Icon name="caretDown" size={17} />
        </button>
        <span
          className="nc-kicker nc-truncate"
          dir="auto"
          style={{ flex: 1, minWidth: 0, textAlign: 'center', padding: '0 10px', fontSize: 10 }}
        >
          {context.collectionName || context.playlistName || 'Now playing'}
        </span>
        <button
          className="nc-btn nc-btn-icon"
          style={{
            width: 40,
            height: 40,
            borderRadius: 10,
            color: queueOpen ? 'var(--nc-accent-text-bright)' : 'var(--nc-text-soft)',
          }}
          onClick={() => setQueueOpen((open) => !open)}
          aria-label={queueOpen ? 'Show player' : 'Show queue'}
          aria-pressed={queueOpen}
        >
          <Icon name="list" size={17} />
        </button>
      </div>

      {queueOpen ? (
        <div
          style={{
            flex: 1,
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
            padding: '0 14px 24px',
          }}
        >
          <div className="nc-kicker" style={{ padding: '6px 8px 12px', fontSize: 10 }}>
            Up next{context.playlistName ? ` · ${context.playlistName}` : ''}
          </div>
          <div
            className="nc-scroll"
            style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 2 }}
          >
            {playlist.map((item, index) => (
              <QueueRow
                key={item.id || index}
                index={index}
                name={item.name}
                duration={item.duration}
                current={index === state.currentTrackIndex}
                onPlay={() => playTrackFromPlaylist(item, index)}
              />
            ))}
          </div>
        </div>
      ) : (
        <div
          style={{
            flex: 1,
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            gap: 26,
            padding: '0 22px 24px',
          }}
        >
          <div
            className="nc-art"
            style={{
              width: '100%',
              aspectRatio: '1 / 1',
              maxHeight: 300,
              borderRadius: 18,
              boxShadow: '0 24px 60px rgba(0,0,0,0.5)',
            }}
          >
            <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0 }}>
              <Waveform
                seed={context.playlistName || track.name}
                kind="cover"
                height={120}
              />
            </div>
          </div>

          <div>
            <h1
              dir="auto"
              style={{
                margin: '0 0 6px',
                fontSize: 23,
                fontWeight: 500,
                letterSpacing: '-0.02em',
                lineHeight: 1.2,
                textWrap: 'pretty',
                overflowWrap: 'anywhere',
              }}
            >
              {track.name}
            </h1>
            <div dir="auto" style={{ fontSize: 13.5, color: 'var(--nc-mut)' }}>
              {[context.playlistName, context.collectionName].filter(Boolean).join(' · ')}
            </div>
          </div>

          <div>
            <Waveform
              seed={track.name}
              kind="hero"
              progress={progress}
              live
              height={72}
              onSeek={seekToFraction}
              ariaLabel="Seek within track"
            />
            <div
              className="nc-mono"
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginTop: 8,
                fontSize: 11,
                color: 'var(--nc-dim)',
              }}
            >
              <span>{formatTime(state.currentTime)}</span>
              <span>-{formatTime(remaining)}</span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 28 }}>
            <button
              onClick={playPrevious}
              aria-label="Previous track"
              style={{
                width: 52,
                height: 52,
                ...CENTER,
                background: 'none',
                border: 'none',
                color: 'var(--nc-muted)',
                cursor: 'pointer',
              }}
            >
              <Icon name="prev" size={24} />
            </button>
            <button
              onClick={togglePlayPause}
              aria-label={state.isPlaying ? 'Pause' : 'Play'}
              style={{
                width: 68,
                height: 68,
                borderRadius: '50%',
                ...CENTER,
                background: 'transparent',
                border: '1px solid rgba(34,199,214,0.55)',
                color: 'var(--nc-accent-text-bright)',
                cursor: 'pointer',
                boxShadow: '0 0 30px rgba(34,199,214,0.18) inset',
              }}
            >
              <Icon
                name={state.isPlaying ? 'pause' : 'play'}
                size={24}
                style={state.isPlaying ? undefined : { marginLeft: 3 }}
              />
            </button>
            <button
              onClick={playNext}
              aria-label="Next track"
              style={{
                width: 52,
                height: 52,
                ...CENTER,
                background: 'none',
                border: 'none',
                color: 'var(--nc-muted)',
                cursor: 'pointer',
              }}
            >
              <Icon name="next" size={24} />
            </button>
          </div>

          <div
            className="nc-mono"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 20,
              fontSize: 10.5,
              color: 'var(--nc-dim)',
            }}
          >
            {track.artist && track.artist !== 'Unknown Artist' && (
              <span>{track.artist.toUpperCase()}</span>
            )}
            <span>{track.duration || formatTime(state.duration)}</span>
          </div>
        </div>
      )}
    </div>
  );
};
