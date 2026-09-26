/**
 * `useSportDisplayName` (BUG-M02 remainder): resolves a raw sport slug
 * against `GET /admin/sports/public`, cached module-wide (fetched at most
 * once, not once per component). The static label maps have no logic to
 * test beyond their own literal values, already exercised indirectly by
 * every screen that imports them.
 */
import React from 'react';
import { Text } from 'react-native';

import { getSports } from '../../api/sports';
import { act, render, texts } from '../../test-utils/render';
import {
  __resetSportDisplayNamesCacheForTests,
  getEventVisibilityLabel,
  useSportDisplayName,
} from '../labels';

jest.mock('../../api/sports', () => ({ getSports: jest.fn() }));

const mockGetSports = getSports as jest.MockedFunction<typeof getSports>;

function Probe({ sport }: { sport: string }): React.JSX.Element {
  return <Text>{useSportDisplayName(sport)}</Text>;
}

beforeEach(() => {
  __resetSportDisplayNamesCacheForTests();
  mockGetSports.mockReset();
});

describe('useSportDisplayName', () => {
  it('renders the raw slug immediately, then upgrades to display_name once the list resolves', async () => {
    let resolveSports!: (sports: Awaited<ReturnType<typeof getSports>>) => void;
    mockGetSports.mockReturnValue(new Promise(resolve => (resolveSports = resolve)));

    const root = render(<Probe sport="table_tennis" />);
    expect(texts(root)).toEqual(['table_tennis']);

    await act(async () => {
      resolveSports([{ name: 'table_tennis', display_name: 'Table Tennis' }]);
    });
    expect(texts(root)).toEqual(['Table Tennis']);
  });

  it('falls back to the raw slug for a sport not in the list', async () => {
    mockGetSports.mockResolvedValue([{ name: 'badminton', display_name: 'Badminton' }]);
    const root = render(<Probe sport="curling" />);
    await act(async () => {});
    expect(texts(root)).toEqual(['curling']);
  });

  it('falls back to the raw slug, without throwing, when the fetch fails', async () => {
    mockGetSports.mockRejectedValue(new Error('network'));
    const root = render(<Probe sport="badminton" />);
    await act(async () => {});
    expect(texts(root)).toEqual(['badminton']);
  });

  it('fetches the sports list only once for two components resolving different sports', async () => {
    mockGetSports.mockResolvedValue([
      { name: 'badminton', display_name: 'Badminton' },
      { name: 'tennis', display_name: 'Tennis' },
    ]);
    render(
      <>
        <Probe sport="badminton" />
        <Probe sport="tennis" />
      </>,
    );
    await act(async () => {});
    expect(mockGetSports).toHaveBeenCalledTimes(1);
  });

  it('a component mounted after the cache is already warm renders the display name immediately, no refetch', async () => {
    mockGetSports.mockResolvedValue([{ name: 'badminton', display_name: 'Badminton' }]);
    render(<Probe sport="badminton" />);
    await act(async () => {});
    expect(mockGetSports).toHaveBeenCalledTimes(1);

    const root = render(<Probe sport="badminton" />);
    expect(texts(root)).toEqual(['Badminton']);
    expect(mockGetSports).toHaveBeenCalledTimes(1);
  });
});

describe('getEventVisibilityLabel', () => {
  const customLabels = {
    'event_visibility.public': 'Everyone',
    'event_visibility.invite_only': 'Only Invited',
    'event_visibility.group': 'My Group',
  };

  it('formats public visibility with 🌍 emoji and label', () => {
    expect(getEventVisibilityLabel('public', {})).toBe('🌍 Public');
    expect(getEventVisibilityLabel('public', customLabels)).toBe('🌍 Everyone');
  });

  it('formats invite_only visibility with 🔒 emoji and label', () => {
    expect(getEventVisibilityLabel('invite_only', {})).toBe('🔒 Private');
    expect(getEventVisibilityLabel('invite_only', customLabels)).toBe('🔒 Only Invited');
  });

  it('formats group visibility with 👥 emoji and label', () => {
    expect(getEventVisibilityLabel('group', {})).toBe('👥 Group');
    expect(getEventVisibilityLabel('group', customLabels)).toBe('👥 My Group');
  });

  it('defaults to public with 🌍 emoji for undefined or unknown values', () => {
    expect(getEventVisibilityLabel(undefined, {})).toBe('🌍 Public');
    expect(getEventVisibilityLabel('unknown' as any, {})).toBe('🌍 Public');
  });
});
