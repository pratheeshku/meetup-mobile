/**
 * Push permission + device-token registration lifecycle (DES-MEETUP-MOBILE.md
 * §3.6, R-070, R-072, R-075).
 *
 * `AuthContext` calls `startPushRegistration()` whenever a session exists
 * (fresh sign-in by any method, or a session restored on cold start) and the
 * returned function on sign-out / unmount, so nothing here ever runs while
 * signed out. One call = one "session":
 *
 * - Permission (API 33+): a short rationale `Alert` is shown ONCE per install
 *   — remembered in AsyncStorage before it is shown — followed by the system
 *   `POST_NOTIFICATIONS` prompt. After that, a denial is never re-prompted
 *   (no nagging). Below API 33 there is no runtime permission and no
 *   rationale. If the "shown" flag cannot be read or written we fail closed
 *   and do not prompt.
 * - Registration: only when permission is granted. The FCM token is fetched
 *   and `POST /notifications/mobile-subscriptions` is called at most once per
 *   distinct token per session. A failure is swallowed with a log and retried
 *   on the next app foreground (or the next cold start, which starts a new
 *   session).
 * - Rotation: `onTokenRefresh` is subscribed once permission is granted (a
 *   device that has not granted notifications has nothing to re-register)
 *   and unsubscribed on stop.
 *
 * Logging never includes the FCM token or any error object (R-111).
 */
import { Alert, AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { describeError } from '../utils/logSafeError';
import {
  fetchFcmToken,
  hasNotificationPermission,
  onTokenRefresh,
  registerDeviceToken,
  requestPermission,
} from './fcm';

/** Device-level (not per-account): the OS permission is per-app. */
export const RATIONALE_SHOWN_KEY = 'notifications.permissionRationaleShown.v1';

function showRationale(): Promise<void> {
  return new Promise(resolve => {
    Alert.alert(
      'Stay up to date',
      'Meetup sends notifications about event invites, changes, cancellations and waitlist ' +
        'updates. Next, Android will ask whether to allow them. You can change this any time ' +
        'in your phone settings.',
      [{ text: 'Continue', onPress: () => resolve() }],
      // No outside-tap / back dismissal: the promise must resolve via the button.
      { cancelable: false },
    );
  });
}

/**
 * Resolves `true` when notifications are permitted. Prompts (rationale, then
 * system dialog) at most once per install; otherwise never prompts.
 */
export async function ensureNotificationPermission(): Promise<boolean> {
  if (await hasNotificationPermission()) {
    return true;
  }

  try {
    if ((await AsyncStorage.getItem(RATIONALE_SHOWN_KEY)) !== null) {
      return false;
    }
    // Remembered *before* showing, so a kill mid-dialog cannot cause a re-ask.
    await AsyncStorage.setItem(RATIONALE_SHOWN_KEY, '1');
  } catch {
    return false;
  }

  await showRationale();
  return requestPermission();
}

/**
 * Starts push registration for the current session. Returns `stop`, which is
 * idempotent and cancels any in-flight attempt's side effects.
 */
export function startPushRegistration(): () => void {
  let active = true;
  let inFlight = false;
  let registeredToken: string | null = null;
  let unsubscribeRefresh: (() => void) | null = null;

  const attempt = async (): Promise<void> => {
    if (!active || inFlight) {
      return;
    }
    // Alert.alert needs a foreground Activity; a foreground event retries.
    if (AppState.currentState === 'background') {
      return;
    }

    inFlight = true;
    try {
      const granted = await ensureNotificationPermission();
      if (!active || !granted) {
        return;
      }

      if (!unsubscribeRefresh) {
        unsubscribeRefresh = onTokenRefresh(token => {
          if (active) {
            registeredToken = token;
          }
        });
      }

      const token = await fetchFcmToken();
      if (!active || token === registeredToken) {
        return;
      }

      await registerDeviceToken(token);
      if (active) {
        registeredToken = token;
      }
    } catch (error) {
      console.log(
        '[push] registration attempt failed; retrying on next foreground or cold start',
        describeError(error),
      );
    } finally {
      inFlight = false;
    }
  };

  const appStateSubscription = AppState.addEventListener('change', state => {
    if (state === 'active') {
      attempt();
    }
  });

  attempt();

  return () => {
    if (!active) {
      return;
    }
    active = false;
    appStateSubscription.remove();
    unsubscribeRefresh?.();
    unsubscribeRefresh = null;
  };
}
