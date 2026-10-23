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
import type { VenueSnapshot } from '../types/venue';
import type { TournamentScoringState, TournamentStandingsView } from '../types/tournamentScoring';
import { normaliseScoringState, normaliseStandings } from '../utils/tournamentScoring';
import type {
  CommitteeInvitationAck,
  CommitteeInvitationSummary,
  CommitteeMember,
  CreateTournamentInput,
  DeclineAck,
  ResponsesResponse,
  TournamentClosurePut,
  TournamentClosureResponse,
  TournamentInvitation,
  TournamentInvitationStatus,
  TournamentInviteAccess,
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
  /** List endpoint only; null/absent = unknown. */
  registered_count?: number | null;
  my_registration_status?: TournamentRegistrationStatus | null;
  my_invite_access?: string | null;
  group_name?: string | null;
  visibility?: string | null;
  my_invitation_status?: string | null;
  my_committee_invitation?: string | null;
  venue_name?: string | null;
  venue_label?: string | null;
  venue_id?: string | null;
  venue_snapshot?: VenueSnapshot | null;
  lifecycle_status?: string | null;
  closure_outcome?: string | null;
  my_declined?: boolean | null;
}

/** Unknown, null or absent -> `'none'` (never a value that shows buttons). */
function normaliseInviteAccess(value: string | null | undefined): TournamentInviteAccess {
  return value === 'full' || value === 'individuals' ? value : 'none';
}

function normaliseInvitationStatus(
  value: string | null | undefined,
): TournamentInvitationStatus | null {
  return value === 'pending' || value === 'accepted' ? value : null;
}

/** See the `Tournament` type's own header comment for the numbered,
 * per-field Proposed Assumptions and flagged gaps this mapper carries. */
function mapTournamentApiItem(raw: TournamentApiItem, currentUserId?: string): Tournament {
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
    participant_count: raw.registered_count ?? null,
    max_participants: raw.capacity,
    starts_at: raw.starts_at,
    registration_closes_at: raw.registration_closes_at,
    created_at: raw.created_at,
    current_user_registration_status: raw.my_registration_status ?? null,
    is_organiser: Boolean(currentUserId) && raw.organizer_id === currentUserId,
    group_name: raw.group_name ?? null,
    visibility:
      raw.visibility === 'public' || raw.visibility === 'group' || raw.visibility === 'invite'
        ? raw.visibility
        : undefined,
    my_invite_access: normaliseInviteAccess(raw.my_invite_access),
    my_invitation_status: normaliseInvitationStatus(raw.my_invitation_status),
    my_committee_invitation: raw.my_committee_invitation === 'pending' ? 'pending' : null,
    venue_name: raw.venue_name ?? null,
    venue_label: raw.venue_label ?? null,
    venue_id: raw.venue_id ?? null,
    venue_snapshot: raw.venue_snapshot ?? null,
    lifecycle_status: (raw.lifecycle_status as any) ?? 'active',
    closure_outcome: raw.closure_outcome ?? null,
    my_declined: Boolean(raw.my_declined),
  };
}

export async function getTournaments(
  options?: RequestOptions & { currentUserId?: string; view?: 'active' | 'all' },
): Promise<TournamentsListResponse> {
  const { data } = await apiClient.get<TournamentApiItem[]>('/tournaments', {
    params: options?.view ? { view: options.view } : undefined,
    correlationId: options?.correlationId,
  });
  const items = data.map(raw => mapTournamentApiItem(raw, options?.currentUserId));
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
 * `POST /tournaments` (DES §4.3 Create Flow Amendment, §4.5, §7.7; R-040).
 * Body is a subset of the live `TournamentCreate` schema, extended by the
 * amendment to include `visibility`/`group_id`/`description`/`venue_name`
 * (see `CreateTournamentInput`). Optional fields are omitted by the caller
 * when absent so server defaults/nulls apply.
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

/**
 * Tournament invitations (tournament-lifecycle addendum v1.2.2, AD-4). All
 * routes 404 while `meetup.tournament.invitations.enabled` is off, and
 * `409 INVITES_CLOSED` after registration closes: callers show the server's
 * message. One correlation id per user action is passed in by the caller.
 */
export async function inviteUserToTournament(
  id: string,
  userId: string,
  options?: RequestOptions,
): Promise<TournamentInvitation> {
  const { data } = await apiClient.post<TournamentInvitation>(
    `/tournaments/${id}/invite-user`,
    { user_id: userId },
    { correlationId: options?.correlationId },
  );
  return data;
}

export async function inviteGroupToTournament(
  id: string,
  groupId: string,
  options?: RequestOptions,
): Promise<TournamentInvitation[]> {
  const { data } = await apiClient.post<TournamentInvitation[]>(
    `/tournaments/${id}/invite-group`,
    { group_id: groupId },
    { correlationId: options?.correlationId },
  );
  return data;
}

export async function inviteEmailToTournament(
  id: string,
  email: string,
  options?: RequestOptions,
): Promise<TournamentInvitation> {
  const { data } = await apiClient.post<TournamentInvitation>(
    `/tournaments/${id}/invite-email`,
    { email },
    { correlationId: options?.correlationId },
  );
  return data;
}

/** `POST /tournaments/{id}/invitations/respond` `{ accept }` (the invitee only). */
export async function respondToTournamentInvitation(
  id: string,
  accept: boolean,
  options?: RequestOptions,
): Promise<void> {
  await apiClient.post(
    `/tournaments/${id}/invitations/respond`,
    { accept },
    { correlationId: options?.correlationId },
  );
}

/**
 * Fetch tournament closure report (DES-MEETUP-ADDENDUM-closure-report AD-3).
 * Viewers see outcome, winner, runner_up. Organizer/committee also sees attendees, candidates.
 */
export async function getTournamentClosure(
  id: string,
  options?: RequestOptions,
): Promise<TournamentClosureResponse> {
  const { data } = await apiClient.get<TournamentClosureResponse>(`/tournaments/${id}/closure`, {
    correlationId: options?.correlationId,
  });
  return data;
}

/**
 * Submit or update tournament closure report (DES-MEETUP-ADDENDUM-closure-report AD-3).
 * Organizer or active committee member only.
 */
export async function putTournamentClosure(
  id: string,
  payload: TournamentClosurePut,
  options?: RequestOptions,
): Promise<TournamentClosureResponse> {
  const { data } = await apiClient.put<TournamentClosureResponse>(`/tournaments/${id}/closure`, payload, {
    correlationId: options?.correlationId,
  });
  return data;
}

/** `POST /tournaments/{id}/decline` (DES-MEETUP-ADDENDUM-decline-response AD-3). */
export async function declineTournament(
  id: string,
  options?: RequestOptions,
): Promise<DeclineAck> {
  const { data } = await apiClient.post<DeclineAck>(
    `/tournaments/${id}/decline`,
    {},
    { correlationId: options?.correlationId },
  );
  return data;
}

/** `GET /tournaments/{id}/invitations`. Organizer or committee only. */
export async function getTournamentInvitations(
  id: string,
  options?: RequestOptions,
): Promise<TournamentInvitation[]> {
  const { data } = await apiClient.get<TournamentInvitation[]>(`/tournaments/${id}/invitations`, {
    correlationId: options?.correlationId,
  });
  return data;
}

/** `GET /tournaments/{id}/responses` (DES-MEETUP-ADDENDUM-decline-response AD-5). Organizer or committee only. */
export async function getTournamentResponses(
  id: string,
  options?: RequestOptions,
): Promise<ResponsesResponse> {
  const { data } = await apiClient.get<ResponsesResponse>(`/tournaments/${id}/responses`, {
    correlationId: options?.correlationId,
  });
  return data;
}

/**
 * `GET /tournaments/{id}/standings` (match-scoring v1.2, ms-s4 Appendix A1). Any viewer of the
 * tournament. Returns `null` when there is no scoring data to show: the v1 list shape, an
 * unpublished fixture, or a 404 (scoring switched off). Other errors propagate.
 */
export async function getTournamentStandings(
  id: string,
  options?: RequestOptions,
): Promise<TournamentStandingsView | null> {
  try {
    const { data } = await apiClient.get<unknown>(`/tournaments/${id}/standings`, {
      correlationId: options?.correlationId,
    });
    return normaliseStandings(data);
  } catch (error) {
    if ((error as { response?: { status?: number } } | null)?.response?.status === 404) {
      return null;
    }
    throw error;
  }
}

/**
 * `GET /tournaments/{id}/scoring/state` (match-scoring ms-s5). Any viewer; answers 200 whether or not the
 * engine is on. Returns `null` for a 404 or an unreadable body. Other errors propagate.
 */
export async function getTournamentScoringState(
  id: string,
  options?: RequestOptions,
): Promise<TournamentScoringState | null> {
  try {
    const { data } = await apiClient.get<unknown>(`/tournaments/${id}/scoring/state`, {
      correlationId: options?.correlationId,
    });
    return normaliseScoringState(data);
  } catch (error) {
    if ((error as { response?: { status?: number } } | null)?.response?.status === 404) {
      return null;
    }
    throw error;
  }
}

/**
 * Committee invitation (tl-c-accept). Accept and decline take no body and no request id: the server changes the
 * caller's own row only while it is `invited` (a conditional update), so a second answer is refused with a coded
 * 409 rather than applied twice. The caller threads one correlation id through the answer and the refresh.
 * Coded errors: 404 `committee_not_invited`, 409 `committee_already_active`, `committee_invitation_closed`,
 * `tournament_cancelled`, `tournament_ended`, `v2_disabled`.
 */
export async function getCommitteeInvitation(
  id: string,
  options?: RequestOptions,
): Promise<CommitteeInvitationSummary> {
  const { data } = await apiClient.get<CommitteeInvitationSummary>(`/tournaments/${id}/committee/invitation`, {
    correlationId: options?.correlationId,
  });
  return data;
}

export async function respondToCommitteeInvitation(
  id: string,
  accept: boolean,
  options?: RequestOptions,
): Promise<CommitteeInvitationAck> {
  const { data } = await apiClient.post<CommitteeInvitationAck>(
    `/tournaments/${id}/committee/invitation/${accept ? 'accept' : 'decline'}`,
    undefined,
    { correlationId: options?.correlationId },
  );
  return data;
}

/** `GET /tournaments/{id}/committee/members`: names to show; `[]` unless the caller is an active committee member. */
export async function getCommitteeMembers(id: string, options?: RequestOptions): Promise<CommitteeMember[]> {
  const { data } = await apiClient.get<CommitteeMember[]>(`/tournaments/${id}/committee/members`, {
    correlationId: options?.correlationId,
  });
  return Array.isArray(data) ? data : [];
}
