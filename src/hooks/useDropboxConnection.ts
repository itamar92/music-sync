import { useEffect, useRef, useState } from 'react';
import { dropboxService } from '../services/dropboxService';
import { publicDataService } from '../services/publicDataService';
import { PublicTokenService } from '../services/publicTokenService';
import { isServerMode } from '../services/dataMode';
import { useToast } from './useToast';

const POLL_MS = 30000;

export interface DropboxConnection {
  connected: boolean;
  /** True when this browser is riding the server-managed public token. */
  usingPublicTokens: boolean;
  checking: boolean;
}

/**
 * Whether music can currently be streamed, and where that answer comes from.
 *
 * In container mode the browser never holds Dropbox credentials — the backend
 * does — so the honest thing to report is the backend's health rather than this
 * client's (permanently absent) Dropbox session. In Firebase mode the client's
 * own token is what matters, plus whether it came from the shared public token.
 */
export const useDropboxConnection = (): DropboxConnection => {
  const [connected, setConnected] = useState(false);
  const [usingPublicTokens, setUsingPublicTokens] = useState(false);
  const [checking, setChecking] = useState(true);
  const { showConnectionRestored } = useToast();

  // Read through a ref so the poll can compare against the previous value
  // without re-subscribing (and restarting the interval) on every change.
  const connectedRef = useRef(connected);
  connectedRef.current = connected;

  useEffect(() => {
    let cancelled = false;
    let settled = false;

    const apply = (next: boolean) => {
      if (cancelled) return;
      // Only announce a *restored* connection — the first successful check on
      // load is the normal case, not an event worth a toast.
      if (settled && next && !connectedRef.current) showConnectionRestored();
      settled = true;
      setConnected(next);
      setChecking(false);
    };

    const check = async () => {
      if (isServerMode) {
        const status = await publicDataService.getServerStatus();
        apply(Boolean(status?.hasToken));
        return;
      }

      const authenticated = dropboxService.isAuthenticated();
      apply(authenticated);

      if (authenticated) {
        const shared = await PublicTokenService.arePublicTokensAvailable();
        if (!cancelled) setUsingPublicTokens(shared);
      }
    };

    check();
    const interval = setInterval(check, POLL_MS);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [showConnectionRestored]);

  return { connected, usingPublicTokens, checking };
};
