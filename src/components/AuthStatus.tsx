import React, { useState } from 'react';
import { dropboxService } from '../services/dropboxService';
import { useDropboxConnection } from '../hooks/useDropboxConnection';
import { useToast } from '../hooks/useToast';
import { isServerMode } from '../services/dataMode';
import { ConnectionLED } from './ConnectionLED';
import { Icon } from './nocturne/icons';

interface AuthStatusProps {
  mode?: 'admin' | 'public';
}

/**
 * Dropbox connection status.
 *
 * Public mode is a bare LED and a word — a visitor can't do anything about a
 * dropped connection, so offering them a button would be noise. Admin mode adds
 * the reconnect action, and only in Firebase mode: in container mode the
 * credential lives on the backend and no browser action can restore it.
 */
export const AuthStatus: React.FC<AuthStatusProps> = ({ mode = 'admin' }) => {
  const { connected, usingPublicTokens, checking } = useDropboxConnection();
  const [connecting, setConnecting] = useState(false);
  const { showConnectionRestored, showAuthError } = useToast();

  const reconnect = async () => {
    setConnecting(true);
    try {
      await dropboxService.authenticate();
      showConnectionRestored();
    } catch (error) {
      showAuthError(error instanceof Error ? error.message : 'Failed to connect to Dropbox');
    } finally {
      setConnecting(false);
    }
  };

  if (mode === 'public') {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
        <ConnectionLED isConnected={connected} size="md" />
        <span className="nc-mono" style={{ fontSize: 11, color: 'var(--nc-mut)' }}>
          {checking ? 'Checking' : connected ? 'Connected' : 'Offline'}
        </span>
      </span>
    );
  }

  if (connected) {
    return (
      <span className="nc-tag nc-tag-accent">
        <span className="nc-dot nc-dot-live" />
        {usingPublicTokens ? 'SHARED ACCESS' : 'DROPBOX CONNECTED'}
      </span>
    );
  }

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
      <span className="nc-tag nc-tag-danger">
        <Icon name="plugOff" size={12} />
        {checking ? 'CHECKING' : 'DISCONNECTED'}
      </span>
      {!isServerMode && (
        <button
          className="nc-btn"
          style={{ height: 28, fontSize: 12 }}
          onClick={reconnect}
          disabled={connecting}
        >
          <Icon
            name="refresh"
            size={13}
            style={connecting ? { animation: 'ms-spin 0.8s linear infinite' } : undefined}
          />
          {connecting ? 'Connecting…' : 'Reconnect'}
        </button>
      )}
    </span>
  );
};
