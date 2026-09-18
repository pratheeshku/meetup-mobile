/**
 * Notification preferences API (DES-MEETUP-MOBILE.md §4.8, §7.6; R-076).
 *
 * All calls go through the shared `apiClient` (`src/api/client.ts`) — auth
 * header injection, correlation ID propagation, and the 401
 * refresh-and-retry flow are already handled there and are not duplicated
 * here, matching the established pattern in `src/api/groups.ts` and
 * `src/api/events.ts`.
 *
 * Never logs notification content or preference values (R-111, §5.4).
 */
import { apiClient } from './client';
import type {
  NotificationPreference,
  NotificationType,
} from '../types/notification';

interface RequestOptions {
  correlationId?: string;
}

/**
 * Full-contract-audit fix (2026-09-18, see
 * docs/reports/AUDIT-API-CONTRACTS-2026-09-18.md), confirmed against the
 * live backend's OpenAPI schema: `GET /notifications/preferences` returns
 * `NotificationPreferencesResponse`, `{ preferences: NotificationPreferenceItem[] }`
 * — an envelope object, not a bare array (the same class of bug
 * `src/api/events.ts` had, in the opposite direction). Each item's own
 * shape (`{ notification_type, enabled }`) already matched
 * `NotificationPreference` exactly — only the envelope needed unwrapping.
 */
interface NotificationPreferencesApiResponse {
  preferences: NotificationPreference[];
}

/** `GET /notifications/preferences` (§7.6). */
export async function getPreferences(
  options?: RequestOptions,
): Promise<NotificationPreference[]> {
  const { data } = await apiClient.get<NotificationPreferencesApiResponse>(
    '/notifications/preferences',
    {
      correlationId: options?.correlationId,
    },
  );
  return data.preferences;
}

/**
 * Verified compatible against the live OpenAPI schema: path
 * `/notifications/preferences/{notification_type}` and body `{ enabled }`
 * match `NotificationPreferenceUpdate` exactly — no fix needed.
 * `PUT /notifications/preferences/{type}` (§7.6).
 */
export async function updatePreference(
  type: NotificationType,
  enabled: boolean,
  options?: RequestOptions,
): Promise<void> {
  await apiClient.put(
    `/notifications/preferences/${type}`,
    { enabled },
    { correlationId: options?.correlationId },
  );
}
