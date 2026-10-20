/** Game detail Players block: going people only, photos with initials fallback, backend going count, refresh after Join/Leave. */
import React from 'react';
import { Image, View } from 'react-native';

import { apiClient } from '../../api/client';
import { act, pressableLabelled, renderAsync, texts } from '../../test-utils/render';
import type { Instance } from '../../test-utils/render';
import UserMenuHost from '../../components/user/UserMenuHost';
import { closeUserMenu } from '../../hooks/useUserMenu';
import { __resetSportDisplayNamesCacheForTests } from '../../utils/labels';
import EventDetailScreen from '../EventDetailScreen';

jest.mock('../../api/client', () => ({ apiClient: { get: jest.fn(), patch: jest.fn(), post: jest.fn() } }));
jest.mock('../../auth/AuthContext', () => ({ useAuth: () => ({ user: { id: 'user-me', nickname: 'Sam' } }) }));

const mockGet = apiClient.get as jest.Mock;
const mockPost = apiClient.post as jest.Mock;

const server: { event: Record<string, unknown>; participants: Record<string, unknown>[] } = { event: {}, participants: [] };

const rawEvent = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  id: 'evt-1', organizer_id: 'someone-else', sport: 'badminton', title: 'Friday doubles', visibility: 'public',
  capacity: 12, starts_at: '2999-09-25T18:00:00Z', ends_at: '2999-09-25T20:00:00Z', allow_waitlist: true,
  status: 'upcoming', venue_name: 'Hall', going_count: 2, user_rsvp_status: null, skill_level_requirement: 'all_levels',
  ...overrides,
});
const person = (id: string, name: string, status: string, photo: string | null = null) => ({
  id: `p-${id}`, user_id: id, status, user_display_name: name, user_nickname: name.toLowerCase(), user_photo_url: photo,
});

async function mount(event: Record<string, unknown>, participants: Record<string, unknown>[]): Promise<Instance> {
  server.event = event;
  server.participants = participants;
  mockGet.mockImplementation((url: string) =>
    url.endsWith('/card')
      ? Promise.resolve({
          data: {
            user_id: 'u-1', display_name: 'Alice', nickname: 'alice', photo_url: null, is_self: false,
            relation: 'player', allowed_actions: [{ key: 'remove_player', requires_approval: false }],
          },
        })
      : Promise.resolve({ data: url.includes('/participants') ? server.participants : url === '/config/client' ? {} : server.event }),
  );
  const props = {
    route: { key: 'k', name: 'EventDetail', params: { eventId: 'evt-1' } },
    navigation: { goBack: jest.fn() },
  } as unknown as React.ComponentProps<typeof EventDetailScreen>;
  return renderAsync(
    <View>
      <EventDetailScreen {...props} />
      <UserMenuHost />
    </View>,
  );
}
const avatars = (root: Instance): Instance[] => root.findAll(n => n.props.testID === 'player-avatar' && typeof n.type === 'string');
const press = async (root: Instance, label: string): Promise<void> => {
  await act(async () => {
    pressableLabelled(root, label).props.onPress();
  });
};

beforeEach(() => {
  act(() => closeUserMenu());
  mockGet.mockReset();
  mockPost.mockReset().mockResolvedValue({ data: {} });
  __resetSportDisplayNamesCacheForTests();
});

describe('who is shown and counted', () => {
  const people = [
    person('u-1', 'Alice', 'going', 'https://cdn.example.com/alice.jpg'),
    person('u-2', 'Bob', 'going'),
    person('u-3', 'Carol', 'withdrawn'),
    person('u-4', 'Dan', 'waitlisted'),
  ];

  it('shows only going participants; withdrawn and waitlisted are neither shown nor counted', async () => {
    const root = await mount(rawEvent({ going_count: 2 }), people);
    expect(avatars(root)).toHaveLength(2);
    expect(texts(root)).toContain('2 of 12 joined');
    expect(texts(root)).not.toContain('4 of 12 joined');
  });

  it('the joined count is the backend going count, not the participants list length', async () => {
    const root = await mount(rawEvent({ going_count: 5 }), people.slice(0, 2));
    expect(texts(root)).toContain('5 of 12 joined');
  });

  it('shows the photo when there is one', async () => {
    const root = await mount(rawEvent(), people);
    const images = avatars(root)[0].findAllByType(Image);
    expect(images).toHaveLength(1);
    expect(images[0].props.source).toEqual({ uri: 'https://cdn.example.com/alice.jpg' });
  });

  it('falls back to initials when there is no photo', async () => {
    const root = await mount(rawEvent(), people);
    const bob = avatars(root)[1];
    expect(bob.findAllByType(Image)).toHaveLength(0);
    expect(texts(bob)).toContain('B');
  });
});

describe('refresh after Leave and Join', () => {
  it('Leave reloads the game and its participants: block, count and button agree', async () => {
    const root = await mount(
      rawEvent({ going_count: 2, user_rsvp_status: 'going' }),
      [person('user-me', 'Sam', 'going'), person('u-2', 'Bob', 'going')],
    );
    expect(avatars(root)).toHaveLength(2);
    expect(texts(root)).toContain('2 of 12 joined');
    const gets = mockGet.mock.calls.length;

    // The server state after the withdrawal.
    server.event = rawEvent({ going_count: 1, user_rsvp_status: 'withdrawn' });
    server.participants = [person('user-me', 'Sam', 'withdrawn'), person('u-2', 'Bob', 'going')];
    await press(root, 'Leave');

    expect(mockPost).toHaveBeenCalledWith('/events/evt-1/rsvp', { action: 'withdrawn' }, expect.anything());
    expect(mockGet.mock.calls.length).toBeGreaterThan(gets);
    expect(mockGet.mock.calls.slice(gets).map(c => c[0])).toEqual(
      expect.arrayContaining(['/events/evt-1', '/events/evt-1/participants']),
    );
    expect(avatars(root)).toHaveLength(1);
    expect(texts(root)).toContain('1 of 12 joined');
    expect(pressableLabelled(root, 'Join')).toBeDefined();
    expect(root.findAll(n => n.props.accessibilityLabel === 'Leave' && typeof n.props.onPress === 'function')).toHaveLength(0);
  });

  it('Join reloads both too', async () => {
    const root = await mount(rawEvent({ going_count: 1 }), [person('u-2', 'Bob', 'going')]);
    server.event = rawEvent({ going_count: 2, user_rsvp_status: 'going' });
    server.participants = [person('u-2', 'Bob', 'going'), person('user-me', 'Sam', 'going')];
    await press(root, 'Join');
    expect(avatars(root)).toHaveLength(2);
    expect(texts(root)).toContain('2 of 12 joined');
    expect(pressableLabelled(root, 'Leave')).toBeDefined();
  });

  it('does not flash the loading view while refreshing', async () => {
    const root = await mount(rawEvent({ user_rsvp_status: 'going' }), [person('user-me', 'Sam', 'going')]);
    mockGet.mockImplementation(() => new Promise(() => {})); // refresh never resolves
    await act(async () => {
      pressableLabelled(root, 'Leave').props.onPress();
    });
    expect(texts(root)).toContain('Players'); // still on screen
  });
});

describe('organiser capacity minimum', () => {
  it('uses the going count, not the participants list (withdrawn people do not raise it)', async () => {
    const people = [
      person('u-1', 'A', 'going'), person('u-2', 'B', 'going'),
      person('u-3', 'C', 'withdrawn'), person('u-4', 'D', 'withdrawn'), person('u-5', 'E', 'waitlisted'),
    ];
    const root = await mount(rawEvent({ organizer_id: 'user-me', capacity: 3, going_count: 2 }), people);
    await act(async () => {
      root.findAll(n => n.props.accessibilityLabel === 'Edit Game' && typeof n.props.onPress === 'function')[0].props.onPress();
    }); // opens the edit wizard
    await press(root, 'Next'); // step 1 -> 2
    await press(root, 'Next'); // step 2 -> 3 (capacity)
    const next = root.findAll(n => n.props.accessibilityLabel === 'Next' && typeof n.props.onPress === 'function')[0];
    expect(next.props.disabled).toBeFalsy();
  });
});

describe('user menu on a player picture (game context)', () => {
  const people = [person('u-1', 'Alice', 'going'), person('u-2', 'Bob', 'going')];
  const pressable = (root: Instance, index: number): Instance =>
    avatars(root)[index].findAll(n => typeof n.props.onPress === 'function' && typeof n.props.onLongPress === 'function')[0];

  it('a tap opens View Details without a card request', async () => {
    const root = await mount(rawEvent(), people);
    await act(async () => pressable(root, 0).props.onPress());
    expect(root.findAll(n => n.props?.testID === 'user-details' && typeof n.type === 'string')).toHaveLength(1);
    expect(mockGet.mock.calls.some(c => String(c[0]).endsWith('/card'))).toBe(false);
  });

  it('a long-press fetches this game\'s card for that player and offers the server action', async () => {
    const root = await mount(rawEvent(), people);
    await act(async () => pressable(root, 0).props.onLongPress());
    expect(mockGet.mock.calls.some(c => c[0] === '/events/evt-1/players/u-1/card')).toBe(true);
    expect(root.findAll(n => n.props?.accessibilityLabel === 'Remove player' && typeof n.type === 'string').length).toBeGreaterThan(0);
  });
});
