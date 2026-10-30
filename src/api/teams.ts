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
import type { CreateTeamInput, Team, TeamMembership, UpdateTeamInput } from '../types/team';

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

/** `GET /teams/{id}` (`TeamResponse`). 404 = not available (deleted, or private and not visible to the caller); the screen shows the notice. */
export async function getTeam(teamId: string, options?: RequestOptions): Promise<Team> {
  const { data } = await apiClient.get<TeamApiItem>(`/teams/${teamId}`, { correlationId: options?.correlationId });
  return mapTeamApiItem(data);
}

/** `GET /teams/{id}/members`: the roster, for a caller with a membership row (or an admin). 403 = no row: the caller is not on the roster (AD-1). */
export async function getTeamMembers(teamId: string, options?: RequestOptions): Promise<TeamMembership[]> {
  const { data } = await apiClient.get<TeamMembership[]>(`/teams/${teamId}/members`, { correlationId: options?.correlationId });
  return Array.isArray(data)
    ? data.map(row => ({
        id: row.id,
        team_id: row.team_id,
        user_id: row.user_id,
        role: row.role,
        status: row.status,
        created_at: row.created_at,
        user_display_name: row.user_display_name ?? null,
        user_nickname: row.user_nickname ?? null,
      }))
    : [];
}

/** `POST /teams/{id}/requests`: ask to join a public tournament team (no body). Creates the caller's `requested` row. */
export async function requestToJoinTeam(teamId: string, options?: RequestOptions): Promise<void> {
  await apiClient.post(`/teams/${teamId}/requests`, undefined, { correlationId: options?.correlationId });
}

/** `POST /teams/{id}/invites` (`TeamInviteRequest`): an active team player invites a person. */
export async function inviteToTeam(teamId: string, userId: string, options?: RequestOptions): Promise<void> {
  await apiClient.post(`/teams/${teamId}/invites`, { user_id: userId }, { correlationId: options?.correlationId });
}

/** `POST /teams/{id}/invites/respond?accept=`: the invited person accepts or declines. */
export async function respondToTeamInvite(teamId: string, accept: boolean, options?: RequestOptions): Promise<void> {
  await apiClient.post(`/teams/${teamId}/invites/respond`, undefined, {
    params: { accept },
    correlationId: options?.correlationId,
  });
}

/** `POST /teams/{id}/requests/{user_id}/respond?accept=`: the captain approves or rejects a join request. */
export async function respondToTeamRequest(
  teamId: string,
  userId: string,
  accept: boolean,
  options?: RequestOptions,
): Promise<void> {
  await apiClient.post(`/teams/${teamId}/requests/${userId}/respond`, undefined, {
    params: { accept },
    correlationId: options?.correlationId,
  });
}

/**
 * `DELETE /teams/{id}/members/{user_id}`: the captain removes a team player, or a team player leaves (the id is the caller's own).
 * `replacement_captain_id` is sent only when given (the server uses it for an admin removing a captain).
 */
export async function removeTeamMember(
  teamId: string,
  userId: string,
  options?: RequestOptions & { replacementCaptainId?: string },
): Promise<void> {
  await apiClient.delete(`/teams/${teamId}/members/${userId}`, {
    params: options?.replacementCaptainId ? { replacement_captain_id: options.replacementCaptainId } : undefined,
    correlationId: options?.correlationId,
  });
}

/** `PATCH /teams/{id}` (`TeamUpdate`): captain edits the name and/or visibility. Send changed fields only. */
export async function updateTeam(teamId: string, input: UpdateTeamInput, options?: RequestOptions): Promise<Team> {
  const { data } = await apiClient.patch<TeamApiItem>(`/teams/${teamId}`, input, { correlationId: options?.correlationId });
  return mapTeamApiItem(data);
}
