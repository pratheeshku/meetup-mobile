/**
 * Force-update version policy (approved deviation — the requirement and design
 * amendment are deliberately deferred).
 *
 * Contract: `GET {API host}/app/version-policy` returns
 *   { "android": { "min_version_code": int, "store_url": "https://play.google.com/..." } }
 *
 * Uses its OWN bare axios instance — not `apiClient` — so the request carries
 * no `Authorization` header (no interceptors) and no cookies
 * (`withCredentials: false`, which React Native's networking layer enforces by
 * swapping in `CookieJar.NO_COOKIES`). The host is the single config constant
 * `ENV.API_BASE_URL`.
 *
 * FAILS OPEN: every failure (network error, timeout, non-200, malformed or
 * missing field) resolves `null`, meaning "no update required". `fetchVersionPolicy`
 * never rejects. Only an error TAG is ever logged, never a value from the
 * response (R-111).
 */
import axios from 'axios';

import { ENV } from '../../config/env';
import { describeError } from '../utils/logSafeError';

export interface VersionPolicy {
  /** Lowest installed `versionCode` still allowed to run. */
  minVersionCode: number;
  /** Store page the backend wants users sent to (validated before use). */
  storeUrl: string;
}

export const VERSION_POLICY_PATH = '/app/version-policy';

/**
 * In this React Native version the request timeout becomes OkHttp's
 * `callTimeout` (whole call: DNS, connect, TLS, response), so it is a real
 * ceiling even though OkHttp's own connect/read timeouts default to 0.
 */
export const VERSION_POLICY_TIMEOUT_MS = 5_000;

// Exported ONLY so tests can stub the transport; feature code uses
// `fetchVersionPolicy`.
export const versionPolicyClient = axios.create({
  baseURL: ENV.API_BASE_URL,
  timeout: VERSION_POLICY_TIMEOUT_MS,
  withCredentials: false,
});

/**
 * Validates the response body. Returns `null` for anything that is not exactly
 * the documented shape: a missing or non-object `android`, a `min_version_code`
 * that is not a non-negative safe integer, or a missing/empty `store_url`.
 */
export function parseVersionPolicy(body: unknown): VersionPolicy | null {
  if (typeof body !== 'object' || body === null) {
    return null;
  }
  const android = (body as { android?: unknown }).android;
  if (typeof android !== 'object' || android === null) {
    return null;
  }

  const { min_version_code: minVersionCode, store_url: storeUrl } = android as {
    min_version_code?: unknown;
    store_url?: unknown;
  };
  if (
    typeof minVersionCode !== 'number' ||
    !Number.isSafeInteger(minVersionCode) ||
    minVersionCode < 0
  ) {
    return null;
  }
  if (typeof storeUrl !== 'string' || storeUrl.length === 0) {
    return null;
  }
  return { minVersionCode, storeUrl };
}

/** Fetches the policy once. Resolves `null` on ANY failure (fail open); never rejects. */
export async function fetchVersionPolicy(): Promise<VersionPolicy | null> {
  let tag = 'unknown';
  try {
    const response = await versionPolicyClient.get<unknown>(VERSION_POLICY_PATH);
    if (response.status !== 200) {
      tag = `status-${response.status}`;
    } else {
      const policy = parseVersionPolicy(response.data);
      if (policy) {
        return policy;
      }
      tag = 'malformed';
    }
  } catch (error) {
    tag = describeError(error);
  }
  console.log('[update] version policy unavailable; not blocking', tag);
  return null;
}
