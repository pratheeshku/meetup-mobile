/**
 * Public link endpoints (deep-links AD-8, AD-10). Both need no sign-in.
 *
 * - `GET /public/events/{event_id}` (optional query `ref`, a UUID): exactly sport, starts_at,
 *   ends_at, venue_name, capacity, organizer_display_name, going_count. A link grants no access.
 * - `GET /public/groups/invitations/{token}`: `group_name` only. The token is a claim; it travels
 *   only in this path and is never logged (the client's path logging keeps the template only).
 */
import { apiClient } from './client';

export interface PublicEventPreview {
  sport: string | null;
  starts_at: string | null;
  ends_at: string | null;
  venue_name: string | null;
  capacity: number | null;
  organizer_display_name: string | null;
  going_count: number | null;
}

function str(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value : null;
}

function num(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export async function getPublicEventPreview(eventId: string, ref?: string): Promise<PublicEventPreview> {
  const { data } = await apiClient.get<Partial<Record<keyof PublicEventPreview, unknown>>>(
    `/public/events/${encodeURIComponent(eventId)}`,
    ref ? { params: { ref } } : undefined,
  );
  return {
    sport: str(data?.sport),
    starts_at: str(data?.starts_at),
    ends_at: str(data?.ends_at),
    venue_name: str(data?.venue_name),
    capacity: num(data?.capacity),
    organizer_display_name: str(data?.organizer_display_name),
    going_count: num(data?.going_count),
  };
}

export async function getPublicGroupInvitation(token: string): Promise<{ group_name: string | null }> {
  const { data } = await apiClient.get<{ group_name?: unknown }>(
    `/public/groups/invitations/${encodeURIComponent(token)}`,
  );
  return { group_name: str(data?.group_name) };
}
