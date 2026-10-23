/**
 * `GET /tournaments/{id}/standings` (v2 groups+knockout) as the backend returns it today.
 *
 * Shapes and values are copied from the backend repo (`~/meetup`, main at 94604e5):
 * `tournaments/result_service.py::board_view` (field set), `tests/test_match_scoring_s4_unit.py`
 * (GROUP_KEYS, ROW_KEYS, MATCH_KEYS, SIDE_KEYS, RESULT_KEYS) and `tests/js/scoring_view.test.mjs`
 * (values, `bracket_slot` match ids such as `group-A:r1:m1` and `knockout:r1:m1`).
 * Test-only. Do not edit the key sets without re-reading the backend.
 */
export const BACKEND_GROUP_KEYS = [
  'group_key', 'complete', 'provisional', 'unresolved_tie', 'needs_override', 'adjusted_by_committee',
  'qualifiers_resolved', 'matches_total', 'matches_played', 'advance_per_group', 'table', 'matches',
];
export const BACKEND_ROW_KEYS = [
  'rank', 'tied', 'registration_id', 'name', 'played', 'won', 'lost', 'sets_for', 'sets_against', 'set_diff',
  'points_for', 'points_against', 'point_diff', 'qualifies',
];
export const BACKEND_MATCH_KEYS = [
  'fixture_id', 'match_id', 'stage', 'round_number', 'fixture_order', 'status', 'scheduled_at', 'court',
  'side_a', 'side_b', 'winner_registration_id', 'result',
];
export const BACKEND_SIDE_KEYS = ['registration_id', 'name', 'placeholder', 'placeholder_detail', 'is_mine'];
export const BACKEND_RESULT_KEYS = ['result_type', 'sets', 'advancing_side', 'version', 'summary'];
export const BACKEND_TOP_KEYS = ['tournament_id', 'published', 'tiebreakers', 'groups', 'knockout'];

const R = (n: number) => `00000000-0000-4000-8000-00000000000${n}`;

const side = (n: number, name: string, isMine = false) => ({
  registration_id: R(n), name, placeholder: null, placeholder_detail: null, is_mine: isMine,
});
const slot = (placeholder: string, placeholder_detail: unknown) => ({
  registration_id: null, name: null, placeholder, placeholder_detail, is_mine: false,
});
const result = (sets: { a: number; b: number }[], type = 'normal', adv: 'a' | 'b' | null = null) => ({
  result_type: type,
  sets,
  advancing_side: adv,
  version: 1,
  summary:
    type === 'walkover'
      ? 'W/O'
      : `${type === 'retired' ? 'RET ' : ''}${sets.map(s => `${s.a}-${s.b}`).join(', ')}`.trim(),
});
const match = (
  id: string, fixtureNo: number, stage: string, round: number, order: number,
  a: unknown, b: unknown, res: unknown = null, winner: string | null = null, status?: string,
) => ({
  fixture_id: `10000000-0000-4000-8000-0000000000${String(fixtureNo).padStart(2, '0')}`,
  match_id: id, stage, round_number: round, fixture_order: order,
  status: status ?? (res ? 'completed' : 'scheduled'),
  scheduled_at: null, court: null, side_a: a, side_b: b, winner_registration_id: winner, result: res,
});
const row = (rank: number, n: number, name: string, extra: Record<string, unknown> = {}) => ({
  rank, tied: false, registration_id: R(n), name, played: 2, won: 2, lost: 0, sets_for: 4, sets_against: 0,
  set_diff: 4, points_for: 84, points_against: 40, point_diff: 44, qualifies: null, ...extra,
});

const groupBase = {
  complete: true, provisional: false, unresolved_tie: false, needs_override: false, adjusted_by_committee: false,
  qualifiers_resolved: true, matches_total: 3, matches_played: 3, advance_per_group: 2,
};

const gA = {
  group_key: 'A', ...groupBase,
  table: [
    row(1, 1, 'Asha', { qualifies: true }),
    row(2, 2, 'Ben', { qualifies: true }),
    row(3, 3, 'Chen', { qualifies: false }),
  ],
  matches: [
    match('group-A:r1:m1', 1, 'group', 1, 1, side(1, 'Asha', true), side(2, 'Ben'),
      result([{ a: 21, b: 15 }, { a: 21, b: 19 }]), R(1)),
    match('group-A:r2:m1', 3, 'group', 2, 1, side(1, 'Asha', true), side(3, 'Chen'),
      result([], 'walkover', 'a'), R(1), 'walkover'),
  ],
};
const gB = {
  group_key: 'B', ...groupBase, complete: false, provisional: true, qualifiers_resolved: false, matches_played: 1,
  table: [row(1, 4, 'Dev'), row(1, 5, 'Eli', { tied: true }), row(3, 6, 'Fay')],
  matches: [
    match('group-B:r1:m1', 4, 'group', 1, 1, side(4, 'Dev'), side(5, 'Eli'),
      result([{ a: 21, b: 10 }, { a: 3, b: 5 }], 'retired', 'a'), R(4)),
  ],
};
const gD = {
  group_key: 'D', ...groupBase, unresolved_tie: true, needs_override: true, qualifiers_resolved: false,
  table: [row(1, 7, 'Gus', { tied: true }), row(1, 8, 'Hana', { tied: true })], matches: [],
};

/** Group A resolved, B provisional, D an unresolved tie; knockout shows every placeholder_detail type. */
export const BACKEND_STANDINGS = {
  tournament_id: '20000000-0000-4000-8000-000000000001',
  published: true,
  tiebreakers: ['matches_won', 'head_to_head', 'set_difference', 'point_difference', 'override'],
  groups: [gA, gB, gD],
  knockout: [
    match('knockout:r2:m1', 12, 'final', 6, 1,
      slot('winner', { type: 'winner', match_id: 'knockout:r1:m1' }),
      slot('winner', { type: 'winner', match_id: 'knockout:r1:m2' })),
    match('knockout:r1:m2', 11, 'semifinal', 5, 2,
      slot('group_place', { type: 'group_place', group: 'B', place: 1 }),
      slot('group_place', { type: 'group_place', group: 'A', place: 2 })),
    match('knockout:r1:m1', 10, 'semifinal', 5, 1, side(1, 'Asha', true),
      slot('group_place', { type: 'group_place', group: 'B', place: 2 })),
    match('knockout:r3:m1', 13, 'third_place', 6, 2,
      slot('loser', { type: 'loser', match_id: 'knockout:r1:m1' }),
      slot('loser', { type: 'loser', match_id: 'knockout:r1:m2' })),
  ],
};

/** `GET /tournaments/{id}/scoring/state` for a non-committee viewer (engine_service.scoring_state). */
export const BACKEND_SCORING_STATE = {
  enabled: true,
  applicable: true,
  registration_phase: 'frozen',
  is_committee: false,
  fixtures_published: true,
  any_result_posted: true,
  committee: null,
};
