/**
 * Force-update check (approved deviation — requirement/design amendment
 * deferred). Fetches the version policy on launch and again each time the app
 * returns to the foreground, and reports whether the installed build is below
 * the minimum.
 *
 * Fails open: anything other than a well-formed policy that is HIGHER than the
 * installed `versionCode` means "not blocked". That includes an installed
 * version that cannot be read. Only error tags are logged, never values.
 */
import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import type { AppStateStatus } from 'react-native';

import { fetchVersionPolicy } from '../api/versionPolicy';
import { getInstalledVersionCode } from '../utils/installedVersion';

export interface ForceUpdateState {
  blocked: boolean;
  /** The backend's `store_url` (UNVALIDATED — resolve with `resolveStoreUrl`). */
  storeUrl: string | null;
}

const NOT_BLOCKED: ForceUpdateState = { blocked: false, storeUrl: null };

export function useForceUpdate(): ForceUpdateState {
  const [state, setState] = useState<ForceUpdateState>(NOT_BLOCKED);
  // Only the most recently STARTED check may apply its result, so a slow
  // earlier response can never overwrite a newer one.
  const latestCheck = useRef(0);

  useEffect(() => {
    let active = true;

    const check = async (): Promise<void> => {
      latestCheck.current += 1;
      const thisCheck = latestCheck.current;

      const policy = await fetchVersionPolicy(); // never rejects; null = fail open
      if (!active || thisCheck !== latestCheck.current) {
        return;
      }

      const installed = getInstalledVersionCode();
      if (policy && installed === null) {
        console.log('[update] installed version unreadable; not blocking');
      }
      setState(
        policy && installed !== null && installed < policy.minVersionCode
          ? { blocked: true, storeUrl: policy.storeUrl }
          : NOT_BLOCKED,
      );
    };

    // Launch. The listener is registered synchronously, before the first await.
    let previous: AppStateStatus = AppState.currentState ?? 'active';
    const subscription = AppState.addEventListener('change', next => {
      const returnedToForeground = next === 'active' && previous !== 'active';
      previous = next;
      if (returnedToForeground) {
        check();
      }
    });
    check();

    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  return state;
}
