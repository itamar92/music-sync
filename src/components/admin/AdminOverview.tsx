import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDropbox } from '../../hooks/useDropbox';
import { useDropboxConnection } from '../../hooks/useDropboxConnection';
import { adminData, AdminStats } from '../../services/adminData';
import { Icon, IconName } from '../nocturne/icons';

/**
 * The studio landing screen: connection state, the four counts, and the
 * shortcuts into the management panels.
 */

const QUICK_ACTIONS: Array<{ label: string; hint: string; icon: IconName; path: string }> = [
  {
    label: 'Create collection',
    hint: 'Group playlists for listeners',
    icon: 'folder',
    path: '/admin/collections',
  },
  { label: 'Add playlist', hint: 'Build from synced folders', icon: 'music', path: '/admin/playlists' },
  { label: 'Sync a folder', hint: 'Pull new bounces from Dropbox', icon: 'refresh', path: '/admin/folders' },
];

export const AdminOverview: React.FC = () => {
  const navigate = useNavigate();
  const { clientDropboxAuth } = adminData.capabilities;

  // Firebase mode connects Dropbox from the browser; container mode reports the
  // backend's own connection instead, since no browser action can change it.
  const clientDropbox = useDropbox();
  const backend = useDropboxConnection();

  const connected = clientDropboxAuth ? clientDropbox.isConnected : backend.connected;
  const connecting = clientDropboxAuth ? clientDropbox.isConnecting : backend.checking;
  const dropboxError = clientDropboxAuth ? clientDropbox.error : null;

  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const next = await adminData.stats();
        if (!cancelled) setStats(next);
      } catch (error) {
        console.error('Error loading dashboard counts:', error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const connectDropbox = async () => {
    if (connected || connecting) return;
    clientDropbox.clearError();
    await clientDropbox.connect();
  };

  const value = (n?: number) => (loading || n === undefined ? '—' : String(n).padStart(2, '0'));

  return (
    <div style={{ maxWidth: 1180 }}>
      <div style={{ marginBottom: 26 }}>
        <div className="nc-kicker" style={{ marginBottom: 10 }}>
          Studio
        </div>
        <h1 className="nc-h1" style={{ fontSize: 34, marginBottom: 8 }}>
          Your library, behind the curtain
        </h1>
        <p style={{ margin: 0, fontSize: 14, color: 'var(--nc-mut)' }}>
          Folders, playlists and what your listeners can reach.
        </p>
      </div>

      <div
        className={`nc-notice${connected ? '' : dropboxError ? ' nc-notice-danger' : ''}`}
        style={{ marginBottom: 26 }}
      >
        <span
          className={`nc-dot ${connected ? 'nc-dot-live' : ''}`}
          style={{ width: 8, height: 8 }}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 500 }}>
            {connecting
              ? 'Checking Dropbox…'
              : connected
                ? 'Dropbox is connected'
                : 'Dropbox is not connected'}
          </div>
          <div
            className="nc-mono"
            style={{
              fontSize: 11.5,
              color: dropboxError ? 'var(--nc-danger)' : 'var(--nc-accent-text-dim)',
            }}
          >
            {dropboxError ||
              (connected
                ? `${value(stats?.folders)} FOLDERS WATCHED · ${value(stats?.tracks)} TRACKS`
                : clientDropboxAuth
                  ? 'CONNECT TO SYNC FOLDERS AND STREAM TRACKS'
                  : 'THE BACKEND HOLDS THE DROPBOX CREDENTIAL — CHECK ITS CONFIGURATION')}
          </div>
        </div>
        {/* Only offer a connect button where the browser can actually do it. */}
        {!connected && clientDropboxAuth && (
          <button className="nc-btn nc-btn-accent" onClick={connectDropbox} disabled={connecting}>
            {connecting ? 'Connecting…' : 'Connect'}
          </button>
        )}
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 14,
          marginBottom: 28,
        }}
      >
        {[
          ['Collections', stats?.collections],
          ['Playlists', stats?.playlists],
          ['Watched folders', stats?.folders],
          ['Tracks', stats?.tracks],
        ].map(([label, count]) => (
          <div key={label as string} className="nc-stat">
            <div className="nc-stat-label">{label}</div>
            <div className="nc-stat-value">{value(count as number | undefined)}</div>
          </div>
        ))}
      </div>

      <h2 className="nc-section-title" style={{ marginBottom: 12 }}>
        Quick actions
      </h2>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: 12,
        }}
      >
        {QUICK_ACTIONS.map((action) => (
          <button
            key={action.path}
            onClick={() => navigate(action.path)}
            className="nc-panel nc-panel-hover"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 13,
              padding: '16px 18px',
              cursor: 'pointer',
              textAlign: 'left',
              fontFamily: 'inherit',
              color: 'var(--nc-text)',
            }}
          >
            <Icon name={action.icon} size={18} color="var(--nc-accent-text)" />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 500 }}>{action.label}</div>
              <div className="nc-truncate" style={{ fontSize: 12, color: 'var(--nc-mut)' }}>
                {action.hint}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};
