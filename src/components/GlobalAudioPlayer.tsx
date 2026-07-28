import React from 'react';
import { useAudioPlayerContext } from '../context/AudioPlayerContext';
import { TransportBar } from '../public/TransportBar';

/**
 * The transport for pages that scroll normally — the admin dashboards.
 *
 * The public shells lay the transport out as a flex footer inside a fixed-height
 * column; admin pages don't, so here it's pinned to the viewport and only
 * appears once something is loaded. The audio element and engine live in
 * AudioPlayerProvider, so mounting or unmounting this never interrupts playback.
 */
export const GlobalAudioPlayer: React.FC = () => {
  const { hasTrack } = useAudioPlayerContext();

  if (!hasTrack) return null;

  return (
    <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 50 }}>
      <TransportBar />
    </div>
  );
};
