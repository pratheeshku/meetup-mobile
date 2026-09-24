/**
 * Stable per-device identifier for FCM push-token registration.
 *
 * Bug fix: registration previously sent only the FCM token. On every
 * rotation (reinstall, Play Services token refresh) the backend had no way
 * to recognize the request came from the same physical device, so it
 * inserted a new active row instead of updating the existing one — users
 * accumulated multiple active tokens and received every notification once
 * per stale row. `deviceId` lets the backend's registration function
 * `UPDATE ... ON CONFLICT` on (user, device) instead of always inserting.
 *
 * Android only, per current scope (iOS is not in play for this fix).
 *
 * Deliberately `Settings.Secure.ANDROID_ID` (via
 * `react-native-device-info`'s `getAndroidId()`), not a locally generated
 * UUID: a fresh UUID per install would defeat the fix by minting a "new
 * device" on every reinstall, which is exactly the bug being fixed.
 * `ANDROID_ID` survives reinstall and FCM token rotation and only changes
 * on a factory reset / signing-key change — the correct "new device"
 * boundary here.
 *
 * No local persistence: the value is stable by construction (re-reading it
 * always returns the same string for the life of the install). It is
 * memoized in-module only to avoid repeated native-bridge calls within a
 * process lifetime, per the task brief's "persist nothing extra
 * client-side" instruction.
 */
import { Platform } from 'react-native';
import DeviceInfo from 'react-native-device-info';

let cachedDeviceIdPromise: Promise<string> | null = null;

/** Resolves the stable device id to send with every push-token registration. */
export function getDeviceId(): Promise<string> {
  if (!cachedDeviceIdPromise) {
    cachedDeviceIdPromise =
      Platform.OS === 'android' ? DeviceInfo.getAndroidId() : Promise.resolve('');
  }
  return cachedDeviceIdPromise;
}

/** Test-only: clears the memoized value so each test starts fresh. */
export function __resetDeviceIdCacheForTests(): void {
  cachedDeviceIdPromise = null;
}
