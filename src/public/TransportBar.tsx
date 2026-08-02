import React from 'react';
import { Track } from '../types';
import { formatTime } from '../utils/formatTime';
import { useAudioPlayerContext } from '../context/AudioPlayerContext';
import { Waveform } from '../components/nocturne/Waveform';
import { LevelMeter } from '../components/nocturne/EqBars';
import { Icon } from '../components/nocturne/icons';

/**
 * The desktop transport — a permanent 96px footer under the whole app.
 *
 * It stays mounted with nothing loaded so the layout never shifts when the
 * first track starts; in that idle state the controls are disabled and the
 * waveform draws a flat placeholder.
 */

const CENTER = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
} as const;

/** Volume as a rough dB trim, matching how a DAW fader reads. */
const volumeLabel = (volume: number): string =>
  volume <= 0.01 ? '-∞dB' : `${Math.round((volume - 1) * 30)}dB`;

const trackFolder = (track: Track | null): string =>
  track?.path?.split('/').slice(-2, -1)[0] || '';

export const TransportBar: React.FC = () => {
  const {
    state,
    playlist,
    context,
    hasTrack,
    progress,
    seekToFraction,
    togglePlayPause,
    playNext,
    playPrevious,
    setVolume,
    setExpanded,
  } = useAudioPlayerContext();

  const track = state.currentTrack;
  const subtitle =
    [context.playlistName, context.collectionName].filter(Boolean).join(' · ') ||
    trackFolder(track) ||
    'Nothing playing';

  return (
    <footer
      style={{
        flexShrink: 0,
        height: 96,
        borderTop: '1px solid var(--nc-line)',
        background: 'rgba(14,16,28,0.92)',
        backdropFilter: 'blur(14px)',
        display: 'flex',
        alignItems: 'center',
        gap: 24,
        padding: '0 20px',
      }}
    >
      {/* now playing */}
      <div
        onClick={() => hasTrack && setExpanded(true)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 13,
          width: 250,
          flexShrink: 0,
          cursor: hasTrack ? 'pointer' : 'default',
        }}
      >
        <div
          className="nc-art"
          style={{ width: 52, height: 52, borderRadius: 9, ...CENTER, opacity: hasTrack ? 1 : 0.5 }}
        >
          <Icon name="caretDown" size={15} color="rgba(220,231,245,0.75)" />
        </div>
        <div style={{ minWidth: 0 }}>
          <div
            className="nc-truncate"
            dir="auto"
            style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--nc-text)' }}
          >
            {track?.name || 'MusicSync'}
          </div>
          <div
            className="nc-truncate nc-mono"
            style={{ fontSize: 11, color: 'var(--nc-mut)' }}
          >
            {subtitle}
          </div>
        </div>
      </div>

      {/* controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
        <button
          className="nc-btn nc-btn-ghost nc-btn-icon"
          onClick={playPrevious}
          disabled={!hasTrack || state.currentTrackIndex === 0}
          aria-label="Previous track"
        >
          <Icon name="prev" size={18} />
        </button>
        <button
          onClick={togglePlayPause}
          disabled={!hasTrack}
          aria-label={state.isPlaying ? 'Pause' : 'Play'}
          style={{
            position: 'relative',
            width: 44,
            height: 44,
            borderRadius: '50%',
            ...CENTER,
            background: 'transparent',
            border: '1px solid rgba(34,199,214,0.55)',
            color: 'var(--nc-accent-text-bright)',
            cursor: hasTrack ? 'pointer' : 'not-allowed',
            opacity: hasTrack ? 1 : 0.45,
            boxShadow: '0 0 22px rgba(34,199,214,0.18) inset',
            transition: 'background-color 0.15s ease',
          }}
        >
          <Icon
            name={state.isPlaying ? 'pause' : 'play'}
            size={18}
            style={state.isPlaying ? undefined : { marginLeft: 2 }}
          />
        </button>
        <button
          className="nc-btn nc-btn-ghost nc-btn-icon"
          onClick={playNext}
          disabled={!hasTrack || state.currentTrackIndex >= playlist.length - 1}
          aria-label="Next track"
        >
          <Icon name="next" size={18} />
        </button>
      </div>

      {/* scrubber */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 14 }}>
        <span
          className="nc-mono"
          style={{ fontSize: 11.5, color: 'var(--nc-muted)', width: 46, textAlign: 'right' }}
        >
          {formatTime(state.currentTime)}
        </span>
        <Waveform
          seed={track?.name || 'musicsync-idle'}
          kind="transport"
          progress={progress}
          live={hasTrack}
          height={46}
          onSeek={hasTrack ? seekToFraction : undefined}
          ariaLabel="Seek within track"
          style={{ flex: 1, minWidth: 0, opacity: hasTrack ? 1 : 0.4 }}
        />
        <span className="nc-mono" style={{ fontSize: 11.5, color: 'var(--nc-muted)', width: 46 }}>
          {formatTime(state.duration)}
        </span>
      </div>

      {/* output */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          flexShrink: 0,
          width: 230,
          justifyContent: 'flex-end',
        }}
      >
        <LevelMeter active={state.isPlaying} />
        <Icon name="volume" size={17} color="var(--nc-muted)" />
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={state.volume}
          onChange={(e) => setVolume(parseFloat(e.target.value))}
          aria-label="Volume"
          style={{
            width: 92,
            height: 20,
            background: `linear-gradient(90deg, var(--nc-cy) 0%, #6f63b4 ${
              state.volume * 100
            }%, #282c3d ${state.volume * 100}%, #282c3d 100%)`,
            borderRadius: 2,
          }}
        />
        <span className="nc-mono" style={{ fontSize: 11, color: 'var(--nc-dim)', width: 40 }}>
          {volumeLabel(state.volume)}
        </span>
        <button
          className="nc-btn nc-btn-ghost nc-btn-icon"
          onClick={() => setExpanded(true)}
          disabled={!hasTrack}
          aria-label="Expand now playing"
        >
          <Icon name="caretUp" size={16} />
        </button>
      </div>
    </footer>
  );
};

/**
 * The expanded now-playing view: a large scrubable waveform beside the queue.
 * Overlays the main pane rather than the whole window so the transport stays
 * reachable underneath.
 */
export const NowPlayingOverlay: React.FC = () => {
  const {
    state,
    playlist,
    context,
    progress,
    seekToFraction,
    playTrackFromPlaylist,
    setExpanded,
  } = useAudioPlayerContext();

  const track = state.currentTrack;
  if (!track) return null;

  const remaining = Math.max(0, state.duration - state.currentTime);

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 20,
        background: 'linear-gradient(180deg, #12162a 0%, #0e1020 100%)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '18px 32px',
        }}
      >
        <span className="nc-kicker">
          Now playing{context.collectionName ? ` · ${context.collectionName}` : ''}
        </span>
        <button
          className="nc-btn nc-btn-icon"
          onClick={() => setExpanded(false)}
          aria-label="Collapse now playing"
        >
          <Icon name="caretDown" size={16} />
        </button>
      </div>

      <div style={{ flex: 1, minHeight: 0, display: 'flex', gap: 40, padding: '0 40px 28px' }}>
        <div
          style={{
            flex: 1,
            minWidth: 0,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            gap: 26,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
            <div className="nc-art" style={{ width: 96, height: 96, borderRadius: 12 }} />
            <div style={{ minWidth: 0 }}>
              <h1
                className="nc-h1"
                dir="auto"
                style={{ fontSize: 34, marginBottom: 8, lineHeight: 1.1 }}
              >
                {track.name}
              </h1>
              <div style={{ fontSize: 14, color: 'var(--nc-mut)' }}>
                {[context.playlistName, context.collectionName].filter(Boolean).join(' · ')}
              </div>
            </div>
          </div>

          <div>
            <Waveform
              seed={track.name}
              kind="hero"
              progress={progress}
              live
              height={150}
              onSeek={seekToFraction}
              ariaLabel="Seek within track"
            />
            <div
              className="nc-mono"
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginTop: 10,
                fontSize: 11.5,
                color: 'var(--nc-dim)',
              }}
            >
              <span>{formatTime(state.currentTime)}</span>
              <span>-{formatTime(remaining)}</span>
            </div>
          </div>

          <div
            className="nc-mono"
            style={{ display: 'flex', alignItems: 'center', gap: 26, fontSize: 11.5, color: 'var(--nc-dim)' }}
          >
            {track.artist && <span>{track.artist.toUpperCase()}</span>}
            {track.duration && <span>{track.duration}</span>}
            {trackFolder(track) && <span>{trackFolder(track).toUpperCase()}</span>}
          </div>
        </div>

        <div
          style={{
            width: 320,
            flexShrink: 0,
            display: 'flex',
            flexDirection: 'column',
            minHeight: 0,
          }}
        >
          <div className="nc-kicker" style={{ padding: '8px 0 12px' }}>
            Up next
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
      </div>
    </div>
  );
};

interface QueueRowProps {
  index: number;
  name: string;
  duration?: string;
  current: boolean;
  onPlay: () => void;
}

export const QueueRow: React.FC<QueueRowProps> = ({ index, name, duration, current, onPlay }) => (
  <div
    onClick={onPlay}
    role="button"
    tabIndex={0}
    onKeyDown={(e) => e.key === 'Enter' && onPlay()}
    className="nc-row-hover"
    style={{
      position: 'relative',
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: '9px 10px',
      borderRadius: 8,
      cursor: 'pointer',
      overflow: 'hidden',
    }}
  >
    {current && (
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(34,184,214,0.10)' }} />
    )}
    <span
      className="nc-mono"
      style={{ position: 'relative', fontSize: 11, color: 'var(--nc-dim)', width: 18 }}
    >
      {String(index + 1).padStart(2, '0')}
    </span>
    <span
      className="nc-truncate"
      dir="auto"
      style={{ position: 'relative', flex: 1, minWidth: 0, fontSize: 13, color: 'var(--nc-text)' }}
    >
      {name}
    </span>
    <span className="nc-mono" style={{ position: 'relative', fontSize: 11, color: 'var(--nc-dim)' }}>
      {duration}
    </span>
  </div>
);
