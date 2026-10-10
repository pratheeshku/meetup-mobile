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
 *
 * Perf instrumentation (perf-diagnostics task, Item C):
 *   - Every call to getAccessToken() and saveTokens() is wrapped with a
 *     perfLog span: duration_ms, call count, and in-flight concurrency.
 *   - The token value itself is never logged (R-014/R-111/P10).
 */
import * as Keychain from 'react-native-keychain';
import { perfLog, startSpan } from '../diagnostics/perfLog';

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

// ── Perf diagnostics: in-flight concurrency tracking (Item C) ────────────────
let _keychainInFlight = 0;

/**
 * Persists the session tokens.
 *
 * The backend's `TokenResponse` carries no `refresh_token`: the refresh token
 * is an HttpOnly cookie held by the networking layer (see `api/client.ts`,
 * `api/cookies.ts`), so in normal operation only the access token is stored
 * here. `refresh` stays optional — when absent (`undefined`, `null` or empty)
 * only the access token is written and the Keychain refresh entry is left
 * untouched, because writing an empty password is rejected natively.
 */
export async function saveTokens(access: string, refresh?: string | null): Promise<void> {
  _keychainInFlight++;
  const endSpan = startSpan('keychain_write', { in_flight: _keychainInFlight });
  try {
    const writes: Array<ReturnType<typeof Keychain.setGenericPassword>> = [
      Keychain.setGenericPassword(ACCESS_TOKEN_USERNAME, access, {
        ...KEYCHAIN_OPTIONS,
        service: ACCESS_TOKEN_SERVICE,
      }),
    ];
    if (refresh) {
      writes.push(
        Keychain.setGenericPassword(REFRESH_TOKEN_USERNAME, refresh, {
          ...KEYCHAIN_OPTIONS,
          service: REFRESH_TOKEN_SERVICE,
        }),
      );
    }

    const [accessResult, refreshResult] = await Promise.all(writes);

    if (!accessResult || (refresh && !refreshResult)) {
      throw new Error('Failed to persist tokens to secure storage');
    }

    logStorageBacking('access token', accessResult.storage);
    if (refreshResult) {
      logStorageBacking('refresh token', refreshResult.storage);
    }
    endSpan({ wrote_refresh: !!refresh });
  } catch (err) {
    endSpan({ error: true });
    throw err;
  } finally {
    _keychainInFlight--;
  }
}

export async function getAccessToken(): Promise<string | null> {
  _keychainInFlight++;
  const endSpan = startSpan('keychain_read', { in_flight: _keychainInFlight });
  try {
    const result = await Keychain.getGenericPassword({ service: ACCESS_TOKEN_SERVICE });
    const found = !!result;
    endSpan({ found });
    return result ? result.password : null;
  } catch (err) {
    endSpan({ error: true });
    throw err;
  } finally {
    _keychainInFlight--;
  }
}

export async function clearTokens(): Promise<void> {
  // clearTokens is internal cleanup; no perf span needed (not on the
  // critical path being measured).
  await Promise.all([
    Keychain.resetGenericPassword({ service: ACCESS_TOKEN_SERVICE }),
    Keychain.resetGenericPassword({ service: REFRESH_TOKEN_SERVICE }),
  ]);
}

// ── Diagnostics: log flag resolution event (boot timeline, Item B) ──────────
/**
 * Called by AuthContext after resolving the perf runtime flag, so the boot
 * timeline records when Keychain was first instrumented.
 * No-op when perfLog is disabled.
 */
export function logKeychainReady(): void {
  perfLog('boot_keychain_ready');
}
