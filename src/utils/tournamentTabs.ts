/**
 * Pure helpers of the tab bodies of the tournament page for lifecycle version 2 (te-a2; DES-MEETUP-ADDENDUM-tournament-
 * experience AD-T7 to AD-T10). Nothing here decides a winner, a standing, an advancement, a tab state or a status: those
 * are the server's. The file reads what the server sent (normalisers), builds request bodies without a winner, and maps
 * server values to the words and rows of the boards.
 */
import type { LabelKey } from '../labels/fallbackLabels';
import type {
  Tournament,
  TournamentClosurePerson,
  TournamentClosurePut,
  TournamentClosureResponse,
  TournamentFormatRules,
  TournamentRegistration,
} from '../types/tournament';
import type {
  ScoringGroup,
  ScoringMatch,
  ScoringSet,
  TournamentScoringState,
  TournamentStandingsView,
} from '../types/tournamentScoring';
import type {
  AdvancedSlot,
  ApprovalRequest,
  BlockedBy,
  EntryResultType,
  MatchEntryResponse,
  MatchPreview,
  MatchResultBody,
  MediaItem,
  MediaPage,
  ParticipantRow,
  QualifiedEntry,
  ResultRefusal,
} from '../types/tournamentTabs';
import { normaliseGroup, normaliseMatch } from './tournamentScoring';

type Json = Record<string, unknown>;
const isObject = (value: unknown): value is Json => typeof value === 'object' && value !== null && !Array.isArray(value);
const str = (value: unknown): string | null => (typeof value === 'string' ? value : null);
const list = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

// ---- normalisers (what the server returned, defensively) -----------------------------------------------------------
function groups(raw: unknown): ScoringGroup[] {
  return list(raw)
    .map(normaliseGroup)
    .filter((g): g is ScoringGroup => g !== null);
}

function matches(raw: unknown): ScoringMatch[] {
  return list(raw)
    .map(normaliseMatch)
    .filter((m): m is ScoringMatch => m !== null);
}

function advancedSlots(raw: unknown): AdvancedSlot[] {
  return list(raw)
    .filter(isObject)
    .map(item => ({
      match_id: str(item.match_id),
      fixture_id: str(item.fixture_id) ?? '',
      side: (item.side === 'B' ? 'B' : 'A') as 'A' | 'B',
      name: str(item.name),
      registration_id: str(item.registration_id),
      change: str(item.change) ?? '',
    }))
    .filter(item => item.fixture_id !== '');
}

export function normalisePreview(raw: unknown): MatchPreview {
  const body = isObject(raw) ? raw : {};
  return {
    was: normaliseMatch(body.was),
    will_be: normaliseMatch(body.will_be),
    standings_delta: groups(body.standings_delta),
    advanced: advancedSlots(body.advanced),
    blocked_by: list(body.blocked_by)
      .filter(isObject)
      .map(item => ({
        code: str(item.code) ?? '',
        detail: str(item.detail) ?? '',
        ...(Array.isArray(item.matches)
          ? {
              matches: item.matches.filter(isObject).map(m => ({
                match_id: str(m.match_id),
                stage: str(m.stage) ?? '',
                round_number: typeof m.round_number === 'number' ? m.round_number : 0,
              })),
            }
          : {}),
      })) as BlockedBy[],
  };
}

export function normaliseEntryResponse(raw: unknown): MatchEntryResponse {
  const body = isObject(raw) ? raw : {};
  return {
    outcome: str(body.outcome) ?? '',
    match: normaliseMatch(body.match),
    standings_delta: groups(body.standings_delta),
    advanced: advancedSlots(body.advanced),
    qualified: list(body.qualified)
      .filter(isObject)
      .map(q => ({
        group_key: str(q.group_key) ?? '',
        place: typeof q.place === 'number' ? q.place : 0,
        registration_id: str(q.registration_id) ?? '',
        name: str(q.name) ?? '',
      })) as QualifiedEntry[],
    changed_matches: matches(body.changed_matches),
    bracket_version: typeof body.bracket_version === 'number' ? body.bracket_version : 0,
  };
}

export function normaliseApprovals(raw: unknown): ApprovalRequest[] {
  return list(raw)
    .filter(isObject)
    .map(item => ({
      id: str(item.id) ?? '',
      action_type: str(item.action_type) ?? '',
      command_payload: isObject(item.command_payload) ? item.command_payload : {},
      consequence_description: str(item.consequence_description) ?? '',
      initiator_user_id: str(item.initiator_user_id) ?? '',
      approver_user_id: str(item.approver_user_id),
      status: str(item.status) ?? '',
      created_at: str(item.created_at) ?? '',
      resolved_at: str(item.resolved_at),
    }))
    .filter(item => item.id !== '');
}

export function normaliseMediaPage(raw: unknown): MediaPage {
  const body = isObject(raw) ? raw : {};
  const items: MediaItem[] = list(body.items)
    .filter(isObject)
    .map(item => ({
      id: str(item.id) ?? '',
      kind: (item.kind === 'video' ? 'video' : 'photo') as 'photo' | 'video',
      url: str(item.url) ?? '',
      content_type: str(item.content_type),
      size_bytes: typeof item.size_bytes === 'number' ? item.size_bytes : null,
      created_at: str(item.created_at) ?? '',
      uploaded_by: str(item.uploaded_by),
      can_remove: item.can_remove === true,
    }))
    .filter(item => item.id !== '' && item.url !== '');
  return { items, total: typeof body.total === 'number' ? body.total : items.length };
}

// ---- tab facts --------------------------------------------------------------------------------------------------
/** Milliseconds between refreshes, from the server's `live_poll_seconds`; 0 when the server did not send a usable value. */
export function pollMs(state: Pick<TournamentScoringState, 'live_poll_seconds'> | null | undefined): number {
  const seconds = Number(state?.live_poll_seconds);
  return Number.isFinite(seconds) && seconds >= 2 ? Math.round(seconds * 1000) : 0;
}

/**
 * Which page the tournament gets. `lifecycle_version` (te-b3) decides: 2 is the new page, 1 the legacy one. An older
 * server that sends no version falls back to the presence of the server `tabs` object (te-a1 rule). A version 2
 * tournament whose scoring state could not be read still gets the new page (header and Overview).
 */
export function usesV2Page(
  tournament: Pick<Tournament, 'lifecycle_version'>,
  scoring: Pick<TournamentScoringState, 'tabs'> | null | undefined,
): boolean {
  if (tournament.lifecycle_version === 2) {
    return true;
  }
  if (tournament.lifecycle_version === 1) {
    return false;
  }
  return Boolean(scoring?.tabs);
}

// ---- Overview: Format rows and Key dates (A2) ---------------------------------------------------------------------
export interface FormatRule {
  key: 'sets' | 'points' | 'entrants';
  labelKey: LabelKey;
  params: Record<string, number>;
}

/**
 * The rule rows of the Format card, only those that have a stored value. `elimination` and `courts` are not read: the
 * server sends them as null today and the app draws no row and no hard-coded wording for them.
 */
export function formatRuleRows(rules: TournamentFormatRules | null | undefined): FormatRule[] {
  if (!rules) {
    return [];
  }
  const rows: FormatRule[] = [];
  if (rules.sets_best_of !== null) {
    rows.push({ key: 'sets', labelKey: 'mob.tournament.v2.format_sets', params: { count: rules.sets_best_of } });
  }
  if (rules.points_to_win !== null) {
    rows.push({ key: 'points', labelKey: 'mob.tournament.v2.format_points', params: { count: rules.points_to_win } });
  }
  if (rules.min_participants !== null && rules.max_participants !== null) {
    rows.push({
      key: 'entrants',
      labelKey: 'mob.tournament.v2.format_entrants',
      params: { min: rules.min_participants, max: rules.max_participants },
    });
  }
  return rows;
}

// ---- Fixtures and Standings ----------------------------------------------------------------------------------------
export type FixtureFilter = 'all' | 'group' | 'knockouts' | 'mine';

const byTime = (a: ScoringMatch, b: ScoringMatch): number =>
  String(a.scheduled_at ?? '9999').localeCompare(String(b.scheduled_at ?? '9999')) ||
  a.round_number - b.round_number ||
  a.fixture_order - b.fixture_order;

export interface FixtureEntry {
  match: ScoringMatch;
  /** The group the match belongs to, null for a knockout match. */
  group: string | null;
}

/** The matches of one filter chip in time order, as the board holds them (nothing is re-derived). */
export function matchesFor(view: TournamentStandingsView | null, filter: FixtureFilter): FixtureEntry[] {
  const group: FixtureEntry[] = (view?.groups ?? []).flatMap(g => g.matches.map(match => ({ match, group: g.group_key })));
  const knockout: FixtureEntry[] = (view?.knockout ?? []).map(match => ({ match, group: null }));
  const mine = (e: FixtureEntry): boolean => e.match.side_a.is_mine || e.match.side_b.is_mine;
  const pool =
    filter === 'group' ? group : filter === 'knockouts' ? knockout : filter === 'mine' ? [...group, ...knockout].filter(mine) : [...group, ...knockout];
  return pool.filter(e => e.match.status !== 'cancelled').sort((a, b) => byTime(a.match, b.match));
}

/** "N of M played": a match is played when the server sent a result for it. */
export function playedCount(entries: FixtureEntry[]): { played: number; total: number } {
  return { played: entries.filter(e => e.match.result !== null).length, total: entries.length };
}

/** Sets won by each side, for display beside a name: a count of the stored sets, not a winner rule. */
export function setsWon(match: Pick<ScoringMatch, 'result'> | null): [number, number] {
  const sets = match?.result?.sets ?? [];
  return [sets.filter(s => s.a > s.b).length, sets.filter(s => s.b > s.a).length];
}

/** The side the server named as winner of the match: `a`, `b` or null. Read, never decided here. */
export function winnerSide(match: ScoringMatch | null): 'a' | 'b' | null {
  if (!match || !match.winner_registration_id) {
    return null;
  }
  if (match.side_a.registration_id === match.winner_registration_id) {
    return 'a';
  }
  if (match.side_b.registration_id === match.winner_registration_id) {
    return 'b';
  }
  return null;
}

/** A side is ready to score when the server resolved both registrations. */
export function bothSidesKnown(match: ScoringMatch): boolean {
  return Boolean(match.side_a.registration_id && match.side_b.registration_id);
}

function replaceMatch(all: ScoringMatch[], next: ScoringMatch): ScoringMatch[] {
  return all.map(m => (m.fixture_id === next.fixture_id ? next : m));
}

/**
 * Puts an entry response into the board in memory: the saved match, the matches whose slots moved and the recomputed
 * tables of the group, all exactly as the server sent them, so only those regions change (TE-09). A board that is not
 * loaded yet stays as it is.
 */
export function applyEntry(view: TournamentStandingsView | null, entry: MatchEntryResponse): TournamentStandingsView | null {
  if (!view) {
    return view;
  }
  const touched = [...(entry.match ? [entry.match] : []), ...entry.changed_matches];
  let next: TournamentStandingsView = view;
  for (const match of touched) {
    next = {
      ...next,
      groups: next.groups.map(g => ({ ...g, matches: replaceMatch(g.matches, match) })),
      knockout: replaceMatch(next.knockout, match),
    };
  }
  for (const delta of entry.standings_delta) {
    next = {
      ...next,
      groups: next.groups.map(g => (g.group_key === delta.group_key ? { ...delta, matches: g.matches } : g)),
    };
  }
  return next;
}

/**
 * Knockout matches that got a name on a side they did not have before ("Just set"): compares the board held with the
 * board that arrived. Only a name the server sent counts.
 */
export function justSetIds(before: TournamentStandingsView | null, after: TournamentStandingsView | null): Set<string> {
  const out = new Set<string>();
  if (!before || !after) {
    return out;
  }
  for (const match of after.knockout) {
    const old = before.knockout.find(m => m.fixture_id === match.fixture_id);
    if (old && ((match.side_a.name && !old.side_a.name) || (match.side_b.name && !old.side_b.name))) {
      out.add(match.fixture_id);
    }
  }
  return out;
}

/** Fixture ids named by an entry response's `advanced` list (slots filled just now). */
export function advancedFixtureIds(advanced: AdvancedSlot[]): Set<string> {
  return new Set(advanced.filter(a => a.change === 'slot_filled' || a.change === 'slot_replaced').map(a => a.fixture_id));
}

// ---- score form (Enter score, Edit score) ----------------------------------------------------------------------------
export const SET_SLOTS = 3;

export interface ScoreForm {
  mode: 'enter' | 'correct';
  resultType: EntryResultType;
  sets: { a: string; b: string }[];
  advancing: 'a' | 'b' | null;
  reason: string;
  expectedVersion: number;
}

export function scoreFormInit(match: ScoringMatch): ScoreForm {
  const result = match.result;
  const sets = Array.from({ length: SET_SLOTS }, (_, index) => {
    const set = result?.sets[index];
    return { a: set ? String(set.a) : '', b: set ? String(set.b) : '' };
  });
  return {
    mode: result ? 'correct' : 'enter',
    resultType: result?.result_type ?? 'normal',
    sets,
    advancing: result?.advancing_side ?? null,
    reason: '',
    expectedVersion: result?.version ?? 0,
  };
}

/** The sets that are complete (both boxes whole numbers), in order. The server checks every rule again. */
export function scoreSets(form: ScoreForm): ScoringSet[] {
  const out: ScoringSet[] = [];
  for (const set of form.sets) {
    if (/^\d+$/.test(set.a.trim()) && /^\d+$/.test(set.b.trim())) {
      out.push({ a: Number(set.a), b: Number(set.b) });
    }
  }
  return out;
}

/**
 * The body of the preview and of the save. There is NO winner field: the server derives it from the sets (AD-T8).
 * `reason` is sent only on a correction; `client_request_id` only on a save.
 */
export function scoreBody(form: ScoreForm, options: { requestId?: string; withReason?: boolean } = {}): MatchResultBody {
  const body: MatchResultBody = {
    result_type: form.resultType,
    sets: form.resultType === 'walkover' ? [] : scoreSets(form),
    advancing_side: form.resultType === 'normal' ? null : form.advancing,
    expected_version: form.expectedVersion,
  };
  if (options.requestId) {
    body.client_request_id = options.requestId;
  }
  if (options.withReason && form.mode === 'correct') {
    body.reason = form.reason.trim();
  }
  return body;
}

export type ScoreIssueCode = 'SET_INCOMPLETE' | 'SET_GAP' | 'SET1_REQUIRED' | 'ADVANCING_REQUIRED' | 'REASON_REQUIRED';

/**
 * Shape problems the app may flag before asking (the server checks everything again): a half-filled set, set 3 without
 * set 2, set 1 missing, a walkover or retirement without a side, and a missing reason on a correction. A level match
 * is NOT checked here: it needs the winner rule, which only the server applies (`MATCH_TIED`).
 */
export function scoreIssues(form: ScoreForm): ScoreIssueCode[] {
  const issues: ScoreIssueCode[] = [];
  const filled = (set: { a: string; b: string }): boolean => set.a.trim() !== '' || set.b.trim() !== '';
  const complete = (set: { a: string; b: string }): boolean => /^\d+$/.test(set.a.trim()) && /^\d+$/.test(set.b.trim());
  if (form.resultType !== 'walkover') {
    if (form.sets.some(set => filled(set) && !complete(set))) {
      issues.push('SET_INCOMPLETE');
    }
    if (form.sets.some((set, index) => index > 0 && filled(set) && !filled(form.sets[index - 1]))) {
      issues.push('SET_GAP');
    }
    if (form.resultType === 'normal' && !complete(form.sets[0])) {
      issues.push('SET1_REQUIRED');
    }
  }
  if (form.resultType !== 'normal' && form.advancing === null) {
    issues.push('ADVANCING_REQUIRED');
  }
  if (form.mode === 'correct' && form.reason.trim() === '') {
    issues.push('REASON_REQUIRED');
  }
  return issues;
}

/** Digits only in a score box. */
export function digitsOnly(value: string): string {
  return value.replace(/\D/g, '').slice(0, 3);
}

// ---- refusals -----------------------------------------------------------------------------------------------------
/** Reads a coded refusal of the result routes from an axios-shaped error. */
export function readResultRefusal(error: unknown): ResultRefusal {
  const response = (error as { response?: { status?: number; data?: unknown } } | null)?.response;
  const data = isObject(response?.data) ? (response?.data as Json) : {};
  const detail = isObject(data.detail) ? (data.detail as Json) : {};
  const code = str(data.code) ?? str(detail.code);
  const issues = list(data.errors).filter(isObject);
  return {
    status: response?.status ?? 0,
    code,
    issueCodes: issues.map(issue => str(issue.code) ?? '').filter(Boolean),
    needsApproval: code === 'CORRECTION_NEEDS_APPROVAL',
    currentMatch: code === 'RESULT_STALE' ? normaliseMatch(data.match) : null,
  };
}

/** The label of a refusal. `NO_DERIVABLE_WINNER` is kept for an older server only and reads as `MATCH_TIED`. */
export function scoreErrorKey(refusal: ResultRefusal): LabelKey {
  const codes = [refusal.code, ...refusal.issueCodes];
  if (codes.includes('MATCH_TIED') || codes.includes('NO_DERIVABLE_WINNER')) {
    return 'mob.tournament.score.err.MATCH_TIED';
  }
  if (codes.includes('REASON_REQUIRED')) {
    return 'mob.tournament.score.err.REASON_REQUIRED';
  }
  if (codes.includes('RESULTS_LOCKED')) {
    return 'mob.tournament.score.err.RESULTS_LOCKED';
  }
  return 'mob.tournament.score.save_failed';
}

// ---- the impact box (from the server's preview) -----------------------------------------------------------------------
export interface Impact {
  needsApproval: boolean;
  /** Round or stage labels of later matches that depend on this one (DOWNSTREAM_PLAYED). */
  downstream: { stage: string; matchId: string | null }[];
  hasWillBe: boolean;
  from: string;
  to: string;
  winnerChanged: boolean;
  newWinner: string;
  rankMoves: { group: string; name: string; from: number; to: number }[];
  advances: { fixtureId: string; change: string; oldName: string; newName: string; target: ScoringMatch | null }[];
}

function sideName(match: ScoringMatch | null | undefined, side: 'a' | 'b'): string {
  const s = side === 'a' ? match?.side_a : match?.side_b;
  return s?.name ?? '';
}

/** What the impact box says, read from the preview and the board held (`was` ranks come from the held tables). */
export function impactOf(preview: MatchPreview, view: TournamentStandingsView | null): Impact {
  const blocked = preview.blocked_by;
  const impact: Impact = {
    needsApproval: blocked.some(b => b.code === 'CORRECTION_NEEDS_APPROVAL'),
    downstream: [],
    hasWillBe: preview.will_be !== null,
    from: '',
    to: '',
    winnerChanged: false,
    newWinner: '',
    rankMoves: [],
    advances: [],
  };
  const down = blocked.find(b => b.code === 'DOWNSTREAM_PLAYED') as
    | { matches?: { match_id: string | null; stage: string }[] }
    | undefined;
  impact.downstream = (down?.matches ?? []).map(m => ({ stage: m.stage, matchId: m.match_id }));
  const next = preview.will_be;
  if (!next) {
    return impact;
  }
  if (preview.was?.result) {
    const [wa, wb] = setsWon(preview.was);
    impact.from = `${wa}–${wb}`;
  }
  const [na, nb] = setsWon(next);
  impact.to = `${na}–${nb}`;
  const wasWinner = preview.was?.winner_registration_id ?? null;
  const nowWinner = next.winner_registration_id;
  impact.winnerChanged = Boolean(wasWinner && nowWinner && wasWinner !== nowWinner);
  const winner = winnerSide(next);
  impact.newWinner = winner ? sideName(next, winner) : '';
  for (const delta of preview.standings_delta) {
    const old = view?.groups.find(g => g.group_key === delta.group_key);
    const oldRank = new Map((old?.table ?? []).map(row => [row.registration_id, row.rank] as const));
    for (const row of delta.table) {
      const was = oldRank.get(row.registration_id);
      if (was !== undefined && was !== row.rank) {
        impact.rankMoves.push({ group: delta.group_key, name: row.name, from: was, to: row.rank });
      }
    }
  }
  for (const slot of preview.advanced) {
    const target = view?.knockout.find(m => m.fixture_id === slot.fixture_id);
    impact.advances.push({
      fixtureId: slot.fixture_id,
      change: slot.change,
      oldName: target ? sideName(target, slot.side === 'A' ? 'a' : 'b') : '',
      newName: slot.name ?? '',
      target: target ?? null,
    });
  }
  return impact;
}

// ---- knockout rounds -----------------------------------------------------------------------------------------------------
const ROUND_KEYS: Record<string, LabelKey> = {
  quarterfinal: 'mob.tournament.knockouts.round_quarter',
  semifinal: 'mob.tournament.knockouts.round_semi',
  final: 'mob.tournament.knockouts.round_final',
  third_place: 'mob.tournament.knockouts.round_third',
};

/** Label of a knockout round; the open-ended `main` rounds are "Round of N" (twice the number of matches). */
export function roundTitle(stage: string, matchCount: number): { key: LabelKey; count: number | null } {
  const key = ROUND_KEYS[stage];
  return key ? { key, count: null } : { key: 'mob.tournament.knockouts.round_of', count: matchCount * 2 };
}

const TIEBREAK_KEYS: Record<string, LabelKey> = {
  matches_won: 'mob.tournament.standings.tb_matches_won',
  head_to_head: 'mob.tournament.standings.tb_head_to_head',
  set_difference: 'mob.tournament.standings.tb_set_difference',
  point_difference: 'mob.tournament.standings.tb_point_difference',
  override: 'mob.tournament.standings.tb_override',
};

/** The tie-break order the server sent, as label keys (a code the app has no words for is skipped). */
export function tiebreakKeys(view: TournamentStandingsView | null): LabelKey[] {
  return (view?.tiebreakers ?? []).map(code => TIEBREAK_KEYS[code]).filter((key): key is LabelKey => Boolean(key));
}

// ---- Participants ------------------------------------------------------------------------------------------------------
export type ParticipantRole = 'organizer' | 'committee' | null;

export function participantRows(registrations: TournamentRegistration[]): ParticipantRow[] {
  return registrations
    .filter(r => r.status === 'registered')
    .map(r => ({
      id: r.id,
      user_id: r.user_id,
      name: r.nickname,
      registered_at: r.registered_at,
      team_id: r.team_id ?? null,
      payment_received_at: r.payment_received_at ?? null,
      effective_fee_cents: r.effective_fee_cents ?? null,
      points: r.points ?? null,
      payment_exempt: r.payment_exempt === true,
      team_player_count: r.team_player_count ?? null,
      team_captain_name: r.team_captain_name ?? null,
    }))
    .sort((a, b) => a.registered_at.localeCompare(b.registered_at));
}

/** Role chip of a participant: only the people the server named as organizer or committee on the tournament. */
export function participantRole(row: ParticipantRow, tournament: Pick<Tournament, 'organizer' | 'committee'>): ParticipantRole {
  if (!row.user_id) {
    return null;
  }
  if (tournament.organizer?.user_id === row.user_id) {
    return 'organizer';
  }
  return (tournament.committee ?? []).some(person => person.user_id === row.user_id) ? 'committee' : null;
}

/** Case-insensitive name filter of the search box. */
export function filterParticipants(rows: ParticipantRow[], query: string): ParticipantRow[] {
  const needle = query.trim().toLowerCase();
  return needle ? rows.filter(row => row.name.toLowerCase().includes(needle)) : rows;
}

// ---- Approvals -------------------------------------------------------------------------------------------------------------
export type ApprovalBucket = 'needs' | 'waiting' | 'history';

const APPROVAL_TYPES = ['fixture_publication', 'result_winner_change', 'qualification_override'];

export function isApprovalType(type: string): boolean {
  return APPROVAL_TYPES.includes(type);
}

const sameId = (a: string | null | undefined, b: string | null | undefined): boolean =>
  Boolean(a) && Boolean(b) && String(a).toLowerCase() === String(b).toLowerCase();

/**
 * Where a request goes: someone else's pending request waits for the viewer; the viewer's own pending request waits for
 * another member; everything decided is history. Only the three request types this page describes are listed.
 */
export function approvalBucket(request: ApprovalRequest, viewerId: string | undefined): ApprovalBucket {
  if (request.status !== 'pending') {
    return 'history';
  }
  return sameId(request.initiator_user_id, viewerId) ? 'waiting' : 'needs';
}

export interface ApprovalCard {
  id: string;
  bucket: ApprovalBucket;
  titleKey: LabelKey;
  actionType: string;
  /** The draft of a publication request (read from the server to review it); null for other types. */
  draftId: string | null;
  /** One line about the subject (match, group), built from names; null when nothing could be named. */
  subject: string | null;
  /** The reason the maker gave, when the payload carries one. */
  reason: string | null;
  initiatorName: string;
  initiatorIsViewer: boolean;
  approverName: string | null;
  status: string;
  /** Names of the other active committee members, for "Waiting for …". */
  waitingFor: string;
  createdAt: string;
  resolvedAt: string | null;
  canDecide: boolean;
  canWithdraw: boolean;
}

const APPROVAL_TITLES: Record<string, LabelKey> = {
  fixture_publication: 'mob.tournament.approvals.type_publish',
  result_winner_change: 'mob.tournament.approvals.type_winner_change',
  qualification_override: 'mob.tournament.approvals.type_qualification',
};

export interface ApprovalContext {
  viewerId: string | undefined;
  /** Names by user id, from the committee list and the header (never shown as ids). */
  names: Map<string, string>;
  activeMemberIds: string[];
  isActiveMember: boolean;
  view: TournamentStandingsView | null;
  matchLabel: (a: string, b: string) => string;
  groupLabel: (group: string) => string;
}

export function approvalCards(requests: ApprovalRequest[], ctx: ApprovalContext): ApprovalCard[] {
  const lookupRegistration = (registrationId: string): string => {
    for (const group of ctx.view?.groups ?? []) {
      const row = group.table.find(r => r.registration_id === registrationId);
      if (row) {
        return row.name;
      }
    }
    return '';
  };
  return requests
    .filter(request => isApprovalType(request.action_type))
    .map(request => {
      const payload = request.command_payload;
      const bucket = approvalBucket(request, ctx.viewerId);
      let subject: string | null = null;
      if (request.action_type === 'result_winner_change') {
        const fixtureId = str(payload.fixture_id);
        const all = [...(ctx.view?.groups.flatMap(g => g.matches) ?? []), ...(ctx.view?.knockout ?? [])];
        const match = all.find(m => m.fixture_id === fixtureId);
        subject = match ? ctx.matchLabel(sideName(match, 'a'), sideName(match, 'b')) : null;
      } else if (request.action_type === 'qualification_override') {
        const places = list(payload.placements)
          .map(id => lookupRegistration(String(id)))
          .filter(Boolean)
          .join(', ');
        const group = str(payload.group_key);
        subject = group ? [ctx.groupLabel(group), places].filter(Boolean).join(': ') : places || null;
      }
      const reason = str(payload.reason)?.trim() || null;
      const mine = sameId(request.initiator_user_id, ctx.viewerId);
      const pending = request.status === 'pending';
      return {
        id: request.id,
        bucket,
        titleKey: APPROVAL_TITLES[request.action_type],
        actionType: request.action_type,
        draftId: request.action_type === 'fixture_publication' ? str(payload.draft_id) : null,
        subject,
        reason,
        initiatorName: ctx.names.get(request.initiator_user_id.toLowerCase()) ?? '',
        initiatorIsViewer: mine,
        approverName: request.approver_user_id ? ctx.names.get(request.approver_user_id.toLowerCase()) ?? null : null,
        status: request.status,
        waitingFor: ctx.activeMemberIds
          .filter(id => !sameId(id, request.initiator_user_id))
          .map(id => ctx.names.get(id.toLowerCase()) ?? '')
          .filter(Boolean)
          .join(', '),
        createdAt: request.created_at,
        resolvedAt: request.resolved_at,
        canDecide: pending && !mine && ctx.isActiveMember,
        canWithdraw: pending && mine && ctx.isActiveMember,
      };
    });
}

// ---- Closure form (Results tab) -------------------------------------------------------------------------------------------------
export const CLOSURE_COMMENTS_MAX = 500;

export interface ClosureForm {
  outcome: 'completed' | 'not_held';
  attendees: string[];
  winner: string;
  runnerUp: string;
  third: string;
  star: string;
  comments: string;
  version: number;
}

const registrationOf = (person: TournamentClosurePerson | null | undefined): string => person?.registration_id ?? '';

/** Starting values: the saved report, else the server's prefill from the posted results. */
export function closureInit(closure: TournamentClosureResponse | null): ClosureForm {
  const c = closure;
  if (c?.outcome) {
    return {
      outcome: c.outcome === 'not_held' ? 'not_held' : 'completed',
      attendees: (c.attendees ?? []).map(registrationOf).filter(Boolean),
      winner: registrationOf(c.winner),
      runnerUp: registrationOf(c.runner_up),
      third: registrationOf(c.third_place),
      star: c.star?.user_id ?? '',
      comments: c.comments ?? '',
      version: c.version ?? 0,
    };
  }
  const prefill = c?.prefill ?? null;
  return {
    outcome: 'completed',
    attendees: (prefill?.attendees ?? []).map(registrationOf).filter(Boolean),
    winner: registrationOf(prefill?.winner),
    runnerUp: registrationOf(prefill?.runner_up),
    third: '',
    star: '',
    comments: '',
    version: c?.version ?? 0,
  };
}

/** The body of `PUT .../closure`. "Not held" carries no players, podium or star (AD-T9). */
export function closureBody(form: ClosureForm): TournamentClosurePut {
  const held = form.outcome !== 'not_held';
  const comments = form.comments.trim();
  return {
    outcome: held ? 'completed' : 'not_held',
    attendee_registration_ids: held ? [...form.attendees] : [],
    winner_registration_id: held && form.winner ? form.winner : null,
    runner_up_registration_id: held && form.runnerUp ? form.runnerUp : null,
    third_place_registration_id: held && form.third ? form.third : null,
    star_user_id: held && form.star ? form.star : null,
    comments: comments ? comments : null,
    expected_version: form.version,
  };
}

export type ClosureIssue =
  | 'third_place_not_attendee'
  | 'third_place_equals_winner'
  | 'third_place_equals_runner_up'
  | 'star_not_attendee'
  | 'comments_too_long';

/** Shape checks before asking; the server checks every rule again and has the last word. */
export function closureIssues(form: ClosureForm, candidates: TournamentClosurePerson[] | null | undefined): ClosureIssue[] {
  const issues: ClosureIssue[] = [];
  if (form.comments.length > CLOSURE_COMMENTS_MAX) {
    issues.push('comments_too_long');
  }
  if (form.outcome === 'not_held') {
    return issues;
  }
  const attended = new Set(form.attendees);
  if ([form.winner, form.runnerUp, form.third].filter(Boolean).some(id => !attended.has(id))) {
    issues.push('third_place_not_attendee');
  }
  if (form.third && form.third === form.winner) {
    issues.push('third_place_equals_winner');
  }
  if (form.third && form.third === form.runnerUp) {
    issues.push('third_place_equals_runner_up');
  }
  if (form.star) {
    const owner = (candidates ?? []).find(c => (c.members ?? []).some(m => m.user_id === form.star) || c.user_id === form.star);
    if (!owner || !attended.has(owner.registration_id ?? '')) {
      issues.push('star_not_attendee');
    }
  }
  return issues;
}

/** The people one can pick as star: the members of attended registrations (a team lists its players). */
export function starOptions(
  candidates: TournamentClosurePerson[] | null | undefined,
  attendees: string[],
): { userId: string; name: string }[] {
  const attended = new Set(attendees);
  const out: { userId: string; name: string }[] = [];
  for (const candidate of candidates ?? []) {
    if (!attended.has(candidate.registration_id ?? '')) {
      continue;
    }
    const members = candidate.members ?? [];
    if (members.length > 0) {
      members.forEach(m => out.push({ userId: m.user_id, name: m.display_name }));
    } else if (candidate.user_id) {
      out.push({ userId: candidate.user_id, name: candidate.display_name });
    }
  }
  return out;
}

const CLOSURE_ERROR_KEYS: Record<string, LabelKey> = {
  third_place_not_attendee: 'mob.tournament.closure.err.third_place_not_attendee',
  third_place_equals_winner: 'mob.tournament.closure.err.third_place_equals_winner',
  third_place_equals_runner_up: 'mob.tournament.closure.err.third_place_equals_runner_up',
  third_place_not_allowed: 'mob.tournament.closure.err.third_place_not_allowed',
  star_not_attendee: 'mob.tournament.closure.err.star_not_attendee',
  comments_too_long: 'mob.tournament.closure.err.comments_too_long',
  not_held_extras_not_allowed: 'mob.tournament.closure.err.not_held_extras_not_allowed',
};

/** Label for a coded closure refusal (`detail.code` or `code`); null when the code is not one of the closure codes. */
export function closureErrorKey(error: unknown): LabelKey | null {
  const data = (error as { response?: { data?: unknown } } | null)?.response?.data;
  const body = isObject(data) ? data : {};
  const detail = isObject(body.detail) ? body.detail : {};
  const code = str(body.code) ?? str(detail.code) ?? (typeof body.detail === 'string' ? body.detail : null);
  return code && CLOSURE_ERROR_KEYS[code] ? CLOSURE_ERROR_KEYS[code] : null;
}

// ---- Media --------------------------------------------------------------------------------------------------------------------
/** Label of a refused upload from the server's code; the server's own message is shown when the code is unknown. */
export function mediaErrorKey(error: unknown): LabelKey | null {
  const data = (error as { response?: { data?: unknown } } | null)?.response?.data;
  const body = isObject(data) ? data : {};
  const detail = isObject(body.detail) ? body.detail : {};
  const code = str(detail.code) ?? str(body.code);
  switch (code) {
    case 'MEDIA_NOT_ALLOWED':
      return 'mob.tournament.media.err.MEDIA_NOT_ALLOWED';
    case 'MEDIA_TOO_LARGE':
      return 'mob.tournament.media.err.MEDIA_TOO_LARGE';
    case 'MEDIA_LIMIT_REACHED':
      return 'mob.tournament.media.err.MEDIA_LIMIT_REACHED';
    case 'IMAGE_INVALID':
      return 'mob.tournament.media.err.IMAGE_INVALID';
    default:
      return null;
  }
}

/** The server's own message of a refused upload (`detail.message`), when it sent one. */
export function mediaErrorMessage(error: unknown): string | null {
  const data = (error as { response?: { data?: unknown } } | null)?.response?.data;
  const body = isObject(data) ? data : {};
  const detail = isObject(body.detail) ? body.detail : {};
  return str(detail.message);
}
