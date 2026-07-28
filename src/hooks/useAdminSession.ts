import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth } from '../services/firebase';
import { adminApi } from '../services/adminApiService';
import { isServerMode } from '../services/dataMode';
import { useOptionalUser } from './useOptionalUser';
import { useAdminRole } from './useAdminRole';

/**
 * Who is allowed into the studio, in whichever way this deployment decides it.
 *
 * Firebase mode trusts Firebase Auth plus an `admin` role on the user document;
 * container mode trusts a backend-issued JWT. The dashboard only needs three
 * answers — are we still checking, are we in, and how do we leave — so both
 * models collapse to that here and the UI stops caring which is running.
 */

export interface AdminSession {
  loading: boolean;
  isAuthenticated: boolean;
  /** True when this mode wants its own login form rather than a redirect. */
  needsOwnLogin: boolean;
  /** Label for the signed-in account, when there is one. */
  accountLabel: string | null;
  signOut: () => Promise<void>;
  /** Container mode only: call after a successful JWT login. */
  markSignedIn: () => void;
}

export const useAdminSession = (): AdminSession => {
  const navigate = useNavigate();
  const [user, userLoading] = useOptionalUser();
  const { isAdmin, loading: roleLoading } = useAdminRole(user?.uid);
  const [jwtValid, setJwtValid] = useState(() => adminApi.isLoggedIn());

  const signOut = useCallback(async () => {
    if (isServerMode) {
      adminApi.logout();
      setJwtValid(false);
      return;
    }

    try {
      await auth.signOut();
      navigate('/');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  }, [navigate]);

  const markSignedIn = useCallback(() => setJwtValid(true), []);

  if (isServerMode) {
    return {
      loading: false,
      isAuthenticated: jwtValid,
      needsOwnLogin: true,
      accountLabel: null,
      signOut,
      markSignedIn,
    };
  }

  return {
    loading: userLoading || roleLoading,
    isAuthenticated: Boolean(user && isAdmin),
    needsOwnLogin: false,
    accountLabel: user?.email || null,
    signOut,
    markSignedIn,
  };
};
