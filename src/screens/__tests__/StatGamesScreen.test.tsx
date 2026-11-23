/** priority1-nov23 P1-03: the Played / Hosted / Won list, its search and where a row goes. */
import React from 'react';
import { TextInput } from 'react-native';

import { getMyStatItems } from '../../api/profile';
import { act, renderAsync, texts } from '../../test-utils/render';
import type { Instance } from '../../test-utils/render';
import StatGamesScreen from '../StatGamesScreen';

jest.mock('../../api/profile', () => ({ getMyStatItems: jest.fn() }));
const mockNavigateRef = jest.fn();
jest.mock('../../notifications/notificationRouting', () => ({
  navigationRef: { isReady: () => true, navigate: (...args: unknown[]) => mockNavigateRef(...args) },
}));

const mockItems = getMyStatItems as jest.Mock;
const ITEMS = [
  { kind: 'game', id: 'g1', title: 'Friday doubles', sport: 'badminton', starts_at: '2026-11-01T10:00:00Z', venue_name: 'Hall' },
  { kind: 'tournament', id: 't1', title: 'Club cup', sport: 'tennis', starts_at: '2026-10-01T10:00:00Z', venue_name: null },
];

async function mount(stat: 'played' | 'hosted' | 'won' = 'played'): Promise<{ root: Instance; navigation: Record<string, jest.Mock> }> {
  const navigation = { navigate: jest.fn(), setOptions: jest.fn() };
  const props = {
    route: { key: 'k', name: 'StatGames', params: { stat } },
    navigation,
  } as unknown as React.ComponentProps<typeof StatGamesScreen>;
  const root = await renderAsync(<StatGamesScreen {...props} />);
  return { root, navigation };
}

beforeEach(() => {
  jest.useRealTimers();
  mockNavigateRef.mockReset();
  mockItems.mockReset().mockResolvedValue({ stat: 'played', total: 2, items: ITEMS });
});

it('loads the list for the stat, titles the screen and shows the Game / Tournament chips', async () => {
  const { root, navigation } = await mount('won');
  expect(mockItems).toHaveBeenCalledWith('won', expect.objectContaining({ q: '' }), expect.anything());
  expect(navigation.setOptions).toHaveBeenCalledWith({ title: 'Games won' });
  expect(texts(root)).toEqual(expect.arrayContaining(['Friday doubles', 'Club cup', 'Game', 'Tournament']));
});

it('a game row opens the game; a tournament row opens the tournament', async () => {
  const { root, navigation } = await mount();
  await act(async () => {
    root.find(n => n.props.testID === 'stat-row-g1' && typeof n.props.onPress === 'function').props.onPress();
  });
  expect(navigation.navigate).toHaveBeenCalledWith('EventDetail', { eventId: 'g1' });
  await act(async () => {
    root.find(n => n.props.testID === 'stat-row-t1' && typeof n.props.onPress === 'function').props.onPress();
  });
  expect(mockNavigateRef).toHaveBeenCalledWith('Tournaments', { screen: 'TournamentDetail', params: { tournamentId: 't1' } });
});

it('search asks the server with the typed text after a pause, and shows the no-match text', async () => {
  jest.useFakeTimers();
  const { root } = await mount();
  mockItems.mockResolvedValueOnce({ stat: 'played', total: 0, items: [] });
  await act(async () => {
    root.findByType(TextInput).props.onChangeText('zzz');
  });
  expect(mockItems).toHaveBeenCalledTimes(1);
  await act(async () => {
    jest.advanceTimersByTime(350);
  });
  expect(mockItems).toHaveBeenLastCalledWith('played', expect.objectContaining({ q: 'zzz' }), expect.anything());
  expect(texts(root)).toContain('No matches for "zzz"');
  jest.useRealTimers();
});

it('shows the empty state, and the error view when the read fails', async () => {
  mockItems.mockResolvedValueOnce({ stat: 'hosted', total: 0, items: [] });
  const empty = await mount('hosted');
  expect(texts(empty.root)).toContain('Nothing here yet');
  mockItems.mockRejectedValueOnce(new Error('offline'));
  const failed = await mount('hosted');
  expect(texts(failed.root)).toContain('Could not load this list.');
});
