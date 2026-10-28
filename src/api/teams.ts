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
  player_count?: number | null;
  my_role?: string | null;
}

function mapTeamApiItem(raw: TeamApiItem): Team {
  return {
    id: raw.id,
    name: raw.name,
    sport: raw.sport,
    visibility: raw.visibility,
    captain_user_id: raw.captain_user_id,
    created_at: raw.created_at,
    player_count: typeof raw.player_count === 'number' ? raw.player_count : null,
    my_role: raw.my_role === 'captain' || raw.my_role === 'player' ? raw.my_role : null,
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

/** `GET /teams/mine`: the caller's tournament teams (existing endpoint; tournament-registration AD-1 team picker). */
export async function getMyTeams(options?: RequestOptions): Promise<Team[]> {
  const { data } = await apiClient.get<TeamApiItem[]>('/teams/mine', {
    correlationId: options?.correlationId,
  });
  return Array.isArray(data) ? data.map(mapTeamApiItem) : [];
}

/**
 * `GET /teams`: the teams the caller may see (visibility is enforced by the server). Used by the committee's Add team (AD-2, A40); the screen
 * keeps the teams of the tournament's sport and drops the ones already entered. `player_count` is set only by `/teams/mine`, so it is null here.
 */
export async function getTeams(options?: RequestOptions): Promise<Team[]> {
  const { data } = await apiClient.get<TeamApiItem[]>('/teams', {
    correlationId: options?.correlationId,
  });
  return Array.isArray(data) ? data.map(mapTeamApiItem) : [];
}
