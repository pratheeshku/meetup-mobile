/** Join: the backend's error detail is shown (generic message only as fallback); no Join on cancelled games. */
import React from 'react';

import { apiClient } from '../../api/client';
import { act, pressableLabelled, renderAsync, texts } from '../../test-utils/render';
import type { Instance } from '../../test-utils/render';
import { __resetSportDisplayNamesCacheForTests } from '../../utils/labels';
import EventDetailScreen from '../EventDetailScreen';

jest.mock('../../api/client', () => ({ apiClient: { get: jest.fn(), patch: jest.fn(), post: jest.fn() } }));
jest.mock('../../auth/AuthContext', () => ({ useAuth: () => ({ user: { id: 'user-me', nickname: 'Sam' } }) }));

const mockGet = apiClient.get as jest.Mock;
const mockPost = apiClient.post as jest.Mock;

const rawEvent = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  id: 'evt-1', organizer_id: 'someone-else', sport: 'badminton', title: 'Friday doubles', visibility: 'public',
  capacity: 12, starts_at: '2999-09-25T18:00:00Z', ends_at: '2999-09-25T20:00:00Z', allow_waitlist: true,
  status: 'upcoming', venue_name: 'Hall', going_count: 5, user_rsvp_status: null, skill_level_requirement: 'all_levels',
  ...overrides,
});

async function mount(overrides: Record<string, unknown> = {}): Promise<Instance> {
  mockGet.mockImplementation((url: string) =>
    Promise.resolve({ data: url.includes('/participants') ? [] : rawEvent(overrides) }),
  );
  const props = {
    route: { key: 'k', name: 'EventDetail', params: { eventId: 'evt-1' } },
    navigation: { goBack: jest.fn() },
  } as unknown as React.ComponentProps<typeof EventDetailScreen>;
  return renderAsync(<EventDetailScreen {...props} />);
}
const has = (root: Instance, label: string): boolean => texts(root).includes(label);
const join = async (root: Instance): Promise<void> => {
  await act(async () => {
    pressableLabelled(root, 'Join').props.onPress();
  });
};

beforeEach(() => {
  mockGet.mockReset();
  mockPost.mockReset().mockResolvedValue({ data: {} });
  __resetSportDisplayNamesCacheForTests();
});

describe('Join errors', () => {
  it('shows the 400 skill-level detail', async () => {
    const detail = 'Your skill level (beginner) does not meet this game\'s requirement (expert)';
    mockPost.mockRejectedValueOnce({ response: { status: 400, data: { detail } } });
    const root = await mount();
    await join(root);
    expect(has(root, detail)).toBe(true);
    expect(has(root, 'Could not join this game. Please try again.')).toBe(false);
  });

  it('shows the 403 membership detail', async () => {
    const detail = 'You must be a member of the group to join this game';
    mockPost.mockRejectedValueOnce({ response: { status: 403, data: { detail } } });
    const root = await mount();
    await join(root);
    expect(has(root, detail)).toBe(true);
    expect(has(root, 'Could not join this game. Please try again.')).toBe(false);
  });

  it.each([
    ['no detail (400)', { response: { status: 400, data: {} } }],
    ['a network error', new Error('network')],
    ['a 500', { response: { status: 500, data: { detail: 'internal trace' } } }],
  ])('falls back to the generic message for %s', async (_n, error) => {
    mockPost.mockRejectedValueOnce(error);
    const root = await mount();
    await join(root);
    expect(has(root, 'Could not join this game. Please try again.')).toBe(true);
    expect(has(root, 'internal trace')).toBe(false);
  });

  it('clears the error on the next attempt', async () => {
    mockPost.mockRejectedValueOnce({ response: { status: 400, data: { detail: 'Nope' } } });
    const root = await mount();
    await join(root);
    expect(has(root, 'Nope')).toBe(true);
    await join(root);
    expect(has(root, 'Nope')).toBe(false);
  });
});

describe('Join button on cancelled games', () => {
  it('is hidden for a cancelled game', async () => {
    const root = await mount({ status: 'cancelled' });
    expect(root.findAll(n => n.props.accessibilityLabel === 'Join' && typeof n.props.onPress === 'function')).toHaveLength(0);
  });

  it('is shown for an upcoming game', async () => {
    const root = await mount();
    expect(pressableLabelled(root, 'Join')).toBeDefined();
  });

  it('keeps Leave for a cancelled game the user had joined', async () => {
    const root = await mount({ status: 'cancelled', user_rsvp_status: 'going' });
    expect(pressableLabelled(root, 'Leave')).toBeDefined();
  });
});
