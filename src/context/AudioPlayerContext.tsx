import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Track } from '../types';
import { useAudioPlayer } from '../hooks/useAudioPlayer';
import { ToastContainer } from '../components/ui/ToastContainer';

/**
 * One audio engine for the whole app.
 *
 * `useAudioPlayer` owns the <audio> element and all stream-URL resolution, so
 * it must be instantiated exactly once — mounting it per-view would give each
 * view its own element and its own playback. Previously that instance lived
 * inside GlobalAudioPlayer; now it lives here so the transport, the mobile mini
 * player, the now-playing sheet and individual track rows can all read the same
 * state without round-tripping through window events.
 *
 * The window CustomEvent bridge is kept intact: components that dispatch
 * `playTrackFromPlaylist` / `pauseTrack` keep working unchanged, and
 * `audioPlayerStateChanged` is still broadcast for listeners that predate this
 * context.
 */

/** Where the current track came from, for the transport's subtitle. */
export interface PlaybackContext {
  playlistId?: string;
  playlistName?: string;
  collectionName?: string;
}

type AudioEngine = ReturnType<typeof useAudioPlayer>;

interface AudioPlayerContextValue extends AudioEngine {
  /** Descriptive labels for whatever is loaded; set when playback starts. */
  context: PlaybackContext;
  setContext: (context: PlaybackContext) => void;
  /** True once anything has been loaded — the transport shows an idle state until then. */
  hasTrack: boolean;
  /** 0–1 playback position, guarded against a not-yet-known duration. */
  progress: number;
  /** Seek by fraction rather than seconds — what every waveform hands back. */
  seekToFraction: (fraction: number) => void;
  /** Start a playlist from a given index, setting the labels in one step. */
  playFromPlaylist: (tracks: Track[], index: number, context?: PlaybackContext) => void;
  expanded: boolean;
  setExpanded: (expanded: boolean) => void;
}

const AudioPlayerCtx = createContext<AudioPlayerContextValue | null>(null);

export const AudioPlayerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const engine = useAudioPlayer();
  const { audioRef, state, setPlaylist, playTrackFromPlaylist, togglePlayPause, seek } = engine;

  const [context, setContext] = useState<PlaybackContext>({});
  const [expanded, setExpanded] = useState(false);

  const playFromPlaylist = useCallback(
    (tracks: Track[], index: number, nextContext?: PlaybackContext) => {
      if (!tracks.length) return;
      if (nextContext) setContext(nextContext);
      setPlaylist(tracks);
      playTrackFromPlaylist(tracks[index], index);
    },
    [setPlaylist, playTrackFromPlaylist]
  );

  // Inbound bridge: components (notably the admin playlist view) ask for
  // playback by dispatching an event rather than importing this context.
  useEffect(() => {
    const handlePlay = (event: Event) => {
      const detail = (event as CustomEvent).detail as {
        track: Track;
        playlist: Track[];
        index: number;
        context?: PlaybackContext;
      };
      if (detail?.context) setContext(detail.context);
      setPlaylist(detail.playlist);
      playTrackFromPlaylist(detail.track, detail.index);
    };

    const handlePause = () => {
      if (state.isPlaying) togglePlayPause();
    };

    window.addEventListener('playTrackFromPlaylist', handlePlay);
    window.addEventListener('pauseTrack', handlePause);
    return () => {
      window.removeEventListener('playTrackFromPlaylist', handlePlay);
      window.removeEventListener('pauseTrack', handlePause);
    };
  }, [setPlaylist, playTrackFromPlaylist, togglePlayPause, state.isPlaying]);

  // Outbound bridge: kept for listeners that read playback state off the window.
  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent('audioPlayerStateChanged', {
        detail: {
          currentTrack: state.currentTrack,
          isPlaying: state.isPlaying,
          currentTime: state.currentTime,
          duration: state.duration,
        },
      })
    );
  }, [state.currentTrack, state.isPlaying, state.currentTime, state.duration]);

  const progress =
    state.duration > 0 ? Math.max(0, Math.min(1, state.currentTime / state.duration)) : 0;

  const seekToFraction = useCallback(
    (fraction: number) => {
      if (state.duration > 0) seek(Math.max(0, Math.min(1, fraction)) * state.duration);
    },
    [seek, state.duration]
  );

  const value = useMemo<AudioPlayerContextValue>(
    () => ({
      ...engine,
      context,
      setContext,
      hasTrack: Boolean(state.currentTrack),
      progress,
      seekToFraction,
      playFromPlaylist,
      expanded,
      setExpanded,
    }),
    [engine, context, state.currentTrack, progress, seekToFraction, playFromPlaylist, expanded]
  );

  return (
    <AudioPlayerCtx.Provider value={value}>
      {children}
      {/* Auth/connection toasts are raised by the engine, so they live with it. */}
      <ToastContainer toasts={engine.toasts} onDismiss={engine.removeToast} />
      {/*
        The single audio element for the app. It stays mounted across route
        changes so navigation never interrupts playback. The React handlers
        re-broadcast metadata/time as window events because the hook's own
        listeners can miss them when the source is swapped mid-load.
      */}
      <audio
        ref={audioRef}
        preload="metadata"
        crossOrigin="anonymous"
        onLoadedMetadata={() => {
          const duration = audioRef.current?.duration;
          if (duration && !isNaN(duration)) {
            window.dispatchEvent(
              new CustomEvent('audioMetadataLoaded', { detail: { duration } })
            );
          }
        }}
        onTimeUpdate={() => {
          const currentTime = audioRef.current?.currentTime;
          if (typeof currentTime === 'number' && !isNaN(currentTime)) {
            window.dispatchEvent(new CustomEvent('audioTimeUpdate', { detail: { currentTime } }));
          }
        }}
      />
    </AudioPlayerCtx.Provider>
  );
};

export const useAudioPlayerContext = (): AudioPlayerContextValue => {
  const ctx = useContext(AudioPlayerCtx);
  if (!ctx) {
    throw new Error('useAudioPlayerContext must be used inside an AudioPlayerProvider');
  }
  return ctx;
};
