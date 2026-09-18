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
