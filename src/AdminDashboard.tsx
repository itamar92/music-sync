import React, { useState } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { useAdminSession } from './hooks/useAdminSession';
import { ServerAdminLogin } from './admin/ServerAdminLogin';
import { LoadingSpinner } from './components/LoadingSpinner';
import { CollectionManagement } from './components/admin/CollectionManagement';
import { FolderSyncManagement } from './components/admin/FolderSyncManagement';
import { PlaylistManagement } from './components/admin/PlaylistManagement';
import { AdminOverview } from './components/admin/AdminOverview';
import { AdminSettings } from './components/admin/AdminSettings';
import { GlobalAudioPlayer } from './components/GlobalAudioPlayer';
import { AuthStatus } from './components/AuthStatus';
import { WaveMark } from './components/nocturne/WaveMark';
import { Icon, IconName } from './components/nocturne/icons';

/**
 * The studio shell — sidebar, top bar and the routed panel.
 *
 * Same routes and behaviour as before; the chrome now speaks Nocturne so the
 * admin and the public site read as one product.
 */

interface MenuItem {
  path: string;
  label: string;
  icon: IconName;
  exact?: boolean;
}

const MENU: MenuItem[] = [
  { path: '/admin', label: 'Overview', icon: 'chart', exact: true },
  { path: '/admin/collections', label: 'Collections', icon: 'folder' },
  { path: '/admin/folders', label: 'Folder sync', icon: 'refresh' },
  { path: '/admin/playlists', label: 'Playlists', icon: 'music' },
  { path: '/admin/settings', label: 'Settings', icon: 'gear' },
];

export const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const session = useAdminSession();

  const isActive = (path: string, exact = false) =>
    exact ? location.pathname === path : location.pathname.startsWith(path);

  const current = MENU.find((item) => isActive(item.path, item.exact));

  if (session.loading) {
    return (
      <div
        className="nc-page"
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <LoadingSpinner />
      </div>
    );
  }

  // Container mode asks for credentials here; Firebase mode was gated upstream
  // by the router, so an unauthenticated visitor never reaches this component.
  if (!session.isAuthenticated) {
    return session.needsOwnLogin ? (
      <ServerAdminLogin onSuccess={session.markSignedIn} />
    ) : (
      <Navigate to="/" replace />
    );
  }

  const signOut = () => session.signOut();

  return (
    <div className="nc-page" style={{ minHeight: '100vh', display: 'flex' }}>
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          role="presentation"
          style={{ position: 'fixed', inset: 0, background: 'rgba(8,9,16,0.6)', zIndex: 40 }}
          className="nc-admin-scrim"
        />
      )}

      <aside
        className={`nc-admin-sidebar${sidebarOpen ? ' is-open' : ''}`}
        style={{
          width: 248,
          flexShrink: 0,
          background: 'rgba(16,18,32,0.96)',
          borderRight: '1px solid var(--nc-line)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '18px 20px',
            height: 58,
            borderBottom: '1px solid var(--nc-line)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
            <WaveMark height={22} />
            <span style={{ fontSize: 14, fontWeight: 500, letterSpacing: '0.02em' }}>Studio</span>
          </div>
          <button
            className="nc-btn nc-btn-icon nc-admin-close"
            style={{ width: 28, height: 28 }}
            onClick={() => setSidebarOpen(false)}
            aria-label="Close menu"
          >
            <Icon name="x" size={14} />
          </button>
        </div>

        <nav style={{ padding: 12, flex: 1 }}>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 2 }}>
            {MENU.map((item) => {
              const active = isActive(item.path, item.exact);
              return (
                <li key={item.path}>
                  <button
                    onClick={() => {
                      navigate(item.path);
                      setSidebarOpen(false);
                    }}
                    className="nc-row-hover"
                    style={{
                      position: 'relative',
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 11,
                      padding: '10px 12px',
                      borderRadius: 8,
                      background: active ? 'rgba(34,184,214,0.10)' : 'transparent',
                      border: 'none',
                      color: active ? 'var(--nc-accent-text-bright)' : 'var(--nc-text-soft)',
                      fontFamily: 'inherit',
                      fontSize: 13.5,
                      textAlign: 'left',
                      cursor: 'pointer',
                    }}
                  >
                    {active && (
                      <span
                        style={{
                          position: 'absolute',
                          left: 0,
                          top: 9,
                          bottom: 9,
                          width: 2,
                          borderRadius: 2,
                          background: 'var(--nc-cy)',
                          boxShadow: '0 0 10px var(--nc-cy)',
                        }}
                      />
                    )}
                    <Icon name={item.icon} size={16} />
                    {item.label}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        <div style={{ padding: 12, borderTop: '1px solid var(--nc-line)' }}>
          <button className="nc-btn nc-btn-block" onClick={signOut}>
            <Icon name="signOut" size={15} />
            Sign out
          </button>
        </div>
      </aside>

      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <header
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
            padding: '0 24px',
            height: 58,
            flexShrink: 0,
            borderBottom: '1px solid var(--nc-line)',
            background: 'rgba(16,18,32,0.7)',
            backdropFilter: 'blur(10px)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
            <button
              className="nc-btn nc-btn-icon nc-admin-burger"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open menu"
            >
              <Icon name="list" size={16} />
            </button>
            <h1 className="nc-truncate" style={{ margin: 0, fontSize: 15, fontWeight: 500 }}>
              {current?.label || 'Studio'}
            </h1>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
            <AuthStatus mode="admin" />
            <button className="nc-btn" onClick={() => navigate('/')}>
              View public site
            </button>
          </div>
        </header>

        {/* Bottom padding keeps the last row clear of the fixed transport. */}
        <main className="nc-scroll" style={{ flex: 1, padding: '28px 24px 120px' }}>
          <Routes>
            <Route path="/" element={<AdminOverview />} />
            <Route path="/collections/*" element={<CollectionManagement />} />
            <Route path="/folders/*" element={<FolderSyncManagement />} />
            <Route path="/playlists/*" element={<PlaylistManagement />} />
            <Route path="/settings/*" element={<AdminSettings />} />
          </Routes>
        </main>
      </div>

      <GlobalAudioPlayer />
    </div>
  );
};
