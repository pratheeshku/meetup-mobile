/**
 * App version policy (DES-MEETUP-ADDENDUM-app-update-prompt 4.2, 4.3).
 *
 * Contract: `GET {API host}/app/version-policy` returns
 *   {
 *     "android": { "min_version_code": int, "store_url": str, "latest_version_code": int },
 *     "ios": { "min_build": int, "latest_build": int, "store_url": str },
 *     "reminder_hours": int
 *   }
 * `latest_version_code`, `ios` and `reminder_hours` are additive (AD-5): an older server omits them, and then the
 * latest build is "off", iOS shows nothing and the reminder is 24 hours. A value of 0 turns that check off (AU-03).
 *
 * Uses its OWN bare axios instance — not `apiClient` — so the request carries
 * no `Authorization` header (no interceptors) and no cookies
 * (`withCredentials: false`, which React Native's networking layer enforces by
 * swapping in `CookieJar.NO_COOKIES`). The host is the single config constant
 * `ENV.API_BASE_URL`.
 *
 * FAILS OPEN (AD-9): every failure (network error, timeout, non-200, malformed)
 * resolves `null`, meaning "no prompt, not blocked". A platform object that is
 * malformed is `null` on its own. `fetchVersionPolicy` never rejects. Only an
 * error TAG is ever logged, never a value from the response (R-111).
 */
import axios from 'axios';

import { ENV } from '../../config/env';
import { describeError } from '../utils/logSafeError';

export type UpdatePlatform = 'android' | 'ios';

export interface PlatformVersionPolicy {
  /** Lowest installed build still allowed to run; 0 = off. */
  minBuild: number;
  /** Newest build in the store; older builds get the optional prompt; 0 = off. */
  latestBuild: number;
  /** Store page the backend wants users sent to (UNVALIDATED; resolve with `resolveUpdateUrl`). */
  storeUrl: string | null;
}

export interface VersionPolicy {
  android: PlatformVersionPolicy | null;
  ios: PlatformVersionPolicy | null;
  /** Hours the optional prompt stays away after Later (AD-7); 1 or more. */
  reminderHours: number;
}

/** AD-7 default when the server does not send `reminder_hours`. */
export const DEFAULT_REMINDER_HOURS = 24;

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

const isBuild = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;

/** Optional build field: absent means 0 (off); present but not a whole number makes the platform malformed. */
function optionalBuild(value: unknown): number | null {
  if (value === undefined || value === null) {
    return 0;
  }
  return isBuild(value) ? value : null;
}

/**
 * Android keeps today's rules (a non-negative whole `min_version_code` and a non-empty `store_url` string) so the
 * existing contract is read exactly as before; `latest_version_code` is optional.
 */
function parseAndroid(android: unknown): PlatformVersionPolicy | null {
  if (typeof android !== 'object' || android === null) {
    return null;
  }
  const {
    min_version_code: minBuild,
    store_url: storeUrl,
    latest_version_code: latestRaw,
  } = android as Record<string, unknown>;
  const latestBuild = optionalBuild(latestRaw);
  if (!isBuild(minBuild) || latestBuild === null) {
    return null;
  }
  if (typeof storeUrl !== 'string' || storeUrl.length === 0) {
    return null;
  }
  return { minBuild, latestBuild, storeUrl };
}

function parseIos(ios: unknown): PlatformVersionPolicy | null {
  if (typeof ios !== 'object' || ios === null) {
    return null;
  }
  const { min_build: minRaw, latest_build: latestRaw, store_url: storeUrl } = ios as Record<string, unknown>;
  const minBuild = optionalBuild(minRaw);
  const latestBuild = optionalBuild(latestRaw);
  if (minBuild === null || latestBuild === null) {
    return null;
  }
  if (storeUrl !== undefined && storeUrl !== null && typeof storeUrl !== 'string') {
    return null;
  }
  return { minBuild, latestBuild, storeUrl: typeof storeUrl === 'string' && storeUrl.length > 0 ? storeUrl : null };
}

/**
 * Validates the response body. Returns `null` when neither platform is readable. Each platform is `null` on its own
 * when its object is missing or malformed. `reminder_hours` that is missing or below 1 means the 24-hour default.
 */
export function parseVersionPolicy(body: unknown): VersionPolicy | null {
  if (typeof body !== 'object' || body === null) {
    return null;
  }
  const record = body as Record<string, unknown>;
  const android = parseAndroid(record.android);
  const ios = parseIos(record.ios);
  if (!android && !ios) {
    return null;
  }
  const reminder = record.reminder_hours;
  const reminderHours = isBuild(reminder) && reminder >= 1 ? reminder : DEFAULT_REMINDER_HOURS;
  return { android, ios, reminderHours };
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
