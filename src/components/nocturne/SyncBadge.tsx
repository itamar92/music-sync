import React from 'react';
import { useDropboxConnection } from '../../hooks/useDropboxConnection';

/**
 * The Dropbox connection pill in the header — a lit dot and a monospace
 * status. Deliberately small: it's reassurance, not a control.
 */
export const SyncBadge: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const { connected, checking } = useDropboxConnection();

  const text = checking ? 'CHECKING' : connected ? 'CONNECTED' : 'OFFLINE';

  return (
    <span
      className={`nc-tag ${connected ? 'nc-tag-accent' : ''}`}
      style={compact ? { padding: '4px 9px', fontSize: 9.5 } : { padding: '5px 10px', fontSize: 11 }}
      title={
        connected
          ? 'Dropbox is reachable — tracks will stream'
          : 'Dropbox is not reachable right now'
      }
    >
      <span className={`nc-dot ${connected ? 'nc-dot-live' : ''}`} style={{ width: 6, height: 6 }} />
      {compact ? text : `DROPBOX · ${text}`}
    </span>
  );
};
