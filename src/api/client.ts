/**
 * Shared Axios API client (DES-MEETUP-MOBILE.md §3.3, §5.1).
 *
 * Scaffold scope: auth header injection, correlation ID injection, and the
 * 401 refresh-and-retry-once flow. The full four-interceptor composition from
 * §3.3 (retry/backoff allowlist and the per-endpoint-family Circuit Breaker)
 * is designed but not yet built — tracked as a follow-up, not silently
 * included or dropped.
 *
 * Refresh contract (verified read-only against the live OpenAPI + architect):
 *   - Login / OAuth callback return `{ access_token, user }` and set an
 *     HttpOnly, Secure cookie `refresh_token` (Path=/auth, 30 days). The
 *     mobile app never sees the refresh token.
 *   - `POST /auth/refresh` takes NO body and reads that cookie. It returns
 *     `{ access_token }`, `{ access_token: null }` when the cookie is missing,
 *     or 401 when the token is invalid, expired or reused.
 *   - Refresh tokens ROTATE on every call, and presenting the same cookie
 *     twice triggers reuse detection (the session family is revoked). Two
 *     refreshes must therefore never be in flight at once — see the
 *     single-flight below. Access tokens live 15 minutes.
 *
 * Cookies are handled by the networking layer, not this module (see
 * `./cookies.ts`); every request here sets `withCredentials: true` so the
 * cookie is sent and any `Set-Cookie` is stored.
 *
 * Security (R-111, P10): tokens are never logged, printed, or included in
 * thrown-error messages anywhere in this module.
 */
import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { ENV } from '../../config/env';
import { getAccessToken, saveTokens, clearTokens } from '../storage/tokens';
import { describeError } from '../utils/logSafeError';
import { generateCorrelationId } from './correlationId';
import { authEvents } from './authEvents';
import { clearCookieJar } from './cookies';

declare module 'axios' {
  export interface AxiosRequestConfig {
    /** Set via `withCorrelationId()` to share one ID across a logical
     * multi-call action (§3.12). Omit to get a fresh per-call ID. */
    correlationId?: string;
  }
  interface InternalAxiosRequestConfig {
    /** Internal — marks a request that has already gone through one
     * refresh-and-retry cycle, so it is never retried a second time. */
    _retriedAfterRefresh?: boolean;
  }
}

/** `POST /auth/refresh` response; `access_token` is null when the cookie is missing. */
interface RefreshResponse {
  access_token: string | null;
}

/**
 * The refresh proved the session is over: the backend has no session for this
 * cookie (`no-session`: `{ access_token: null }`) or rejected it
 * (`rejected`: 401 — invalid, expired or reused). Deliberately NOT thrown for
 * transport failures or 5xx, where the session may still be fine.
 */
export class SessionEndedError extends Error {
  readonly reason: 'no-session' | 'rejected';

  constructor(reason: 'no-session' | 'rejected') {
    super(`Session ended (${reason})`);
    this.name = 'SessionEndedError';
    this.reason = reason;
  }
}

/** A refresh is a tiny request; do not leave a splash screen waiting 30 s on it. */
const REFRESH_TIMEOUT_MS = 10_000;

/** Auth endpoints answer 401 for reasons a refresh cannot fix (e.g. wrong password). */
const AUTH_PATH_PREFIX = '/auth/';

export const apiClient = axios.create({
  baseURL: ENV.API_BASE_URL,
  timeout: 30_000,
  withCredentials: true,
});

// A bare instance with no interceptors, used only for the refresh call
// itself — prevents the refresh request from recursing through the 401
// handler below, and means a refresh is never retried. Exported ONLY so tests
// can stub its transport; feature code must use `apiClient`.
export const refreshClient = axios.create({
  baseURL: ENV.API_BASE_URL,
  timeout: REFRESH_TIMEOUT_MS,
  withCredentials: true,
});

apiClient.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  const accessToken = await getAccessToken();
  if (accessToken) {
    config.headers.set('Authorization', `Bearer ${accessToken}`);
  }

  config.headers.set(ENV.CORRELATION_ID_HEADER, config.correlationId ?? generateCorrelationId());

  return config;
});

// Single-flight: at most one `POST /auth/refresh` in flight. Concurrent 401s
// share its result. The slot is released only when THIS attempt settles.
let inFlightRefresh: Promise<string> | null = null;

/**
 * Obtains a fresh access token via `POST /auth/refresh` (no body; the cookie
 * is sent by the networking layer), stores it, and returns it. Throws
 * `SessionEndedError` when the session is over, or the underlying error for
 * anything else (network, 5xx). Never retries.
 */
export function refreshAccessToken(): Promise<string> {
  if (inFlightRefresh) {
    return inFlightRefresh;
  }

  const attempt = (async (): Promise<string> => {
    let body: RefreshResponse | undefined;
    try {
      const response = await refreshClient.post<RefreshResponse>('/auth/refresh');
      body = response.data;
    } catch (error) {
      if ((error as AxiosError).response?.status === 401) {
        throw new SessionEndedError('rejected');
      }
      throw error;
    }

    const accessToken = body?.access_token;
    if (!accessToken) {
      throw new SessionEndedError('no-session');
    }
    await saveTokens(accessToken);
    return accessToken;
  })();

  inFlightRefresh = attempt;
  const release = (): void => {
    if (inFlightRefresh === attempt) {
      inFlightRefresh = null;
    }
  };
  attempt.then(release, release);
  return attempt;
}

let endingSession: Promise<void> | null = null;

/**
 * Ends the session locally: clears stored tokens and the cookie jar, then
 * raises `auth-expired` (which `AuthContext` turns into the logged-out state
 * and the "Session expired" notice). Every step is best-effort and the event
 * is ALWAYS raised — a failed local clear must not leave the user "signed in"
 * with a dead session. Concurrent callers share one run.
 */
export function endSession(): Promise<void> {
  if (!endingSession) {
    endingSession = (async () => {
      try {
        await clearTokens();
      } catch (error) {
        console.log('[auth] clearing tokens failed while ending session', describeError(error));
      }
      await clearCookieJar();
      authEvents.emit('auth-expired');
    })().finally(() => {
      endingSession = null;
    });
  }
  return endingSession;
}

apiClient.interceptors.response.use(
  response => response,
  async (error: AxiosError) => {
    const { config, response } = error;

    if (response?.status !== 401 || !config || config.url?.startsWith(AUTH_PATH_PREFIX)) {
      return Promise.reject(error);
    }

    if (config._retriedAfterRefresh) {
      // 401 even with a freshly issued token: the session cannot be recovered.
      await endSession();
      return Promise.reject(error);
    }

    try {
      const storedToken = await getAccessToken();
      if (!storedToken) {
        // Signed out (or a stray in-flight call after the session ended):
        // nothing to renew. App start refreshes explicitly (`AuthContext`).
        return Promise.reject(error);
      }

      // If the token this request was sent with is no longer the stored one, a
      // refresh already completed since. Retry with the current token rather
      // than spend another rotation on it.
      const sentAuthorization = config.headers.get('Authorization');
      const token =
        sentAuthorization !== `Bearer ${storedToken}` ? storedToken : await refreshAccessToken();

      config._retriedAfterRefresh = true;
      config.headers.set('Authorization', `Bearer ${token}`);
      return apiClient(config);
    } catch (refreshError) {
      if (refreshError instanceof SessionEndedError) {
        await endSession();
      } else {
        // Transport failure / 5xx while refreshing: the session may be fine, so
        // keep it. This request fails with its original 401; the next request
        // that hits a 401 will try a refresh again.
        console.log('[auth] token refresh failed; session kept', describeError(refreshError));
      }
      return Promise.reject(error);
    }
  },
);
