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

export interface UserProfile {
  id: string;
  email: string;
  nickname: string;
  /** Only in the auth module's original shape (§3.10 — backs `useRole()`). */
  role?: 'participant' | 'organiser' | 'admin';
  /** Only in the profile module's original shape. Nullable — display-only,
   * and not every user will have set one (no avatar upload built yet). */
  avatar_url?: string | null;
  /** Only in the profile module's original shape. */
  is_admin?: boolean;
  /** Only in the profile module's original shape. */
  created_at?: string;
  /**
   * Only in the profile module's original shape. Proposed Assumption
   * (carried over from that module's Implementation Report): no
   * separate GET endpoint for skill levels exists anywhere in the
   * design's API contract (§7.2 lists only `PUT /users/me/skill-level`)
   * — assumed `GET /users/me` embeds the user's declared skill levels.
   */
  skill_levels?: SkillLevel[];
}

export interface UpdateProfilePayload {
  nickname?: string;
  avatar_url?: string;
}
