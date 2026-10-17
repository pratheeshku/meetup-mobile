/**
 * One player search field everywhere: Game Detail and Tournament Detail use the
 * shared UserSearchPicker with onSelectEmail and have no separate email input.
 * (Create game and Group create are covered in their own suites; Group Detail
 * passes onSelectEmail to the same picker.)
 */
import React from 'react';

import { apiClient } from '../../api/client';
import { act, pressableLabelled, renderAsync, texts } from '../../test-utils/render';
import type { Instance } from '../../test-utils/render';
import { mountTournament } from '../../test-utils/tournamentDetailHarness';
import EventDetailScreen from '../EventDetailScreen';

jest.mock('../../api/client', () => ({ apiClient: { get: jest.fn(), patch: jest.fn(), post: jest.fn() } }));
jest.mock('../../api/groups', () => ({ getMyGroups: jest.fn().mockResolvedValue({ items: [] }) }));
jest.mock('../../auth/AuthContext', () => ({ useAuth: () => ({ user: { id: 'user-me', nickname: 'Sam' } }) }));

const mockGet = apiClient.get as jest.Mock;

async function mountGame(): Promise<Instance> {
  const raw = {
    id: 'evt-1', organizer_id: 'user-me', sport: 'badminton', title: 'Friday doubles', visibility: 'public',
    capacity: 12, starts_at: '2999-09-25T18:00:00Z', ends_at: '2999-09-25T20:00:00Z', allow_waitlist: true,
    status: 'upcoming', venue_name: 'Hall', going_count: 1, user_rsvp_status: null, skill_level_requirement: 'all_levels',
  };
  mockGet.mockImplementation((url: string) =>
    Promise.resolve({ data: url.includes('/participants') ? [] : url.startsWith('/users/search') ? [] : raw }),
  );
  const props = {
    route: { key: 'k', name: 'EventDetail', params: { eventId: 'evt-1' } },
    navigation: { goBack: jest.fn() },
  } as unknown as React.ComponentProps<typeof EventDetailScreen>;
  return renderAsync(<EventDetailScreen {...props} />);
}

const field = (root: Instance): Instance[] =>
  root.findAll(n => (n.type as unknown) === 'TextInput' && n.props.accessibilityLabel === 'Search users');
const emailBtn = (root: Instance, email: string): Instance | undefined =>
  root.findAll(n => n.props.accessibilityLabel === `Invite ${email} as new player` && typeof n.props.onPress === 'function')[0];
const type = async (root: Instance, value: string): Promise<void> => {
  await act(async () => {
    field(root)[0].props.onChangeText(value);
  });
  await act(async () => {
    jest.advanceTimersByTime(300);
  });
};

beforeEach(() => {
  jest.useFakeTimers();
});
afterEach(() => {
  act(() => {
    jest.runOnlyPendingTimers();
  });
  jest.useRealTimers();
});

describe.each([
  ['Game Detail', async () => mountGame()],
  ['Tournament Detail', async () => mountTournament({ my_invite_access: 'individuals' })],
])('%s invite player', (_name, mount) => {
  it('has one search field and no separate email input', async () => {
    const root = await mount();
    await act(async () => pressableLabelled(root, 'Invite Player').props.onPress());
    expect(field(root)).toHaveLength(1);
    expect(root.findAll(n => n.props.accessibilityLabel === 'Invite by email')).toHaveLength(0);
    expect(root.findAll(n => n.props.keyboardType === 'email-address')).toHaveLength(0);
  });

  it('a valid email that matches nobody shows the Invite button; a non-email shows none', async () => {
    const root = await mount();
    await act(async () => pressableLabelled(root, 'Invite Player').props.onPress());
    await type(root, 'who@example.com');
    expect(emailBtn(root, 'who@example.com')).toBeDefined();
    await type(root, 'just words');
    expect(root.findAll(n => /^Invite .+@.+ as new /.test(String(n.props.accessibilityLabel ?? '')))).toHaveLength(0);
  });

  it('tapping the email button selects that email for the invite (same flow as a person)', async () => {
    const root = await mount();
    await act(async () => pressableLabelled(root, 'Invite Player').props.onPress());
    await type(root, 'who@example.com');
    await act(async () => emailBtn(root, 'who@example.com')!.props.onPress());
    expect(texts(root)).toContain('Invite by email: who@example.com');
  });
});
