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
  CreateTournamentInput,
  Tournament,
  TournamentFixture,
  TournamentRegistration,
  TournamentRegistrationStatus,
  TournamentsListResponse,
  TournamentStatus,
} from '../types/tournament';

interface RequestOptions {
  correlationId?: string;
}

/**
 * Full-contract-audit fix (2026-09-18, see
 * docs/reports/AUDIT-API-CONTRACTS-2026-09-18.md), confirmed against the
 * live backend's OpenAPI schema — the real `TournamentResponse` wire
 * shape (subset needed to populate `Tournament`).
 */
interface TournamentApiItem {
  id: string;
  organizer_id: string;
  sport: string;
  title: string;
  name: string | null;
  description: string | null;
  format: string;
  capacity: number;
  registration_closes_at: string | null;
  starts_at: string;
  status: string;
  created_at: string;
}

/** See the `Tournament` type's own header comment for the numbered,
 * per-field Proposed Assumptions and flagged gaps this mapper carries. */
function mapTournamentApiItem(raw: TournamentApiItem): Tournament {
  return {
    id: raw.id,
    name: raw.title,
    description: raw.description ?? '',
    sport: raw.sport,
    organiser_id: raw.organizer_id,
    organiser_nickname: '',
    format: raw.format,
    status: raw.status as TournamentStatus,
    registration_open:
      raw.registration_closes_at === null || Date.parse(raw.registration_closes_at) > Date.now(),
    participant_count: 0,
    max_participants: raw.capacity,
    starts_at: raw.starts_at,
    created_at: raw.created_at,
    current_user_registration_status: 'none',
    is_organiser: false,
  };
}

export async function getTournaments(options?: RequestOptions): Promise<TournamentsListResponse> {
  const { data } = await apiClient.get<TournamentApiItem[]>('/tournaments', {
    correlationId: options?.correlationId,
  });
  const items = data.map(mapTournamentApiItem);
  return { items, total: items.length, page: 1, page_size: items.length };
}

export async function getTournament(id: string, options?: RequestOptions): Promise<Tournament> {
  const { data } = await apiClient.get<TournamentApiItem>(`/tournaments/${id}`, {
    correlationId: options?.correlationId,
  });
  return mapTournamentApiItem(data);
}

/**
 * Verified compatible against the live OpenAPI schema:
 * `TournamentRegistrationRequest` (`{ user_id?, team_id? }`) has no
 * `required` fields, so posting with no body is schema-valid — no fix
 * needed here (the backend presumably infers the registering user from
 * the authenticated session when both are omitted).
 */
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

/**
 * BLOCKED — needs an architect decision, not fixed here (do not guess):
 * confirmed against the live OpenAPI schema that `TournamentFixtureResponse`
 * uses `participant_a_registration_id`/`participant_b_registration_id`
 * (foreign keys to a registration, not team names) and a single
 * `score_summary: string | null` (free-form, no documented format) —
 * there is no `home_team`/`away_team`/`home_score`/`away_score` on the
 * wire at all, and `round` is `round_number: integer`, not a string.
 * Renaming `round_number` would be safe, but:
 * - Resolving a registration id to a display name needs joining against
 *   `GET /tournaments/{id}/registrations` (`TournamentDetailScreen` has
 *   this data, `api/tournaments.ts` does not fetch it here) — a real
 *   design decision (what should this backend, which itself has no
 *   "home"/"away" concept, display as team/player names?).
 * - Parsing `score_summary` into two numbers with no confirmed format
 *   would be inventing a parser the design never specified — could
 *   silently misparse ("3-1 (AET)", "Postponed", etc.).
 * Left unchanged; `TournamentFixture`'s fields are currently all
 * `undefined` at runtime against the real backend (blank rows, not a
 * crash). See docs/reports/AUDIT-API-CONTRACTS-2026-09-18.md.
 */
export async function getFixtures(
  id: string,
  options?: RequestOptions,
): Promise<TournamentFixture[]> {
  const { data } = await apiClient.get<TournamentFixture[]>(`/tournaments/${id}/fixtures`, {
    correlationId: options?.correlationId,
  });
  return data;
}

/**
 * Full-contract-audit fix: real `TournamentRegistrationResponse` has no
 * `nickname` field — mapped from `participant_name` (Proposed Assumption:
 * may represent a team name rather than a personal nickname for
 * team-based registrations, but that's an accurate reflection of the
 * data, not an invented value). Also carries through the real `status`
 * and nullable `user_id` (see `TournamentRegistration`'s type comment).
 */
interface TournamentRegistrationApiItem {
  id: string;
  user_id: string | null;
  registered_at: string;
  participant_name: string | null;
  status: string;
}

function mapTournamentRegistration(raw: TournamentRegistrationApiItem): TournamentRegistration {
  return {
    id: raw.id,
    user_id: raw.user_id,
    nickname: raw.participant_name ?? '',
    registered_at: raw.registered_at,
    status: raw.status as TournamentRegistrationStatus,
  };
}

export async function getRegistrations(
  id: string,
  options?: RequestOptions,
): Promise<TournamentRegistration[]> {
  const { data } = await apiClient.get<TournamentRegistrationApiItem[]>(
    `/tournaments/${id}/registrations`,
    { correlationId: options?.correlationId },
  );
  return data.map(mapTournamentRegistration);
}

/**
 * Verified compatible against the live OpenAPI schema: `POST
 * /tournaments/{id}/cancel` has no request body at all — no fix needed.
 */
export async function cancelTournament(id: string, options?: RequestOptions): Promise<void> {
  await apiClient.post(`/tournaments/${id}/cancel`, undefined, {
    correlationId: options?.correlationId,
  });
}

/**
 * `POST /tournaments` (DES §4.5, §7.7; R-040). Body is a subset of the live
 * `TournamentCreate` schema (see `CreateTournamentInput`). Optional
 * `registration_closes_at` is omitted when absent so the server default
 * (null) applies.
 */
export async function createTournament(
  input: CreateTournamentInput,
  options?: RequestOptions,
): Promise<Tournament> {
  const { data } = await apiClient.post<TournamentApiItem>('/tournaments', input, {
    correlationId: options?.correlationId,
  });
  return mapTournamentApiItem(data);
}
