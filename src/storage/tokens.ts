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
 *   - The access token is additionally held in memory for the process
 *     lifetime: read from Keystore once at cold start and again only when the
 *     cache is empty (after a failed save, a clear, or a process start).
 *     Keystore remains the sole persistent store. The refresh token is never
 *     cached in memory.
 *
 * The access token and refresh token are stored as two independent generic
 * password entries, distinguished by `service`, since a single keychain
 * entry holds one username/password pair.
 *
 * Perf instrumentation (perf-diagnostics task):
 *   - A cache hit logs `token_cache_hit` (no duration span, no Keychain call).
 *   - A miss keeps the `keychain_read` span (`cache: 'miss'`, `first_read`,
 *     and `storage` when Keychain returns it).
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

// ── Perf diagnostics: in-flight concurrency tracking ─────────────────────────
let _keychainInFlight = 0;

// ── In-memory access token (DES-MEETUP-MOBILE §3.4) ─────────────────────────
// Access token only. The refresh token is never stored here.
let memoryAccess: string | null = null;
// Single-flight cold read. Concurrent callers share this promise.
let readFlight: Promise<string | null> | null = null;
// Bumped on every save and clear. A cold read that finishes after a save or
// clear started must not publish its result into the cache.
let generation = 0;
// Saves and clears in progress. A read must not publish while one is active.
let mutations = 0;
// First Keychain read of this process (diagnostics only).
let didKeychainRead = false;

function publishRead(token: string | null, genAtStart: number): void {
  // Cache only a non-null result, and only if no save/clear started after
  // this read began (generation) and none is still in flight (mutations).
  if (token !== null && genAtStart === generation && mutations === 0) {
    memoryAccess = token;
  }
}

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
  const myGen = ++generation;
  mutations += 1;
  // Detach any cold read so a caller that arrives now does not join a read
  // that is no longer allowed to fill the cache.
  readFlight = null;

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

    // Set the in-memory copy only after the writes succeed and the failure
    // check above has passed. A newer save/clear owns the cache instead.
    if (myGen === generation) {
      memoryAccess = access;
      generation += 1;
    }
    endSpan({ wrote_refresh: !!refresh });
  } catch (err) {
    // Failed write: drop the in-memory copy so the next read goes to Keychain.
    // A newer save/clear owns the cache instead.
    if (myGen === generation) {
      memoryAccess = null;
      generation += 1;
    }
    endSpan({ error: true });
    throw err;
  } finally {
    mutations -= 1;
    _keychainInFlight--;
  }
}

export async function getAccessToken(): Promise<string | null> {
  if (memoryAccess !== null) {
    perfLog('token_cache_hit');
    return memoryAccess;
  }

  // Concurrent callers during a cold read share one in-flight Keychain read.
  if (readFlight) {
    return readFlight;
  }

  const genAtStart = generation;
  const firstRead = !didKeychainRead;
  didKeychainRead = true;

  _keychainInFlight++;
  const endSpan = startSpan('keychain_read', {
    in_flight: _keychainInFlight,
    cache: 'miss',
    first_read: firstRead,
  });

  // Holder so the in-flight promise can clear itself without referring to
  // the const before it is assigned.
  const gate: { current: Promise<string | null> | null } = { current: null };
  const flight = (async (): Promise<string | null> => {
    try {
      const result = await Keychain.getGenericPassword({ service: ACCESS_TOKEN_SERVICE });
      const found = !!result;
      const storage = result ? result.storage : undefined;
      endSpan({
        found,
        ...(storage !== undefined ? { storage } : {}),
      });
      const token = result ? result.password : null;
      publishRead(token, genAtStart);
      return token;
    } catch (err) {
      endSpan({ error: true });
      throw err;
    } finally {
      _keychainInFlight--;
      if (readFlight === gate.current) {
        readFlight = null;
      }
    }
  })();

  gate.current = flight;
  readFlight = flight;
  return flight;
}

export async function clearTokens(): Promise<void> {
  // Invalidate the in-memory copy FIRST, before the Keychain resets.
  memoryAccess = null;
  const myGen = ++generation;
  mutations += 1;
  readFlight = null;
  try {
    await Promise.all([
      Keychain.resetGenericPassword({ service: ACCESS_TOKEN_SERVICE }),
      Keychain.resetGenericPassword({ service: REFRESH_TOKEN_SERVICE }),
    ]);
  } finally {
    mutations -= 1;
    // A cold read that sampled this generation must not refill the cache.
    if (myGen === generation) {
      memoryAccess = null;
      generation += 1;
    }
  }
}

// ── Diagnostics: log flag resolution event (boot timeline) ───────────────────
/**
 * Called by AuthContext after resolving the perf runtime flag, so the boot
 * timeline records when Keychain was first instrumented.
 * No-op when perfLog is disabled.
 */
export function logKeychainReady(): void {
  perfLog('boot_keychain_ready');
}
