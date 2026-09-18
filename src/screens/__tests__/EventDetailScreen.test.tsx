/**
 * Regression test for organiser detection on the Event Detail screen.
 *
 * Bug: the RSVP/Cancel gates read `event.is_organiser`, which
 * `mapEventApiItem` always sets to `false` (the endpoint has no such field).
 * Result: organisers saw "Join" on their own events, and "Cancel Event"
 * appeared for nobody.
 *
 * Only the HTTP client is mocked — the REAL `getEvent()` / `mapEventApiItem`
 * runs, so the fixture carries the exact stub value production produces
 * instead of a hand-set `is_organiser`. Signed-in user id: `user-me`.
 *
 * RSVP/withdraw contract fix: Join and Leave both POST `/events/{id}/rsvp`
 * with `{ action: "going" }` / `{ action: "withdrawn" }` (no `/withdraw`
 * path exists). Cancel Event is NOT rendered for anyone until a
 * cancellation-reason UI exists (`EventCancelRequest.reason` is required).
 */
import React from 'react';

import { apiClient } from '../../api/client';
import {
  act,
  pressableLabelled,
  renderAsync,
  texts,
} from '../../test-utils/render';
import type { Instance } from '../../test-utils/render';
import EventDetailScreen from '../EventDetailScreen';

jest.mock('../../api/client', () => ({
  apiClient: { get: jest.fn(), post: jest.fn() },
}));

let mockUser: { id: string; nickname: string } | null = { id: 'user-me', nickname: 'Sam' };
jest.mock('../../auth/AuthContext', () => ({
  useAuth: () => ({ user: mockUser }),
}));

const mockGet = apiClient.get as jest.Mock;
const mockPost = apiClient.post as jest.Mock;
const goBack = jest.fn();

/** Raw `EventResponse` wire shape (subset the mapper reads). */
function rawEvent(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'evt-1',
    organizer_id: 'someone-else',
    sport: 'badminton',
    title: 'Friday night doubles',
    description: 'Bring a racket',
    visibility: 'public',
    capacity: 12,
    starts_at: '2026-09-25T18:00:00Z',
    ends_at: '2026-09-25T20:00:00Z',
    estimated_cost_cents: null,
    recurrence_rule_id: null,
    status: 'upcoming',
    venue_name: 'Riverside Courts',
    venue_address: null,
    organizer_nickname: 'Pat',
    organizer_display_name: null,
    going_count: 5,
    user_rsvp_status: null,
    ...overrides,
  };
}

async function mount(raw: Record<string, unknown>): Promise<Instance> {
  mockGet.mockResolvedValue({ data: raw });
  const props = {
    route: { key: 'k', name: 'EventDetail', params: { eventId: 'evt-1' } },
    navigation: { goBack },
  } as unknown as React.ComponentProps<typeof EventDetailScreen>;
  return renderAsync(<EventDetailScreen {...props} />);
}

const has = (root: Instance, label: string): boolean => texts(root).includes(label);

beforeEach(() => {
  mockUser = { id: 'user-me', nickname: 'Sam' };
  goBack.mockReset();
  mockGet.mockReset();
  mockPost.mockReset().mockResolvedValue({ data: {} });
});

describe('organiser (organizer_id === signed-in user id)', () => {
  it('does NOT see "Join" or "Cancel Event" (Cancel hidden until reason UI exists)', async () => {
    const root = await mount(rawEvent({ organizer_id: 'user-me' }));
    expect(has(root, 'Cancel Event')).toBe(false);
    expect(has(root, 'Join')).toBe(false);
    expect(has(root, 'Leave')).toBe(false);
  });

  it('sees no RSVP control and no Cancel even when they also have an RSVP row (going)', async () => {
    const root = await mount(rawEvent({ organizer_id: 'user-me', user_rsvp_status: 'going' }));
    expect(has(root, 'Cancel Event')).toBe(false);
    expect(has(root, 'Leave')).toBe(false);
    expect(has(root, 'Join')).toBe(false);
  });

  it('does not see Cancel for an in-progress (active) event either', async () => {
    const root = await mount(rawEvent({ organizer_id: 'user-me', status: 'active' }));
    expect(has(root, 'Cancel Event')).toBe(false);
  });

  it.each(['cancelled', 'completed'])(
    'sees neither Cancel nor Join on a %s event',
    async status => {
      const root = await mount(rawEvent({ organizer_id: 'user-me', status }));
      expect(has(root, 'Cancel Event')).toBe(false);
      expect(has(root, 'Join')).toBe(false);
    },
  );
});

describe('non-organiser', () => {
  it('sees "Join" and does NOT see "Cancel Event"', async () => {
    const root = await mount(rawEvent({ organizer_id: 'someone-else' }));
    expect(has(root, 'Join')).toBe(true);
    expect(has(root, 'Cancel Event')).toBe(false);
  });

  it('sees "Leave" (not Cancel) when already going', async () => {
    const root = await mount(rawEvent({ user_rsvp_status: 'going' }));
    expect(has(root, 'Leave')).toBe(true);
    expect(has(root, 'Cancel Event')).toBe(false);
    expect(has(root, 'Join')).toBe(false);
  });

  it.each(['cancelled', 'completed'])('sees no RSVP control on a %s event', async status => {
    const root = await mount(rawEvent({ status }));
    expect(has(root, 'Join')).toBe(false);
    expect(has(root, 'Leave')).toBe(false);
    expect(has(root, 'Cancel Event')).toBe(false);
  });

  it('is never treated as organiser when there is no signed-in user', async () => {
    mockUser = null;
    const root = await mount(rawEvent({ organizer_id: 'someone-else' }));
    expect(has(root, 'Join')).toBe(true);
    expect(has(root, 'Cancel Event')).toBe(false);
  });
});

describe('the stub it works around', () => {
  it('the real mapper still yields is_organiser=false for an organiser (precondition of the bug)', async () => {
    // Guards the premise: if the mapper ever starts setting the flag, this
    // test should be revisited, not silently keep passing for the wrong reason.
    const { getEvent } = jest.requireActual('../../api/events') as typeof import('../../api/events');
    mockGet.mockResolvedValue({ data: rawEvent({ organizer_id: 'user-me' }) });
    const event = await getEvent('evt-1');
    expect(event.is_organiser).toBe(false);
    expect(event.organiser_id).toBe('user-me');
  });

  it('still honours is_organiser if the mapper ever supplies it (forward compatible)', async () => {
    // Not reachable via the real mapper today; verified through the pure rule.
    const { isOrganiserOf } = jest.requireActual('../../utils/homeDashboard') as typeof import('../../utils/homeDashboard');
    const { getEvent } = jest.requireActual('../../api/events') as typeof import('../../api/events');
    mockGet.mockResolvedValue({ data: rawEvent() });
    const event = { ...(await getEvent('evt-1')), is_organiser: true };
    expect(isOrganiserOf(event, 'user-me')).toBe(true);
  });
});

describe('RSVP / withdraw contract', () => {
  it('Join sends POST /events/{id}/rsvp with { action: "going" }', async () => {
    const root = await mount(rawEvent({ user_rsvp_status: null }));
    await act(async () => {
      pressableLabelled(root, 'Join').props.onPress();
    });
    expect(mockPost).toHaveBeenCalledTimes(1);
    expect(mockPost.mock.calls[0][0]).toBe('/events/evt-1/rsvp');
    expect(mockPost.mock.calls[0][1]).toEqual({ action: 'going' });
  });

  it('Leave sends POST /events/{id}/rsvp with { action: "withdrawn" }', async () => {
    const root = await mount(rawEvent({ user_rsvp_status: 'going' }));
    await act(async () => {
      pressableLabelled(root, 'Leave').props.onPress();
    });
    expect(mockPost).toHaveBeenCalledTimes(1);
    expect(mockPost.mock.calls[0][0]).toBe('/events/evt-1/rsvp');
    expect(mockPost.mock.calls[0][1]).toEqual({ action: 'withdrawn' });
  });

  it('Join and Leave hit the same endpoint; nothing ever calls /withdraw or /cancel', async () => {
    const joinRoot = await mount(rawEvent({ user_rsvp_status: null }));
    await act(async () => {
      pressableLabelled(joinRoot, 'Join').props.onPress();
    });
    const leaveRoot = await mount(rawEvent({ user_rsvp_status: 'going' }));
    await act(async () => {
      pressableLabelled(leaveRoot, 'Leave').props.onPress();
    });
    const paths = mockPost.mock.calls.map(call => call[0]);
    expect(paths).toEqual(['/events/evt-1/rsvp', '/events/evt-1/rsvp']);
    expect(paths.some((p: string) => p.includes('/withdraw') || p.includes('/cancel'))).toBe(false);
  });

  it('shows the join error when the RSVP request fails', async () => {
    mockPost.mockRejectedValue(new Error('422'));
    const root = await mount(rawEvent({ user_rsvp_status: null }));
    await act(async () => {
      pressableLabelled(root, 'Join').props.onPress();
    });
    expect(has(root, 'Could not join this event. Please try again.')).toBe(true);
  });
});
