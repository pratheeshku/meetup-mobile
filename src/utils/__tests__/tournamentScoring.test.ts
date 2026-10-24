import { STANDINGS_RAW, withMine } from '../../test-utils/scoringFixtures';
import {
  groupKnockoutRounds,
  isMyMatch,
  mainRoundSize,
  normaliseScoringState,
  normaliseStandings,
  signed,
  sortKnockout,
} from '../tournamentScoring';

describe('normaliseStandings', () => {
  it('reads the documented shape without changing the backend values', () => {
    const view = normaliseStandings(STANDINGS_RAW)!;
    expect(view.groups.map(g => g.group_key)).toEqual(['A', 'B', 'C']);
    expect(view.groups[0].table.map(r => [r.rank, r.tied, r.qualifies])).toEqual([
      [1, false, true],
      [2, false, true],
      [3, false, false],
      [4, false, false],
    ]);
    expect(view.groups.map(g => g.advance_per_group)).toEqual([2, 2, 2]);
    // Provisional group and unresolved tie: the server sends null, which stays null (no marker).
    expect(view.groups[1].table.every(r => r.qualifies === null)).toBe(true);
    expect(view.groups[2].table.map(r => [r.rank, r.tied, r.qualifies])).toEqual([
      [1, true, null],
      [1, true, null],
      [1, true, null],
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
    expect(m.side_a).toEqual({ registration_id: null, name: null, placeholder: null, placeholder_detail: null, is_mine: false });
    expect(m.result).toMatchObject({ result_type: 'normal', sets: [{ a: 0, b: 0 }], advancing_side: null });
    expect(view.groups[0].matches).toHaveLength(1);
  });
});

describe('ms-s5 fields', () => {
  const view = normaliseStandings(withMine(STANDINGS_RAW, ['r1']))!;
  const knockout = view.knockout;
  const byId = (id: string) => knockout.find(m => m.fixture_id === id)!;

  it('reads placeholder_detail as the server sent it', () => {
    expect(byId('kq2').side_a.placeholder_detail).toEqual({ type: 'group_place', group: 'C', place: 1 });
    expect(byId('ks1').side_a.placeholder_detail).toEqual({ type: 'winner', match_id: 'kq1' });
    expect(byId('k3').side_a.placeholder_detail).toEqual({ type: 'loser', match_id: 'ks1' });
    expect(byId('k3').side_b.placeholder_detail).toEqual({ type: 'loser', match_id: null });
    expect(byId('kq1').side_a.placeholder_detail).toBeNull();
  });

  it('reads is_mine per side and never infers it', () => {
    expect(byId('kq1').side_a.is_mine).toBe(true);
    expect(byId('kq1').side_b.is_mine).toBe(false);
    expect(isMyMatch(byId('kq1'))).toBe(true);
    expect(isMyMatch(byId('kq2'))).toBe(false);
    const none = normaliseStandings(STANDINGS_RAW)!;
    expect(none.knockout.some(isMyMatch)).toBe(false);
  });

  it('defaults missing or malformed ms-s5 fields safely (an older answer)', () => {
    const old = normaliseStandings({
      published: true,
      groups: [{ group_key: 'A', table: [{ registration_id: 'r1', name: 'X', qualifies: 'yes' }], matches: [
        { fixture_id: 'f', side_a: { registration_id: 'r1', placeholder_detail: { type: 'nope' }, is_mine: 'true' } },
      ] }],
      knockout: [],
    })!;
    expect(old.groups[0].advance_per_group).toBe(0);
    expect(old.groups[0].table[0].qualifies).toBeNull();
    expect(old.groups[0].matches[0].side_a).toMatchObject({ placeholder_detail: null, is_mine: false });
  });

  it('sizes a main round from its matches only', () => {
    const main = [1, 2, 3, 4, 5, 6, 7, 8].map(i => ({ ...byId('kq1'), fixture_id: `m${i}`, stage: 'main', round_number: 4 }));
    expect(mainRoundSize(main[0], [...main, byId('kf')])).toBe(16);
    expect(mainRoundSize(byId('kq1'), knockout)).toBeUndefined();
  });
});

describe('normaliseScoringState', () => {
  it('reads enabled and applicable as booleans, plus is_committee (te-a3), and nothing else', () => {
    expect(normaliseScoringState({ enabled: true, applicable: true, committee: null, is_committee: false })).toEqual({ enabled: true, applicable: true, is_committee: false });
    expect(normaliseScoringState({ enabled: true })).toEqual({ enabled: true, applicable: false });
    expect(normaliseScoringState({ enabled: 'true', applicable: 1 })).toEqual({ enabled: false, applicable: false });
    expect(normaliseScoringState(null)).toBeNull();
    expect(normaliseScoringState([])).toBeNull();
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
});

describe('signed', () => {
  it('prefixes positives only', () => {
    expect([signed(4), signed(0), signed(-3)]).toEqual(['+4', '0', '-3']);
  });
});
