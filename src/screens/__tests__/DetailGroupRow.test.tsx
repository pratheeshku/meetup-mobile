/** Game and tournament detail show a Group row (icon + name) for group visibility only. */
import React from 'react';

import { apiClient } from '../../api/client';
import { renderAsync, texts } from '../../test-utils/render';
import type { Instance } from '../../test-utils/render';
import { mountTournament } from '../../test-utils/tournamentDetailHarness';
import { __resetSportDisplayNamesCacheForTests } from '../../utils/labels';
import EventDetailScreen from '../EventDetailScreen';

jest.mock('../../api/client', () => ({ apiClient: { get: jest.fn(), patch: jest.fn(), post: jest.fn() } }));
jest.mock('../../auth/AuthContext', () => ({ useAuth: () => ({ user: { id: 'user-me', nickname: 'Sam' } }) }));

const mockGet = apiClient.get as jest.Mock;

async function mountGame(overrides: Record<string, unknown>): Promise<Instance> {
  const raw = {
    id: 'evt-1', organizer_id: 'someone-else', sport: 'badminton', title: 'Friday doubles', visibility: 'public',
    capacity: 12, starts_at: '2999-09-25T18:00:00Z', ends_at: '2999-09-25T20:00:00Z', allow_waitlist: true,
    status: 'upcoming', venue_name: 'Hall', going_count: 1, user_rsvp_status: null, skill_level_requirement: 'all_levels',
    ...overrides,
  };
  mockGet.mockImplementation((url: string) => Promise.resolve({ data: url.includes('/participants') ? [] : raw }));
  const props = {
    route: { key: 'k', name: 'EventDetail', params: { eventId: 'evt-1' } },
    navigation: { goBack: jest.fn() },
  } as unknown as React.ComponentProps<typeof EventDetailScreen>;
  return renderAsync(<EventDetailScreen {...props} />);
}

const groupRows = (root: Instance): Instance[] => root.findAll(n => n.props.testID === 'group-name-item' && typeof n.type === 'string');

beforeEach(() => {
  mockGet.mockReset();
  __resetSportDisplayNamesCacheForTests();
});

describe('Game detail', () => {
  it('group game: a Group row with the group name', async () => {
    const root = await mountGame({ visibility: 'group', group_name: 'Sunday Footballers' });
    expect(groupRows(root)).toHaveLength(1);
    expect(texts(groupRows(root)[0])).toEqual(['Sunday Footballers']);
  });

  it.each([['public'], ['invite_only']])('%s game: no Group row, even if a name came back', async visibility => {
    const root = await mountGame({ visibility, group_name: 'Sunday Footballers' });
    expect(groupRows(root)).toHaveLength(0);
    expect(texts(root)).not.toContain('Sunday Footballers');
  });

  it('group game without a name renders no empty row', async () => {
    const root = await mountGame({ visibility: 'group', group_name: null });
    expect(groupRows(root)).toHaveLength(0);
  });
});

describe('Tournament detail', () => {
  it('group tournament: a Group row with the group name', async () => {
    const root = await mountTournament({ visibility: 'group', group_name: 'Sunday Footballers' });
    expect(groupRows(root)).toHaveLength(1);
    expect(texts(groupRows(root)[0])).toEqual(['Sunday Footballers']);
  });

  it.each([['public'], ['invite']])('%s tournament: no Group row', async visibility => {
    const root = await mountTournament({ visibility, group_name: 'Sunday Footballers' });
    expect(groupRows(root)).toHaveLength(0);
  });

  it('group tournament without a name renders no empty row', async () => {
    const root = await mountTournament({ visibility: 'group', group_name: null });
    expect(groupRows(root)).toHaveLength(0);
  });
});
