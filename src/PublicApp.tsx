import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { useOptionalUser } from './hooks/useOptionalUser';
import { useAdminRole } from './hooks/useAdminRole';
import { useDropbox } from './hooks/useDropbox';
import { useIsMobile } from './hooks/useMediaQuery';
import { LoadingSpinner } from './components/LoadingSpinner';
import { LoginModal } from './components/LoginModal';
import { SyncBadge } from './components/nocturne/SyncBadge';
import { Icon } from './components/nocturne/icons';
import { auth } from './services/firebase';
import { isServerMode } from './services/dataMode';
import { usePublicLibrary } from './public/usePublicLibrary';
import { PublicDesktop } from './public/PublicDesktop';
import { PublicMobile } from './public/PublicMobile';

/**
 * The public site.
 *
 * This component is now only routing, auth affordances and the desktop/mobile
 * switch — browsing lives in `usePublicLibrary`, playback in the audio context,
 * and the two layouts in their own shells.
 */
export const PublicApp: React.FC = () => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  const [user, userLoading] = useOptionalUser();
  const { isAdmin, loading: adminLoading } = useAdminRole(user?.uid);

  // Mounted for its side effect: it completes the Dropbox OAuth callback when
  // the redirect lands back on a public route.
  useDropbox();

  const [showLogin, setShowLogin] = useState(false);
  const library = usePublicLibrary({ enabled: !adminLoading });

  // After the Dropbox redirect finishes, an admin belongs in the studio.
  useEffect(() => {
    const handleAuthComplete = () => {
      if (isAdmin && !adminLoading) navigate('/admin');
    };
    window.addEventListener('dropbox_auth_complete', handleAuthComplete);
    return () => window.removeEventListener('dropbox_auth_complete', handleAuthComplete);
  }, [isAdmin, adminLoading, navigate]);

  const handleLoginSuccess = () => {
    // A Dropbox token still in the URL fragment has to be consumed by
    // useDropbox before we navigate away, or it's lost.
    if (window.location.hash.includes('access_token=')) return;
    if (isAdmin) navigate('/admin');
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const openStudio = () => {
    // Server mode has its own JWT login screen behind /admin; Firebase mode
    // needs a session first.
    if (isServerMode || user) navigate('/admin');
    else setShowLogin(true);
  };

  if (library.loading && !library.collections.length) {
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

  if (library.error) {
    return (
      <div
        className="nc-page"
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
        }}
      >
        <div style={{ textAlign: 'center', maxWidth: 420 }}>
          <div className="nc-kicker" style={{ marginBottom: 12 }}>
            Something went wrong
          </div>
          <h2 className="nc-h1" style={{ fontSize: 28, marginBottom: 12 }}>
            {library.error}
          </h2>
          <button className="nc-btn nc-btn-accent" onClick={() => window.location.reload()}>
            Try again
          </button>
        </div>
      </div>
    );
  }

  const headerActions = (
    <>
      <SyncBadge />
      {!userLoading && user && (
        <button className="nc-btn" onClick={handleLogout} title={user.email || 'Signed in'}>
          <Icon name="signOut" size={15} />
          Sign out
        </button>
      )}
      <button className="nc-btn nc-btn-accent" onClick={openStudio}>
        <Icon name="studio" size={15} />
        Studio
      </button>
    </>
  );

  return (
    <>
      {isMobile ? (
        <PublicMobile library={library} syncBadge={<SyncBadge compact />} />
      ) : (
        <PublicDesktop library={library} headerActions={headerActions} />
      )}

      <LoginModal
        isOpen={showLogin}
        onClose={() => setShowLogin(false)}
        onLoginSuccess={handleLoginSuccess}
      />
    </>
  );
};
