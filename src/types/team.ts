/**
 * Team domain types (DES-MEETUP-MOBILE.md §4.4; REQ-MEETUP Addendum B,
 * R-200–R-207).
 *
 * The Team entity is the same one from the web backend (`teams/schemas.py`).
 * Captain is auto-assigned to the creator — there is no captain field on
 * the create payload.
 */

/**
 * Team visibility — `public` or `private` only.
 *
 * ⚠️ Distinct enum from Event visibility (`public`/`invite_only`/`group`)
 * and Tournament visibility (`public`/`invite`/`group`). Do NOT alias to
 * either of those — the literal values are different.
 */
export type TeamVisibility = 'public' | 'private';

/**
 * `POST /teams` request body — the live `TeamCreate` schema:
 * `name` (required, 1–100 chars), `sport` (required, 1–30 chars),
 * `visibility` (required, `public` or `private`).
 *
 * Captain is NOT a form field — backend auto-assigns the creator
 * (`captain_user_id = current_user_id`).
 */
export interface CreateTeamInput {
  name: string;
  sport: string;
  visibility: TeamVisibility;
}

/**
 * `TeamResponse` — the shape returned by `POST /teams` and
 * `GET /teams/{id}`. Mirrors the live backend schema.
 */
export interface Team {
  id: string;
  name: string;
  sport: string;
  visibility: string;
  captain_user_id: string;
  created_at: string;
  /** `GET /teams/mine` only (teams-payments AD-4): the active player count; null elsewhere. */
  player_count?: number | null;
  /** `GET /teams/mine` only: the caller's role on the team; null elsewhere. */
  my_role?: TeamRole | null;
}

/** The caller's role on a tournament team (`GET /teams/mine` `my_role`). */
export type TeamRole = 'captain' | 'player';

/** `TeamMembership.status` (DES-MEETUP-ADDENDUM-team-screens-remarks section 4). */
export type TeamMembershipStatus = 'invited' | 'requested' | 'active' | 'rejected' | 'removed' | 'left';

/** One row of `GET /teams/{id}/members` (`TeamMembershipResponse`). `role` is `captain` or `member` on the wire. */
export interface TeamMembership {
  id: string;
  team_id: string;
  user_id: string;
  role: string;
  status: string;
  created_at: string;
  user_display_name: string | null;
  user_nickname: string | null;
}

/** `PATCH /teams/{id}` body (`TeamUpdate`): changed fields only; the server forbids any other key. */
export interface UpdateTeamInput {
  name?: string;
  visibility?: TeamVisibility;
}
