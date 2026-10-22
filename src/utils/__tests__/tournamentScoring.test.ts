import { STANDINGS_RAW } from '../../test-utils/scoringFixtures';
import {
  groupKnockoutRounds,
  normaliseStandings,
  seatedKnockoutIds,
  signed,
  sortKnockout,
} from '../tournamentScoring';

describe('normaliseStandings', () => {
  it('reads the documented shape without changing the backend values', () => {
    const view = normaliseStandings(STANDINGS_RAW)!;
    expect(view.groups.map(g => g.group_key)).toEqual(['A', 'B']);
    expect(view.groups[0].table.map(r => [r.rank, r.tied])).toEqual([
      [1, false],
      [2, false],
      [3, true],
      [3, true],
    ]);
    expect(view.groups[1].provisional).toBe(true);
    expect(view.groups[0].matches[0].result).toEqual({
      result_type: 'normal',
      sets: [
        { a: 21, b: 15 },
        { a: 21, b: 19 },
      ],
      advancing_side: null,
      version: 1,
    });
  });

  it.each([
    ['the v1 list shape', [{ id: 'x', home_team: 'a' }]],
    ['an unpublished fixture', { published: false, groups: [], knockout: [] }],
    ['null', null],
    ['a string', 'nope'],
    ['an object without the lists', { published: true }],
    ['published but empty', { published: true, groups: [], knockout: [] }],
  ])('returns null for %s (no scoring UI)', (_name, raw) => {
    expect(normaliseStandings(raw)).toBeNull();
  });

  it('survives missing and unknown fields', () => {
    const view = normaliseStandings({
      published: true,
      groups: [
        { group_key: 'A', table: [{ registration_id: 'r1', name: 'X' }, { name: 'no id' }], matches: [{ fixture_id: 'f1', side_a: null, result: { result_type: 'weird', sets: [{ a: 'x' }] } }, 'junk'] },
        { nokey: true },
      ],
      knockout: [],
    })!;
    expect(view.groups).toHaveLength(1);
    expect(view.groups[0].table).toHaveLength(1);
    expect(view.groups[0].table[0]).toMatchObject({ rank: 0, tied: false, played: 0, set_diff: 0 });
    const m = view.groups[0].matches[0];
    expect(m.side_a).toEqual({ registration_id: null, name: null, placeholder: null });
    expect(m.result).toMatchObject({ result_type: 'normal', sets: [{ a: 0, b: 0 }], advancing_side: null });
    expect(view.groups[0].matches).toHaveLength(1);
  });
});

describe('knockout helpers', () => {
  const ko = normaliseStandings(STANDINGS_RAW)!.knockout;

  it('sorts by round_number then fixture_order', () => {
    expect(sortKnockout(ko).map(m => m.fixture_id)).toEqual(['kq1', 'kq2', 'ks1', 'k3', 'kf']);
  });

  it('builds one pill per stage in bracket order, third place before the final', () => {
    expect(groupKnockoutRounds(ko).map(r => [r.key, r.matches.length])).toEqual([
      ['quarterfinal', 2],
      ['semifinal', 1],
      ['third_place', 1],
      ['final', 1],
    ]);
  });

  it('keeps several main rounds apart', () => {
    const rounds = groupKnockoutRounds(
      ['m1', 'm2', 'm3'].map((id, i) => ({ ...ko[0], fixture_id: id, stage: 'main', round_number: i < 2 ? 4 : 5 })),
    );
    expect(rounds.map(r => r.key)).toEqual(['main:4', 'main:5']);
  });

  it('lists only registrations already seated in a slot', () => {
    expect([...seatedKnockoutIds(ko)].sort()).toEqual(['r1', 'r2']);
  });
});

describe('signed', () => {
  it('prefixes positives only', () => {
    expect([signed(4), signed(0), signed(-3)]).toEqual(['+4', '0', '-3']);
  });
});
