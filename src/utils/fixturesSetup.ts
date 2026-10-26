/**
 * Pure helpers of the committee's fixtures setup and results file (te-a3; DES-MEETUP-ADDENDUM-tournament-experience
 * AD-T12; web reference `cnUpload`, `cnGenerate`, `cnSubmit`, `ScoringView.drawModel`, `draftReview`). Nothing here
 * builds a draw, seeds a player or decides a winner: the draft, its seeds and its matches are the server's. This file
 * reads what the server sent, maps refusal codes to labels, and picks the values the draw controls start on.
 */
import type { LabelKey } from '../labels/fallbackLabels';
import type { GroupOptions, DraftSummary } from '../types/tournamentScoring';
import type { DraftDetail, DraftMatch, DraftSide, UploadRefusal, UploadRow } from '../types/tournamentTabs';

type Json = Record<string, unknown>;
const isObject = (value: unknown): value is Json => typeof value === 'object' && value !== null && !Array.isArray(value);
const str = (value: unknown): string | null => (typeof value === 'string' ? value : null);
const num = (value: unknown, fallback = 0): number => (typeof value === 'number' && Number.isFinite(value) ? value : fallback);
const list = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

// ---- refusals ---------------------------------------------------------------------------------------------------
/** Every code the server can answer with on these routes that has its own text (the web's list). */
const KNOWN_CODES = new Set([
  // points workbook rows
  'HEADER_MISMATCH', 'SHEET_MISSING', 'UNKNOWN_REGISTRATION', 'UNEXPECTED_CELLS', 'DUPLICATE_REGISTRATION',
  'MISSING_REGISTRATION', 'LOCKED_CELL_EDITED', 'POINTS_NOT_NUMERIC', 'POINTS_NEGATIVE', 'POINTS_OUT_OF_BOUNDS',
  // results workbook rows
  'SHEET_UNKNOWN', 'UNKNOWN_MATCH', 'DUPLICATE_MATCH', 'RESULT_TYPE_INVALID', 'SET_INCOMPLETE', 'SET_ORDER',
  'SET_NOT_INTEGER', 'SET_NEGATIVE', 'SET_TIED', 'SET_TOO_LARGE', 'NO_COMPLETED_SET', 'NO_DERIVABLE_WINNER',
  'MATCH_TIED', 'TOO_MANY_SETS', 'SECOND_DERIVABLE_WINNER', 'WO_HAS_SCORES', 'ADVANCING_SIDE_REQUIRED',
  'ADVANCING_SIDE_INVALID', 'SIDE_UNRESOLVED', 'SIDE_MISMATCH', 'CORRECTION_NEEDS_APPROVAL', 'SHEET_MISMATCH',
  // file level
  'NOT_XLSX', 'FILE_TOO_LARGE', 'FORMULA_NOT_ALLOWED', 'MACROS_OR_EXTERNAL_CONTENT', 'ENCRYPTED', 'ZIP_BOMB',
  'UNREADABLE', 'TOO_MANY_ROWS',
  // headlines and request level
  'POINTS_UPLOAD_INVALID', 'RESULTS_UPLOAD_INVALID', 'NOT_LIFECYCLE_V2', 'NOT_GROUPS_KNOCKOUT',
  'FIXTURES_NOT_PUBLISHED', 'REGISTRATION_NOT_FROZEN', 'POINTS_LOCKED', 'POINTS_REQUIRED', 'POINTS_ROSTER_MISMATCH',
  'WORKBOOK_STALE', 'FIXTURE_FROZEN', 'FORMAT_SPEC_MISSING', 'FORMAT_QUALIFIERS_INVALID', 'FORMAT_PARAM_INVALID',
  'FORMAT_GROUP_TOO_SMALL', 'DOWNSTREAM_PLAYED', 'RESULTS_LOCKED',
]);

const HEADLINES = ['POINTS_UPLOAD_INVALID', 'RESULTS_UPLOAD_INVALID'];

/** Label of a code, or the generic "could not be accepted" for a code the app has no words for. */
export function errLabelKey(code: string | null | undefined): LabelKey {
  if (code === 'RESULTS_LOCKED') {
    return 'mob.tournament.score.err.RESULTS_LOCKED';
  }
  return (code && KNOWN_CODES.has(code) ? `mob.scoring.err.${code}` : 'mob.scoring.err.UNKNOWN') as LabelKey;
}

/** Reads an axios-shaped refusal: `{detail, code, error_count, errors[]}` or the nested `detail: {code, ...}` form. */
export function readUploadRefusal(error: unknown): UploadRefusal {
  const response = (error as { response?: { status?: number; data?: unknown } } | null)?.response;
  const body = isObject(response?.data) ? (response?.data as Json) : {};
  const nested = isObject(body.detail) ? (body.detail as Json) : null;
  const source = nested ?? body;
  const rows: UploadRow[] = list(source.errors)
    .filter(isObject)
    .map(item => ({
      sheet: str(item.sheet),
      row: typeof item.row === 'number' ? item.row : null,
      column: str(item.column),
      code: str(item.code) ?? '',
      matchId: str(item.match_id),
    }));
  return {
    status: response?.status ?? 0,
    code: str(source.code) ?? str(body.code),
    detail: typeof body.detail === 'string' ? body.detail : str(nested?.detail) ?? str(nested?.message) ?? '',
    errorCount: typeof source.error_count === 'number' ? source.error_count : rows.length,
    rows,
  };
}

export interface RefusalView {
  /** Label of the headline (the whole file was refused, nothing saved), or null when the server's own sentence is used. */
  headlineKey: LabelKey | null;
  /** The server's own sentence when the code has no label. */
  headlineText: string | null;
  /** True when individual rows explain the refusal (the headline is then "nothing was saved"). */
  hasRows: boolean;
  fileLevel: UploadRow[];
  sections: { sheet: string | null; rows: UploadRow[] }[];
  /** Rows the server did not list (it lists at most 50). */
  more: number;
}

/** Groups the rows per sheet and by row number; rows without a row number are file or sheet level. */
export function refusalView(refusal: UploadRefusal): RefusalView {
  const fileLevel: UploadRow[] = [];
  const bySheet = new Map<string, UploadRow[]>();
  const order: (string | null)[] = [];
  for (const row of refusal.rows) {
    if (row.row === null) {
      const repeatsHeadline = row.code === refusal.code && !row.sheet;
      const repeated = fileLevel.some(x => x.code === row.code && x.sheet === row.sheet);
      if (!repeatsHeadline && !repeated) {
        fileLevel.push(row);
      }
      continue;
    }
    const key = row.sheet ?? '';
    if (!bySheet.has(key)) {
      bySheet.set(key, []);
      order.push(row.sheet);
    }
    bySheet.get(key)?.push(row);
  }
  const sections = order.map(sheet => ({ sheet, rows: (bySheet.get(sheet ?? '') ?? []).sort((a, b) => (a.row ?? 0) - (b.row ?? 0)) }));
  const known = refusal.code !== null && KNOWN_CODES.has(refusal.code);
  return {
    headlineKey: known || !refusal.detail ? errLabelKey(refusal.code) : null,
    headlineText: known || !refusal.detail ? null : refusal.detail,
    hasRows: sections.length > 0 || fileLevel.length > 0 || HEADLINES.includes(refusal.code ?? ''),
    fileLevel,
    sections,
    more: Math.max(0, refusal.errorCount - refusal.rows.length),
  };
}

// ---- the draft ----------------------------------------------------------------------------------------------------
function side(raw: unknown): DraftSide {
  const item = isObject(raw) ? raw : {};
  const kind = item.kind;
  return {
    kind: kind === 'entrant' || kind === 'group_place' || kind === 'winner' || kind === 'loser' ? kind : 'other',
    entrantId: str(item.entrant_id),
    group: str(item.group_key),
    place: typeof item.place === 'number' ? item.place : null,
  };
}

/** `GET .../drafts/{id}` as groups and matches. A rest slot (bye) is not a match. Seeds are the draft's own `rank`. */
export function normaliseDraft(raw: unknown): DraftDetail | null {
  if (!isObject(raw) || !str(raw.draft_id)) {
    return null;
  }
  const payload = isObject(raw.payload) ? raw.payload : {};
  const fixture = isObject(payload.fixture) ? payload.fixture : {};
  const seedOf = new Map<string, number>();
  list(fixture.entrants)
    .filter(isObject)
    .forEach(e => {
      const id = str(e.entrant_id);
      if (id && typeof e.rank === 'number') {
        seedOf.set(id, e.rank);
      }
    });
  const stages = list(fixture.stages).filter(isObject);
  const kindOf = new Map<string, string>();
  const groupOf = new Map<string, string>();
  stages.forEach(st => {
    const id = str(st.stage_id) ?? '';
    kindOf.set(id, str(st.kind) ?? '');
    groupOf.set(id, str(st.group_key) ?? '');
  });
  const groupList = stages
    .filter(st => st.kind === 'group')
    .map(st => ({
      key: str(st.group_key) ?? '',
      members: list(st.entrant_ids)
        .filter((id): id is string => typeof id === 'string')
        .map(id => ({ entrantId: id, seed: seedOf.get(id) ?? null })),
    }))
    .sort((a, b) => a.key.localeCompare(b.key));
  const matches: DraftMatch[] = [];
  for (const m of list(fixture.matches).filter(isObject)) {
    const a = side(m.a);
    const b = side(m.b);
    const isBye = (m.a as Json | undefined)?.kind === 'bye' || (m.b as Json | undefined)?.kind === 'bye';
    if (!isObject(m.a) || !isObject(m.b) || isBye) {
      continue;
    }
    const stageId = str(m.stage_id) ?? '';
    const schedule = isObject(m.schedule) ? m.schedule : null;
    matches.push({
      knockout: kindOf.get(stageId) === 'knockout',
      round: num(m.round),
      ordinal: num(m.ordinal),
      group: groupOf.get(stageId) ?? '',
      start: str(schedule?.start),
      court: str(schedule?.court),
      a,
      b,
    });
  }
  matches.sort(
    (x, y) => Number(x.knockout) - Number(y.knockout) || x.round - y.round || x.group.localeCompare(y.group) || x.ordinal - y.ordinal,
  );
  return {
    draftId: str(raw.draft_id) as string,
    version: num(raw.version),
    status: str(raw.status) ?? '',
    payloadHash: str(raw.payload_hash) ?? '',
    groups: typeof raw.groups === 'number' ? raw.groups : null,
    advance: typeof raw.advance_per_group === 'number' ? raw.advance_per_group : null,
    matchCount: typeof raw.match_count === 'number' ? raw.match_count : matches.length,
    groupList,
    groupMatches: matches.filter(m => !m.knockout).length,
    knockoutMatches: matches.filter(m => m.knockout).length,
    matches,
    excludedUnpaid: typeof raw.excluded_unpaid === 'number' ? raw.excluded_unpaid : null,
  };
}

/** Entrants of the draft, for the "N players" chip. */
export function draftPlayerCount(draft: DraftDetail): number {
  return draft.groupList.reduce((n, g) => n + g.members.length, 0);
}

// ---- the draw controls ---------------------------------------------------------------------------------------------
export interface DrawChoice {
  groupCounts: number[];
  advanceOptions: number[];
  groupCount: number | null;
  advance: number | null;
}

/**
 * The values the draw controls start on and offer: only what the server allows. A pick that is no longer allowed falls
 * back to the server's suggestion, then the last allowed value; advance falls back to the open draft's, then the last.
 */
export function drawChoice(
  options: GroupOptions | null,
  draft: Pick<DraftSummary, 'advance_per_group'> | null,
  pick: { groupCount: number | null; advance: number | null },
): DrawChoice {
  const groupCounts = options?.allowed ?? [];
  const advanceOptions = options?.advance_per_group_allowed ?? [];
  const last = (values: number[]): number | null => (values.length > 0 ? values[values.length - 1] : null);
  const groupCount =
    pick.groupCount !== null && groupCounts.includes(pick.groupCount)
      ? pick.groupCount
      : options?.suggested != null && groupCounts.includes(options.suggested)
        ? options.suggested
        : last(groupCounts);
  const advance =
    pick.advance !== null && advanceOptions.includes(pick.advance)
      ? pick.advance
      : draft?.advance_per_group != null && advanceOptions.includes(draft.advance_per_group)
        ? draft.advance_per_group
        : last(advanceOptions);
  return { groupCounts, advanceOptions, groupCount, advance };
}

/** True when a publication request for this draft is waiting for a decision (read from the server's request list). */
export function publicationPending(
  requests: { action_type: string; status: string; command_payload: Record<string, unknown> }[],
  draftId: string,
): { pending: boolean; createdAt: string | null } {
  const hit = requests.find(
    r => r.action_type === 'fixture_publication' && r.status === 'pending' && String(r.command_payload.draft_id ?? '').toLowerCase() === draftId.toLowerCase(),
  ) as ({ created_at?: string } & (typeof requests)[number]) | undefined;
  return { pending: Boolean(hit), createdAt: hit?.created_at ?? null };
}

/** Text of a side of a draft match: the entrant's name, or the words of the slot. Never an id. */
export function draftSideText(
  s: DraftSide,
  names: ReadonlyMap<string, string>,
  words: { unknown: string; tbd: string; groupPlace: (group: string, place: number) => string; winner: string; loser: string },
): string {
  if (s.kind === 'entrant') {
    return (s.entrantId && names.get(s.entrantId.toLowerCase())) || words.unknown;
  }
  if (s.kind === 'group_place' && s.group && s.place !== null) {
    return words.groupPlace(s.group, s.place);
  }
  if (s.kind === 'winner') {
    return words.winner;
  }
  if (s.kind === 'loser') {
    return words.loser;
  }
  return words.tbd;
}
