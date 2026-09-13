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
import type { Event, EventsListResponse } from '../types/event';

export interface GetEventsParams {
  sport?: string;
  page?: number;
  page_size?: number;
}

interface RequestOptions {
  correlationId?: string;
}

export async function getEvents(
  params?: GetEventsParams,
  options?: RequestOptions,
): Promise<EventsListResponse> {
  const { data } = await apiClient.get<EventsListResponse>('/events', {
    params,
    correlationId: options?.correlationId,
  });
  return data;
}

export async function getEvent(id: string, options?: RequestOptions): Promise<Event> {
  const { data } = await apiClient.get<Event>(`/events/${id}`, {
    correlationId: options?.correlationId,
  });
  return data;
}

export async function rsvpEvent(id: string, options?: RequestOptions): Promise<void> {
  await apiClient.post(`/events/${id}/rsvp`, undefined, {
    correlationId: options?.correlationId,
  });
}

export async function withdrawEvent(id: string, options?: RequestOptions): Promise<void> {
  await apiClient.post(`/events/${id}/withdraw`, undefined, {
    correlationId: options?.correlationId,
  });
}

export async function cancelEvent(id: string, options?: RequestOptions): Promise<void> {
  await apiClient.post(`/events/${id}/cancel`, undefined, {
    correlationId: options?.correlationId,
  });
}
