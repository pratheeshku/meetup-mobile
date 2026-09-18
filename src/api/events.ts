/**
 * Events API (DES-MEETUP-MOBILE.md §4.3, §7.4; R-021, R-024).
 *
 * All calls go through the shared `apiClient` (`src/api/client.ts`) —
 * auth header injection, correlation ID propagation, and the 401
 * refresh-and-retry flow are already handled there (§3.3, §3.12) and
 * are not duplicated here.
 *
 * Each function accepts an optional trailing `{ correlationId }` so a
 * caller performing a multi-call logical action (e.g. RSVP, then
 * re-fetch the event to refresh its detail) can thread one shared
 * correlation ID through both calls per §3.12/R-113, using
 * `withCorrelationId()` (`src/api/correlationId.ts`) — the same pattern
 * already established for auth's sign-out sequence. A call made without
 * one still gets a valid, traceable per-call ID from the client's own
 * fallback.
 */
import { apiClient } from './client';
import type { Event, EventsListResponse, EventVisibility, EventStatus, RsvpStatus } from '../types/event';

export interface GetEventsParams {
  sport?: string;
  page?: number;
  page_size?: number;
}

interface RequestOptions {
  correlationId?: string;
}

/**
 * Root cause fix (HomeScreen crash `Cannot read property 'length' of
 * undefined` at HomeScreen.tsx:93): `getEvents()` was typed as returning
 * `EventsListResponse` (`{ items, total, page, page_size }`), but that
 * shape was a Proposed Assumption made without the backend contract
 * (see the gap already recorded in `../types/event.ts`'s header comment).
 *
 * Confirmed against the live backend's OpenAPI schema
 * (`GET https://meetups.duckdns.org/openapi.json` → `paths['/events'].get`,
 * checked 2026-09-18): `GET /events` actually returns a bare JSON array of
 * `EventResponse` objects, not an envelope object. `apiClient.get<EventsListResponse>`
 * therefore received an array at runtime; `data.items` was `undefined`,
 * `setEvents(undefined)` replaced the `[]` initial state, and the next
 * render's `events.length` (HomeScreen.tsx:93) threw.
 *
 * The live schema also confirmed the per-item field names diverge from the
 * ones this app's `Event` type guessed (e.g. `organizer_id` not
 * `organiser_id`, `venue_name`/`venue_address` not `location`,
 * `going_count` not `participant_count`, `user_rsvp_status` not
 * `current_user_rsvp_status`, `recurrence_rule_id` not `is_recurring`, no
 * `waitlist_count`/`is_organiser` field at all). `EventApiItem` below is
 * the actual wire shape (subset needed to populate `Event` for the feed);
 * `mapEventApiItem` adapts it, and is now also applied to `getEvent()`
 * (singular, consumed by EventDetailScreen) — confirmed the same class of
 * gap there per the full-API-contract audit (`docs/reports/AUDIT-API-CONTRACTS-2026-09-18.md`)
 * and fixed below.
 */
interface EventApiItem {
  id: string;
  organizer_id: string;
  sport: string;
  title: string;
  description: string | null;
  visibility: string;
  capacity: number;
  starts_at: string;
  ends_at: string | null;
  estimated_cost_cents: number | null;
  recurrence_rule_id: string | null;
  status: string;
  venue_name: string | null;
  venue_address: string | null;
  organizer_nickname: string | null;
  organizer_display_name: string | null;
  going_count: number;
  user_rsvp_status: string | null;
}

/**
 * Proposed Assumptions (numbered, conservative readings — record in the
 * Implementation Report):
 * 1. `location` <- `venue_name` (falls back to `''`). `venue_address` is
 *    not concatenated in — smallest change to satisfy the existing
 *    single-field `location` display on the feed card.
 * 2. `is_recurring` <- `recurrence_rule_id !== null`.
 * 3. `waitlist_count` <- `0`. The backend does not return this field on
 *    `EventResponse` at all; HomeScreen does not render it today, so a
 *    fixed default is conservative and non-breaking.
 * 4. `is_organiser` <- `false`. Deriving this correctly needs the current
 *    authenticated user's id compared against `organizer_id`, which is
 *    not available from this endpoint and not read here (importing an
 *    auth/session accessor into `src/api/events.ts` would also cross the
 *    documented zero-sibling-import boundary). The value is therefore
 *    NOT trustworthy: consumers must derive organiser status with
 *    `isOrganiserOf(event, currentUserId)` (`src/utils/homeDashboard.ts`),
 *    as `EventDetailScreen` and the Home dashboard do — never read
 *    `event.is_organiser` alone. Role/permission UI gating remains a UX
 *    convenience only, per R-017/R-082 — the backend enforces the real
 *    authorization on every write endpoint.
 * 5. `cost` <- `estimated_cost_cents` as-is (still cents, not converted to
 *    a display currency amount). HomeScreen does not render `cost`, so
 *    this is inert for this fix; flagged for correction alongside the
 *    `getEvent()`/EventDetailScreen follow-up.
 */
function mapEventApiItem(raw: EventApiItem): Event {
  return {
    id: raw.id,
    title: raw.title,
    description: raw.description ?? '',
    sport: raw.sport,
    location: raw.venue_name ?? '',
    starts_at: raw.starts_at,
    // Pass null through unchanged. Coercing it to '' made the display layer
    // call `new Date('')` → "Invalid Date" on events with no end time.
    ends_at: raw.ends_at,
    capacity: raw.capacity,
    participant_count: raw.going_count,
    waitlist_count: 0,
    visibility: raw.visibility as EventVisibility,
    status: raw.status as EventStatus,
    organiser_id: raw.organizer_id,
    organiser_nickname: raw.organizer_nickname ?? raw.organizer_display_name ?? '',
    is_recurring: raw.recurrence_rule_id !== null,
    cost: raw.estimated_cost_cents,
    current_user_rsvp_status: (raw.user_rsvp_status as RsvpStatus | null) ?? 'none',
    is_organiser: false,
  };
}

export async function getEvents(
  params?: GetEventsParams,
  options?: RequestOptions,
): Promise<EventsListResponse> {
  const { data } = await apiClient.get<EventApiItem[]>('/events', {
    params,
    correlationId: options?.correlationId,
  });
  const items = data.map(mapEventApiItem);
  return {
    items,
    total: items.length,
    page: params?.page ?? 1,
    page_size: params?.page_size ?? items.length,
  };
}

export async function getEvent(id: string, options?: RequestOptions): Promise<Event> {
  const { data } = await apiClient.get<EventApiItem>(`/events/${id}`, {
    correlationId: options?.correlationId,
  });
  return mapEventApiItem(data);
}

/**
 * RSVP and withdraw share ONE endpoint: `POST /events/{id}/rsvp` with body
 * `RSVPRequest { action: string }`, where `action` must be exactly `"going"`
 * or `"withdrawn"` (confirmed by the architect directly against the backend's
 * `events/schemas.py` and `events/router.py`). There is no separate withdraw
 * path — `POST /events/{id}/withdraw` does not exist (404).
 *
 * - Join  -> `{ action: "going" }`
 * - Leave -> `{ action: "withdrawn" }`
 */
export async function rsvpEvent(id: string, options?: RequestOptions): Promise<void> {
  await apiClient.post(
    `/events/${id}/rsvp`,
    { action: 'going' },
    { correlationId: options?.correlationId },
  );
}

/** Leave an event: same `POST /events/{id}/rsvp` endpoint as `rsvpEvent`, `action: "withdrawn"`. */
export async function withdrawEvent(id: string, options?: RequestOptions): Promise<void> {
  await apiClient.post(
    `/events/${id}/rsvp`,
    { action: 'withdrawn' },
    { correlationId: options?.correlationId },
  );
}

/**
 * BLOCKED — needs an architect decision, not fixed here (do not guess):
 * confirmed against the live OpenAPI schema that `POST /events/{event_id}/cancel`
 * requires a body matching `EventCancelRequest { reason: string }` (1–500
 * chars, REQUIRED). This call currently sends no body, so every cancel
 * attempt against the real backend gets a 422 Validation Error. Fixing
 * this needs a cancellation-reason UI (EventDetailScreen's cancel flow
 * has none today) — a UX/design decision beyond an API-layer adapter,
 * out of scope for this audit pass. See the audit report.
 *
 * Not called from any UI for now: `EventDetailScreen` no longer renders a
 * Cancel Event button until a cancellation-reason UI exists (follow-up).
 */
export async function cancelEvent(id: string, options?: RequestOptions): Promise<void> {
  await apiClient.post(`/events/${id}/cancel`, undefined, {
    correlationId: options?.correlationId,
  });
}
