import React from 'react';

interface ConnectionLEDProps {
  isConnected: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const SIZES = { sm: 6, md: 8, lg: 10 } as const;

/**
 * The connection LED. Lit cyan with a glow when Dropbox is reachable, an unlit
 * grey when it isn't — the system reads "off", not "error", since a dropped
 * connection is usually transient.
 */
export const ConnectionLED: React.FC<ConnectionLEDProps> = ({ isConnected, size = 'sm' }) => {
  const px = SIZES[size];

  return (
    <span
      className={`nc-dot ${isConnected ? 'nc-dot-live' : ''}`}
      style={{ width: px, height: px, transition: 'background-color 0.3s ease' }}
      title={isConnected ? 'Connected to Dropbox' : 'Disconnected from Dropbox'}
      role="img"
      aria-label={isConnected ? 'Connected' : 'Disconnected'}
    />
  );
};
