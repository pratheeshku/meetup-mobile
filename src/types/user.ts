/**
 * User/profile domain types (DES-MEETUP-MOBILE.md §4.13, §7.2; R-124).
 *
 * Field list and enum values as specified in the task brief. Note this
 * is a deliberately distinct type from `src/auth/types.ts`'s
 * `UserProfile` (which has `role` instead of `is_admin`, no
 * `avatar_url`/`created_at`) — both describe the same `GET /users/me`
 * endpoint from two different modules built in separate tasks. Not
 * reconciled here since doing so would mean editing `src/auth/`, which
 * this task's rules explicitly forbid. Flagged in the Implementation
 * Report for the architect/conformance review to consolidate.
 */
export type SkillLevelValue = 'Beginner' | 'Intermediate' | 'Expert';

export interface SkillLevel {
  sport: string;
  skill_level: SkillLevelValue;
}

export interface UserProfile {
  id: string;
  nickname: string;
  email: string;
  /** Proposed Assumption: nullable — display-only in this task, and not
   * every user will have set one (no avatar upload in this task). */
  avatar_url: string | null;
  is_admin: boolean;
  created_at: string;
  /**
   * Proposed Assumption: not in the brief's literal field list for this
   * interface, but the brief's own Step 3 requires displaying "list of
   * sports with declared skill level," and no separate GET endpoint for
   * skill levels exists anywhere in the design's API contract (§7.2
   * lists only `PUT /users/me/skill-level`, no GET variant). Assumed
   * `GET /users/me` embeds the user's declared skill levels — the only
   * plausible data source for the requested UI. Correct against the
   * actual backend contract on conformance review.
   */
  skill_levels: SkillLevel[];
}

export interface UpdateProfilePayload {
  nickname?: string;
  avatar_url?: string;
}
