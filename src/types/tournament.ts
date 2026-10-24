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

import type { OthersVenueInput, VenueSnapshot } from './venue';
import type { DeclineAck, LifecycleStatus, ResponsePerson, ResponseSection, ResponsesResponse } from './event';
export type { DeclineAck, ResponsePerson, ResponseSection, ResponsesResponse };

/**
 * Proposed Assumption: not specified anywhere for Tournaments. Reused
 * the Events module's status vocabulary (same backend, same general
 * lifecycle shape: scheduled -> in progress -> finished, or cancelled
 * at any point) since the brief's own Step 4 explicitly names
 * 'completed' and 'cancelled' as real values ("Cancel tournament
 * button... not completed/cancelled").
 */
export type TournamentStatus = 'upcoming' | 'active' | 'completed' | 'cancelled';

/**
 * `GET /tournaments/{id}` `my_invite_access` (tournament-lifecycle addendum
 * AD-4). The only source for showing Share/Invite: committee membership is
 * never derived on the client. `null`/absent from the server means `'none'`.
 */
export type TournamentInviteAccess = 'full' | 'individuals' | 'none';

/** `GET /tournaments/{id}` `my_invitation_status`: the caller's own invitation only. */
export type TournamentInvitationStatus = 'pending' | 'accepted';

/** Subset of `TournamentInvitationResponse` the app reads (mirrors `event_invitations`). */
export interface TournamentInvitation {
  id: string;
  status: string;
  invitee_user_id?: string | null;
  invited_email?: string | null;
  /** Group the invitation came from; null/absent = an individual invite. */
  source_group_id?: string | null;
}

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
  /** `GET /tournaments` list only (`registered_count`). `null` = unknown: hide the count, never show 0. */
  participant_count: number | null;
  max_participants: number;
  starts_at: string;
  ends_at?: string | null;
  registration_closes_at?: string | null;
  created_at: string;
  /** `GET /tournaments` list only (`my_registration_status`). `null` = unknown: hide the text, never show "Not Registered". */
  current_user_registration_status: TournamentRegistrationStatus | null;
  is_organiser: boolean;
  /** Absent/undefined is treated as `'none'` everywhere; the mapper never defaults to a value that shows buttons. */
  /** Name of the group a `group` tournament belongs to (`group_name`); null otherwise. */
  group_name?: string | null;
  visibility?: TournamentVisibility;
  my_invite_access?: TournamentInviteAccess;
  my_invitation_status?: TournamentInvitationStatus | null;
  /**
   * `GET /tournaments/{id}` `my_committee_invitation` (tl-c-accept): `'pending'` while the caller's own committee row
   * is `invited` (they can accept or decline), else null. Describes only the caller.
   */
  my_committee_invitation?: 'pending' | null;
  venue_name?: string | null;
  venue_label?: string | null;
  venue_id?: string | null;
  venue_snapshot?: VenueSnapshot | null;
  /** DES-MEETUP-ADDENDUM-closure-report AD-1: computed lifecycle status */
  lifecycle_status?: LifecycleStatus;
  /** DES-MEETUP-ADDENDUM-closure-report AD-1: closure outcome when closed */
  closure_outcome?: string | null;
  /** DES-MEETUP-ADDENDUM-decline-response AD-4: true when caller has a current decline row */
  my_declined?: boolean;
  /** `individual` or `team` (`TournamentResponse.participation_mode`). */
  participation_mode?: TournamentParticipationMode | null;
  /** When the committee published the fixtures, else null. A server fact; never derived on the device. */
  schedule_published_at?: string | null;
  /**
   * Tournament-experience AD-T1 (te-b1), additive: the EFFECTIVE banner and logo (own image, else the admin default,
   * else null: the app then shows its built-in asset). Set by the list and the single read.
   */
  banner_url?: string | null;
  logo_url?: string | null;
  /** Text colour on the status strip: `light` or `dark`, chosen by the server from the picture (AD-T1). */
  banner_tone?: BannerTone | null;
  /** Strip scrim opacity, 0 to 60 percent, chosen by the server. */
  banner_scrim?: number | null;
  /** `false` only when the server says so (the organizer is then offered "Add banner"); null when it did not say. */
  has_custom_banner?: boolean | null;
  /** te-b3 (additive): 2 picks the version 2 page; 1 or null keeps the legacy screen. */
  lifecycle_version?: number | null;
  /** te-b3: stored dates of the registration window; null on version 1 and on the routes that do not set them. */
  registration_opened_at?: string | null;
  registration_hard_block_at?: string | null;
  roster_frozen_at?: string | null;
  /** te-b3: the stored rules. A value that is not stored is null; `elimination` and `courts` are always null today. */
  format_rules?: TournamentFormatRules | null;
  /** AD-T6, set by `GET /tournaments/{id}` only. */
  organizer?: TournamentPerson | null;
  /** AD-T6: active committee members other than the organizer. */
  committee?: TournamentPerson[];
}

export type BannerTone = 'light' | 'dark';

export interface TournamentFormatRules {
  elimination: string | null;
  sets_best_of: number | null;
  points_to_win: number | null;
  courts: number | null;
  min_participants: number | null;
  max_participants: number | null;
}

/** Header chip data (AD-T6): names and picture only. Never an email or a number. */
export interface TournamentPerson {
  user_id: string;
  display_name: string;
  nickname: string | null;
  avatar_url: string | null;
}

/** `PUT` and `DELETE /tournaments/{id}/banner` and `/logo`: the new effective values. */
export interface TournamentImages {
  banner_url: string | null;
  logo_url: string | null;
  banner_tone: BannerTone | null;
  banner_scrim: number | null;
  has_custom_banner: boolean;
}

export type TournamentImageKind = 'banner' | 'logo';

/** `GET /home/court-booking` item (AD-T2). `booking_url` is https only; opened in the system browser. */
export interface CourtProvider {
  id: string;
  name: string;
  description: string | null;
  booking_url: string;
  logo_url: string | null;
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
  venue_id?: string;
  others?: OthersVenueInput;
}

export interface TournamentClosurePerson {
  user_id?: string | null;
  display_name: string;
  photo_url?: string | null;
  registration_id?: string | null;
  kind?: string | null;
  /** AD-T9, `candidates` only (organizer and committee): the people of this registration, to pick the star from. */
  members?: { user_id: string; display_name: string; photo_url?: string | null }[];
}

export interface TournamentClosureResponse {
  can_close: boolean;
  outcome?: 'completed' | 'not_held' | null;
  version: number;
  winner?: TournamentClosurePerson | null;
  runner_up?: TournamentClosurePerson | null;
  /** AD-T9 (te-b2), additive: third place, star of the tournament and the closing comments. */
  third_place?: TournamentClosurePerson | null;
  star?: TournamentClosurePerson | null;
  comments?: string | null;
  closed_at?: string | null;
  updated_at?: string | null;
  attendees?: TournamentClosurePerson[] | null;
  candidates?: TournamentClosurePerson[] | null;
  /** Match-scoring AD-S10: starting values taken from the posted results while no report is saved. */
  prefill?: {
    winner?: TournamentClosurePerson | null;
    runner_up?: TournamentClosurePerson | null;
    attendees?: TournamentClosurePerson[] | null;
  } | null;
}

export interface TournamentClosurePut {
  outcome: 'completed' | 'not_held';
  attendee_registration_ids: string[];
  winner_registration_id: string | null;
  runner_up_registration_id: string | null;
  /** AD-T9, tournaments only; omitted = none. */
  third_place_registration_id?: string | null;
  star_user_id?: string | null;
  comments?: string | null;
  expected_version: number;
}

/** `GET /tournaments/{id}/committee/invitation`: what an accept card can show. Readable only by the invited user. */
export interface CommitteeInvitationSummary {
  tournament_id: string;
  status: string;
  title: string;
  sport: string;
  starts_at: string;
  ends_at: string | null;
  /** The organizer's display name (never an id). */
  organizer_name: string;
}

/** Answer of accept and decline: the caller's committee status afterwards (`active` or `removed`). */
export interface CommitteeInvitationAck {
  tournament_id: string;
  status: 'active' | 'removed' | string;
}

/**
 * One row of `GET /tournaments/{id}/committee/members`. `display_name` is the name to show; ids are never shown.
 * The route lists only to active committee members: everyone else (an invited person included) gets `[]`.
 */
export interface CommitteeMember {
  user_id: string;
  display_name: string | null;
  status: 'active' | 'invited' | 'removed' | string;
  is_organizer: boolean;
}
