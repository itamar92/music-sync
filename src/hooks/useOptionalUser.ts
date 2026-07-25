import { useAuthState } from 'react-firebase-hooks/auth';
import type { User } from 'firebase/auth';
import { auth } from '../services/firebase';
import { isServerMode } from '../services/dataMode';

/**
 * Firebase auth state that is safe in server mode, where Firebase is never
 * initialized. `isServerMode` is a build-time constant, so the hook call
 * order is stable across renders despite the early return.
 */
export function useOptionalUser(): [User | null, boolean] {
  if (isServerMode) {
    return [null, false];
  }
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const [user, loading] = useAuthState(auth);
  return [user ?? null, loading];
}
