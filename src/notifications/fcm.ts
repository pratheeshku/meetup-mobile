/**
 * FCM setup scaffold (DES-MEETUP-MOBILE.md §3.6, R-070–R-076).
 *
 * These functions are standalone building blocks, not yet wired into the
 * sign-in / cold-start lifecycle described in §3.6 — that wiring depends
 * on the auth flow (§3.5), which is not built in this scaffold pass. No
 * screen calls these yet.
 *
 * Never logs the FCM token itself, per R-111 (§5.4 requires it excluded
 * "beyond a truncated reference").
 */
import { Platform, PermissionsAndroid } from 'react-native';
import { getApp } from '@react-native-firebase/app';
import {
  getMessaging,
  requestPermission as requestFirebasePermission,
  AuthorizationStatus,
  getToken as getFcmToken,
  onTokenRefresh as onFcmTokenRefresh,
  onMessage as onFcmMessage,
} from '@react-native-firebase/messaging';

import { apiClient } from '../api/client';

const messaging = getMessaging(getApp());

/**
 * Requests notification permission.
 *
 * Android 13+ (API 33+) requires the runtime `POST_NOTIFICATIONS`
 * permission (R-072); API 26–32 need no runtime prompt at all, per
 * §3.6. A rationale dialog shown before this call is a screen-level
 * concern (§4.8, "Notification Permission rationale") not built yet —
 * tracked as a follow-up.
 */
export async function requestPermission(): Promise<boolean> {
  if (Platform.OS === 'android' && Platform.Version >= 33) {
    const result = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
    );
    return result === PermissionsAndroid.RESULTS.GRANTED;
  }

  // Pre-33 Android needs no runtime prompt. `messaging().requestPermission()`
  // itself is a deprecated, largely iOS-oriented API in this SDK version;
  // calling it here would not reflect Android's actual permission model.
  const status = await requestFirebasePermission(messaging);
  return status === AuthorizationStatus.AUTHORIZED || status === AuthorizationStatus.PROVISIONAL;
}

/**
 * Proposed Assumption (Implementation Report #2): the exact `userAgent`
 * string format expected by `POST /notifications/mobile-subscriptions` is
 * not specified in the local design excerpt. A minimal, non-PII
 * platform/version string is used below; correct against the actual
 * backend contract on conformance review.
 */
function buildUserAgent(): string {
  return `MeetupMobile-Android/${Platform.Version}`;
}

async function registerDeviceToken(deviceToken: string): Promise<void> {
  await apiClient.post('/notifications/mobile-subscriptions', {
    deviceToken,
    platform: 'android',
    userAgent: buildUserAgent(),
  });
}

/**
 * Retrieves the current FCM registration token and registers it with the
 * backend (R-070, R-029).
 */
export async function getToken(): Promise<string> {
  const token = await getFcmToken(messaging);
  await registerDeviceToken(token);
  return token;
}

/**
 * Silently re-registers the device token whenever FCM rotates it (R-075).
 * Returns the unsubscribe function.
 */
export function onTokenRefresh(): () => void {
  return onFcmTokenRefresh(messaging, async newToken => {
    try {
      await registerDeviceToken(newToken);
    } catch {
      // Best-effort re-registration; a failure here is not fatal to the
      // current session and will be retried on the next rotation or
      // cold start.
    }
  });
}

/**
 * Foreground message handler. Rendering via `notifee` (§3.6) is not part
 * of this scaffold pass — logs a minimal, non-sensitive marker only.
 * Never logs token or auth data (R-111).
 */
export function onMessage(): () => void {
  return onFcmMessage(messaging, remoteMessage => {
    console.log('[fcm] foreground message received', {
      messageId: remoteMessage.messageId,
      notificationType: remoteMessage.data?.notification_type,
    });
  });
}
