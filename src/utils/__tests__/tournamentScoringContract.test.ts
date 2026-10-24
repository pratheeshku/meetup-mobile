/**
 * Contract check against the backend read model (tl-c-mobile PR 1). Fixtures come from the backend repo's
 * own tests (see src/test-utils/scoringBackendFixture.ts). Nothing here is recomputed: the app must
 * carry the server's values through unchanged.
 */
import {
  BACKEND_GROUP_KEYS,
  BACKEND_MATCH_KEYS,
  BACKEND_RESULT_KEYS,
  BACKEND_ROW_KEYS,
  BACKEND_SCORING_STATE,
  BACKEND_SIDE_KEYS,
  BACKEND_STANDINGS,
  BACKEND_TOP_KEYS,
} from '../../test-utils/scoringBackendFixture';
import {
  groupKnockoutRounds,
  isMyMatch,
  normaliseScoringState,
  normaliseStandings,
} from '../tournamentScoring';

const keys = (o: object) => Object.keys(o).sort();
const sorted = (a: string[]) => [...a].sort();

/** Backend fields the app deliberately does not read. Listed in docs/reports/tl-c-mobile-report.md. */
const IGNORED = {
  // te-a2 reads `tiebreakers` (the order the server uses, shown as words), so no top-level field is ignored any more
  top: [] as string[],
  result: ['summary'],
};

describe('standings contract (backend board_view)', () => {
  const view = normaliseStandings(BACKEND_STANDINGS);

  it('the fixture has exactly the backend key sets', () => {
    expect(keys(BACKEND_STANDINGS)).toEqual(sorted(BACKEND_TOP_KEYS));
    BACKEND_STANDINGS.groups.forEach(g => {
      expect(keys(g)).toEqual(sorted(BACKEND_GROUP_KEYS));
      g.table.forEach(r => expect(keys(r)).toEqual(sorted(BACKEND_ROW_KEYS)));
      g.matches.forEach(m => expect(keys(m)).toEqual(sorted(BACKEND_MATCH_KEYS)));
    });
    BACKEND_STANDINGS.knockout.forEach(m => {
      expect(keys(m)).toEqual(sorted(BACKEND_MATCH_KEYS));
      expect(keys(m.side_a as object)).toEqual(sorted(BACKEND_SIDE_KEYS));
    });
  });

  it('reads every group, row, match and side field the backend returns (except the listed ignores)', () => {
    expect(view).not.toBeNull();
    const g = view!.groups[0];
    expect(keys(g)).toEqual(sorted(BACKEND_GROUP_KEYS));
    expect(keys(g.table[0])).toEqual(sorted(BACKEND_ROW_KEYS));
    expect(keys(g.matches[0])).toEqual(sorted(BACKEND_MATCH_KEYS));
    expect(keys(g.matches[0].side_a)).toEqual(sorted(BACKEND_SIDE_KEYS));
    expect(keys(g.matches[0].result!)).toEqual(
      sorted(BACKEND_RESULT_KEYS.filter(k => !IGNORED.result.includes(k))),
    );
    expect(keys(view!)).toEqual(
      sorted(BACKEND_TOP_KEYS.filter(k => !IGNORED.top.includes(k))),
    );
  });

  it('reads no field the backend does not return', () => {
    const g = view!.groups[0];
    const backendTop = new Set(BACKEND_TOP_KEYS);
    keys(view!).forEach(k => expect(backendTop.has(k)).toBe(true));
    keys(g.table[0]).forEach(k => expect(BACKEND_ROW_KEYS).toContain(k));
    keys(g.matches[0]).forEach(k => expect(BACKEND_MATCH_KEYS).toContain(k));
    keys(g.matches[0].side_a).forEach(k => expect(BACKEND_SIDE_KEYS).toContain(k));
    keys(g.matches[0].result!).forEach(k => expect(BACKEND_RESULT_KEYS).toContain(k));
  });

  it('carries advance_per_group and qualifies true / false / null through unchanged', () => {
    const [a, b] = view!.groups;
    expect(a.advance_per_group).toBe(2);
    expect(a.table.map(r => r.qualifies)).toEqual([true, true, false]);
    expect(b.table.map(r => r.qualifies)).toEqual([null, null, null]);
    expect(b.provisional).toBe(true);
  });

  it('keeps the unresolved tie flags and ranks as sent (no recompute)', () => {
    const d = view!.groups[2];
    expect(d.unresolved_tie).toBe(true);
    expect(d.needs_override).toBe(true);
    expect(d.qualifiers_resolved).toBe(false);
    expect(d.table.map(r => [r.rank, r.tied])).toEqual([[1, true], [1, true]]);
  });

  it('keeps placeholder_detail group_place, winner and loser with the feeder bracket_slot as match_id', () => {
    const byId = (id: string) => view!.knockout.find(m => m.match_id === id)!;
    expect(byId('knockout:r1:m2').side_a.placeholder_detail).toEqual({ type: 'group_place', group: 'B', place: 1 });
    expect(byId('knockout:r2:m1').side_a.placeholder_detail).toEqual({ type: 'winner', match_id: 'knockout:r1:m1' });
    expect(byId('knockout:r3:m1').side_b.placeholder_detail).toEqual({ type: 'loser', match_id: 'knockout:r1:m2' });
    expect(byId('knockout:r3:m1').side_b.placeholder).toBe('loser');
    // A resolved side has neither a placeholder nor a detail.
    expect(byId('knockout:r1:m1').side_a.placeholder).toBeNull();
    expect(byId('knockout:r1:m1').side_a.placeholder_detail).toBeNull();
  });

  it('every winner/loser match_id resolves to a match in the same payload', () => {
    const all = [...view!.groups.flatMap(g => g.matches), ...view!.knockout];
    view!.knockout.forEach(m =>
      [m.side_a, m.side_b].forEach(s => {
        const d = s.placeholder_detail;
        if (d && d.type !== 'group_place') {
          expect(all.some(x => x.match_id === d.match_id)).toBe(true);
        }
      }),
    );
  });

  it('reads is_mine per side and flags the caller\'s matches', () => {
    const mine = view!.groups[0].matches;
    expect(mine.every(isMyMatch)).toBe(true);
    expect(view!.groups[1].matches.some(isMyMatch)).toBe(false);
  });

  it('keeps walkover and retired results as sent', () => {
    const wo = view!.groups[0].matches[1];
    expect(wo.status).toBe('walkover');
    expect(wo.result).toMatchObject({ result_type: 'walkover', sets: [], advancing_side: 'a' });
    const ret = view!.groups[1].matches[0];
    expect(ret.result).toMatchObject({ result_type: 'retired', advancing_side: 'a' });
    expect(ret.result!.sets).toEqual([{ a: 21, b: 10 }, { a: 3, b: 5 }]);
  });

  it('orders the knockout pills semifinal, third place, final', () => {
    expect(groupKnockoutRounds(view!.knockout).map(r => r.stage)).toEqual(['semifinal', 'third_place', 'final']);
  });

  it('treats published:false and the v1 list shape as no scoring data', () => {
    expect(normaliseStandings({ ...BACKEND_STANDINGS, published: false })).toBeNull();
    expect(normaliseStandings([{ participant_name: 'x', points: 3 }])).toBeNull();
  });
});

describe('scoring/state contract (engine_service.scoring_state)', () => {
  // Additive reads (te-a1): the registration phase and the two published/posted facts, as the server sent them.
  const FACTS = { registration_phase: 'frozen', fixtures_published: true, any_result_posted: true };

  it('reads enabled and applicable, and the additive facts, from the full backend payload', () => {
    expect(normaliseScoringState(BACKEND_SCORING_STATE)).toEqual({ enabled: true, applicable: true, ...FACTS });
  });

  it('reads off / not applicable as such', () => {
    expect(normaliseScoringState({ ...BACKEND_SCORING_STATE, enabled: false })).toEqual({
      enabled: false,
      applicable: true,
      ...FACTS,
    });
    expect(normaliseScoringState({ ...BACKEND_SCORING_STATE, applicable: false })).toEqual({
      enabled: true,
      applicable: false,
      ...FACTS,
    });
  });

  it('te-b2: the tabs object and the poll interval ride along for a version 2 tournament and are absent otherwise', () => {
    const tabs = { overview: { state: 'open' }, fixtures: { state: 'locked', unlocks: 'fixtures_published' } };
    expect(normaliseScoringState({ ...BACKEND_SCORING_STATE, tabs, live_poll_seconds: 10 })).toMatchObject({
      tabs: { overview: { state: 'open' }, fixtures: { state: 'locked', unlocks: 'fixtures_published' } },
      live_poll_seconds: 10,
    });
    expect(normaliseScoringState(BACKEND_SCORING_STATE)).not.toHaveProperty('tabs');
  });
});
