/**
 * Regression for tl-r1m-game-restore: commit 5f04b95 removed Share, Invite Group,
 * Invite Individual and email invite from EventDetailScreen. Organiser-only.
 */
import React from 'react';

import { apiClient } from '../../api/client';
import { act, pressableLabelled, renderAsync, texts } from '../../test-utils/render';
import type { Instance } from '../../test-utils/render';
import { __resetSportDisplayNamesCacheForTests } from '../../utils/labels';
import EventDetailScreen from '../EventDetailScreen';

jest.mock('../../api/client', () => ({
  apiClient: { get: jest.fn(), patch: jest.fn(), post: jest.fn() },
}));

jest.mock('../../auth/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'user-me', nickname: 'Sam' } }),
}));

jest.mock('../../components/UserSearchPicker', () => {
  const { Pressable, Text } = require('react-native');
  return function MockUserSearchPicker({ onSelect, onSelectEmail }: any) {
    return (
      <>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Pick Alex"
          onPress={() => onSelect({ id: 'u-1', nickname: 'alex', display_name: 'Alex C' })}
        >
          <Text>Pick Alex</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Pick Email"
          onPress={() => onSelectEmail('new@example.com')}
        >
          <Text>Pick Email</Text>
        </Pressable>
      </>
    );
  };
});

const mockGet = apiClient.get as jest.Mock;
const mockPost = apiClient.post as jest.Mock;

function rawEvent(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'evt-1',
    organizer_id: 'user-me',
    sport: 'badminton',
    title: 'Friday night doubles',
    visibility: 'public',
    capacity: 12,
    starts_at: '2026-09-25T18:00:00Z',
    ends_at: '2026-09-25T20:00:00Z',
    allow_waitlist: true,
    status: 'upcoming',
    venue_name: 'Riverside Courts',
    going_count: 5,
    user_rsvp_status: null,
    skill_level_requirement: 'all_levels',
    ...overrides,
  };
}

async function mount(raw: Record<string, unknown>): Promise<Instance> {
  mockGet.mockImplementation((url: string) =>
    Promise.resolve({ data: url.includes('/participants') ? [] : raw }),
  );
  const props = {
    route: { key: 'k', name: 'EventDetail', params: { eventId: 'evt-1' } },
    navigation: { goBack: jest.fn() },
  } as unknown as React.ComponentProps<typeof EventDetailScreen>;
  return renderAsync(<EventDetailScreen {...props} />);
}

const has = (root: Instance, label: string): boolean => texts(root).includes(label);

beforeEach(() => {
  mockGet.mockReset();
  mockPost.mockReset().mockResolvedValue({ data: {} });
  __resetSportDisplayNamesCacheForTests();
});

describe('EventDetailScreen share + invite (organiser)', () => {
  it('shows Invite Group, Invite Player and Share for the organiser', async () => {
    const root = await mount(rawEvent());
    expect(has(root, 'Invite Group')).toBe(true);
    expect(has(root, 'Invite Player')).toBe(true);
    expect(has(root, 'Share app link')).toBe(true);
  });

  it('hides them for a non-organiser', async () => {
    const root = await mount(rawEvent({ organizer_id: 'someone-else' }));
    expect(has(root, 'Invite Group')).toBe(false);
    expect(has(root, 'Invite Player')).toBe(false);
    expect(has(root, 'Share app link')).toBe(false);
  });

  it('hides them on a cancelled event', async () => {
    const root = await mount(rawEvent({ status: 'cancelled' }));
    expect(has(root, 'Invite Player')).toBe(false);
    expect(has(root, 'Share app link')).toBe(false);
  });

  it('Share opens the share sheet', async () => {
    const root = await mount(rawEvent());
    await act(async () => {
      pressableLabelled(root, 'Share app link').props.onPress();
    });
    expect(root.findAll(n => n.props?.visible === true && n.props?.onCopyLink).length).toBeGreaterThan(0);
  });

  it('Invite Player posts invite-user for a picked user', async () => {
    const root = await mount(rawEvent());
    await act(async () => {
      pressableLabelled(root, 'Invite Player').props.onPress();
    });
    await act(async () => {
      pressableLabelled(root, 'Pick Alex').props.onPress();
    });
    await act(async () => {
      pressableLabelled(root, 'Send Invite').props.onPress();
    });
    expect(mockPost).toHaveBeenCalledWith(
      '/events/evt-1/invite-user',
      { user_id: 'u-1' },
      expect.anything(),
    );
  });

  it('Invite Player posts invite-email for a picked email', async () => {
    const root = await mount(rawEvent());
    await act(async () => {
      pressableLabelled(root, 'Invite Player').props.onPress();
    });
    await act(async () => {
      pressableLabelled(root, 'Pick Email').props.onPress();
    });
    await act(async () => {
      pressableLabelled(root, 'Send Invite').props.onPress();
    });
    expect(mockPost).toHaveBeenCalledWith(
      '/events/evt-1/invite-email',
      { email: 'new@example.com' },
      expect.anything(),
    );
  });
});
