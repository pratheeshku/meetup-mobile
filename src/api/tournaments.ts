/**
 * Tournaments API (DES-MEETUP-MOBILE.md §4.5, §7.7; R-041, R-042).
 *
 * All calls go through the shared `apiClient` (`src/api/client.ts`) —
 * auth header injection, correlation ID propagation, and the 401
 * refresh-and-retry flow are already handled there and are not
 * duplicated here.
 *
 * Each function accepts an optional trailing `{ correlationId }` so a
 * caller performing a multi-call logical action (e.g. register, then
 * re-fetch the tournament + registrations to refresh the screen) can
 * thread one shared correlation ID through both calls per §3.12/R-113 —
 * the same pattern already established in `src/api/events.ts`,
 * `src/api/profile.ts`, and `src/api/groups.ts`.
 *
 * `cancelTournament()` is not in the brief's literal Step 2 function
 * list, but is added here because Step 4 explicitly requires a "Cancel
 * tournament button (organiser only...)" and `POST /tournaments/{id}/cancel`
 * is an already-documented endpoint in §7.7 — filling a brief gap with
 * an endpoint the design itself specifies, not inventing one.
 */
import { apiClient } from './client';
import type {
  Tournament,
  TournamentFixture,
  TournamentRegistration,
  TournamentsListResponse,
} from '../types/tournament';

interface RequestOptions {
  correlationId?: string;
}

export async function getTournaments(options?: RequestOptions): Promise<TournamentsListResponse> {
  const { data } = await apiClient.get<TournamentsListResponse>('/tournaments', {
    correlationId: options?.correlationId,
  });
  return data;
}

export async function getTournament(id: string, options?: RequestOptions): Promise<Tournament> {
  const { data } = await apiClient.get<Tournament>(`/tournaments/${id}`, {
    correlationId: options?.correlationId,
  });
  return data;
}

export async function registerForTournament(id: string, options?: RequestOptions): Promise<void> {
  await apiClient.post(`/tournaments/${id}/registrations`, undefined, {
    correlationId: options?.correlationId,
  });
}

export async function withdrawFromTournament(
  id: string,
  registrationId: string,
  options?: RequestOptions,
): Promise<void> {
  await apiClient.delete(`/tournaments/${id}/registrations/${registrationId}`, {
    correlationId: options?.correlationId,
  });
}

export async function getFixtures(
  id: string,
  options?: RequestOptions,
): Promise<TournamentFixture[]> {
  const { data } = await apiClient.get<TournamentFixture[]>(`/tournaments/${id}/fixtures`, {
    correlationId: options?.correlationId,
  });
  return data;
}

export async function getRegistrations(
  id: string,
  options?: RequestOptions,
): Promise<TournamentRegistration[]> {
  const { data } = await apiClient.get<TournamentRegistration[]>(
    `/tournaments/${id}/registrations`,
    { correlationId: options?.correlationId },
  );
  return data;
}

export async function cancelTournament(id: string, options?: RequestOptions): Promise<void> {
  await apiClient.post(`/tournaments/${id}/cancel`, undefined, {
    correlationId: options?.correlationId,
  });
}
