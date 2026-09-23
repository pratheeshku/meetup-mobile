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
}
