/**
 * Event domain types (DES-MEETUP-MOBILE.md §4.3, §7.4; R-021, R-024).
 *
 * Field list and enum values as specified in the task brief. The local
 * design excerpt's API contract (§7.4) lists Events endpoints
 * (method/path/auth-required/notes) only, not response body schemas —
 * the parent backend design (DES-MEETUP.md) is not available in this
 * repo, the same gap already recorded against the auth endpoints in
 * `docs/reports/IMPL-DES-MEETUP-MOBILE-auth.md`. Correct against the
 * actual backend contract on conformance review.
 *
 * Correction (Create Flow Amendment, 2026-09-22): `EventVisibility`'s
 * third value was previously `'invite'`, an unverified guess. Fetched
 * directly from `pratheeshku/meetup`'s `events/schemas.py`
 * (`EventCreate.validate_visibility`, a `field_validator` that rejects
 * anything outside `'public'`/`'group'`/`'invite_only'`) and confirmed
 * against `frontend/app.js`'s `event-visibility` `<select>` — the real
 * value is `'invite_only'`, a different literal from Tournament's
 * `'invite'` (`TournamentVisibility`, `types/tournament.ts`). Sending the
 * old `'invite'` value on a create would have been rejected by the
 * backend's validator with a 422.
 */
import type { OthersVenueInput, VenueSnapshot } from './venue';

export type EventVisibility = 'public' | 'invite_only' | 'group';
export type EventStatus = 'upcoming' | 'active' | 'cancelled' | 'completed';
/**
 * Backend `display_status`: what the UI shows as the game's state. Older
 * servers omit it; the mapper then derives `active`/`cancelled` from `status`
 * and never `completed` (see `mapEventApiItem`).
 */
export type GameDisplayStatus = 'active' | 'cancelled' | 'completed';
export type RsvpStatus = 'none' | 'going' | 'waitlisted' | 'withdrawn';

/**
 * Server-computed lifecycle status (DES-MEETUP-ADDENDUM-closure-report AD-1).
 * Never computed on the client. Rendered from the server field `lifecycle_status`.
 */
export type LifecycleStatus = 'active' | 'cancelled' | 'past' | 'closed';

/**
 * `EventCreate.skill_level_requirement` (`events/schemas.py`,
 * `validate_skill`): enforced enum, default `'all_levels'`.
 */
export type EventSkillLevel = 'all_levels' | 'beginner' | 'intermediate' | 'expert';

export interface Event {
  id: string;
  title: string;
  description: string;
  sport: string;
  location: string;
  starts_at: string;
  /**
   * Nullable per the live OpenAPI schema (`EventResponse.ends_at` is
   * `date-time | null`): an event may have no defined end time.
   */
  ends_at: string | null;
  capacity: number;
  participant_count: number;
  waitlist_count: number;
  visibility: EventVisibility;
  status: EventStatus;
  display_status?: GameDisplayStatus;
  organiser_id: string;
  organiser_nickname: string;
  is_recurring: boolean;
  /**
   * Proposed Assumption: nullable rather than always-present, since §4
   * of the task brief describes display as conditional ("Cost display
   * if set").
   */
  cost: number | null;
  current_user_rsvp_status: RsvpStatus;
  is_organiser: boolean;
  /** Name of the group a `group` game belongs to (`GET /events/{id}` `group_name`); null otherwise. */
  group_name?: string | null;
  /** All groups a `group` game is shared with (`group_ids`); older servers: a one-item list from `group_id`. */
  group_ids?: string[];
  /** Names matching `group_ids` (`group_names`); older servers: a one-item list from `group_name`. */
  group_names?: string[];
  venue_name?: string | null;
  venue_address?: string | null;
  venue_place_id?: string | null;
  venue_lat?: number | null;
  venue_lng?: number | null;
  venue_id?: string | null;
  venue_snapshot?: VenueSnapshot | null;
  skill_level_requirement?: EventSkillLevel | null;
  allow_waitlist?: boolean;
  estimated_cost_cents?: number | null;
  estimated_cost_currency?: string | null;
  /** Wire `created_at`; the tie-break for equal start times (AD-14). */
  created_at?: string;
  /** Home v2 contract: preview of up to 4 players */
  players_preview?: Array<{ display_name: string; photo_url: string | null; user_id?: string }>;
  /** DES-MEETUP-ADDENDUM-closure-report AD-1: computed lifecycle status */
  lifecycle_status?: LifecycleStatus;
  /** DES-MEETUP-ADDENDUM-closure-report AD-1: closure outcome when closed */
  closure_outcome?: string | null;
  /** DES-MEETUP-ADDENDUM-decline-response AD-4: true when caller has a current decline row */
  my_declined?: boolean;
  /**
   * teams-payments AD-8: the game fee per player in whole cents and its currency; both null while the game fee switch is off and for a free game
   * (a stored fee is ignored while the switch is off). A separate field from `estimated_cost_cents`.
   */
  registration_fee_cents?: number | null;
  registration_fee_currency?: string | null;
  /** teams-payments AD-7: the payee number of this game; null unless the server allows (organizer, a participant who is going). Never logged. */
  payment_contact_number?: string | null;
  /** teams-payments AD-9: the caller's own participant row (the Payment card); null for anyone who is not going or waitlisted. */
  my_participation?: EventMyParticipation | null;
}

/** `GET /events/{id}` `my_participation`. */
export interface EventMyParticipation {
  status: string;
  fee_cents_at_join: number | null;
  effective_fee_cents: number | null;
  payment_received_at: string | null;
  payment_exempt: boolean;
  payment_contact_number: string | null;
}

export interface UpdateEventInput {
  title?: string;
  description?: string | null;
  venue_name?: string | null;
  venue_address?: string | null;
  venue_id?: string | null;
  others?: OthersVenueInput | null;
  skill_level_requirement?: EventSkillLevel | string | null;
  capacity?: number;
  starts_at?: string;
  ends_at?: string | null;
  visibility?: EventVisibility | string;
  group_ids?: string[];
  sport?: string;
  allow_waitlist?: boolean;
  estimated_cost_cents?: number | null;
  estimated_cost_currency?: string | null;
  /** teams-payments AD-8, AD-7: the game fee (whole cents, or null to clear) and the payee number (E.164); sent only while the game fee switch is on. */
  registration_fee_cents?: number | null;
  payment_contact_number?: string | null;
  venue_place_id?: string | null;
  venue_lat?: number | null;
  venue_lng?: number | null;
}

export interface EventInvitation {
  id: string;
  event_id: string;
  invitee_user_id?: string | null;
  invited_email?: string | null;
  /** Group the invitation came from; null/absent = an individual invite. */
  source_group_id?: string | null;
  status: string;
  created_at?: string;
  invited_at?: string;
  invited_by_user_id?: string;
}

export interface EventsListResponse {
  items: Event[];
  total: number;
  page: number;
  page_size: number;
}

export interface EventParticipant {
  id: string;
  event_id?: string;
  user_id: string;
  status: 'going' | 'waitlisted' | string;
  joined_at?: string;
  user_display_name?: string | null;
  user_nickname?: string;
  /** `user_photo_url` from `GET /events/{id}/participants`; initials are shown when null. */
  user_photo_url?: string | null;
  is_checked_in?: boolean;
}

/**
 * `POST /events` request body — a subset of the live `EventCreate` schema
 * (`events/schemas.py`, DES §4.3 Create Flow Amendment), matching the
 * fields the web app's Casual Game form (`frontend/app.js`,
 * `eventCreateFormHtml`/`submitCreateEvent`) actually collects. Schema
 * `required`: `title`, `visibility`, `capacity`, `starts_at`. `sport`
 * defaults to `'football'` server-side if omitted — unlike Tournament's
 * required `sport`, the amendment does not mark Casual Game's Sport with
 * an asterisk, so this client treats it as optional (omitted, letting the
 * server default apply, if the user never picks a chip) rather than a
 * blocking "must choose" field, even though web's own `<select>` always
 * has *some* value selected (native HTML select semantics, no true empty
 * state) — a Proposed Assumption, see the Implementation Report. `ends_at`
 * is always sent `null`, matching web. `group_id` is required by the
 * schema's own `validate_group_visibility` when `visibility === 'group'`,
 * and rejected (ValueError) if present otherwise — omitted unless that
 * condition holds.
 */
export interface CreateEventInput {
  title: string;
  sport?: string;
  visibility: EventVisibility;
  group_ids?: string[];
  invite_user_ids?: string[];
  skill_level_requirement: EventSkillLevel;
  /** Integer, schema `gt=0` (i.e. at least 1); form enforces 2–200 to match web. */
  capacity: number;
  /** ISO 8601 date-time. */
  starts_at: string;
  ends_at: string | null;
  venue_name?: string;
  venue_address?: string;
  venue_place_id?: string | null;
  venue_lat?: number | null;
  venue_lng?: number | null;
  venue_id?: string;
  others?: OthersVenueInput;
  description?: string;
  /**
   * Contract-verification finding (Create Game screen rebuild task):
   * `EventCreate` (`events/schemas.py`, `pratheeshku/meetup`, fetched
   * live via `gh api` during this task) DOES declare
   * `estimated_cost_cents: Optional[int] = Field(None, ge=0)` — this was
   * previously absent from this interface and never sent on create
   * (`createEvent()` only ever passed `CreateEventInput` through
   * verbatim), even though `UpdateEventInput`/`Event` already had it.
   * Whole currency units in the UI, converted to cents before sending.
   */
  estimated_cost_cents?: number | null;
  /**
   * Same schema: `estimated_cost_currency: Optional[str] = Field("USD",
   * min_length=3, max_length=3)`, validated server-side against an ISO
   * 4217 allowlist — client only checks length (3 letters), matching the
   * existing edit-form precedent (`IMPL-DES-MEETUP-MOBILE-builds-a-b-c.md`
   * BUILD B, before that field was hidden on Edit only).
   */
  estimated_cost_currency?: string | null;
  /** teams-payments AD-8, AD-7: optional game fee in whole cents (a fee above 0 needs `payment_contact_number`, E.164). Sent only while the game fee switch is on. */
  registration_fee_cents?: number | null;
  payment_contact_number?: string | null;
}

export interface ClosurePerson {
  user_id: string | null;
  display_name: string;
  photo_url: string | null;
  registration_id?: string | null;
  kind?: string | null;
}

export interface ClosureResponse {
  can_close: boolean;
  outcome: string | null;
  version: number;
  winner: ClosurePerson | null;
  runner_up: ClosurePerson | null;
  closed_at: string | null;
  updated_at: string | null;
  attendees: ClosurePerson[] | null;
  candidates: ClosurePerson[] | null;
}

export interface EventClosurePut {
  outcome: 'completed' | 'not_held';
  attendee_user_ids: string[];
  winner_user_id: string | null;
  runner_up_user_id: string | null;
  expected_version: number;
}

/** DES-MEETUP-ADDENDUM-decline-response AD-5: response person preview */
export interface ResponsePerson {
  user_id?: string | null;
  display_name: string;
  photo_url?: string | null;
  email?: string | null;
  responded_at?: string | null;
  declined_at?: string | null;
  via?: 'invitation' | 'public' | 'joined' | string | null;
  waitlisted?: boolean;
}

export interface ResponseSection {
  total: number;
  items: ResponsePerson[];
}

export interface ResponsesResponse {
  accepted: ResponseSection;
  /**
   * Absent (not null) for anyone except the organizer and committee, and for a public tournament (tournament-registration AD-2, v1.1).
   * Missing or null means "hide the section"; the app never derives a Pending list itself.
   */
  pending?: ResponseSection | null;
  /** Absent for a viewer who may not see who declined (not an error, not loading). */
  declined?: ResponseSection;
}

export interface DeclineAck {
  my_declined: boolean;
}
