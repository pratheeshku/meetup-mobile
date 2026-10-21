/**
 * Game and tournament detail: the Invite type row (game-view-redesign GV-3) replaces the old Group row.
 * It counts the groups for group visibility only; the Invited sheet names them.
 */
import React from 'react';

import { apiClient } from '../../api/client';
import { act, renderAsync, texts } from '../../test-utils/render';
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

const typeRow = (root: Instance): Instance[] => root.findAll(n => n.props.testID === 'invite-type-row' && typeof n.type === 'string');
const openRow = async (root: Instance): Promise<void> =>
  act(async () => root.find(n => n.props.testID === 'invite-type-row' && typeof n.props.onPress === 'function').props.onPress());

beforeEach(() => {
  mockGet.mockReset();
  __resetSportDisplayNamesCacheForTests();
});

describe('Game detail', () => {
  it('group game: the Invite type row counts the group and the Invited sheet names it', async () => {
    const root = await mountGame({ visibility: 'group', group_name: 'Sunday Footballers' });
    expect(texts(root)).toContain('Groups (1)');
    expect(texts(root)).not.toContain('Sunday Footballers');
    await openRow(root);
    expect(texts(root)).toContain('Sunday Footballers');
  });

  it.each([['public'], ['invite_only']])('%s game: no group count, even if a name came back', async visibility => {
    const root = await mountGame({ visibility, group_name: 'Sunday Footballers' });
    expect(texts(root)).not.toContain('Groups (1)');
    expect(texts(root)).not.toContain('Sunday Footballers');
  });

  it('a public game reads "Public" and the row is not tappable', async () => {
    const root = await mountGame({ visibility: 'public' });
    expect(texts(root)).toEqual(expect.arrayContaining(['Invite type', 'Public']));
    expect(root.findAll(n => n.props.testID === 'invite-type-row' && typeof n.props.onPress === 'function')).toHaveLength(0);
  });

  it('group game without a name renders no empty row', async () => {
    const root = await mountGame({ visibility: 'group', group_name: null });
    expect(typeRow(root)).toHaveLength(0);
  });
});

describe('Tournament detail', () => {
  it('group tournament: the Invite type row counts the group and the Invited sheet names it', async () => {
    const root = await mountTournament({ visibility: 'group', group_name: 'Sunday Footballers' });
    expect(texts(root)).toContain('Groups (1)');
    await openRow(root);
    expect(texts(root)).toContain('Sunday Footballers');
  });

  it.each([['public'], ['invite']])('%s tournament: no group count', async visibility => {
    const root = await mountTournament({ visibility, group_name: 'Sunday Footballers' });
    expect(texts(root)).not.toContain('Groups (1)');
    expect(texts(root)).not.toContain('Sunday Footballers');
  });

  it('group tournament without a name renders no empty row', async () => {
    const root = await mountTournament({ visibility: 'group', group_name: null });
    expect(typeRow(root)).toHaveLength(0);
  });
});
