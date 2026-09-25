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
export type EventVisibility = 'public' | 'invite_only' | 'group';
export type EventStatus = 'upcoming' | 'active' | 'cancelled' | 'completed';
export type RsvpStatus = 'none' | 'going' | 'waitlisted' | 'withdrawn';

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
  venue_name?: string | null;
  venue_address?: string | null;
  skill_level_requirement?: EventSkillLevel | null;
  allow_waitlist?: boolean;
  estimated_cost_cents?: number | null;
  estimated_cost_currency?: string | null;
}

export interface UpdateEventInput {
  title?: string;
  description?: string | null;
  venue_name?: string | null;
  venue_address?: string | null;
  skill_level_requirement?: EventSkillLevel | string | null;
  capacity?: number;
  starts_at?: string;
  ends_at?: string | null;
  visibility?: EventVisibility | string;
  sport?: string;
  allow_waitlist?: boolean;
  estimated_cost_cents?: number | null;
  estimated_cost_currency?: string | null;
}

export interface EventInvitation {
  id: string;
  event_id: string;
  invitee_user_id: string;
  status: string;
  created_at?: string;
}

export interface EventsListResponse {
  items: Event[];
  total: number;
  page: number;
  page_size: number;
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
  group_id?: string;
  skill_level_requirement: EventSkillLevel;
  /** Integer, schema `gt=0` (i.e. at least 1); form enforces 2–200 to match web. */
  capacity: number;
  /** ISO 8601 date-time. */
  starts_at: string;
  ends_at: null;
  venue_name?: string;
  venue_address?: string;
  description?: string;
}
