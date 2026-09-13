/**
 * Secure token storage.
 *
 * Access and refresh tokens are stored exclusively via `react-native-keychain`,
 * backed by the Android Keystore — never `AsyncStorage`, never logged.
 * Per DES-MEETUP-MOBILE.md §3.4 (R-014):
 *   - `accessible: WHEN_UNLOCKED_THIS_DEVICE_ONLY` — never migrates off-device,
 *     never readable while the device is locked.
 *   - `storage` is intentionally left unset so the library selects the best
 *     available backing (hardware-backed Keystore where supported, with an
 *     automatic software-backed AES fallback on devices that lack it) — the
 *     fallback is logged as a non-PII flag only, never the token value.
 *
 * The access token and refresh token are stored as two independent generic
 * password entries, distinguished by `service`, since a single keychain
 * entry holds one username/password pair.
 */
import * as Keychain from 'react-native-keychain';

const ACCESS_TOKEN_SERVICE = 'com.meetupmobile.auth.accessToken';
const REFRESH_TOKEN_SERVICE = 'com.meetupmobile.auth.refreshToken';

// Keychain's generic-password API requires a username; the value itself is
// carried entirely in the password field, so the username is a fixed,
// non-secret placeholder distinct per service.
const ACCESS_TOKEN_USERNAME = 'access_token';
const REFRESH_TOKEN_USERNAME = 'refresh_token';

const KEYCHAIN_OPTIONS: Keychain.SetOptions = {
  accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

function logStorageBacking(label: string, storage: Keychain.STORAGE_TYPE | undefined): void {
  // Non-PII fleet-visibility flag only (§3.4 trade-off) — never logs the
  // token value itself.
  if (storage === Keychain.STORAGE_TYPE.AES_CBC) {
    console.warn(`[tokens] ${label} stored with a legacy, unauthenticated backing (${storage})`);
  }
}

export async function saveTokens(access: string, refresh: string): Promise<void> {
  const [accessResult, refreshResult] = await Promise.all([
    Keychain.setGenericPassword(ACCESS_TOKEN_USERNAME, access, {
      ...KEYCHAIN_OPTIONS,
      service: ACCESS_TOKEN_SERVICE,
    }),
    Keychain.setGenericPassword(REFRESH_TOKEN_USERNAME, refresh, {
      ...KEYCHAIN_OPTIONS,
      service: REFRESH_TOKEN_SERVICE,
    }),
  ]);

  if (!accessResult || !refreshResult) {
    throw new Error('Failed to persist tokens to secure storage');
  }

  logStorageBacking('access token', accessResult.storage);
  logStorageBacking('refresh token', refreshResult.storage);
}

export async function getAccessToken(): Promise<string | null> {
  const result = await Keychain.getGenericPassword({ service: ACCESS_TOKEN_SERVICE });
  return result ? result.password : null;
}

export async function getRefreshToken(): Promise<string | null> {
  const result = await Keychain.getGenericPassword({ service: REFRESH_TOKEN_SERVICE });
  return result ? result.password : null;
}

export async function clearTokens(): Promise<void> {
  await Promise.all([
    Keychain.resetGenericPassword({ service: ACCESS_TOKEN_SERVICE }),
    Keychain.resetGenericPassword({ service: REFRESH_TOKEN_SERVICE }),
  ]);
}
