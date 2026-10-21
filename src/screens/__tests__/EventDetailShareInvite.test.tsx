/**
 * Regression for tl-r1m-game-restore: commit 5f04b95 removed Share, Invite Group,
 * Invite Individual and email invite from EventDetailScreen. Organiser-only.
 * Since game-view-redesign GV-5 the entries are "Invite groups" / "Invite players" on the Invite
 * card and open the invite picker (one "Send n invites" button; AD-4 client loop).
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
          accessibilityLabel="Pick Bea"
          onPress={() => onSelect({ id: 'u-2', nickname: 'bea', display_name: 'Bea D' })}
        >
          <Text>Pick Bea</Text>
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
  it('shows the Invite card with Invite groups, Invite players and Share for the organiser', async () => {
    const root = await mount(rawEvent());
    expect(has(root, 'Invite')).toBe(true);
    expect(has(root, 'Invite groups')).toBe(true);
    expect(has(root, 'Invite players')).toBe(true);
    expect(has(root, 'Share app link')).toBe(true);
  });

  it('hides them for a non-organiser', async () => {
    const root = await mount(rawEvent({ organizer_id: 'someone-else' }));
    expect(has(root, 'Invite groups')).toBe(false);
    expect(has(root, 'Invite players')).toBe(false);
    expect(has(root, 'Share app link')).toBe(false);
  });

  it('hides them on a cancelled event', async () => {
    const root = await mount(rawEvent({ status: 'cancelled' }));
    expect(has(root, 'Invite players')).toBe(false);
    expect(has(root, 'Share app link')).toBe(false);
  });

  it('Share opens the share sheet', async () => {
    const root = await mount(rawEvent());
    await act(async () => {
      pressableLabelled(root, 'Share app link').props.onPress();
    });
    expect(root.findAll(n => n.props?.visible === true && n.props?.onCopyLink).length).toBeGreaterThan(0);
  });

  it('Invite players posts invite-user for a staged user (one Send)', async () => {
    const root = await mount(rawEvent());
    await act(async () => {
      pressableLabelled(root, 'Invite players').props.onPress();
    });
    await act(async () => {
      pressableLabelled(root, 'Pick Alex').props.onPress();
    });
    await act(async () => {
      pressableLabelled(root, 'Send 1 invites').props.onPress();
    });
    expect(mockPost).toHaveBeenCalledWith(
      '/events/evt-1/invite-user',
      { user_id: 'u-1' },
      expect.anything(),
    );
  });

  it('Invite players posts invite-email for a staged email', async () => {
    const root = await mount(rawEvent());
    await act(async () => {
      pressableLabelled(root, 'Invite players').props.onPress();
    });
    await act(async () => {
      pressableLabelled(root, 'Pick Email').props.onPress();
    });
    await act(async () => {
      pressableLabelled(root, 'Send 1 invites').props.onPress();
    });
    expect(mockPost).toHaveBeenCalledWith(
      '/events/evt-1/invite-email',
      { email: 'new@example.com' },
      expect.anything(),
    );
  });

  it('T4: several staged players and an email send once: invite-user per user, invite-email per email, one correlation id', async () => {
    const root = await mount(rawEvent());
    await act(async () => {
      pressableLabelled(root, 'Invite players').props.onPress();
    });
    await act(async () => {
      pressableLabelled(root, 'Pick Alex').props.onPress();
    });
    await act(async () => {
      pressableLabelled(root, 'Pick Bea').props.onPress();
    });
    await act(async () => {
      pressableLabelled(root, 'Pick Email').props.onPress();
    });
    await act(async () => {
      pressableLabelled(root, 'Send 3 invites').props.onPress();
    });
    const calls = mockPost.mock.calls.filter(c => String(c[0]).startsWith('/events/evt-1/invite-'));
    expect(calls.map(c => [c[0], c[1]])).toEqual([
      ['/events/evt-1/invite-user', { user_id: 'u-1' }],
      ['/events/evt-1/invite-user', { user_id: 'u-2' }],
      ['/events/evt-1/invite-email', { email: 'new@example.com' }],
    ]);
    const ids = new Set(calls.map(c => (c[2] as { correlationId: string }).correlationId));
    expect(ids.size).toBe(1);
  });

  it('T4: a failed entry is reported by name, stays staged, and the others stand', async () => {
    mockPost.mockImplementation((url: string, body: { user_id?: string }) =>
      url.endsWith('/invite-user') && body.user_id === 'u-2'
        ? Promise.reject({ response: { status: 409, data: { detail: 'Already invited' } } })
        : Promise.resolve({ data: {} }),
    );
    const root = await mount(rawEvent());
    await act(async () => {
      pressableLabelled(root, 'Invite players').props.onPress();
    });
    await act(async () => {
      pressableLabelled(root, 'Pick Alex').props.onPress();
    });
    await act(async () => {
      pressableLabelled(root, 'Pick Bea').props.onPress();
    });
    await act(async () => {
      pressableLabelled(root, 'Send 2 invites').props.onPress();
    });
    expect(mockPost).toHaveBeenCalledTimes(2);
    const error = root.find(n => n.props.testID === 'invite-picker-error' && typeof n.type === 'string');
    expect(texts(error).join(' ')).toContain('Could not invite: Bea D');
    expect(texts(error).join(' ')).toContain('Already invited');
    // Alex went out; Bea is the only one still staged.
    expect(has(root, 'Send 1 invites')).toBe(true);
  });
});
