/**
 * Shared Axios API client (DES-MEETUP-MOBILE.md §3.3, §5.1).
 *
 * Scaffold scope for this pass: auth header injection, correlation ID
 * injection, and the 401 refresh-and-retry-once flow, per the
 * implementation brief's Step 5. The full four-interceptor composition
 * from §3.3 (retry/backoff allowlist and the per-endpoint-family Circuit
 * Breaker) is designed but not yet built — tracked as a follow-up in the
 * Implementation Report, not silently included or silently dropped.
 *
 * Security (R-111, P10): tokens are never logged, printed, or included in
 * thrown-error messages anywhere in this module.
 */
import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { ENV } from '../../config/env';
import { getAccessToken, getRefreshToken, saveTokens, clearTokens } from '../storage/tokens';
import { generateCorrelationId } from './correlationId';
import { authEvents } from './authEvents';

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

/**
 * Proposed Assumption (Implementation Report #1): the exact response body
 * of `POST /auth/refresh` is not specified in DES-MEETUP-MOBILE.md's local
 * excerpt (it references DES-MEETUP.md §6, not available in this repo).
 * Assumed conservative, standard OAuth2/FastAPI convention below; correct
 * on conformance review against the actual backend contract.
 */
interface RefreshResponse {
  access_token: string;
  refresh_token: string;
}

export const apiClient = axios.create({
  baseURL: ENV.API_BASE_URL,
  timeout: 30_000,
});

// A bare instance with no interceptors, used only for the refresh call
// itself — prevents the refresh request from recursing through the 401
// handler below.
const refreshClient = axios.create({
  baseURL: ENV.API_BASE_URL,
  timeout: 30_000,
});

apiClient.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  const accessToken = await getAccessToken();
  if (accessToken) {
    config.headers.set('Authorization', `Bearer ${accessToken}`);
  }

  config.headers.set(ENV.CORRELATION_ID_HEADER, config.correlationId ?? generateCorrelationId());

  return config;
});

// Concurrent 401s share a single in-flight refresh call rather than each
// triggering their own POST /auth/refresh.
let inFlightRefresh: Promise<string> | null = null;

async function refreshAccessToken(): Promise<string> {
  if (!inFlightRefresh) {
    inFlightRefresh = (async () => {
      const refreshToken = await getRefreshToken();
      if (!refreshToken) {
        throw new Error('No refresh token available');
      }
      const { data } = await refreshClient.post<RefreshResponse>('/auth/refresh', {
        refresh_token: refreshToken,
      });
      await saveTokens(data.access_token, data.refresh_token);
      return data.access_token;
    })();
  }

  try {
    return await inFlightRefresh;
  } finally {
    inFlightRefresh = null;
  }
}

apiClient.interceptors.response.use(
  response => response,
  async (error: AxiosError) => {
    const { config, response } = error;

    if (response?.status !== 401 || !config || config._retriedAfterRefresh) {
      if (response?.status === 401 && config?._retriedAfterRefresh) {
        // Persistent 401 after a refresh attempt already happened this
        // request: refresh did not restore a valid session.
        await clearTokens();
        authEvents.emit('auth-expired');
      }
      return Promise.reject(error);
    }

    try {
      const newAccessToken = await refreshAccessToken();
      config._retriedAfterRefresh = true;
      config.headers.set('Authorization', `Bearer ${newAccessToken}`);
      return apiClient(config);
    } catch {
      await clearTokens();
      authEvents.emit('auth-expired');
      return Promise.reject(error);
    }
  },
);
