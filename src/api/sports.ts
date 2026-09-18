/**
 * Sports API — `GET /admin/sports/public` (DES-MEETUP-MOBILE.md §7, "Distinct
 * from admin-only list"; unauthenticated by design, §7.9 note).
 *
 * Used to populate the sport choices on Create Tournament instead of
 * hardcoding a list the backend owns. Only active sports are returned.
 *
 * Proposed Assumption: the `sport` string sent to `POST /tournaments` is the
 * sport's `name`. The `TournamentCreate.sport` schema is an unconstrained
 * string (max 30), like `SportCreateRequest.name` (max 30). On the live
 * backend `name` and `slug` are identical for every sport, so the choice
 * has no observable effect today — see the Implementation Report.
 */
import { apiClient } from './client';
import type { Sport } from '../types/sport';

interface RequestOptions {
  correlationId?: string;
}

interface SportApiItem {
  id: string;
  name: string;
  slug: string;
  display_name: string;
  is_active: boolean;
}

export async function getSports(options?: RequestOptions): Promise<Sport[]> {
  const { data } = await apiClient.get<SportApiItem[]>('/admin/sports/public', {
    correlationId: options?.correlationId,
  });
  return data
    .filter(sport => sport.is_active)
    .map(sport => ({ name: sport.name, display_name: sport.display_name }));
}
