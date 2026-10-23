import React from 'react';

import { getTournamentScoringState } from '../../../api/tournaments';
import { act, renderAsync } from '../../../test-utils/render';
import TournamentScoringEntry from '../TournamentScoringEntry';

jest.mock('../../../api/tournaments', () => ({ getTournamentScoringState: jest.fn() }));
const mockState = getTournamentScoringState as jest.MockedFunction<typeof getTournamentScoringState>;

describe('TournamentScoringEntry', () => {
  it('shows the entry only when scoring is enabled and applicable, and opens the screen', async () => {
    mockState.mockResolvedValue({ enabled: true, applicable: true });
    const onOpen = jest.fn();
    const root = await renderAsync(<TournamentScoringEntry tournamentId="t-1" onOpen={onOpen} />);
    expect(mockState).toHaveBeenCalledWith('t-1');
    const card = root.findByProps({ testID: 'tournament-scoring-entry' });
    await act(async () => {
      card.props.onPress();
    });
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['scoring switched off', () => mockState.mockResolvedValue({ enabled: false, applicable: true })],
    ['a tournament it does not apply to', () => mockState.mockResolvedValue({ enabled: true, applicable: false })],
    ['no state (404)', () => mockState.mockResolvedValue(null)],
    ['a failed request', () => mockState.mockRejectedValue(new Error('down'))],
  ])('renders nothing for %s', async (_name, arrange) => {
    arrange();
    const root = await renderAsync(<TournamentScoringEntry tournamentId="t-1" onOpen={jest.fn()} />);
    expect(root.findAllByProps({ testID: 'tournament-scoring-entry' })).toHaveLength(0);
  });
});
