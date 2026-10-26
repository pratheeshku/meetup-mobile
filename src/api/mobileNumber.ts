/**
 * Mobile number endpoints (DES-MEETUP-ADDENDUM-profile-onboarding.md §4.1,
 * §5, AD-1, AD-3, AD-9). Contract verified against the live OpenAPI
 * document (`GET /openapi.json`):
 * - `GET /public/consent/mobile-number` -> `{ version, text }` (unauthenticated)
 * - `GET /public/country-codes` -> `[{ iso2, name, dial_code, sort_order,
 *   enabled }]` in `sort_order` (unauthenticated)
 * - `PATCH /users/me` with `UserUpdate.mobile_number: string | null` and
 *   `mobile_consent_version: string | null` (absent = unchanged, null = clear)
 *
 * The mobile number is PII: nothing here logs it, and error helpers never
 * read or echo the submitted value (R-111 spirit, §8 "log counts only").
 */
import { apiClient } from './client';

interface RequestOptions {
  correlationId?: string;
}

export interface MobileConsent {
  version: string;
  text: string;
}

export interface CountryCode {
  iso2: string;
  name: string;
  /** With the leading plus, e.g. `+65`. */
  dial_code: string;
  sort_order: number;
  enabled: boolean;
}

export async function getMobileConsent(options?: RequestOptions): Promise<MobileConsent> {
  const { data } = await apiClient.get<MobileConsent>('/public/consent/mobile-number', {
    correlationId: options?.correlationId,
  });
  return { version: data.version, text: data.text };
}

/**
 * Enabled rows, in the server's `sort_order` (the CSV order is authoritative:
 * the FIRST row is the default country, AD-9 v1.3). Never hardcoded or
 * re-sorted on the client.
 */
export async function getCountryCodes(options?: RequestOptions): Promise<CountryCode[]> {
  const { data } = await apiClient.get<CountryCode[]>('/public/country-codes', {
    correlationId: options?.correlationId,
  });
  return data.filter(row => row.enabled !== false);
}

/**
 * The caller's OWN stored number (`GET /users/me`), to prefill a payee number the organizer then edits (teams-payments AD-7). Null when none or unreadable.
 * Never logged and never sent anywhere but back to the organizer's own form.
 */
export async function getOwnMobileNumber(options?: RequestOptions): Promise<string | null> {
  const { data } = await apiClient.get<{ mobile_number?: string | null }>('/users/me', {
    correlationId: options?.correlationId,
  });
  return typeof data?.mobile_number === 'string' && data.mobile_number ? data.mobile_number : null;
}

export interface UpdateMobileNumberPayload {
  /** E.164 string, or `null` to clear. */
  mobile_number: string | null;
  /** Required when setting a number; omitted when clearing. */
  mobile_consent_version?: string;
}

export async function updateMobileNumber(
  payload: UpdateMobileNumberPayload,
  options?: RequestOptions,
): Promise<void> {
  await apiClient.patch('/users/me', payload, { correlationId: options?.correlationId });
}

export type MobileNumberFailure = 'consent_version_stale' | 'invalid_number' | 'other';

/**
 * Classifies a failed save WITHOUT reading the response body's values:
 * 409 is `consent_version_stale`, 422 is an invalid number (the server's 422
 * body must not echo the value, and this never surfaces it either).
 */
export function classifyMobileNumberError(error: unknown): MobileNumberFailure {
  const status = (error as { response?: { status?: number } } | null)?.response?.status;
  if (status === 409) {
    return 'consent_version_stale';
  }
  if (status === 422) {
    return 'invalid_number';
  }
  return 'other';
}
