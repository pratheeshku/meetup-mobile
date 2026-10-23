import React from 'react';

import { match, side } from '../../../test-utils/scoringFixtures';
import { render, texts } from '../../../test-utils/render';
import ScoringMatchCard from '../ScoringMatchCard';

describe('ScoringMatchCard', () => {
  it('shows each side\'s games per set and takes the winner from the backend', () => {
    const root = render(
      <ScoringMatchCard
        match={match({
          fixture_id: 'f1',
          stage: 'quarterfinal',
          fixture_order: 2,
          status: 'completed',
          // Backend names the winner even though side b has the higher first set: never re-derived.
          winner_registration_id: 'r1',
          result: {
            result_type: 'normal',
            sets: [
              { a: 15, b: 21 },
              { a: 21, b: 19 },
              { a: 21, b: 18 },
            ],
            advancing_side: null,
            version: 1,
          },
        })}
      />,
    );
    const a = texts(root.findByProps({ testID: 'scoring-match-f1-a' }));
    const b = texts(root.findByProps({ testID: 'scoring-match-f1-b' }));
    expect(a).toEqual(['Ravi K.', '15', '21', '21']);
    expect(b).toEqual(['Wei C.', '21', '19', '18']);
    expect(texts(root)[0]).toBe('QF2');
  });

  it('labels a walkover and a retirement and keeps the sets played for RET', () => {
    const wo = render(
      <ScoringMatchCard
        match={match({
          fixture_id: 'w',
          status: 'walkover',
          winner_registration_id: 'r1',
          result: { result_type: 'walkover', sets: [], advancing_side: 'a', version: 1 },
        })}
      />,
    );
    expect(texts(wo)[0]).toContain('W/O');
    expect(texts(wo.findByProps({ testID: 'scoring-match-w-a' }))).toEqual(['Ravi K.']);

    const ret = render(
      <ScoringMatchCard
        match={match({
          fixture_id: 'r',
          status: 'completed',
          winner_registration_id: 'r2',
          result: {
            result_type: 'retired',
            sets: [
              { a: 21, b: 10 },
              { a: 3, b: 5 },
            ],
            advancing_side: 'b',
            version: 1,
          },
        })}
      />,
    );
    expect(texts(ret)[0]).toContain('RET');
    expect(texts(ret.findByProps({ testID: 'scoring-match-r-a' }))).toEqual(['Ravi K.', '21', '3']);
  });

  it('shows You for the user\'s own side (the server\'s is_mine), the court, and a plain name otherwise', () => {
    const root = render(
      <ScoringMatchCard
        match={match({
          fixture_id: 'p',
          stage: 'final',
          court: '1',
          side_a: side('me', 'Pratheesh K.', null, null, true),
          side_b: side('other', 'Wei C.'),
        })}
      />,
    );
    const all = texts(root);
    expect(all[0]).toBe('Final · Court 1');
    expect(all).toContain('You');
    expect(all).toContain('Wei C.');
    expect(all).not.toContain('Pratheesh K.');
  });

  it('draws placeholders as the boards do: A1, Winner of QF1, Loser of SF2', () => {
    const labels: Record<string, string> = { m1: 'QF1', m2: 'SF2' };
    const refLabel = (id: string): string | null => labels[id] ?? null;
    const root = render(
      <>
        <ScoringMatchCard
          refLabel={refLabel}
          match={match({
            fixture_id: 'a',
            side_a: side(null, null, 'group_place', { type: 'group_place', group: 'A', place: 1 }),
            side_b: side(null, null, 'winner', { type: 'winner', match_id: 'm1' }),
          })}
        />
        <ScoringMatchCard
          refLabel={refLabel}
          match={match({ fixture_id: 'b', side_a: side(null, null, 'loser', { type: 'loser', match_id: 'm2' }), side_b: side('r2', 'Wei C.') })}
        />
      </>,
    );
    const all = texts(root);
    expect(all).toEqual(expect.arrayContaining(['A1', 'Winner of QF1', 'Loser of SF2']));
  });

  it('falls back to the generic wording when the referenced match is not in the response', () => {
    const root = render(
      <>
        <ScoringMatchCard
          refLabel={() => null}
          match={match({
            fixture_id: 'c',
            side_a: side(null, null, 'winner', { type: 'winner', match_id: 'gone' }),
            side_b: side(null, null, 'loser', { type: 'loser', match_id: null }),
          })}
        />
        <ScoringMatchCard match={match({ fixture_id: 'd', side_a: side(null, null, 'winner', null), side_b: side(null, null) })} />
      </>,
    );
    const all = texts(root);
    expect(all.filter(t => t === 'Winner of an earlier match')).toHaveLength(2);
    expect(all).toContain('Loser of an earlier match');
    expect(all).toContain('To be decided');
  });

  it('names the round size for a main round', () => {
    const root = render(<ScoringMatchCard match={match({ fixture_id: 'm', stage: 'main', fixture_order: 3 })} mainRoundSize={16} />);
    expect(texts(root)[0]).toBe('R16-3');
  });
});
