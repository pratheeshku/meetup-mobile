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
 */
export type EventVisibility = 'public' | 'group' | 'invite';
export type EventStatus = 'upcoming' | 'active' | 'cancelled' | 'completed';
export type RsvpStatus = 'none' | 'going' | 'waitlisted' | 'withdrawn';

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
}

export interface EventsListResponse {
  items: Event[];
  total: number;
  page: number;
  page_size: number;
}
