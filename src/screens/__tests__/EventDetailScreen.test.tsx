/**
 * Event Detail Screen tests:
 * - Organiser detection & action gates (Cancel, Edit, Group Invite)
 * - RSVP Join/Leave contract (both use POST /events/{id}/rsvp)
 * - Cancel flow (POST /events/{id}/cancel with required reason)
 * - Edit flow (PATCH /events/{id}, full field set, 409 handling)
 * - Group Invite flow (POST /events/{id}/invite-group)
 * - Sport label display lookup (BUG-M02)
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
import { __resetSportDisplayNamesCacheForTests } from '../../utils/labels';
import EventDetailScreen from '../EventDetailScreen';

jest.mock('../../api/client', () => ({
  apiClient: { get: jest.fn(), patch: jest.fn(), post: jest.fn() },
}));

let mockUser: { id: string; nickname: string } | null = { id: 'user-me', nickname: 'Sam' };
jest.mock('../../auth/AuthContext', () => ({
  useAuth: () => ({ user: mockUser }),
}));

const mockGet = apiClient.get as jest.Mock;
const mockPost = apiClient.post as jest.Mock;
const mockPatch = apiClient.patch as jest.Mock;
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
    venue_address: '123 River Rd',
    organizer_nickname: 'Pat',
    organizer_display_name: null,
    going_count: 5,
    user_rsvp_status: null,
    skill_level_requirement: 'all_levels',
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
  mockPatch.mockReset().mockResolvedValue({ data: rawEvent({ organizer_id: 'user-me' }) });
  __resetSportDisplayNamesCacheForTests();
});

it('resolves the sport slug to its display_name from GET /admin/sports/public (BUG-M02)', async () => {
  mockGet.mockImplementation((url: string) => {
    if (url === '/admin/sports/public') {
      return Promise.resolve({
        data: [{ id: '1', name: 'badminton', slug: 'badminton', display_name: 'Badminton', is_active: true }],
      });
    }
    return Promise.resolve({ data: rawEvent() });
  });
  const props = {
    route: { key: 'k', name: 'EventDetail', params: { eventId: 'evt-1' } },
    navigation: { goBack },
  } as unknown as React.ComponentProps<typeof EventDetailScreen>;
  const root = await renderAsync(<EventDetailScreen {...props} />);
  expect(texts(root)).toContain('Badminton · Riverside Courts');
});

describe('organiser (organizer_id === signed-in user id)', () => {
  it('sees "Edit Event", "Invite Group", and "Cancel Event", but not "Join" or "Leave"', async () => {
    const root = await mount(rawEvent({ organizer_id: 'user-me' }));
    expect(has(root, 'Cancel Event')).toBe(true);
    expect(has(root, 'Edit Event')).toBe(true);
    expect(has(root, 'Invite Group')).toBe(true);
    expect(has(root, 'Join')).toBe(false);
    expect(has(root, 'Leave')).toBe(false);
  });

  it('sees organiser controls and no RSVP control even when they also have an RSVP row (going)', async () => {
    const root = await mount(rawEvent({ organizer_id: 'user-me', user_rsvp_status: 'going' }));
    expect(has(root, 'Cancel Event')).toBe(true);
    expect(has(root, 'Edit Event')).toBe(true);
    expect(has(root, 'Invite Group')).toBe(true);
    expect(has(root, 'Leave')).toBe(false);
    expect(has(root, 'Join')).toBe(false);
  });

  it('sees organiser actions for an in-progress (active) event', async () => {
    const root = await mount(rawEvent({ organizer_id: 'user-me', status: 'active' }));
    expect(has(root, 'Cancel Event')).toBe(true);
    expect(has(root, 'Edit Event')).toBe(true);
    expect(has(root, 'Invite Group')).toBe(true);
  });

  it.each(['cancelled', 'completed'])(
    'sees neither organiser actions nor Join on a %s event',
    async status => {
      const root = await mount(rawEvent({ organizer_id: 'user-me', status }));
      expect(has(root, 'Cancel Event')).toBe(false);
      expect(has(root, 'Edit Event')).toBe(false);
      expect(has(root, 'Invite Group')).toBe(false);
      expect(has(root, 'Join')).toBe(false);
    },
  );
});

describe('non-organiser', () => {
  it('sees "Join" and does NOT see organiser actions', async () => {
    const root = await mount(rawEvent({ organizer_id: 'someone-else' }));
    expect(has(root, 'Join')).toBe(true);
    expect(has(root, 'Cancel Event')).toBe(false);
    expect(has(root, 'Edit Event')).toBe(false);
    expect(has(root, 'Invite Group')).toBe(false);
  });

  it('sees "Leave" (not Cancel) when already going', async () => {
    const root = await mount(rawEvent({ user_rsvp_status: 'going' }));
    expect(has(root, 'Leave')).toBe(true);
    expect(has(root, 'Cancel Event')).toBe(false);
    expect(has(root, 'Edit Event')).toBe(false);
    expect(has(root, 'Invite Group')).toBe(false);
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
    const { getEvent } = jest.requireActual('../../api/events') as typeof import('../../api/events');
    mockGet.mockResolvedValue({ data: rawEvent({ organizer_id: 'user-me' }) });
    const event = await getEvent('evt-1');
    expect(event.is_organiser).toBe(false);
    expect(event.organiser_id).toBe('user-me');
  });

  it('still honours is_organiser if the mapper ever supplies it (forward compatible)', async () => {
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

  it('shows the join error when the RSVP request fails', async () => {
    mockPost.mockRejectedValue(new Error('422'));
    const root = await mount(rawEvent({ user_rsvp_status: null }));
    await act(async () => {
      pressableLabelled(root, 'Join').props.onPress();
    });
    expect(has(root, 'Could not join this event. Please try again.')).toBe(true);
  });
});

describe('BUILD 1: Event Cancel Flow', () => {
  it('opens cancel form and rejects empty cancellation reason', async () => {
    const root = await mount(rawEvent({ organizer_id: 'user-me' }));
    await act(async () => {
      pressableLabelled(root, 'Cancel Event').props.onPress();
    });
    expect(has(root, 'Confirm Cancellation')).toBe(true);

    // Try submitting without typing a reason
    await act(async () => {
      pressableLabelled(root, 'Confirm Cancellation').props.onPress();
    });
    expect(has(root, 'Please provide a reason for cancelling this event.')).toBe(true);
    expect(mockPost).not.toHaveBeenCalled();
  });

  it('sends POST /events/{id}/cancel with { reason } and refreshes the event to cancelled', async () => {
    const root = await mount(rawEvent({ organizer_id: 'user-me' }));
    const cancelledRaw = rawEvent({ organizer_id: 'user-me', status: 'cancelled' });
    mockPost.mockResolvedValueOnce({ data: cancelledRaw });
    // Next GET returns cancelled event
    mockGet.mockResolvedValue({ data: cancelledRaw });

    await act(async () => {
      pressableLabelled(root, 'Cancel Event').props.onPress();
    });

    const input = root.findByProps({ accessibilityLabel: 'Cancellation Reason' });
    await act(async () => {
      input.props.onChangeText('Heavy rainfall, pitch flooded');
    });

    await act(async () => {
      pressableLabelled(root, 'Confirm Cancellation').props.onPress();
    });

    expect(mockPost).toHaveBeenCalledWith(
      '/events/evt-1/cancel',
      { reason: 'Heavy rainfall, pitch flooded' },
      expect.any(Object),
    );
    expect(has(root, 'This event has been cancelled.')).toBe(true);
    expect(has(root, 'Cancel Event')).toBe(false);
  });

  it('surfaces backend cancel error via getApiErrorMessage', async () => {
    mockPost.mockRejectedValueOnce({
      response: { status: 400, data: { detail: 'Event is already cancelled' } },
    });

    const root = await mount(rawEvent({ organizer_id: 'user-me' }));
    await act(async () => {
      pressableLabelled(root, 'Cancel Event').props.onPress();
    });

    const input = root.findByProps({ accessibilityLabel: 'Cancellation Reason' });
    await act(async () => {
      input.props.onChangeText('Change of plans');
    });

    await act(async () => {
      pressableLabelled(root, 'Confirm Cancellation').props.onPress();
    });

    expect(has(root, 'Event is already cancelled')).toBe(true);
  });

  it('closes cancel form on Close press', async () => {
    const root = await mount(rawEvent({ organizer_id: 'user-me' }));
    await act(async () => {
      pressableLabelled(root, 'Cancel Event').props.onPress();
    });
    expect(has(root, 'Confirm Cancellation')).toBe(true);

    await act(async () => {
      pressableLabelled(root, 'Close').props.onPress();
    });
    expect(has(root, 'Confirm Cancellation')).toBe(false);
    expect(has(root, 'Cancel Event')).toBe(true);
  });
});

describe('BUILD 2: Event Edit Flow', () => {
  it('opens edit form pre-populated with current event values', async () => {
    const root = await mount(
      rawEvent({
        organizer_id: 'user-me',
        title: 'Original Title',
        venue_name: 'Original Venue',
        venue_address: '100 Main St',
        capacity: 16,
      }),
    );

    await act(async () => {
      pressableLabelled(root, 'Edit Event').props.onPress();
    });

    expect(has(root, 'Save Changes')).toBe(true);
    const titleInput = root.findByProps({ accessibilityLabel: 'Event Title' });
    expect(titleInput.props.value).toBe('Original Title');

    const venueNameInput = root.findByProps({ accessibilityLabel: 'Venue Name' });
    expect(venueNameInput.props.value).toBe('Original Venue');

    const venueAddressInput = root.findByProps({ accessibilityLabel: 'Venue Address' });
    expect(venueAddressInput.props.value).toBe('100 Main St');
  });

  it('validates empty title and invalid capacity client-side before sending', async () => {
    const root = await mount(rawEvent({ organizer_id: 'user-me' }));
    await act(async () => {
      pressableLabelled(root, 'Edit Event').props.onPress();
    });

    const titleInput = root.findByProps({ accessibilityLabel: 'Event Title' });
    await act(async () => {
      titleInput.props.onChangeText('   ');
    });

    await act(async () => {
      pressableLabelled(root, 'Save Changes').props.onPress();
    });
    expect(has(root, 'Title cannot be empty.')).toBe(true);
    expect(mockPatch).not.toHaveBeenCalled();

    await act(async () => {
      titleInput.props.onChangeText('Valid Title');
    });
    const capInput = root.findByProps({ accessibilityLabel: 'Capacity' });
    await act(async () => {
      capInput.props.onChangeText('0');
    });

    await act(async () => {
      pressableLabelled(root, 'Save Changes').props.onPress();
    });
    expect(has(root, 'Capacity must be a positive number.')).toBe(true);
    expect(mockPatch).not.toHaveBeenCalled();
  });

  it('submits PATCH /events/{id} with full EventUpdate field set', async () => {
    const updatedRaw = rawEvent({
      organizer_id: 'user-me',
      title: 'Edited Title',
      venue_name: 'New Arena',
      venue_address: '200 Arena Rd',
      capacity: 20,
    });
    mockPatch.mockResolvedValueOnce({ data: updatedRaw });

    const root = await mount(rawEvent({ organizer_id: 'user-me' }));
    await act(async () => {
      pressableLabelled(root, 'Edit Event').props.onPress();
    });

    const titleInput = root.findByProps({ accessibilityLabel: 'Event Title' });
    await act(async () => {
      titleInput.props.onChangeText('Edited Title');
    });

    const venueNameInput = root.findByProps({ accessibilityLabel: 'Venue Name' });
    await act(async () => {
      venueNameInput.props.onChangeText('New Arena');
    });

    const capInput = root.findByProps({ accessibilityLabel: 'Capacity' });
    await act(async () => {
      capInput.props.onChangeText('20');
    });

    await act(async () => {
      pressableLabelled(root, 'Save Changes').props.onPress();
    });

    expect(mockPatch).toHaveBeenCalledWith(
      '/events/evt-1',
      expect.objectContaining({
        title: 'Edited Title',
        venue_name: 'New Arena',
        capacity: 20,
      }),
      expect.any(Object),
    );
    expect(has(root, 'Save Changes')).toBe(false);
    expect(has(root, 'Edited Title')).toBe(true);
  });

  it('surfaces 409 conflict when visibility transition is rejected by backend', async () => {
    mockPatch.mockRejectedValueOnce({
      response: {
        status: 409,
        data: { detail: 'Visibility is immutable after creation' },
      },
    });

    const root = await mount(rawEvent({ organizer_id: 'user-me', visibility: 'public' }));
    await act(async () => {
      pressableLabelled(root, 'Edit Event').props.onPress();
    });

    // Select Group visibility
    await act(async () => {
      pressableLabelled(root, 'Group').props.onPress();
    });

    await act(async () => {
      pressableLabelled(root, 'Save Changes').props.onPress();
    });

    expect(has(root, 'Visibility is immutable after creation')).toBe(true);
  });

  it('surfaces 409 conflict when edit is locked after event start', async () => {
    mockPatch.mockRejectedValueOnce({
      response: {
        status: 409,
        data: { detail: 'Cannot edit an event that has already started' },
      },
    });

    const root = await mount(rawEvent({ organizer_id: 'user-me' }));
    await act(async () => {
      pressableLabelled(root, 'Edit Event').props.onPress();
    });

    await act(async () => {
      pressableLabelled(root, 'Save Changes').props.onPress();
    });

    expect(has(root, 'Cannot edit an event that has already started')).toBe(true);
  });

  it('closes edit form on Cancel press without saving', async () => {
    const root = await mount(rawEvent({ organizer_id: 'user-me' }));
    await act(async () => {
      pressableLabelled(root, 'Edit Event').props.onPress();
    });
    expect(has(root, 'Save Changes')).toBe(true);

    await act(async () => {
      pressableLabelled(root, 'Cancel').props.onPress();
    });
    expect(has(root, 'Save Changes')).toBe(false);
    expect(has(root, 'Edit Event')).toBe(true);
  });
});

describe('BUILD 3: Group Invite Flow', () => {
  it('opens invite group form, loads user groups, and sends POST /events/{id}/invite-group', async () => {
    const root = await mount(rawEvent({ organizer_id: 'user-me' }));

    mockGet.mockImplementation((url: string) => {
      if (url === '/settings/groups-owned') {
        return Promise.resolve({
          data: [
            { id: 'grp-1', name: 'Badminton Club', description: '', owner_id: 'user-me', created_at: '2026-01-01' },
          ],
        });
      }
      if (url === '/settings/groups-member') {
        return Promise.resolve({
          data: [
            { id: 'grp-2', name: 'Weekend Runners', description: '', owner_id: 'other', created_at: '2026-01-01' },
          ],
        });
      }
      return Promise.resolve({ data: rawEvent({ organizer_id: 'user-me' }) });
    });

    mockPost.mockResolvedValueOnce({
      data: [{ id: 'inv-1', event_id: 'evt-1', invitee_user_id: 'u-1', status: 'pending' }],
    });

    await act(async () => {
      pressableLabelled(root, 'Invite Group').props.onPress();
    });

    expect(has(root, 'Badminton Club')).toBe(true);
    expect(has(root, 'Weekend Runners')).toBe(true);

    // Select Badminton Club
    await act(async () => {
      pressableLabelled(root, 'Badminton Club').props.onPress();
    });

    await act(async () => {
      pressableLabelled(root, 'Send Group Invite').props.onPress();
    });

    expect(mockPost).toHaveBeenCalledWith(
      '/events/evt-1/invite-group',
      { group_id: 'grp-1' },
      expect.any(Object),
    );
    expect(has(root, 'Sent 1 group invitation!')).toBe(true);
  });

  it('surfaces error when group invite request fails', async () => {
    const root = await mount(rawEvent({ organizer_id: 'user-me' }));

    mockGet.mockImplementation((url: string) => {
      if (url === '/settings/groups-owned') {
        return Promise.resolve({
          data: [
            { id: 'grp-1', name: 'Badminton Club', description: '', owner_id: 'user-me', created_at: '2026-01-01' },
          ],
        });
      }
      if (url === '/settings/groups-member') {
        return Promise.resolve({ data: [] });
      }
      return Promise.resolve({ data: rawEvent({ organizer_id: 'user-me' }) });
    });

    mockPost.mockRejectedValueOnce({
      response: {
        status: 403,
        data: { detail: 'Only group admins can invite members' },
      },
    });

    await act(async () => {
      pressableLabelled(root, 'Invite Group').props.onPress();
    });

    await act(async () => {
      pressableLabelled(root, 'Badminton Club').props.onPress();
    });

    await act(async () => {
      pressableLabelled(root, 'Send Group Invite').props.onPress();
    });

    expect(has(root, 'Only group admins can invite members')).toBe(true);
  });
});
