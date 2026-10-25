/**
 * Defensive normaliser and pure view helpers for the match-scoring read model
 * (`GET /tournaments/{id}/standings`, ms-s4 Appendix A1).
 *
 * Only presentation grouping lives here (ordering the knockout list as the
 * design asks, listing which rounds exist). No rank, winner, qualifier or
 * total is ever computed (AGENTS.md); qualification, placeholders and
 * "mine" are the backend's fields.
 */
import type {
  CommitteeSetup,
  ScoringGroup,
  ScoringMatch,
  ScoringPlaceholder,
  ScoringPlaceholderDetail,
  ScoringResult,
  ScoringSet,
  ScoringSide,
  ScoringTableRow,
  TournamentScoringState,
  TournamentStandingsView,
  TournamentTabKey,
  TournamentTabs,
} from '../types/tournamentScoring';

type Json = Record<string, unknown>;

const isObject = (value: unknown): value is Json =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const str = (value: unknown): string | null => (typeof value === 'string' ? value : null);
const num = (value: unknown, fallback = 0): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;
const bool = (value: unknown): boolean => value === true;
const list = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

function normaliseDetail(raw: unknown): ScoringPlaceholderDetail | null {
  if (!isObject(raw)) {
    return null;
  }
  if (raw.type === 'group_place' && typeof raw.group === 'string' && typeof raw.place === 'number') {
    return { type: 'group_place', group: raw.group, place: raw.place };
  }
  if (raw.type === 'winner' || raw.type === 'loser') {
    return { type: raw.type, match_id: str(raw.match_id) };
  }
  return null;
}

function normaliseSide(raw: unknown): ScoringSide {
  const side = isObject(raw) ? raw : {};
  const placeholder = side.placeholder;
  return {
    registration_id: str(side.registration_id),
    name: str(side.name),
    placeholder:
      placeholder === 'group_place' || placeholder === 'winner' || placeholder === 'loser'
        ? (placeholder as ScoringPlaceholder)
        : null,
    placeholder_detail: normaliseDetail(side.placeholder_detail),
    is_mine: bool(side.is_mine),
  };
}

function normaliseResult(raw: unknown): ScoringResult | null {
  if (!isObject(raw)) {
    return null;
  }
  const type = raw.result_type;
  const sets: ScoringSet[] = list(raw.sets)
    .filter(isObject)
    .map(s => ({ a: num(s.a), b: num(s.b) }));
  const advancing = raw.advancing_side;
  return {
    result_type: type === 'walkover' || type === 'retired' ? type : 'normal',
    sets,
    advancing_side: advancing === 'a' || advancing === 'b' ? advancing : null,
    version: num(raw.version, 1),
  };
}

export function normaliseMatch(raw: unknown): ScoringMatch | null {
  if (!isObject(raw)) {
    return null;
  }
  const fixtureId = str(raw.fixture_id);
  if (fixtureId === null) {
    return null;
  }
  return {
    fixture_id: fixtureId,
    match_id: str(raw.match_id) ?? fixtureId,
    stage: str(raw.stage) ?? 'group',
    round_number: num(raw.round_number),
    fixture_order: num(raw.fixture_order),
    status: str(raw.status) ?? 'scheduled',
    scheduled_at: str(raw.scheduled_at),
    court: str(raw.court),
    side_a: normaliseSide(raw.side_a),
    side_b: normaliseSide(raw.side_b),
    winner_registration_id: str(raw.winner_registration_id),
    result: normaliseResult(raw.result),
  };
}

function normaliseRow(raw: unknown): ScoringTableRow | null {
  if (!isObject(raw)) {
    return null;
  }
  const id = str(raw.registration_id);
  if (id === null) {
    return null;
  }
  return {
    rank: num(raw.rank),
    tied: bool(raw.tied),
    registration_id: id,
    name: str(raw.name) ?? '',
    played: num(raw.played),
    won: num(raw.won),
    lost: num(raw.lost),
    sets_for: num(raw.sets_for),
    sets_against: num(raw.sets_against),
    set_diff: num(raw.set_diff),
    points_for: num(raw.points_for),
    points_against: num(raw.points_against),
    point_diff: num(raw.point_diff),
    qualifies: typeof raw.qualifies === 'boolean' ? raw.qualifies : null,
  };
}

export function normaliseGroup(raw: unknown): ScoringGroup | null {
  if (!isObject(raw)) {
    return null;
  }
  const key = str(raw.group_key);
  if (key === null) {
    return null;
  }
  const matches = list(raw.matches).map(normaliseMatch).filter((m): m is ScoringMatch => m !== null);
  return {
    group_key: key,
    complete: bool(raw.complete),
    provisional: bool(raw.provisional),
    unresolved_tie: bool(raw.unresolved_tie),
    needs_override: bool(raw.needs_override),
    adjusted_by_committee: bool(raw.adjusted_by_committee),
    qualifiers_resolved: bool(raw.qualifiers_resolved),
    matches_total: num(raw.matches_total, matches.length),
    matches_played: num(raw.matches_played),
    advance_per_group: num(raw.advance_per_group),
    table: list(raw.table).map(normaliseRow).filter((r): r is ScoringTableRow => r !== null),
    matches,
  };
}

/**
 * The scoring shape is an object with `groups` and `knockout`. A tournament
 * that is not v2 groups+knockout (or has the engine flag off) answers with the
 * v1 list, and an unpublished one with `published: false`: both mean "show no
 * scoring UI" and return `null`.
 */
export function normaliseStandings(raw: unknown): TournamentStandingsView | null {
  if (!isObject(raw) || !Array.isArray(raw.groups) || !Array.isArray(raw.knockout)) {
    return null;
  }
  if (raw.published !== true) {
    return null;
  }
  const groups = raw.groups.map(normaliseGroup).filter((g): g is ScoringGroup => g !== null);
  const knockout = raw.knockout.map(normaliseMatch).filter((m): m is ScoringMatch => m !== null);
  if (groups.length === 0 && knockout.length === 0) {
    return null;
  }
  const tiebreakers = list(raw.tiebreakers).filter((code): code is string => typeof code === 'string');
  return {
    tournament_id: str(raw.tournament_id) ?? '',
    published: true,
    groups,
    knockout,
    ...(tiebreakers.length > 0 ? { tiebreakers } : {}),
  };
}

/** Knockout matches ordered round_number, then fixture_order (round numbers continue after the group rounds). */
export function sortKnockout(matches: ScoringMatch[]): ScoringMatch[] {
  return [...matches].sort(
    (a, b) => a.round_number - b.round_number || a.fixture_order - b.fixture_order,
  );
}

export interface KnockoutRound {
  /** Stable pill id: the stage, plus the round number for the open-ended `main` stage. */
  key: string;
  stage: string;
  matches: ScoringMatch[];
}

/**
 * One pill per stage in bracket order. Stages other than `main` appear once;
 * several `main` rounds (a bracket bigger than the quarterfinal) stay separate pills.
 */
export function groupKnockoutRounds(matches: ScoringMatch[]): KnockoutRound[] {
  const rounds: KnockoutRound[] = [];
  sortKnockout(matches).forEach(match => {
    const key = match.stage === 'main' ? `main:${match.round_number}` : match.stage;
    const existing = rounds.find(r => r.key === key);
    if (existing) {
      existing.matches.push(match);
    } else {
      rounds.push({ key, stage: match.stage, matches: [match] });
    }
  });
  // The third-place playoff is drawn before the final on the board (QF SF 3rd Final).
  const third = rounds.findIndex(r => r.stage === 'third_place');
  const final = rounds.findIndex(r => r.stage === 'final');
  if (third !== -1 && final !== -1 && third > final) {
    const [moved] = rounds.splice(third, 1);
    rounds.splice(final, 0, moved);
  }
  return rounds;
}

/** Number of entrants of a `main` round (16 for R16): twice its matches. Other stages carry their own label. */
export function mainRoundSize(match: ScoringMatch, all: ScoringMatch[]): number | undefined {
  if (match.stage !== 'main') {
    return undefined;
  }
  return all.filter(m => m.stage === 'main' && m.round_number === match.round_number).length * 2;
}

/** True when the signed-in user plays in either side (server-computed `is_mine`). */
export function isMyMatch(match: ScoringMatch): boolean {
  return match.side_a.is_mine || match.side_b.is_mine;
}

/**
 * `GET /tournaments/{id}/scoring/state`: scoring UI is shown only when the backend says it is on
 * (`enabled`) and applies to this tournament (`applicable`). Anything else reads as not available.
 */
export function normaliseScoringState(raw: unknown): TournamentScoringState | null {
  if (!isObject(raw)) {
    return null;
  }
  const state: TournamentScoringState = { enabled: raw.enabled === true, applicable: raw.applicable === true };
  // Additive (te-b2): only what the server sent is carried; an older answer keeps its old shape.
  if (typeof raw.registration_phase === 'string') {
    state.registration_phase = raw.registration_phase;
  }
  if (typeof raw.fixtures_published === 'boolean') {
    state.fixtures_published = raw.fixtures_published;
  }
  if (typeof raw.any_result_posted === 'boolean') {
    state.any_result_posted = raw.any_result_posted;
  }
  const tabs = normaliseTabs(raw.tabs);
  if (tabs) {
    state.tabs = tabs;
  }
  if (typeof raw.live_poll_seconds === 'number') {
    state.live_poll_seconds = raw.live_poll_seconds;
  }
  if (typeof raw.is_committee === 'boolean') {
    state.is_committee = raw.is_committee;
  }
  if (isObject(raw.committee)) {
    state.committee = normaliseCommitteeSetup(raw.committee);
  }
  return state;
}

function normaliseCommitteeSetup(raw: Json): CommitteeSetup {
  const points = isObject(raw.points) ? raw.points : null;
  const draft = isObject(raw.latest_draft) && str(raw.latest_draft.draft_id) ? raw.latest_draft : null;
  const options = isObject(raw.group_options) ? raw.group_options : null;
  const numbers = (value: unknown): number[] => list(value).filter((n): n is number => typeof n === 'number' && Number.isFinite(n));
  return {
    points: points
      ? {
          entrants: num(points.entrants),
          rated: num(points.rated),
          unrated: num(points.unrated),
          locked: points.locked === true,
          uploaded_at: str(points.uploaded_at),
        }
      : null,
    latest_draft: draft
      ? {
          draft_id: str(draft.draft_id) as string,
          version: num(draft.version),
          status: str(draft.status) ?? '',
          payload_hash: str(draft.payload_hash) ?? '',
          groups: typeof draft.groups === 'number' ? draft.groups : null,
          advance_per_group: typeof draft.advance_per_group === 'number' ? draft.advance_per_group : null,
          created_at: str(draft.created_at),
        }
      : null,
    group_options: options
      ? {
          suggested: typeof options.suggested === 'number' ? options.suggested : null,
          allowed: numbers(options.allowed),
          advance_per_group_allowed: numbers(options.advance_per_group_allowed),
        }
      : null,
  };
}

const TAB_KEYS: TournamentTabKey[] = ['overview', 'participants', 'fixtures', 'standings', 'results', 'media', 'approvals'];

/** The `tabs` object as sent; `null` when absent or unreadable (the legacy page). Unknown tabs are ignored. */
export function normaliseTabs(raw: unknown): TournamentTabs | null {
  if (!isObject(raw)) {
    return null;
  }
  const tabs: TournamentTabs = {};
  for (const key of TAB_KEYS) {
    const entry = raw[key];
    if (isObject(entry) && (entry.state === 'open' || entry.state === 'locked')) {
      tabs[key] = {
        state: entry.state,
        ...(typeof entry.unlocks === 'string' ? { unlocks: entry.unlocks } : {}),
        ...(typeof entry.badge === 'number' ? { badge: entry.badge } : {}),
        ...(entry.read_only === true ? { read_only: true } : {}),
      };
    }
  }
  return Object.keys(tabs).length > 0 ? tabs : null;
}

/** The score line of one side: its games in each set, as returned. */
export function sideSetScores(result: ScoringResult | null, side: 'a' | 'b'): number[] {
  return result ? result.sets.map(s => s[side]) : [];
}

export function signed(value: number): string {
  return value > 0 ? `+${value}` : String(value);
}
