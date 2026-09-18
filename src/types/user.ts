/**
 * Canonical User/profile domain types (DES-MEETUP-MOBILE.md §3.10,
 * §4.13, §7.2; R-124).
 *
 * `UserProfile` is the single canonical type for the `GET /users/me`
 * response, consolidated from two divergent definitions that
 * independently grew up around the same endpoint in separate tasks:
 * the auth module's (`id`, `email`, `nickname`, `role`) and the profile
 * module's (`id`, `nickname`, `email`, `avatar_url`, `is_admin`,
 * `created_at`, `skill_levels`). See
 * `docs/reports/IMPL-DES-MEETUP-MOBILE-types-consolidation.md` for the
 * full merge record.
 *
 * Per that consolidation's explicit instruction: fields present in
 * *both* original shapes (`id`, `email`, `nickname`) stay required;
 * every field that was present in only one of the two stays optional
 * here, since neither original call site's actual backend response has
 * been verified to always include the other shape's fields. Correct
 * against the actual backend contract on conformance review.
 */
export type SkillLevelValue = 'Beginner' | 'Intermediate' | 'Expert';

export interface SkillLevel {
  sport: string;
  skill_level: SkillLevelValue;
}

/**
 * Full-contract-audit findings (2026-09-18, see
 * docs/reports/AUDIT-API-CONTRACTS-2026-09-18.md), confirmed against the
 * live backend's `PrivateUserProfile` schema (`GET /users/me`):
 * - `role`: BLOCKED, not fixable here — `PrivateUserProfile` has no
 *   `role` field at all, only `is_admin: boolean`. There is no source
 *   for a three-way 'participant'/'organiser'/'admin' distinction on
 *   this endpoint. `useRole()` (an auth-module file, off-limits to this
 *   audit) always sees `undefined` here against the real backend —
 *   flagged for an architect decision, not guessed.
 * - `avatar_url`: BLOCKED, not fixable here — the real field is
 *   `avatar_storage_key` (a storage key, not a URL). No documented
 *   scheme exists anywhere in the design for turning a storage key into
 *   a displayable URL (no CDN base path, no signed-URL endpoint).
 *   Left unpopulated by `getProfile()` — `ProfileScreen` already
 *   guards this as optional/nullable and shows a placeholder avatar, so
 *   this degrades safely rather than guessing a URL scheme.
 * - `is_admin`, `created_at`, `email`, `nickname`, `id`: confirmed always
 *   present on the real response — no longer need the "only in one of
 *   the two original shapes" optionality for these.
 * - `display_name`: real, required field this type never had at all.
 *   Added (optional here, since existing UI doesn't render it yet).
 * - `skill_levels`: BLOCKED as originally assumed ("embedded in `GET
 *   /users/me`") — confirmed there is no such field on
 *   `PrivateUserProfile`. There IS a real `GET /users/me/skill-levels`
 *   endpoint (confirmed to exist; the prior assumption that no skill-level
 *   read endpoint existed was wrong), but its response schema is
 *   undeclared in the live OpenAPI doc (`{}` — FastAPI's default when no
 *   `response_model` is set), so its exact field names cannot be verified
 *   without a live authenticated call, which this audit had no
 *   credentials to make. `getProfile()` now calls it and assumes the
 *   same `{ sport, skill_level }` shape as `UserSkillLevelUpdate` (the
 *   confirmed write-side shape) — a Proposed Assumption, not a
 *   guess made from nothing, but still flagged for confirmation once
 *   real credentials/a live call are available.
 */
export interface UserProfile {
  id: string;
  email: string;
  nickname: string;
  display_name?: string;
  /** Only in the auth module's original shape (§3.10 — backs `useRole()`).
   * Confirmed BLOCKED (see the interface-level comment above) — always
   * `undefined` against the real backend; left as-is, not this audit's
   * to fix (auth-module file). */
  role?: 'participant' | 'organiser' | 'admin';
  /** Confirmed BLOCKED (see the interface-level comment above) — always
   * `undefined`/`null` against the real backend today. */
  avatar_url?: string | null;
  is_admin?: boolean;
  created_at?: string;
  skill_levels?: SkillLevel[];
}

/**
 * BLOCKED — needs an architect decision, not fixed here (do not guess):
 * confirmed against the live OpenAPI schema that `PATCH /users/me`'s real
 * body (`UserUpdate`) only accepts `{ display_name?, theme_preference? }`
 * — neither `nickname` nor `avatar_url` is an accepted field.
 * `ProfileScreen`'s "Edit nickname" flow currently sends `{ nickname }`,
 * which the real backend silently ignores (or rejects) — the feature is
 * a no-op/broken against the real backend today. Renaming `nickname` to
 * `display_name` in the payload would silently conflate two fields the
 * backend keeps distinct (`PrivateUserProfile` has both `nickname` and
 * `display_name`) — a product/design decision, not a mechanical rename.
 * See docs/reports/AUDIT-API-CONTRACTS-2026-09-18.md.
 */
export interface UpdateProfilePayload {
  nickname?: string;
  avatar_url?: string;
}
