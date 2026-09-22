/**
 * Tournament domain types (DES-MEETUP-MOBILE.md §4.5, §7.7; R-041, R-042).
 *
 * Field list and enum values as specified in the task brief, where
 * given. The local design excerpt's API contract (§7.7) lists
 * Tournament endpoints (method/path/auth-required) only, not response
 * body schemas — the parent backend design (DES-MEETUP.md) is not
 * available in this repo, the same class of gap already recorded for
 * every other module's endpoints in this project. Correct against the
 * actual backend contract on conformance review.
 */

/**
 * Proposed Assumption: not specified anywhere for Tournaments. Reused
 * the Events module's status vocabulary (same backend, same general
 * lifecycle shape: scheduled -> in progress -> finished, or cancelled
 * at any point) since the brief's own Step 4 explicitly names
 * 'completed' and 'cancelled' as real values ("Cancel tournament
 * button... not completed/cancelled").
 */
export type TournamentStatus = 'upcoming' | 'active' | 'completed' | 'cancelled';

/** Brief's literal enum. */
export type TournamentRegistrationStatus = 'none' | 'registered' | 'withdrawn';

/**
 * Proposed Assumption: not specified anywhere for fixtures. A
 * conservative guess at a fixture's own lifecycle, analogous to
 * `TournamentStatus`.
 */
export type FixtureStatus = 'scheduled' | 'in_progress' | 'completed' | 'cancelled';

/**
 * Full-contract-audit findings (2026-09-18, see
 * docs/reports/AUDIT-API-CONTRACTS-2026-09-18.md), confirmed against the
 * live backend's `TournamentResponse` schema — kept as required fields
 * (unlike `Group.owner_nickname`/`member_count`) because `getTournament()`
 * (singular) can be, and now is, corrected by its caller
 * (`TournamentDetailScreen`, which already independently fetches
 * registrations and reads the current user's id): the placeholder values
 * `api/tournaments.ts` fills in are inert there. They remain
 * best-effort/flagged for the *list* screen only:
 * - `organiser_nickname`: `TournamentResponse` has no nickname/display-name
 *   field at all, and no `GET /users/{id}` lookup endpoint exists to
 *   resolve `organizer_id` — unreconcilable without a backend change.
 *   Always `''` from the API layer.
 * - `participant_count`: not on `TournamentResponse`; would need an extra
 *   `GET /tournaments/{id}/registrations` call per tournament in the list
 *   view (N+1) — flagged, not implemented. `0` from the API layer for
 *   list items; `TournamentDetailScreen` uses its own already-fetched
 *   `registrations.length` instead of this field.
 * - `current_user_registration_status`, `is_organiser`: need the current
 *   user's id, unavailable to `api/tournaments.ts` — `'none'`/`false`
 *   from the API layer; `TournamentDetailScreen` recomputes both locally.
 */
export interface Tournament {
  id: string;
  name: string;
  description: string;
  sport: string;
  organiser_id: string;
  organiser_nickname: string;
  /** Proposed Assumption: no enum evidence anywhere in the local design
   * excerpt (R-040 mentions "a group-stage structure" as one example,
   * not a closed enum) — kept as a free-form string. */
  format: string;
  status: TournamentStatus;
  registration_open: boolean;
  participant_count: number;
  max_participants: number;
  starts_at: string;
  created_at: string;
  current_user_registration_status: TournamentRegistrationStatus;
  is_organiser: boolean;
}

export interface TournamentFixture {
  id: string;
  home_team: string;
  away_team: string;
  scheduled_at: string;
  /** Proposed Assumption: nullable — the brief's own Step 3 says "with
   * scores if available," implying a fixture can exist before it has
   * been played. */
  home_score: number | null;
  away_score: number | null;
  status: FixtureStatus;
  /** Proposed Assumption: kept as a free-form string (e.g. "Round 1",
   * "Semifinal") rather than a number — tournament round labels are
   * often non-numeric, and no format is specified. */
  round: string;
}

export interface TournamentRegistration {
  id: string;
  /**
   * Full-contract-audit finding (2026-09-18, see
   * docs/reports/AUDIT-API-CONTRACTS-2026-09-18.md): the real backend's
   * `TournamentRegistrationResponse` has `user_id: string | null` (a
   * team-based registration has `team_id` set and `user_id` null) —
   * widened from the assumed always-present `string`.
   */
  user_id: string | null;
  nickname: string;
  registered_at: string;
  /**
   * Added by the audit fix: needed by `TournamentDetailScreen` to derive
   * the signed-in user's own registration status locally (`api/tournaments.ts`
   * has no access to the current user's id). Sourced from the real
   * `TournamentRegistrationResponse.status` field.
   */
  status: TournamentRegistrationStatus;
}

export interface TournamentsListResponse {
  items: Tournament[];
  total: number;
  page: number;
  page_size: number;
}

/**
 * Values confirmed against `tournaments/schemas.py`
 * (`TournamentCreate.validate_format`, a `field_validator`): the schema
 * itself enforces exactly `'knockout'`, `'round_robin'`, or
 * `'group_stage'`.
 *
 * `'group_stage'` is deliberately excluded from the client-facing type
 * (Create Flow Amendment, 2026-09-22 — Deferred: Tournament Format Group
 * Stage). `format='group_stage'` requires `participation_mode='team'`
 * AND a populated `structured_rules` object (`validate_group_stage_
 * constraints`, same file) — a real, enforced backend contract, but no
 * UI populates `structured_rules` on web (`frontend/app.js`'s Format
 * `<select>` has no `group_stage` `<option>` to reach it — its
 * `toggleTournamentFormat()`/`t-group-stage-rules` panel logic is
 * orphaned) or, as of this amendment, mobile. Mobile's prior 3rd Format
 * chip offered `group_stage` without ever collecting `structured_rules`,
 * which meant every such submission got a guaranteed 422 — removing it
 * here is a bug fix, not a regression. Re-add only once a
 * `structured_rules` UI is designed on web first.
 */
export type TournamentFormat = 'knockout' | 'round_robin';
export type TournamentParticipationMode = 'individual' | 'team';

/**
 * `TournamentCreate.visibility` (`tournaments/schemas.py`): documented via
 * the field's `description` ("'public', 'group', or 'invite'"), not a
 * `field_validator` — unlike `EventVisibility`, the backend does not
 * actually enforce this at the schema level, but `frontend/app.js`'s
 * `t-visibility` `<select>` sends exactly these three values, confirmed
 * as the correct ones to send. Note the third value is `'invite'`, not
 * Event's `'invite_only'` — a different literal for the same concept on
 * a different endpoint, confirmed in both `schemas.py` and `app.js`.
 */
export type TournamentVisibility = 'public' | 'invite' | 'group';

/**
 * `POST /tournaments` request body, a subset of the live `TournamentCreate`
 * schema, extended by the Create Flow Amendment (2026-09-22) to match the
 * web app's tournament form (`frontend/app.js`, `tournamentCreateFormHtml`/
 * `submitCreateTournament`). Schema `required`: `sport`,
 * `participation_mode`. `title` has a server default of "Test Tourney"
 * and `capacity` a default of 8, so this client always sends `title`
 * explicitly. `starts_at` is not in the schema's `required` list but has
 * no default and is non-nullable — this client always sends it.
 * `group_id` is required by `validate_group_visibility` when
 * `visibility === 'group'`, rejected otherwise — omitted unless that
 * condition holds, matching web. `venue_address`, `skill_level`,
 * `ends_at`, and `structured_rules` are not offered by the form (the
 * first two confirmed absent from web's tournament form despite existing
 * on `EventCreate`/nowhere on `TournamentCreate` respectively; the last
 * two per the Deferred note above) — omitted so server defaults/nulls
 * apply.
 */
export interface CreateTournamentInput {
  title: string;
  sport: string;
  description?: string;
  visibility: TournamentVisibility;
  group_id?: string;
  participation_mode: TournamentParticipationMode;
  format: TournamentFormat;
  /** Integer, schema `exclusiveMinimum: 1` (i.e. at least 2). */
  capacity: number;
  /** ISO 8601 date-time. */
  starts_at: string;
  /** ISO 8601 date-time; optional/nullable in the schema. */
  registration_closes_at?: string;
  venue_name?: string;
}
