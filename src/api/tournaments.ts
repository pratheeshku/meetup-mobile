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
  TournamentEditBody,
  TournamentClosureResponse,
  TournamentAudienceGroup,
  TournamentInvitation,
  TournamentImageKind,
  TournamentImages,
  TournamentInvitationStatus,
  TournamentInviteAccess,
  TournamentParticipationMode,
  TournamentFormatRules,
  TournamentPerson,
  Tournament,
  TournamentFixture,
  TournamentMyRegistration,
  RegistrationPaymentResult,
  RegistrationRoster,
  RegistrationSummary,
  TournamentRegistration,
  TournamentRegistrationStatus,
  TournamentsListResponse,
  TournamentStatus,
} from '../types/tournament';
import type {
  ApprovalRequest,
  MatchEntryResponse,
  MatchPreview,
  MatchResultBody,
  MediaPage,
  PointsAccepted,
  ResultsUploadSummary,
} from '../types/tournamentTabs';
import type { DraftDetail } from '../types/tournamentTabs';
import { normaliseDraft } from '../utils/fixturesSetup';
import { normaliseApprovals, normaliseEntryResponse, normaliseMediaPage, normalisePreview } from '../utils/tournamentTabs';
import type {
  WizardCreateBody,
  WizardCreateResult,
  WizardTemplatesResponse,
} from '../types/tournamentWizard';

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
  /** AD-1: set on every route that returns a tournament; null/absent = unknown. */
  registered_count?: number | null;
  /** AD-1, AD-4: read-only booleans set by the server. */
  is_full?: boolean | null;
  registration_open?: boolean | null;
  my_registration_status?: TournamentRegistrationStatus | null;
  my_invite_access?: string | null;
  group_name?: string | null;
  visibility?: string | null;
  my_invitation_status?: string | null;
  my_committee_invitation?: string | null;
  venue_name?: string | null;
  venue_label?: string | null;
  venue_detail?: string | null;
  venue_id?: string | null;
  venue_snapshot?: VenueSnapshot | null;
  lifecycle_status?: string | null;
  closure_outcome?: string | null;
  my_declined?: boolean | null;
  participation_mode?: string | null;
  ends_at?: string | null;
  schedule_published_at?: string | null;
  banner_url?: string | null;
  logo_url?: string | null;
  banner_tone?: string | null;
  banner_scrim?: number | null;
  has_custom_banner?: boolean | null;
  organizer?: TournamentPerson | null;
  committee?: TournamentPerson[] | null;
  lifecycle_version?: number | null;
  registration_opened_at?: string | null;
  registration_hard_block_at?: string | null;
  roster_frozen_at?: string | null;
  format_rules?: TournamentFormatRules | null;
  /** tournament-registration AD-4: whole cents and currency; both null while the fee flag is off and for a free tournament. */
  registration_fee_cents?: number | null;
  registration_fee_currency?: string | null;
  /** teams-payments AD-7, AD-9: the payee number (null unless the server allows) and the caller's own registration (`GET /tournaments/{id}` only). */
  payment_contact_number?: string | null;
  my_registration?: Partial<TournamentMyRegistration> | null;
  /** AD-7 list-row fields (additive): venue address and map pin, the audience groups `[{id, name}]` and their ids. */
  venue_address?: string | null;
  venue_lat?: number | null;
  venue_lng?: number | null;
  venue_place_id?: string | null;
  groups?: Array<{ id?: unknown; name?: unknown }> | null;
  group_ids?: string[] | null;
}

const ruleNumber = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

/** `format_rules` as stored (te-b3): a value that is not a number or a string stays null; nothing is defaulted. */
function normaliseFormatRules(raw: unknown): TournamentFormatRules | null {
  if (typeof raw !== 'object' || raw === null) {
    return null;
  }
  const rules = raw as Record<string, unknown>;
  return {
    elimination: typeof rules.elimination === 'string' && rules.elimination ? rules.elimination : null,
    sets_best_of: ruleNumber(rules.sets_best_of),
    points_to_win: ruleNumber(rules.points_to_win),
    courts: ruleNumber(rules.courts),
    min_participants: ruleNumber(rules.min_participants),
    max_participants: ruleNumber(rules.max_participants),
  };
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
    // The API's word wins (A39); only a server that does not send it (older build) falls back to the closing date.
    registration_open:
      typeof raw.registration_open === 'boolean'
        ? raw.registration_open
        : raw.registration_closes_at === null || Date.parse(raw.registration_closes_at) > Date.now(),
    participant_count: raw.registered_count ?? null,
    is_full: raw.is_full === true,
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
    venue_detail: raw.venue_detail?.trim() ? raw.venue_detail.trim() : null,
    venue_id: raw.venue_id ?? null,
    venue_snapshot: raw.venue_snapshot ?? null,
    lifecycle_status: (raw.lifecycle_status as any) ?? 'active',
    closure_outcome: raw.closure_outcome ?? null,
    my_declined: Boolean(raw.my_declined),
    ends_at: raw.ends_at ?? null,
    participation_mode:
      raw.participation_mode === 'individual' || raw.participation_mode === 'team'
        ? (raw.participation_mode as TournamentParticipationMode)
        : null,
    schedule_published_at: raw.schedule_published_at ?? null,
    banner_url: raw.banner_url ?? null,
    logo_url: raw.logo_url ?? null,
    banner_tone: raw.banner_tone === 'light' || raw.banner_tone === 'dark' ? raw.banner_tone : null,
    banner_scrim: typeof raw.banner_scrim === 'number' ? raw.banner_scrim : null,
    has_custom_banner: typeof raw.has_custom_banner === 'boolean' ? raw.has_custom_banner : null,
    organizer: raw.organizer ?? null,
    committee: Array.isArray(raw.committee) ? raw.committee : [],
    lifecycle_version: typeof raw.lifecycle_version === 'number' ? raw.lifecycle_version : null,
    registration_opened_at: raw.registration_opened_at ?? null,
    registration_hard_block_at: raw.registration_hard_block_at ?? null,
    roster_frozen_at: raw.roster_frozen_at ?? null,
    format_rules: normaliseFormatRules(raw.format_rules),
    registration_fee_cents: typeof raw.registration_fee_cents === 'number' ? raw.registration_fee_cents : null,
    registration_fee_currency:
      typeof raw.registration_fee_currency === 'string' && raw.registration_fee_currency ? raw.registration_fee_currency : null,
    payment_contact_number: raw.payment_contact_number?.trim() ? raw.payment_contact_number.trim() : null,
    my_registration: normaliseMyRegistration(raw.my_registration),
    venue_address: raw.venue_address?.trim() ? raw.venue_address.trim() : null,
    venue_lat: typeof raw.venue_lat === 'number' ? raw.venue_lat : null,
    venue_lng: typeof raw.venue_lng === 'number' ? raw.venue_lng : null,
    venue_place_id: raw.venue_place_id ?? null,
    audience_groups: normaliseAudienceGroups(raw.groups),
  };
}

/** `my_registration` as sent; null when absent or without a registration id. A missing field is null/false, never invented. */
function normaliseMyRegistration(raw: Partial<TournamentMyRegistration> | null | undefined): TournamentMyRegistration | null {
  if (!raw || typeof raw.registration_id !== 'string' || !raw.registration_id) {
    return null;
  }
  const number = (value: unknown): number | null => (typeof value === 'number' && Number.isFinite(value) ? value : null);
  return {
    registration_id: raw.registration_id,
    status: typeof raw.status === 'string' ? raw.status : '',
    fee_cents_at_registration: number(raw.fee_cents_at_registration),
    effective_fee_cents: number(raw.effective_fee_cents),
    payment_received_at: typeof raw.payment_received_at === 'string' ? raw.payment_received_at : null,
    payment_exempt: raw.payment_exempt === true,
    payment_contact_number:
      typeof raw.payment_contact_number === 'string' && raw.payment_contact_number.trim() ? raw.payment_contact_number.trim() : null,
  };
}

/** `groups` as sent: `[{id, name}]` in selection order. An entry without a text id and name is dropped. */
function normaliseAudienceGroups(raw: TournamentApiItem['groups']): TournamentAudienceGroup[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const out: TournamentAudienceGroup[] = [];
  for (const entry of raw) {
    if (typeof entry?.id === 'string' && entry.id && typeof entry?.name === 'string' && entry.name) {
      out.push({ id: entry.id, name: entry.name });
    }
  }
  return out;
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
 * `POST /tournaments/{id}/registrations` (tournament-registration AD-1, AD-5). A free individual tournament posts no body (the server treats an omitted
 * `user_id` as the caller); a tournament with a fee posts `{ accepted_fee_cents }`, the fee the player saw and confirmed. The server answers 409
 * `FEE_ACK_REQUIRED` or `FEE_CHANGED` (with the current `registration_fee_cents`) when that is missing or stale.
 */
export async function registerForTournament(
  id: string,
  options?: RequestOptions & { acceptedFeeCents?: number | null; teamId?: string | null },
): Promise<void> {
  const fee = options?.acceptedFeeCents;
  const body: { team_id?: string; accepted_fee_cents?: number } = {};
  // Team mode names the tournament team; individual mode sends neither team_id nor user_id (the server treats an omitted user_id as the caller).
  if (options?.teamId) {
    body.team_id = options.teamId;
  }
  if (typeof fee === 'number') {
    body.accepted_fee_cents = fee;
  }
  await apiClient.post(
    `/tournaments/${id}/registrations`,
    Object.keys(body).length > 0 ? body : undefined,
    { correlationId: options?.correlationId },
  );
}

/**
 * `PATCH /tournaments/{id}` with `{ registration_fee_cents }` (tournament-registration AD-4, "Set and edit"): whole cents, or null to clear
 * the fee, plus `payment_contact_number` for a fee above 0 (teams-payments AD-7). The server refuses with 409 once registration has closed and 422 for a value out of range.
 */
export async function updateTournamentFee(
  id: string,
  cents: number | null,
  options?: RequestOptions & { paymentContactNumber?: string | null },
): Promise<void> {
  // The payee number (teams-payments AD-7, E.164) goes with a fee above 0 only; the server validates it and never echoes it.
  const body: { registration_fee_cents: number | null; payment_contact_number?: string } = { registration_fee_cents: cents };
  if (typeof cents === 'number' && cents > 0 && options?.paymentContactNumber) {
    body.payment_contact_number = options.paymentContactNumber;
  }
  await apiClient.patch(`/tournaments/${id}`, body, { correlationId: options?.correlationId });
}

/** `DELETE /tournaments/{id}/registrations/{registration_id}`. `wasPaid` is the server's `was_paid` (teams-payments AD-12). */
export async function withdrawFromTournament(
  id: string,
  registrationId: string,
  options?: RequestOptions,
): Promise<{ wasPaid: boolean }> {
  const { data } = await apiClient.delete<{ was_paid?: boolean } | undefined>(`/tournaments/${id}/registrations/${registrationId}`, {
    correlationId: options?.correlationId,
  });
  return { wasPaid: data?.was_paid === true };
}

const summaryNumber = (value: unknown): number => (typeof value === 'number' && Number.isFinite(value) ? value : 0);

function normaliseSummary(raw: Partial<RegistrationSummary> | null | undefined): RegistrationSummary {
  return {
    payments_enabled: raw?.payments_enabled === true,
    registered: summaryNumber(raw?.registered),
    paid: summaryNumber(raw?.paid),
    unpaid: summaryNumber(raw?.unpaid),
    exempt: summaryNumber(raw?.exempt),
    collected_cents: summaryNumber(raw?.collected_cents),
    currency: typeof raw?.currency === 'string' && raw.currency ? raw.currency : '',
    fee_cents: typeof raw?.fee_cents === 'number' ? raw.fee_cents : null,
    excluded_from_fixtures: summaryNumber(raw?.excluded_from_fixtures),
    points_locked: raw?.points_locked === true,
  };
}

/** `GET /tournaments/{id}/registrations/summary`: organizer and active committee (403 otherwise). Every figure is the server's. */
export async function getRegistrationSummary(id: string, options?: RequestOptions): Promise<RegistrationSummary> {
  const { data } = await apiClient.get<Partial<RegistrationSummary>>(`/tournaments/${id}/registrations/summary`, {
    correlationId: options?.correlationId,
  });
  return normaliseSummary(data);
}

/**
 * `PUT /tournaments/{id}/registrations/{registration_id}/payment` `{received}`: an idempotent set, not a toggle (teams-payments AD-9). The answer carries
 * the entrant's state and the fresh summary, so the screen takes both from it and never adds numbers.
 */
export async function setRegistrationPayment(
  id: string,
  registrationId: string,
  received: boolean,
  options?: RequestOptions,
): Promise<RegistrationPaymentResult> {
  const { data } = await apiClient.put<Partial<RegistrationPaymentResult>>(
    `/tournaments/${id}/registrations/${registrationId}/payment`,
    { received },
    { correlationId: options?.correlationId },
  );
  return {
    registration_id: data?.registration_id ?? registrationId,
    payment_received_at: data?.payment_received_at ?? null,
    effective_fee_cents: typeof data?.effective_fee_cents === 'number' ? data.effective_fee_cents : null,
    summary: normaliseSummary(data?.summary),
    draft_exists: data?.draft_exists === true,
  };
}

/** `PUT /tournaments/{id}/registrations/{registration_id}/points` `{points}`: a number, or null for unrated (teams-payments AD-13). */
export async function setRegistrationPoints(
  id: string,
  registrationId: string,
  points: number | null,
  options?: RequestOptions,
): Promise<void> {
  await apiClient.put(`/tournaments/${id}/registrations/${registrationId}/points`, { points }, { correlationId: options?.correlationId });
}

/** `GET /tournaments/{id}/registrations/{registration_id}/roster`: the team details sheet. `players` is null unless the server allows names. */
export async function getRegistrationRoster(id: string, registrationId: string, options?: RequestOptions): Promise<RegistrationRoster> {
  const { data } = await apiClient.get<Partial<RegistrationRoster>>(`/tournaments/${id}/registrations/${registrationId}/roster`, {
    correlationId: options?.correlationId,
  });
  return {
    registration_id: data?.registration_id ?? registrationId,
    team_id: data?.team_id ?? null,
    team_name: data?.team_name ?? null,
    sport: data?.sport ?? '',
    captain_name: data?.captain_name ?? null,
    player_count: typeof data?.player_count === 'number' ? data.player_count : 0,
    players: Array.isArray(data?.players)
      ? data.players.map(player => ({
          user_id: player.user_id,
          display_name: player.display_name ?? null,
          is_captain: player.is_captain === true,
        }))
      : null,
  };
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
  team_id?: string | null;
  registered_at: string;
  participant_name: string | null;
  status: string;
  payment_received_at?: string | null;
  effective_fee_cents?: number | null;
  points?: string | number | null;
  payment_exempt?: boolean | null;
  team_player_count?: number | null;
  team_captain_name?: string | null;
}

function mapTournamentRegistration(raw: TournamentRegistrationApiItem): TournamentRegistration {
  return {
    id: raw.id,
    user_id: raw.user_id,
    nickname: raw.participant_name ?? '',
    registered_at: raw.registered_at,
    status: raw.status as TournamentRegistrationStatus,
    team_id: raw.team_id ?? null,
    payment_received_at: raw.payment_received_at ?? null,
    effective_fee_cents: typeof raw.effective_fee_cents === 'number' ? raw.effective_fee_cents : null,
    points: raw.points === null || raw.points === undefined ? null : String(raw.points),
    payment_exempt: raw.payment_exempt === true,
    team_player_count: typeof raw.team_player_count === 'number' ? raw.team_player_count : null,
    team_captain_name: raw.team_captain_name ?? null,
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

/**
 * Creation wizard (AD-20). `GET /tournaments/v2/templates`: published templates plus the limits the wizard
 * mirrors; `{ templates: [] }` while the v2 flag is off. Not cached: the list is read when the wizard opens.
 */
export async function getWizardTemplates(options?: RequestOptions): Promise<WizardTemplatesResponse> {
  const { data } = await apiClient.get<WizardTemplatesResponse>('/tournaments/v2/templates', {
    correlationId: options?.correlationId,
  });
  return { ...data, templates: Array.isArray(data?.templates) ? data.templates : [] };
}

/**
 * `POST /tournaments/v2/create`. 201 (created) and 200 (replay of the same `client_request_id`) are both success;
 * `replayed` tells them apart. Rejections reject with the axios error (`response.data` = `WizardRejection`).
 */
export async function createWizardTournament(
  body: WizardCreateBody,
  options?: RequestOptions,
): Promise<{ result: WizardCreateResult; replayed: boolean }> {
  const response = await apiClient.post<WizardCreateResult>('/tournaments/v2/create', body, {
    correlationId: options?.correlationId,
  });
  return { result: response.data, replayed: response.status === 200 };
}

/**
 * Tournament banner and logo (tournament-experience AD-T1, te-b1). `PUT /tournaments/{id}/banner` and `/logo` take one
 * multipart field named `file` (JPEG or PNG; the server crops, strips EXIF and computes the text tone). Organizer or
 * active committee member only. The answer is the new effective values. Coded errors: `422`/`413` with
 * `detail.code = IMAGE_INVALID`, `409 tournament_ended`, `403`, `502`.
 */
export async function uploadTournamentImage(
  id: string,
  kind: TournamentImageKind,
  file: { uri: string; name: string; type: string },
  options?: RequestOptions,
): Promise<TournamentImages> {
  const formData = new FormData();
  formData.append('file', file as unknown as Blob);
  const { data } = await apiClient.put<TournamentImages>(`/tournaments/${id}/${kind}`, formData, {
    correlationId: options?.correlationId,
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}

/** `DELETE /tournaments/{id}/banner` or `/logo`: clears the tournament's own image; the default shows again. */
export async function deleteTournamentImage(
  id: string,
  kind: TournamentImageKind,
  options?: RequestOptions,
): Promise<TournamentImages> {
  const { data } = await apiClient.delete<TournamentImages>(`/tournaments/${id}/${kind}`, {
    correlationId: options?.correlationId,
  });
  return data;
}

/**
 * `POST /tournaments/{id}/matches/{match_id}/result/preview` (AD-T7, te-b2): the impact box of Enter score and Edit
 * score. Writes nothing. The body never carries a winner. Active committee members only; refusals reject with the axios
 * error (`readResultRefusal` reads them).
 */
export async function previewMatchResult(
  id: string,
  fixtureId: string,
  body: MatchResultBody,
  options?: RequestOptions,
): Promise<MatchPreview> {
  const { data } = await apiClient.post<unknown>(`/tournaments/${id}/matches/${fixtureId}/result/preview`, body, {
    correlationId: options?.correlationId,
  });
  return normalisePreview(data);
}

/**
 * `POST /tournaments/{id}/matches/{match_id}/result` (AD-S13, AD-T8). The server derives the winner from the sets; the
 * answer carries `advanced`, `qualified`, `standings_delta` and `bracket_version` for the live fill. Refusals reject with
 * the axios error: 422 `MATCH_TIED` / `REASON_REQUIRED` / `SIDES_NOT_KNOWN`, 409 `RESULTS_LOCKED` / `RESULT_STALE` /
 * `CORRECTION_NEEDS_APPROVAL`.
 */
export async function postMatchResult(
  id: string,
  fixtureId: string,
  body: MatchResultBody,
  options?: RequestOptions,
): Promise<MatchEntryResponse> {
  const { data } = await apiClient.post<unknown>(`/tournaments/${id}/matches/${fixtureId}/result`, body, {
    correlationId: options?.correlationId,
  });
  return normaliseEntryResponse(data);
}

/**
 * `POST /tournaments/{id}/committee/actions` with `result_winner_change`: the proposed result of a correction that
 * changes the winner, sent for a second committee member to approve (match-scoring AD-S6). The server derives the winner.
 */
export async function submitResultChangeForApproval(
  id: string,
  fixtureId: string,
  body: Pick<MatchResultBody, 'result_type' | 'sets' | 'advancing_side'> & { reason: string },
  options?: RequestOptions,
): Promise<void> {
  await apiClient.post(
    `/tournaments/${id}/committee/actions`,
    {
      action_type: 'result_winner_change',
      fixture_id: fixtureId,
      result_type: body.result_type,
      sets: body.sets,
      advancing_side: body.advancing_side,
      reason: body.reason,
    },
    { correlationId: options?.correlationId },
  );
}

/** `GET /tournaments/{id}/committee/actions`: the requests the caller may see (all for an active committee member). */
export async function getCommitteeActions(id: string, options?: RequestOptions): Promise<ApprovalRequest[]> {
  const { data } = await apiClient.get<unknown>(`/tournaments/${id}/committee/actions`, {
    correlationId: options?.correlationId,
  });
  return normaliseApprovals(data);
}

/** `POST .../committee/actions/{request_id}/approve`: a version 2 approval executes in the same call (no code, no confirm). */
export async function approveCommitteeAction(id: string, requestId: string, options?: RequestOptions): Promise<void> {
  await apiClient.post(`/tournaments/${id}/committee/actions/${requestId}/approve`, {}, {
    correlationId: options?.correlationId,
  });
}

/** `POST .../committee/actions/{request_id}/reject`: takes no body and no reason. The maker uses it to withdraw. */
export async function rejectCommitteeAction(id: string, requestId: string, options?: RequestOptions): Promise<void> {
  await apiClient.post(`/tournaments/${id}/committee/actions/${requestId}/reject`, undefined, {
    correlationId: options?.correlationId,
  });
}

/** `POST /tournaments/{id}/registrations/committee-add`: an active committee member adds one individual (version 2). */
export async function committeeAddPlayer(id: string, userId: string, options?: RequestOptions): Promise<void> {
  await apiClient.post(`/tournaments/${id}/registrations/committee-add`, { user_id: userId }, {
    correlationId: options?.correlationId,
  });
}

/** `POST /tournaments/{id}/registrations/committee-add` with `team_id` only (AD-2: exactly one of `user_id` or `team_id`). */
export async function committeeAddTeam(id: string, teamId: string, options?: RequestOptions): Promise<void> {
  await apiClient.post(`/tournaments/${id}/registrations/committee-add`, { team_id: teamId }, {
    correlationId: options?.correlationId,
  });
}

/**
 * `PATCH /tournaments/{id}` for Edit tournament (AD-3, lifecycle version 2): only the fields in `body` are sent. The answer's `fixtures_reset` is
 * true when the edit threw the generated fixtures away. The fee client above (`updateTournamentFee`) is a separate call and unchanged.
 */
export async function updateTournament(
  id: string,
  body: TournamentEditBody,
  options?: RequestOptions,
): Promise<{ fixturesReset: boolean }> {
  const { data } = await apiClient.patch<{ fixtures_reset?: boolean | null } | undefined>(`/tournaments/${id}`, body, {
    correlationId: options?.correlationId,
  });
  return { fixturesReset: data?.fixtures_reset === true };
}

/** `GET /tournaments/{id}/media`: newest first, paginated. Anyone who can view the tournament. */
export async function getTournamentMedia(
  id: string,
  page: { limit: number; offset: number },
  options?: RequestOptions,
): Promise<MediaPage> {
  const { data } = await apiClient.get<unknown>(`/tournaments/${id}/media`, {
    params: { limit: page.limit, offset: page.offset },
    correlationId: options?.correlationId,
  });
  return normaliseMediaPage(data);
}

/**
 * `POST /tournaments/{id}/media`, one multipart field `file`. The server decides the kind from the bytes and holds every
 * limit (size, count, video on or off): the app hard-codes none and shows the server's coded error
 * (`MEDIA_NOT_ALLOWED`, `MEDIA_TOO_LARGE`, `MEDIA_LIMIT_REACHED`, `IMAGE_INVALID`).
 */
export async function uploadTournamentMedia(
  id: string,
  file: { uri: string; name: string; type: string },
  options?: RequestOptions,
): Promise<void> {
  const formData = new FormData();
  formData.append('file', file as unknown as Blob);
  await apiClient.post(`/tournaments/${id}/media`, formData, {
    correlationId: options?.correlationId,
    headers: { 'Content-Type': 'multipart/form-data' },
  });
}

/** `DELETE /tournaments/{id}/media/{media_id}` (204): the uploader or an active committee member. */
export async function deleteTournamentMedia(id: string, mediaId: string, options?: RequestOptions): Promise<void> {
  await apiClient.delete(`/tournaments/${id}/media/${mediaId}`, { correlationId: options?.correlationId });
}

// ---- Fixtures setup and results file (te-a3, AD-T12): the routes the web already uses ------------------------------
type UploadFile = { uri: string; name: string; type: string };

async function postWorkbook<T>(path: string, file: UploadFile, options?: RequestOptions): Promise<T> {
  const formData = new FormData();
  formData.append('file', file as unknown as Blob);
  const { data } = await apiClient.post<T>(path, formData, {
    correlationId: options?.correlationId,
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}

/**
 * `POST /tournaments/{id}/points` (all or nothing): 422 lists the row errors and nothing is saved.
 * Deprecated (teams-payments AD-13): the app no longer calls it. Points are edited per entrant (`setRegistrationPoints`); the server keeps the route
 * for older apps until the sunset.
 */
export async function uploadPoints(id: string, file: UploadFile, options?: RequestOptions): Promise<PointsAccepted> {
  const data = await postWorkbook<Partial<PointsAccepted>>(`/tournaments/${id}/points`, file, options);
  return { entrants: data.entrants ?? 0, rated: data.rated ?? 0, unrated: data.unrated ?? 0 };
}

/** `POST /tournaments/{id}/fixtures/generate`: a new draft (replaces the open one). 409 `FIXTURE_FROZEN` once a result exists. */
export async function generateFixtureDraft(
  id: string,
  body: { group_count: number | null; advance_per_group: number },
  options?: RequestOptions,
): Promise<DraftDetail | null> {
  const { data } = await apiClient.post<unknown>(`/tournaments/${id}/fixtures/generate`, body, {
    correlationId: options?.correlationId,
  });
  return normaliseDraft(data);
}

/** `GET /tournaments/{id}/drafts/{draft_id}`: registration ids only (no names). */
export async function getFixtureDraft(id: string, draftId: string, options?: RequestOptions): Promise<DraftDetail | null> {
  const { data } = await apiClient.get<unknown>(`/tournaments/${id}/drafts/${draftId}`, {
    correlationId: options?.correlationId,
  });
  return normaliseDraft(data);
}

/** `POST .../committee/actions` `fixture_publication`: submits the draft, bound by its hash, for a second member to approve. */
export async function submitFixturePublication(
  id: string,
  draftId: string,
  payloadHash: string,
  options?: RequestOptions,
): Promise<void> {
  await apiClient.post(
    `/tournaments/${id}/committee/actions`,
    { action_type: 'fixture_publication', draft_id: draftId, payload_hash: payloadHash },
    { correlationId: options?.correlationId },
  );
}

/** `POST /tournaments/{id}/fixtures/results-upload`: the optional bulk scoring workbook. */
export async function uploadResultsFile(id: string, file: UploadFile, options?: RequestOptions): Promise<ResultsUploadSummary> {
  const data = await postWorkbook<Partial<ResultsUploadSummary>>(`/tournaments/${id}/fixtures/results-upload`, file, options);
  return { posted: data.posted ?? 0, corrected: data.corrected ?? 0, unchanged: data.unchanged ?? 0 };
}
