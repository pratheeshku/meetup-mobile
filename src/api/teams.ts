/**
 * Teams API (DES-MEETUP-MOBILE.md §4.4; REQ-MEETUP Addendum B, R-200–R-207).
 *
 * All calls go through the shared `apiClient` (`src/api/client.ts`) —
 * auth header injection, correlation ID propagation, and the 401
 * refresh-and-retry flow are already handled there and are not
 * duplicated here.
 *
 * Mirrors the pattern established in `src/api/groups.ts`.
 */
import { apiClient } from './client';
import type { CreateTeamInput, Team } from '../types/team';

interface RequestOptions {
  correlationId?: string;
}

/** Raw shape returned by `POST /teams` (and `GET /teams/{id}`). */
interface TeamApiItem {
  id: string;
  name: string;
  sport: string;
  visibility: string;
  captain_user_id: string;
  created_at: string;
}

function mapTeamApiItem(raw: TeamApiItem): Team {
  return {
    id: raw.id,
    name: raw.name,
    sport: raw.sport,
    visibility: raw.visibility,
    captain_user_id: raw.captain_user_id,
    created_at: raw.created_at,
  };
}

/**
 * `POST /teams` (DES §4.4). Request body is the live `TeamCreate` schema —
 * `{ name, sport, visibility }`. The caller becomes the captain.
 */
export async function createTeam(
  input: CreateTeamInput,
  options?: RequestOptions,
): Promise<Team> {
  const { data } = await apiClient.post<TeamApiItem>('/teams', input, {
    correlationId: options?.correlationId,
  });
  return mapTeamApiItem(data);
}
