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

  it('shows placeholders, "To be decided", the court, and You for the signed-in player', () => {
    const root = render(
      <ScoringMatchCard
        match={match({
          fixture_id: 'p',
          stage: 'final',
          court: '1',
          side_a: side('me', 'Pratheesh K.'),
          side_b: side(null, null, 'winner'),
        })}
        mineIds={new Set(['me'])}
      />,
    );
    const all = texts(root);
    expect(all[0]).toBe('Final · Court 1');
    expect(all).toContain('You');
    expect(all).toContain('Winner of an earlier match');
    expect(all).not.toContain('Pratheesh K.');

    const tbd = render(<ScoringMatchCard match={match({ fixture_id: 'q', side_b: side(null, null) })} />);
    expect(texts(tbd)).toContain('To be decided');
  });

  it('names the round size for a main round', () => {
    const root = render(<ScoringMatchCard match={match({ fixture_id: 'm', stage: 'main', fixture_order: 3 })} mainRoundSize={16} />);
    expect(texts(root)[0]).toBe('R16-3');
  });
});
