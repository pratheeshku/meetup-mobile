import React from 'react';

import { getTournamentStandings } from '../../../api/tournaments';
import { act, renderAsync } from '../../../test-utils/render';
import { normaliseStandings } from '../../../utils/tournamentScoring';
import { STANDINGS_RAW } from '../../../test-utils/scoringFixtures';
import TournamentScoringEntry from '../TournamentScoringEntry';

jest.mock('../../../api/tournaments', () => ({ getTournamentStandings: jest.fn() }));
const mockStandings = getTournamentStandings as jest.MockedFunction<typeof getTournamentStandings>;

describe('TournamentScoringEntry', () => {
  it('shows the entry only when scoring data exists, and opens the screen', async () => {
    mockStandings.mockResolvedValue(normaliseStandings(STANDINGS_RAW));
    const onOpen = jest.fn();
    const root = await renderAsync(<TournamentScoringEntry tournamentId="t-1" onOpen={onOpen} />);
    const card = root.findByProps({ testID: 'tournament-scoring-entry' });
    await act(async () => {
      card.props.onPress();
    });
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['no scoring data (v1, unpublished, 404)', () => mockStandings.mockResolvedValue(null)],
    ['a failed request', () => mockStandings.mockRejectedValue(new Error('down'))],
  ])('renders nothing for %s', async (_name, arrange) => {
    arrange();
    const root = await renderAsync(<TournamentScoringEntry tournamentId="t-1" onOpen={jest.fn()} />);
    expect(root.findAllByProps({ testID: 'tournament-scoring-entry' })).toHaveLength(0);
  });
});
