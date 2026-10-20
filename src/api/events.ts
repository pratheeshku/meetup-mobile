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
import type { UserCardOut } from '../types/userMenu';
import type {
  ClosureResponse,
  CreateEventInput,
  DeclineAck,
  Event,
  EventClosurePut,
  EventInvitation,
  EventsListResponse,
  EventSkillLevel,
  EventVisibility,
  EventStatus,
  GameDisplayStatus,
  LifecycleStatus,
  ResponsesResponse,
  RsvpStatus,
  UpdateEventInput,
} from '../types/event';

export interface GetEventsParams {
  sport?: string;
  sports?: string;
  mine?: boolean;
  upcoming?: boolean;
  /** Also return past (completed and cancelled) games; used by the My games scope. */
  history?: boolean;
  /** DES-MEETUP-ADDENDUM-closure-report AD-10: 'active' (default) or 'all' */
  view?: 'active' | 'all';
  limit?: number;
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
export interface EventApiItem {
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
  estimated_cost_currency?: string | null;
  allow_waitlist?: boolean;
  recurrence_rule_id: string | null;
  status: string;
  display_status?: string | null;
  lifecycle_status?: string | null;
  closure_outcome?: string | null;
  venue_name: string | null;
  venue_address: string | null;
  organizer_nickname: string | null;
  organizer_display_name: string | null;
  going_count: number;
  user_rsvp_status: string | null;
  skill_level_requirement?: string | null;
  created_at?: string;
  players_preview?: Array<{ display_name: string; photo_url: string | null }>;
  group_name?: string | null;
  group_id?: string | null;
  group_ids?: string[] | null;
  group_names?: string[] | null;
  my_declined?: boolean | null;
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
 *    `isOrganiserOf(event, currentUserId)` (`src/utils/gameLists.ts`),
 *    as `EventDetailScreen` and the Home dashboard do — never read
 *    `event.is_organiser` alone. Role/permission UI gating remains a UX
 *    convenience only, per R-017/R-082 — the backend enforces the real
 *    authorization on every write endpoint.
 * 5. `cost` <- `estimated_cost_cents` as-is (still cents, not converted to
 *    a display currency amount). HomeScreen does not render `cost`, so
 *    this is inert for this fix; flagged for correction alongside the
 *    `getEvent()`/EventDetailScreen follow-up.
 */
/** Server value when valid; else active/cancelled from `status` — `completed` is never derived. */
function resolveDisplayStatus(raw: string | null | undefined, status: string): GameDisplayStatus {
  if (raw === 'active' || raw === 'cancelled' || raw === 'completed') {
    return raw;
  }
  return status === 'cancelled' ? 'cancelled' : 'active';
}

function resolveLifecycleStatus(raw: EventApiItem): LifecycleStatus {
  if (raw.lifecycle_status) {
    return raw.lifecycle_status as LifecycleStatus;
  }
  if (raw.status === 'cancelled' || raw.display_status === 'cancelled') {
    return 'cancelled';
  }
  if (raw.display_status === 'completed') {
    return 'closed';
  }
  if (raw.status === 'upcoming') {
    return 'active';
  }
  const end = raw.ends_at ? Date.parse(raw.ends_at) : raw.starts_at ? Date.parse(raw.starts_at) : NaN;
  if (!Number.isNaN(end) && Date.now() >= end) {
    return 'past';
  }
  return 'active';
}

export function mapEventApiItem(raw: EventApiItem): Event {
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
    display_status: resolveDisplayStatus(raw.display_status, raw.status),
    organiser_id: raw.organizer_id,
    organiser_nickname: raw.organizer_nickname ?? raw.organizer_display_name ?? '',
    is_recurring: raw.recurrence_rule_id !== null,
    cost: raw.estimated_cost_cents,
    current_user_rsvp_status: (raw.user_rsvp_status as RsvpStatus | null) ?? 'none',
    is_organiser: false,
    venue_name: raw.venue_name ?? null,
    venue_address: raw.venue_address ?? null,
    skill_level_requirement: (raw.skill_level_requirement as EventSkillLevel | null) ?? null,
    allow_waitlist: raw.allow_waitlist ?? true,
    estimated_cost_cents: raw.estimated_cost_cents ?? null,
    estimated_cost_currency: raw.estimated_cost_currency ?? null,
    created_at: raw.created_at,
    players_preview: raw.players_preview,
    group_name: raw.group_name ?? raw.group_names?.[0] ?? null,
    // Older servers send only group_id / group_name: a one-item list.
    group_ids: raw.group_ids ?? (raw.group_id ? [raw.group_id] : []),
    group_names: raw.group_names ?? (raw.group_name ? [raw.group_name] : []),
    lifecycle_status: resolveLifecycleStatus(raw),
    closure_outcome: raw.closure_outcome ?? null,
    my_declined: Boolean(raw.my_declined),
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
 * `POST /events` (Create Flow Amendment, §4.3; `EventCreate` schema). Body
 * is a subset of the live schema (see `CreateEventInput`) — a direct port
 * of the web app's Casual Game submit handler (`frontend/app.js`,
 * `submitCreateEvent`), (`ends_at` is now start + the chosen duration).
 */
export async function createEvent(
  input: CreateEventInput,
  options?: RequestOptions,
): Promise<Event> {
  const { data } = await apiClient.post<EventApiItem>('/events', input, {
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
 * Cancel an event: calls `POST /events/{id}/cancel` with `{ reason }`.
 * Organiser-only action. Backend requires a reason (1–500 chars).
 */
export async function cancelEvent(
  id: string,
  reason: string,
  options?: RequestOptions,
): Promise<void> {
  await apiClient.post(
    `/events/${id}/cancel`,
    { reason },
    { correlationId: options?.correlationId },
  );
}

/**
 * Partial update for an owned event: calls `PATCH /events/{id}` (§5.9 Event Edit Lifecycle).
 * Organiser-only action. Only fields present in `input` are sent.
 * Accepts: title, description, venue_name, venue_address, skill_level_requirement,
 * capacity, starts_at, ends_at, visibility, sport, allow_waitlist,
 * estimated_cost_cents, estimated_cost_currency.
 */
export async function updateEvent(
  id: string,
  input: UpdateEventInput,
  options?: RequestOptions,
): Promise<Event> {
  const payload: Record<string, unknown> = {};
  if (input.title !== undefined) payload.title = input.title;
  if (input.description !== undefined) payload.description = input.description;
  if (input.venue_name !== undefined) payload.venue_name = input.venue_name;
  if (input.venue_address !== undefined) payload.venue_address = input.venue_address;
  if (input.venue_id !== undefined) payload.venue_id = input.venue_id;
  if (input.others !== undefined) payload.others = input.others;
  if (input.skill_level_requirement !== undefined) {
    payload.skill_level_requirement = input.skill_level_requirement;
  }
  if (input.capacity !== undefined) payload.capacity = input.capacity;
  if (input.starts_at !== undefined) payload.starts_at = input.starts_at;
  if (input.ends_at !== undefined) payload.ends_at = input.ends_at;
  if (input.visibility !== undefined) payload.visibility = input.visibility;
  if (input.sport !== undefined) payload.sport = input.sport;
  if (input.allow_waitlist !== undefined) payload.allow_waitlist = input.allow_waitlist;
  if (input.estimated_cost_cents !== undefined) {
    payload.estimated_cost_cents = input.estimated_cost_cents;
  }
  if (input.estimated_cost_currency !== undefined) {
    payload.estimated_cost_currency = input.estimated_cost_currency;
  }

  const { data } = await apiClient.patch<EventApiItem>(`/events/${id}`, payload, {
    correlationId: options?.correlationId,
  });
  return mapEventApiItem(data);
}

/**
 * Invite group members to an event: calls `POST /events/{id}/invite-group`.
 * Organiser-only action. Takes `{ group_id }`.
 */
export async function inviteGroupToEvent(
  eventId: string,
  groupId: string,
  options?: RequestOptions,
): Promise<EventInvitation[]> {
  const { data } = await apiClient.post<EventInvitation[]>(
    `/events/${eventId}/invite-group`,
    { group_id: groupId },
    { correlationId: options?.correlationId },
  );
  return data;
}

/**
 * Invite an individual user to an event: calls `POST /events/{id}/invite-user`.
 * Organiser-only action. Takes `{ user_id }`.
 */
export async function inviteUserToEvent(
  eventId: string,
  userId: string,
  options?: RequestOptions,
): Promise<EventInvitation> {
  const { data } = await apiClient.post<EventInvitation>(
    `/events/${eventId}/invite-user`,
    { user_id: userId },
    { correlationId: options?.correlationId },
  );
  return data;
}

/**
 * Invite an email address to an event: calls `POST /events/{id}/invite-email`.
 * Organiser-only action. Takes `{ email }`.
 * DES-MEETUP-ADDENDUM-shareable-links Decision 25.
 */
export async function inviteEmailToEvent(
  eventId: string,
  email: string,
  options?: RequestOptions,
): Promise<EventInvitation> {
  const { data } = await apiClient.post<EventInvitation>(
    `/events/${eventId}/invite-email`,
    { email },
    { correlationId: options?.correlationId },
  );
  return data;
}

/**
  * Fetch event participants: calls `GET /events/{id}/participants`.
  */
/**
 * `GET /events/{event_id}/players/{user_id}/card` (user details menu, AD-1). Called on every open
 * of the menu, never cached. 404 = the viewer cannot see the game or the person has no current
 * relationship to it (a pending invitee is visible only to the organizer and the invitee).
 */
export async function getEventPlayerCard(
  eventId: string,
  userId: string,
  options?: RequestOptions,
): Promise<UserCardOut> {
  const { data } = await apiClient.get<UserCardOut>(`/events/${eventId}/players/${userId}/card`, {
    correlationId: options?.correlationId,
  });
  return data;
}

/**
 * `DELETE /events/{event_id}/participants/{user_id}` (existing backend endpoint, organizer only,
 * 100/min). Optional `reason` goes in the query string. Returns the participant row. A 404 means
 * the game is gone or not visible to the caller.
 */
export async function removeEventPlayer(
  eventId: string,
  userId: string,
  options?: RequestOptions & { reason?: string },
): Promise<import('../types/event').EventParticipant> {
  const { data } = await apiClient.delete<import('../types/event').EventParticipant>(
    `/events/${eventId}/participants/${userId}`,
    {
      params: options?.reason ? { reason: options.reason } : undefined,
      correlationId: options?.correlationId,
    },
  );
  return data;
}

export async function getEventParticipants(
  eventId: string,
  options?: RequestOptions,
): Promise<import('../types/event').EventParticipant[]> {
  const { data } = await apiClient.get<import('../types/event').EventParticipant[]>(
    `/events/${eventId}/participants`,
    { correlationId: options?.correlationId },
  );
  return data;
}

/**
 * Fetch game closure report (DES-MEETUP-ADDENDUM-closure-report AD-2).
 * Viewers see outcome, winner, runner_up. Organizer also sees attendees, candidates.
 */
export async function getEventClosure(
  eventId: string,
  options?: RequestOptions,
): Promise<ClosureResponse> {
  const { data } = await apiClient.get<ClosureResponse>(`/events/${eventId}/closure`, {
    correlationId: options?.correlationId,
  });
  return data;
}

/**
 * Submit or update game closure report (DES-MEETUP-ADDENDUM-closure-report AD-2).
 * Organizer only.
 */
export async function putEventClosure(
  eventId: string,
  payload: EventClosurePut,
  options?: RequestOptions,
): Promise<ClosureResponse> {
  const { data } = await apiClient.put<ClosureResponse>(`/events/${eventId}/closure`, payload, {
    correlationId: options?.correlationId,
  });
  return data;
}

/** `POST /events/{id}/invitations/respond` `{ accept }` (the invitee only). */
export async function respondToEventInvitation(
  id: string,
  accept: boolean,
  options?: RequestOptions,
): Promise<{ participation_status?: string | null }> {
  const { data } = await apiClient.post<{ participation_status?: string | null }>(
    `/events/${id}/invitations/respond`,
    { accept },
    { correlationId: options?.correlationId },
  );
  return data;
}

/** `POST /events/{id}/decline` (DES-MEETUP-ADDENDUM-decline-response AD-3). */
export async function declineEvent(
  id: string,
  options?: RequestOptions,
): Promise<DeclineAck> {
  const { data } = await apiClient.post<DeclineAck>(
    `/events/${id}/decline`,
    {},
    { correlationId: options?.correlationId },
  );
  return data;
}

/** `GET /events/{id}/responses` (DES-MEETUP-ADDENDUM-decline-response AD-5). Organizer only. */
export async function getEventResponses(
  id: string,
  options?: RequestOptions,
): Promise<ResponsesResponse> {
  const { data } = await apiClient.get<ResponsesResponse>(`/events/${id}/responses`, {
    correlationId: options?.correlationId,
  });
  return data;
}

