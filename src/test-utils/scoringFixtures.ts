/** Fixtures shaped like ms-s4 Appendix A1 (`GET /tournaments/{id}/standings`). Test-only. */
import type {
  ScoringMatch,
  ScoringPlaceholderDetail,
  ScoringSide,
  ScoringTableRow,
} from '../types/tournamentScoring';

export const side = (
  id: string | null,
  name: string | null,
  placeholder: ScoringSide['placeholder'] = null,
  placeholder_detail: ScoringPlaceholderDetail | null = null,
  is_mine = false,
): ScoringSide => ({
  registration_id: id,
  name,
  placeholder,
  placeholder_detail,
  is_mine,
});

export const row = (rank: number, id: string, name: string, over: Partial<ScoringTableRow> = {}): ScoringTableRow => ({
  rank,
  tied: false,
  registration_id: id,
  name,
  played: 2,
  won: 2 - (rank - 1),
  lost: rank - 1,
  sets_for: 4,
  sets_against: 1,
  set_diff: 3,
  points_for: 84,
  points_against: 40,
  point_diff: 44,
  qualifies: null,
  ...over,
});

export const match = (over: Partial<ScoringMatch> & Pick<ScoringMatch, 'fixture_id'>): ScoringMatch => ({
  match_id: over.fixture_id,
  stage: 'group',
  round_number: 1,
  fixture_order: 1,
  status: 'scheduled',
  scheduled_at: null,
  court: null,
  side_a: side('r1', 'Ravi K.'),
  side_b: side('r2', 'Wei C.'),
  winner_registration_id: null,
  result: null,
  ...over,
});

const played = (a: number, b: number) => ({ a, b });

/** Group A resolved (r1, r2 seated in the knockout), group B provisional, knockout QF/SF/3rd/Final given out of order. */
export const STANDINGS_RAW = {
  tournament_id: 't-1',
  published: true,
  tiebreakers: ['matches_won', 'head_to_head', 'set_difference', 'point_difference', 'override'],
  groups: [
    {
      group_key: 'A',
      complete: true,
      provisional: false,
      unresolved_tie: false,
      needs_override: false,
      adjusted_by_committee: false,
      qualifiers_resolved: true,
      matches_total: 3,
      matches_played: 3,
      advance_per_group: 2,
      table: [
        row(1, 'r1', 'Ravi K.', { qualifies: true }),
        row(2, 'r2', 'Wei C.', { qualifies: true }),
        row(3, 'r3', 'Mei Tan', { qualifies: false }),
        row(4, 'r4', 'Jon Ong', { qualifies: false }),
      ],
      matches: [
        match({
          fixture_id: 'ga1',
          status: 'completed',
          winner_registration_id: 'r1',
          result: { result_type: 'normal', sets: [played(21, 15), played(21, 19)], advancing_side: null, version: 1 },
        }),
        match({
          fixture_id: 'ga2',
          side_a: side('r3', 'Mei Tan'),
          side_b: side('r4', 'Jon Ong'),
          status: 'walkover',
          winner_registration_id: 'r3',
          result: { result_type: 'walkover', sets: [], advancing_side: 'a', version: 1 },
        }),
      ],
    },
    {
      group_key: 'B',
      complete: false,
      provisional: true,
      unresolved_tie: false,
      needs_override: false,
      adjusted_by_committee: false,
      qualifiers_resolved: false,
      matches_total: 3,
      matches_played: 1,
      advance_per_group: 2,
      table: [row(1, 'r5', 'Daniel S.'), row(2, 'r6', 'Alicia L.')],
      matches: [
        match({
          fixture_id: 'gb1',
          side_a: side('r5', 'Daniel S.'),
          side_b: side('r6', 'Alicia L.'),
          status: 'completed',
          winner_registration_id: 'r6',
          result: { result_type: 'retired', sets: [played(21, 10), played(3, 5)], advancing_side: 'b', version: 1 },
        }),
      ],
    },
    {
      // Complete but tied: the backend leaves the qualifiers open, so no row carries a marker.
      group_key: 'C',
      complete: true,
      provisional: false,
      unresolved_tie: true,
      needs_override: true,
      adjusted_by_committee: false,
      qualifiers_resolved: false,
      matches_total: 3,
      matches_played: 3,
      advance_per_group: 2,
      table: [
        row(1, 'r7', 'Mei Tan', { tied: true }),
        row(1, 'r8', 'Jon Ong', { tied: true }),
        row(1, 'r9', 'Sam Lee', { tied: true }),
      ],
      matches: [],
    },
  ],
  knockout: [
    match({ fixture_id: 'kf', stage: 'final', round_number: 6, fixture_order: 1, side_a: side(null, null, 'winner', { type: 'winner', match_id: 'ks1' }), side_b: side(null, null, 'winner', { type: 'winner', match_id: 'not-in-response' }) }),
    match({ fixture_id: 'k3', stage: 'third_place', round_number: 5, fixture_order: 2, side_a: side(null, null, 'loser', { type: 'loser', match_id: 'ks1' }), side_b: side(null, null, 'loser', { type: 'loser', match_id: null }) }),
    match({ fixture_id: 'ks1', stage: 'semifinal', round_number: 5, fixture_order: 1, side_a: side(null, null, 'winner', { type: 'winner', match_id: 'kq1' }), side_b: side(null, null, 'winner', { type: 'winner', match_id: 'kq2' }) }),
    match({ fixture_id: 'kq2', stage: 'quarterfinal', round_number: 4, fixture_order: 2, side_a: side(null, null, 'group_place', { type: 'group_place', group: 'C', place: 1 }), side_b: side(null, null, 'group_place', { type: 'group_place', group: 'D', place: 2 }) }),
    match({ fixture_id: 'kq1', stage: 'quarterfinal', round_number: 4, fixture_order: 1, side_a: side('r1', 'Ravi K.'), side_b: side('r2', 'Wei C.') }),
  ],
};

/** A copy of the answer as another caller would get it: every side of these registrations is `is_mine`. */
export function withMine(raw: typeof STANDINGS_RAW, ids: string[]): typeof STANDINGS_RAW {
  const copy = JSON.parse(JSON.stringify(raw)) as typeof STANDINGS_RAW;
  const mark = (m: ScoringMatch): void => {
    [m.side_a, m.side_b].forEach(sd => {
      sd.is_mine = sd.registration_id !== null && ids.includes(sd.registration_id);
    });
  };
  copy.groups.forEach(g => g.matches.forEach(mark));
  copy.knockout.forEach(mark);
  return copy;
}
