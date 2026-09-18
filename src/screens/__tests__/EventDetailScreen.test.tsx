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
 * Scope note: `cancelEvent` is mocked at the HTTP layer, so these tests do
 * NOT prove the cancel request is accepted by the backend. It is not: the
 * live schema requires a `reason` body that the app does not send (see the
 * Implementation Report).
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
  it('sees "Cancel Event" and does NOT see "Join"', async () => {
    const root = await mount(rawEvent({ organizer_id: 'user-me' }));
    expect(has(root, 'Cancel Event')).toBe(true);
    expect(has(root, 'Join')).toBe(false);
    expect(has(root, 'Leave')).toBe(false);
  });

  it('sees Cancel and no RSVP control even when they also have an RSVP row (going)', async () => {
    const root = await mount(rawEvent({ organizer_id: 'user-me', user_rsvp_status: 'going' }));
    expect(has(root, 'Cancel Event')).toBe(true);
    expect(has(root, 'Leave')).toBe(false);
    expect(has(root, 'Join')).toBe(false);
  });

  it('sees Cancel for an in-progress (active) event', async () => {
    const root = await mount(rawEvent({ organizer_id: 'user-me', status: 'active' }));
    expect(has(root, 'Cancel Event')).toBe(true);
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

describe('Cancel Event action (reachable for the first time)', () => {
  it('calls the cancel endpoint for this event and goes back on success', async () => {
    const root = await mount(rawEvent({ organizer_id: 'user-me' }));
    await act(async () => {
      pressableLabelled(root, 'Cancel Event').props.onPress();
    });
    expect(mockPost).toHaveBeenCalledTimes(1);
    expect(mockPost.mock.calls[0][0]).toBe('/events/evt-1/cancel');
    expect(goBack).toHaveBeenCalledTimes(1);
  });

  it('shows the existing error and stays on screen when the request fails', async () => {
    mockPost.mockRejectedValue(new Error('422'));
    const root = await mount(rawEvent({ organizer_id: 'user-me' }));
    await act(async () => {
      pressableLabelled(root, 'Cancel Event').props.onPress();
    });
    expect(has(root, 'Could not cancel this event. Please try again.')).toBe(true);
    expect(goBack).not.toHaveBeenCalled();
  });
});
