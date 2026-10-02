/**
 * iOS device identifier (DES-MEETUP-ADDENDUM-IOS-App.md §3).
 *
 * iOS has no equivalent of `ANDROID_ID`, so a UUIDv4 is generated once and
 * kept in the Keychain. Keychain items survive an app reinstall, which is the
 * "same physical device" boundary the backend's `(user, platform, device_id)`
 * upsert needs. `AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY` keeps it readable by a
 * background push registration (device locked) and off backups/other devices.
 *
 * Never returns an empty string: if the Keychain cannot be read or written the
 * promise rejects instead (a failed read must not mint a replacement id, and
 * an unpersisted id would register a new "device" on every launch). The
 * caller (`deviceId.ts`) does not cache a rejection, and push registration
 * already retries on the next foreground.
 */
import * as Keychain from 'react-native-keychain';
import uuid from 'react-native-uuid';

const DEVICE_ID_SERVICE = 'com.meetupmobile.deviceId';
const DEVICE_ID_USERNAME = 'device_id';

export async function getOrCreateKeychainDeviceId(): Promise<string> {
  const existing = await Keychain.getGenericPassword({ service: DEVICE_ID_SERVICE });
  if (existing && existing.password) {
    return existing.password;
  }

  const deviceId = uuid.v4() as string;
  const saved = await Keychain.setGenericPassword(DEVICE_ID_USERNAME, deviceId, {
    service: DEVICE_ID_SERVICE,
    accessible: Keychain.ACCESSIBLE.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
  });
  if (!saved) {
    throw new Error('Failed to persist device id to secure storage');
  }
  return deviceId;
}
