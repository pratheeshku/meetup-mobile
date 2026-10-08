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
import { getAvatarUrl } from '../utils/avatar';
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
  mobile_number?: string | null;
  cover_url?: string | null;
}

function mapPrivateUserProfile(raw: PrivateUserProfileApiItem, skillLevels: SkillLevel[]): UserProfile {
  return {
    id: raw.id,
    email: raw.email,
    nickname: raw.nickname,
    display_name: raw.display_name,
    is_admin: raw.is_admin,
    created_at: raw.created_at,
    // UNBLOCKED (DES-MEETUP-ADDENDUM-profile-photo §5, §10.1) — the missing
    // URL scheme is now specified: `{bucket_base_url}/{avatar_storage_key}`.
    // `getAvatarUrl` returns `null` when the key is absent, preserving the
    // existing placeholder behaviour on ProfileScreen.
    avatar_url: getAvatarUrl(raw.avatar_storage_key),
    // BLOCKED, not guessed — see the type-level comment: no `role` field
    // exists on the real response at all.
    role: undefined,
    skill_levels: skillLevels,
    mobile_number: raw.mobile_number ?? null,
    cover_url: raw.cover_url ?? null,
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
 *
 * Exported (ADDENDUM-MOBILE-SPORTS-FILTER-PRESELECT-001 §4): `HomeScreen`
 * also calls this directly, alongside `getEvents()`/`getMyGroups()`, to
 * drive the sport-filter pre-selection default — it does not need the
 * rest of `getProfile()`'s response, so it calls this endpoint on its own
 * rather than fetching the whole profile just for `skill_levels`.
 */
export async function getSkillLevels(options?: RequestOptions): Promise<SkillLevel[]> {
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
 * `DELETE /users/me/skill-level/{sport}` (ADDENDUM-MOBILE-SKILL-DELETE-001,
 * R-MOBILE-SKILL-DELETE-1; backend: `DES-MEETUP-001` v1.71 §5.1/§5.5/§5.13,
 * R-339, `fn_has_active_tournament_registration`). Confirmed live against
 * the real OpenAPI schema: bearer-auth required, 204 on success, 404 if no
 * skill_level row exists for this sport, 409 if the caller has an active,
 * unconcluded tournament registration for it. The 409's `detail` is
 * surfaced verbatim to the user by the caller (`getApiErrorMessage`) — the
 * backend is the sole authority on the guard message, not re-worded here.
 */
export async function deleteSkillLevel(sport: string, options?: RequestOptions): Promise<void> {
  await apiClient.delete(`/users/me/skill-level/${sport}`, {
    correlationId: options?.correlationId,
  });
}

/**
 * `POST /users/me/avatar` — multipart file upload
 * (DES-MEETUP-ADDENDUM-profile-photo §5, §10.4; R-NEW-1, R-NEW-2).
 *
 * Sends the selected photo as a multipart form-data request via the
 * existing `apiClient`. The backend validates format (JPEG/PNG, magic-byte
 * inspection) and size (max 5MB) server-side (§3.2) — the client does not
 * perform client-side format validation (§10.3, R-NEW-2 simplified:
 * Android-only, no HEIC).
 *
 * `fileUri` is the local file URI from react-native-image-crop-picker.
 * `fileName` and `fileType` are provided by the picker's response asset.
 */
export async function uploadAvatar(
  fileUri: string,
  fileName: string,
  fileType: string,
  options?: RequestOptions,
): Promise<void> {
  const formData = new FormData();
  formData.append('file', {
    uri: fileUri,
    name: fileName,
    type: fileType,
  } as unknown as Blob);

  await apiClient.post('/users/me/avatar', formData, {
    correlationId: options?.correlationId,
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
}

/**
 * `DELETE /users/me/avatar` — self-remove current profile photo
 * (DES-MEETUP-ADDENDUM-profile-photo §5, §10.4; R-NEW-1).
 *
 * On success the backend nulls `avatar_storage_key` and deletes the
 * storage object. The next `getProfile()` call returns a null key, and
 * `getAvatarUrl(null)` → `null` → the existing placeholder renders.
 */
export async function deleteAvatar(options?: RequestOptions): Promise<void> {
  await apiClient.delete('/users/me/avatar', {
    correlationId: options?.correlationId,
  });
}

export interface OwnedGroupInfo {
  id: string;
  name: string;
  member_count: number;
}

export interface OwnsGroupsErrorData {
  code: 'owns_groups';
  groups: OwnedGroupInfo[];
}

export function parseOwnsGroupsError(error: unknown): OwnedGroupInfo[] | null {
  const data = (error as { response?: { status?: number; data?: { code?: string; groups?: OwnedGroupInfo[] } } })
    ?.response?.data;
  if (data?.code === 'owns_groups' && Array.isArray(data.groups)) {
    return data.groups;
  }
  return null;
}

/**
 * `POST /users/me/deletion-request` -> 202 (confirmation code is emailed).
 * Returns 409 `{"code":"owns_groups","groups":[{"id","name","member_count"}]}` when the user owns groups.
 * Resend is allowed (rate-limited).
 */
export async function requestDeletion(options?: RequestOptions): Promise<void> {
  await apiClient.post('/users/me/deletion-request', undefined, {
    correlationId: options?.correlationId,
  });
}

/**
 * `POST /users/me/deletion-confirm` with `{"code": "<6 digits>"}` -> 200.
 * Invalid code -> 400 (generic message). 409 owns_groups when the user owns groups.
 */
export async function confirmDeletion(code: string, options?: RequestOptions): Promise<void> {
  await apiClient.post(
    '/users/me/deletion-confirm',
    { code },
    { correlationId: options?.correlationId },
  );
}

/**
 * `POST /users/me/cover` — multipart file upload (Phase 2 revamp, 3:1 aspect ratio).
 * Returns `{ cover_url: string }`.
 */
export async function uploadCover(
  fileUri: string,
  fileName: string,
  fileType: string,
  options?: RequestOptions,
): Promise<{ cover_url: string }> {
  const formData = new FormData();
  formData.append('file', {
    uri: fileUri,
    name: fileName,
    type: fileType,
  } as unknown as Blob);

  const { data } = await apiClient.post<{ cover_url: string }>('/users/me/cover', formData, {
    correlationId: options?.correlationId,
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return data;
}

/**
 * `DELETE /users/me/cover` — remove custom cover image, reverting to default banner.
 */
export async function deleteCover(options?: RequestOptions): Promise<void> {
  await apiClient.delete('/users/me/cover', {
    correlationId: options?.correlationId,
  });
}

export interface RecentGameItem {
  id: string;
  title: string;
  sport: string;
  starts_at: string;
  venue_name: string;
}

export interface ProfileSummary {
  games_played: number;
  games_hosted: number;
  groups_count: number;
  recent_games: RecentGameItem[];
}

/**
 * `GET /users/me/profile-summary` — summary metrics and recent games for profile home.
 */
export async function getProfileSummary(options?: RequestOptions): Promise<ProfileSummary> {
  const { data } = await apiClient.get<ProfileSummary>('/users/me/profile-summary', {
    correlationId: options?.correlationId,
  });
  return data;
}

export interface NotificationSettings {
  push_enabled: boolean;
  email_enabled: boolean;
}

/**
 * `GET /users/me/notification-settings` — read push and email notification master toggles.
 */
export async function getNotificationSettings(
  options?: RequestOptions,
): Promise<NotificationSettings> {
  const { data } = await apiClient.get<NotificationSettings>(
    '/users/me/notification-settings',
    { correlationId: options?.correlationId },
  );
  return data;
}

/**
 * `PUT /users/me/notification-settings` — update push and email notification master toggles.
 */
export async function updateNotificationSettings(
  settings: Partial<NotificationSettings>,
  options?: RequestOptions,
): Promise<NotificationSettings> {
  const { data } = await apiClient.put<NotificationSettings>(
    '/users/me/notification-settings',
    settings,
    { correlationId: options?.correlationId },
  );
  return data;
}


