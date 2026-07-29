import React from 'react';
import { useParams } from 'react-router-dom';
import { useIsMobile } from '../hooks/useMediaQuery';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { PublicDesktop } from '../public/PublicDesktop';
import { PublicMobile } from '../public/PublicMobile';
import { useShareLibrary } from './useShareLibrary';

/**
 * A single collection, reachable only by its link.
 *
 * Deliberately the same shells the public site uses — the recipient gets the
 * real player, waveforms and all — driven by a library scoped to one collection
 * (see `useShareLibrary`). Nothing rendered here links to the catalogue, the
 * studio, or any other collection.
 */
export const ShareApp: React.FC = () => {
  const { token } = useParams();
  const isMobile = useIsMobile();
  const { library, status, token: activeToken } = useShareLibrary(token || '');

  const shareLink = () => `${window.location.origin}/share/${activeToken}`;

  if (status === 'loading') {
    return (
      <Centered>
        <LoadingSpinner />
      </Centered>
    );
  }

  if (status !== 'ready' || !library.selectedCollection) {
    return <ShareUnavailable isError={status === 'error'} />;
  }

  return isMobile ? (
    <PublicMobile
      library={library}
      syncBadge={null}
      showStudioTab={false}
      playlistLink={shareLink}
    />
  ) : (
    <PublicDesktop library={library} headerActions={<SharedPill />} playlistLink={shareLink} />
  );
};

const Centered: React.FC<{ children: React.ReactNode }> = ({ children }) => (
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
    {children}
  </div>
);

/** Says what this page is, without offering a way anywhere else. */
const SharedPill: React.FC = () => (
  <span
    className="nc-mono"
    style={{
      fontSize: 11,
      letterSpacing: '0.12em',
      color: 'var(--nc-dim)',
      border: '1px solid var(--nc-line)',
      borderRadius: 999,
      padding: '5px 12px',
    }}
  >
    SHARED COLLECTION
  </span>
);

/**
 * The one page a bad token can reach.
 *
 * Revoked, mistyped and never-existed tokens all land here — the backend can't
 * tell the recipient which it was, and neither should this.
 */
const ShareUnavailable: React.FC<{ isError: boolean }> = ({ isError }) => (
  <Centered>
    <div style={{ textAlign: 'center', maxWidth: 420 }}>
      <div className="nc-kicker" style={{ marginBottom: 12 }}>
        Shared collection
      </div>
      <h2 className="nc-h1" style={{ fontSize: 28, marginBottom: 12 }}>
        {isError ? 'This link could not be opened' : 'This link is no longer available'}
      </h2>
      <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: 'var(--nc-mut)' }}>
        {isError
          ? 'Something went wrong reaching the library. Try again in a moment.'
          : 'The link may have been revoked, or replaced with a new one. Ask whoever sent it for an up-to-date link.'}
      </p>
      {isError && (
        <button
          className="nc-btn nc-btn-accent"
          style={{ marginTop: 20 }}
          onClick={() => window.location.reload()}
        >
          Try again
        </button>
      )}
    </div>
  </Centered>
);
