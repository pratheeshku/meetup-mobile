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
import type { SkillLevel, SkillLevelValue, UpdateProfilePayload, UserProfile } from '../types/user';

interface RequestOptions {
  correlationId?: string;
}

/**
 * Full-contract-audit fix (2026-09-18, see
 * docs/reports/AUDIT-API-CONTRACTS-2026-09-18.md), confirmed against the
 * live backend's `PrivateUserProfile` OpenAPI schema — see
 * `../types/user.ts`'s `UserProfile` comment for the full per-field
 * write-up (what's fixed vs. flagged/BLOCKED).
 */
interface PrivateUserProfileApiItem {
  id: string;
  display_name: string;
  nickname: string;
  avatar_storage_key: string | null;
  created_at: string;
  email: string;
  is_admin: boolean;
}

function mapPrivateUserProfile(raw: PrivateUserProfileApiItem, skillLevels: SkillLevel[]): UserProfile {
  return {
    id: raw.id,
    email: raw.email,
    nickname: raw.nickname,
    display_name: raw.display_name,
    is_admin: raw.is_admin,
    created_at: raw.created_at,
    // BLOCKED, not guessed — see the type-level comment: no scheme exists
    // to turn `avatar_storage_key` into a displayable URL.
    avatar_url: null,
    // BLOCKED, not guessed — see the type-level comment: no `role` field
    // exists on the real response at all.
    role: undefined,
    skill_levels: skillLevels,
  };
}

/**
 * `GET /users/me/skill-levels` (plural) is a real, separate endpoint —
 * confirmed to exist against the live OpenAPI schema (the prior
 * assumption that skill levels were embedded in `GET /users/me` was
 * wrong; `PrivateUserProfile` has no such field). Its response schema is
 * undeclared in the live OpenAPI doc, so the exact field names are a
 * Proposed Assumption (mirrors the confirmed write-side
 * `UserSkillLevelUpdate` shape: `{ sport, skill_level }`), not verified
 * end-to-end. Fetched defensively (falls back to `[]` on any failure,
 * including an unexpected shape) so an unconfirmed secondary endpoint
 * can never break the whole profile load.
 */
async function getSkillLevels(options?: RequestOptions): Promise<SkillLevel[]> {
  try {
    const { data } = await apiClient.get<SkillLevel[]>('/users/me/skill-levels', {
      correlationId: options?.correlationId,
    });
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

export async function getProfile(options?: RequestOptions): Promise<UserProfile> {
  const correlationId = options?.correlationId;
  const [{ data: raw }, skillLevels] = await Promise.all([
    apiClient.get<PrivateUserProfileApiItem>('/users/me', { correlationId }),
    getSkillLevels({ correlationId }),
  ]);
  return mapPrivateUserProfile(raw, skillLevels);
}

/**
 * `PATCH /users/me` — body `UserUpdate` accepts `{ display_name?,
 * theme_preference? }` (confirmed against the live OpenAPI schema). The app
 * only sends `display_name`; `nickname` is unique and read-only, and there
 * is no `avatar_url` field. See `../types/user.ts`'s `UpdateProfilePayload`.
 */
export async function updateProfile(
  payload: UpdateProfilePayload,
  options?: RequestOptions,
): Promise<void> {
  await apiClient.patch('/users/me', payload, { correlationId: options?.correlationId });
}

/**
 * Verified compatible against the live OpenAPI schema: body `{ sport,
 * skill_level }` matches `UserSkillLevelUpdate` exactly — no fix needed.
 */
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
 * BLOCKED — CRITICAL, needs an architect/product decision, not fixed
 * here (do not guess or invent a replacement endpoint): confirmed
 * against the live OpenAPI schema that neither `/users/me/deletion-request`
 * nor `/users/me/deletion-confirm` (below) exists on the real backend at
 * all — not a field mismatch, the paths themselves 404. The entire
 * "Delete Account" flow in `ProfileScreen` is calling endpoints that do
 * not exist. Nothing in the live schema suggests an alternative
 * account-deletion mechanism (no `/users/me` DELETE, no other
 * deletion-shaped path anywhere in the 123 real paths audited). This may
 * mean the feature was never built server-side yet — needs the architect
 * to confirm with the backend team before any client-side fix is
 * attempted. See docs/reports/AUDIT-API-CONTRACTS-2026-09-18.md.
 *
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
 * BLOCKED — see `requestDeletion()`'s comment above: this endpoint also
 * does not exist on the real backend (confirmed via the live OpenAPI
 * schema). Left unchanged pending the architect/backend-team decision.
 */
export async function confirmDeletion(confirmationToken: string): Promise<void> {
  await apiClient.post('/users/me/deletion-confirm', { confirmation_token: confirmationToken });
}
