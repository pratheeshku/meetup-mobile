/**
 * Profile API (DES-MEETUP-MOBILE.md §4.13, §7.2; R-124).
 *
 * All calls go through the shared `apiClient` (`src/api/client.ts`) —
 * auth header injection, correlation ID propagation, and the 401
 * refresh-and-retry flow are already handled there and are not
 * duplicated here.
 *
 * Each function accepts an optional trailing `{ correlationId }` so a
 * caller performing a multi-call logical action (e.g. update, then
 * re-fetch to refresh the displayed profile) can thread one shared
 * correlation ID through both calls per §3.12/R-113 — the same pattern
 * already established in `src/notifications/fcm.ts` and
 * `src/api/events.ts`. A call made without one still gets a valid,
 * traceable per-call ID from the client's own fallback.
 *
 * `requestDeletion()`/`confirmDeletion()` are deliberately left as two
 * independent calls, not threaded onto a shared correlation ID: §4.13's
 * flow puts a real-world gap between them (the user has to go read an
 * email), so they are two separate logical user actions, not one
 * multi-call sequence (§3.12's own worked example — "challenge -> verify
 * -> submit" — describes calls made back-to-back within one user
 * gesture, which this is not).
 */
import { apiClient } from './client';
import type { SkillLevelValue, UpdateProfilePayload, UserProfile } from '../types/user';

interface RequestOptions {
  correlationId?: string;
}

export async function getProfile(options?: RequestOptions): Promise<UserProfile> {
  const { data } = await apiClient.get<UserProfile>('/users/me', {
    correlationId: options?.correlationId,
  });
  return data;
}

export async function updateProfile(
  payload: UpdateProfilePayload,
  options?: RequestOptions,
): Promise<void> {
  await apiClient.patch('/users/me', payload, { correlationId: options?.correlationId });
}

export async function updateSkillLevel(
  sport: string,
  skill_level: SkillLevelValue,
  options?: RequestOptions,
): Promise<void> {
  await apiClient.put(
    '/users/me/skill-level',
    { sport, skill_level },
    { correlationId: options?.correlationId },
  );
}

/**
 * Triggers the backend to send a confirmation code to the user's email
 * (§4.13). The code itself is never returned in this response — it is
 * delivered out-of-band, matching an email-based confirmation flow and
 * never exposing the token to a channel where R-111/§5.4-style logging
 * hygiene would need to guard it client-side.
 */
export async function requestDeletion(): Promise<void> {
  await apiClient.post('/users/me/deletion-request');
}

/**
 * Proposed Assumption: the request body field name for the confirmation
 * code is not specified anywhere in the local design excerpt. Used
 * `confirmation_token` (snake_case), matching this backend's dominant
 * JSON convention elsewhere (e.g. `access_token`/`refresh_token`,
 * event fields like `starts_at`/`participant_count`). Correct against
 * the actual backend contract on conformance review.
 */
export async function confirmDeletion(confirmationToken: string): Promise<void> {
  await apiClient.post('/users/me/deletion-confirm', { confirmation_token: confirmationToken });
}
