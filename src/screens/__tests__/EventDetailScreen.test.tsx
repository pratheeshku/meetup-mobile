/**
 * Event Detail Screen tests:
 * - Organiser detection & action gates (Edit and Cancel Game icons in the banner, Invite card, Share)
 * - RSVP Join/Leave contract (both use POST /events/{id}/rsvp)
 * - Delete game flow (header Cancel Game icon, bottom sheet, POST /events/{id}/cancel with the fixed host reason)
 * - Edit game wizard (4 steps, sport and visibility locked, PATCH /events/{id} changed-field set, refusals)
 * - Group Invite flow (POST /events/{id}/invite-group)
 * - Sport label display lookup (BUG-M02)
 * - Game view of DES-MEETUP-ADDENDUM-game-view-redesign (details card, Remarks, Players block, share)
 */
import React from 'react';
import { Clipboard, Linking, Platform, Share, StyleSheet, TextInput } from 'react-native';

import { apiClient } from '../../api/client';
import { colors } from '../../theme/tokens';
import {
  act,
  pressableLabelled,
  renderAsync,
  texts,
} from '../../test-utils/render';
import type { Instance } from '../../test-utils/render';
import { getShareUrl } from '../../utils/shareLink';
import { __resetSportDisplayNamesCacheForTests } from '../../utils/labels';
import EventDetailScreen from '../EventDetailScreen';

jest.mock('../../api/client', () => ({
  apiClient: { get: jest.fn(), patch: jest.fn(), post: jest.fn() },
}));

let mockUser: { id: string; nickname: string } | null = { id: 'user-me', nickname: 'Sam' };
jest.mock('../../auth/AuthContext', () => ({
  useAuth: () => ({ user: mockUser }),
}));

// The share text is the admin-label invite message (utils/shareInvite), then a blank line and the game link
// built from GET /config/client (deep-links AD-11). Labels default to none, as before.
let mockShareLabels: Record<string, string> = {};
jest.mock('../../labels/LabelsContext', () => ({
  ...jest.requireActual('../../labels/LabelsContext'),
  useLabels: () => mockShareLabels,
}));

jest.mock('../../components/UserSearchPicker', () => {
  const { Pressable, Text, View } = require('react-native');
  return function MockUserSearchPicker({ onSelect, onSelectEmail, disabled, excludeEventId }: any) {
    return (
      <View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Pick Alex"
          testID={`mock-picker-${excludeEventId}`}
          disabled={disabled}
          onPress={() => onSelect({ id: 'u-user-1', nickname: 'alex', display_name: 'Alex C' })}
        >
          <Text>Pick Alex</Text>
        </Pressable>
        {onSelectEmail ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Pick Email"
            disabled={disabled}
            onPress={() => onSelectEmail('newcomer@example.com')}
          >
            <Text>Pick Email</Text>
          </Pressable>
        ) : null}
      </View>
    );
  };
});

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
    starts_at: new Date(Date.now() + 2 * 3600 * 1000).toISOString(),
    ends_at: new Date(Date.now() + 4 * 3600 * 1000).toISOString(),
    estimated_cost_cents: null,
    estimated_cost_currency: null,
    allow_waitlist: true,
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

async function mount(
  raw: Record<string, unknown>,
  clientConfig: Record<string, unknown> = {},
): Promise<Instance> {
  mockGet.mockImplementation((url: string) => {
    if (url.includes('/participants')) {
      return Promise.resolve({ data: [] });
    }
    if (url === '/config/client') {
      return Promise.resolve({ data: clientConfig });
    }
    return Promise.resolve({ data: raw });
  });
  const props = {
    route: { key: 'k', name: 'EventDetail', params: { eventId: 'evt-1' } },
    navigation: { goBack },
  } as unknown as React.ComponentProps<typeof EventDetailScreen>;
  return renderAsync(<EventDetailScreen {...props} />);
}

const has = (root: Instance, label: string): boolean => texts(root).includes(label);

/** Header and sheet actions are icon buttons: found by accessibility label (a touchable can match twice). */
const labelled = (root: Instance, label: string): Instance[] =>
  root.findAll(n => n.props.accessibilityLabel === label && typeof n.props.onPress === 'function');
const hasLabelled = (root: Instance, label: string): boolean => labelled(root, label).length > 0;
const pressLabelled = async (root: Instance, label: string): Promise<void> => {
  const matches = labelled(root, label);
  if (matches.length === 0) {
    throw new Error(`No pressable labelled "${label}"`);
  }
  await act(async () => {
    matches[0].props.onPress();
  });
};
/** A touchable without an accessibility label (the delete sheet's buttons): found by its text. */
const pressText = async (root: Instance, text: string): Promise<void> => {
  const matches = root.findAll(n => typeof n.props.onPress === 'function' && texts(n).includes(text));
  if (matches.length === 0) {
    throw new Error(`No pressable with text "${text}"`);
  }
  await act(async () => {
    matches[0].props.onPress();
  });
};
const textInputs = (root: Instance): Instance[] => root.findAllByType(TextInput);
const typeInto = async (input: Instance, value: string): Promise<void> => {
  await act(async () => {
    input.props.onChangeText(value);
  });
};

beforeEach(() => {
  mockUser = { id: 'user-me', nickname: 'Sam' };
  mockShareLabels = {};
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
  // Game view: the banner subtitle shows the sport display name and the skill level; the venue is its own row.
  expect(texts(root)).toContain('Badminton · All levels •');
  expect(texts(root)).toContain('Riverside Courts, 123 River Rd');
});

it('does not render the retired estimated-cost fields: the game view has no Cost row (the price is the game fee)', async () => {
  const root = await mount(rawEvent({ estimated_cost_cents: 1550, estimated_cost_currency: 'USD' }));
  expect(has(root, 'Cost')).toBe(false);
  expect(has(root, '$15.50 USD')).toBe(false);
});

it('does not render Cost row when estimated_cost_cents and cost are null', async () => {
  const root = await mount(
    rawEvent({ estimated_cost_cents: null, cost: null }),
  );
  expect(has(root, 'Cost')).toBe(false);
});

it('renders without throwing when the participants endpoint resolves with a non-array', async () => {
  mockGet.mockImplementation((url: string) => {
    if (url.includes('/participants')) {
      return Promise.resolve({ data: { notAnArray: true } });
    }
    return Promise.resolve({ data: rawEvent() });
  });
  const props = {
    route: { key: 'k', name: 'EventDetail', params: { eventId: 'evt-1' } },
    navigation: { goBack },
  } as unknown as React.ComponentProps<typeof EventDetailScreen>;
  const root = await renderAsync(<EventDetailScreen {...props} />);
  expect(root).toBeDefined();
});

describe('organiser (organizer_id === signed-in user id)', () => {
  it('sees the Edit Game and Cancel Game icons, the Invite card and Share, but not Register or Decline', async () => {
    const root = await mount(rawEvent({ organizer_id: 'user-me' }));
    expect(hasLabelled(root, 'Cancel Game')).toBe(true);
    expect(hasLabelled(root, 'Edit Game')).toBe(true);
    expect(has(root, 'Invite groups')).toBe(true);
    expect(has(root, 'Invite players')).toBe(true);
    expect(hasLabelled(root, 'Share app link')).toBe(true);
    expect(has(root, 'Host')).toBe(true);
    expect(has(root, 'Register')).toBe(false);
    expect(has(root, 'Decline')).toBe(false);
  });

  it('opens Edit game in the standing-rule CTA blue (#1D5FA3), not the accent color, on its Save button', async () => {
    const root = await mount(rawEvent({ organizer_id: 'user-me' }));
    await pressLabelled(root, 'Edit Game');
    for (let step = 1; step < 4; step += 1) {
      await pressLabelled(root, 'Next');
    }
    const button = pressableLabelled(root, 'Save changes');
    const view = button.findAll(n => (n.type as unknown) === 'View')[0];
    const background = StyleSheet.flatten(view.props.style)?.backgroundColor;
    expect(background).toBe(colors.ctaBlue);
    expect(background).not.toBe(colors.accent);
  });

  it('sees organiser controls and no RSVP control even when they also have an RSVP row (going)', async () => {
    const root = await mount(rawEvent({ organizer_id: 'user-me', user_rsvp_status: 'going' }));
    expect(hasLabelled(root, 'Cancel Game')).toBe(true);
    expect(hasLabelled(root, 'Edit Game')).toBe(true);
    expect(has(root, 'Invite groups')).toBe(true);
    expect(has(root, 'Invite players')).toBe(true);
    expect(has(root, 'Decline')).toBe(false);
    expect(has(root, 'Register')).toBe(false);
  });

  it('sees organiser actions for an in-progress (active) event', async () => {
    const root = await mount(rawEvent({ organizer_id: 'user-me', status: 'active' }));
    expect(hasLabelled(root, 'Cancel Game')).toBe(true);
    expect(hasLabelled(root, 'Edit Game')).toBe(true);
    expect(has(root, 'Invite groups')).toBe(true);
    expect(has(root, 'Invite players')).toBe(true);
  });

  it.each(['cancelled', 'completed'])(
    'sees neither organiser actions nor Join on a %s event',
    async status => {
      const root = await mount(rawEvent({ organizer_id: 'user-me', status }));
      expect(hasLabelled(root, 'Cancel Game')).toBe(false);
      expect(hasLabelled(root, 'Edit Game')).toBe(false);
      expect(has(root, 'Invite groups')).toBe(false);
      expect(has(root, 'Invite players')).toBe(false);
      expect(has(root, 'Register')).toBe(false);
    },
  );
});

describe('public game: Register alone (tournament-registration TR-04, AD-3)', () => {
  const buttons = (root: Instance, id: string): Instance[] =>
    root.findAll(n => n.props.testID === id && typeof n.props.onPress === 'function');

  it('a user who has not joined sees one Register button and no Decline; group and invite-only games are unchanged', async () => {
    const pub = await mount(rawEvent({ organizer_id: 'someone-else', visibility: 'public' }));
    expect(has(pub, 'Register')).toBe(true);
    expect(has(pub, 'Join')).toBe(false);
    expect(has(pub, 'Decline')).toBe(false);
    expect(buttons(pub, 'decline-button')).toHaveLength(0);

    const group = await mount(rawEvent({ organizer_id: 'someone-else', visibility: 'group', group_ids: ['g-1'], group_names: ['Crew'] }));
    expect(has(group, 'Join')).toBe(true);
    expect(has(group, 'Decline')).toBe(true);
    expect(has(group, 'Register')).toBe(false);

    const invite = await mount(rawEvent({ organizer_id: 'someone-else', visibility: 'invite_only' }));
    expect(has(invite, 'Accept')).toBe(true);
    expect(has(invite, 'Decline')).toBe(true);
    expect(has(invite, 'Register')).toBe(false);
  });

  it('a declined public game shows Register alone', async () => {
    const root = await mount(rawEvent({ organizer_id: 'someone-else', visibility: 'public', my_declined: true }));
    expect(has(root, 'Register')).toBe(true);
    expect(has(root, 'Join')).toBe(false);
    expect(has(root, 'Decline')).toBe(false);
  });
});

describe('non-organiser', () => {
  it('sees "Join" and does NOT see organiser actions', async () => {
    const root = await mount(rawEvent({ organizer_id: 'someone-else' }));
    expect(has(root, 'Register')).toBe(true);
    expect(has(root, 'Cancel Event')).toBe(false);
    expect(has(root, 'Edit Game')).toBe(false);
    expect(has(root, 'Invite Group')).toBe(false);
    expect(has(root, 'Invite Individual')).toBe(false);
    expect(has(root, 'Share Event')).toBe(false);
  });

  it('sees "Decline" (not Cancel) when already going', async () => {
    const root = await mount(rawEvent({ user_rsvp_status: 'going' }));
    expect(has(root, 'Decline')).toBe(true);
    expect(has(root, 'Cancel Event')).toBe(false);
    expect(has(root, 'Edit Game')).toBe(false);
    expect(has(root, 'Invite Group')).toBe(false);
    expect(has(root, 'Invite Individual')).toBe(false);
    expect(has(root, 'Share Event')).toBe(false);
    expect(has(root, 'Register')).toBe(false);
  });

  it.each(['cancelled', 'completed'])('sees no RSVP control on a %s event', async status => {
    const root = await mount(rawEvent({ status }));
    expect(has(root, 'Register')).toBe(false);
    expect(has(root, 'Decline')).toBe(false);
    expect(has(root, 'Cancel Event')).toBe(false);
  });

  it('is never treated as organiser when there is no signed-in user', async () => {
    mockUser = null;
    const root = await mount(rawEvent({ organizer_id: 'someone-else' }));
    expect(has(root, 'Register')).toBe(true);
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
    const { isOrganiserOf } = jest.requireActual('../../utils/gameLists') as typeof import('../../utils/gameLists');
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
      pressableLabelled(root, 'Register').props.onPress();
    });
    expect(mockPost).toHaveBeenCalledTimes(1);
    expect(mockPost.mock.calls[0][0]).toBe('/events/evt-1/rsvp');
    expect(mockPost.mock.calls[0][1]).toEqual({ action: 'going' });
  });

  it('Decline sends POST /events/{id}/rsvp with { action: "withdrawn" }', async () => {
    const root = await mount(rawEvent({ user_rsvp_status: 'going' }));
    await act(async () => {
      pressableLabelled(root, 'Decline').props.onPress();
    });
    expect(mockPost).toHaveBeenCalledTimes(1);
    expect(mockPost.mock.calls[0][0]).toBe('/events/evt-1/rsvp');
    expect(mockPost.mock.calls[0][1]).toEqual({ action: 'withdrawn' });
  });

  it('shows the join error when the RSVP request fails', async () => {
    mockPost.mockRejectedValue(new Error('422'));
    const root = await mount(rawEvent({ user_rsvp_status: null }));
    await act(async () => {
      pressableLabelled(root, 'Register').props.onPress();
    });
    expect(has(root, 'Could not join this game. Please try again.')).toBe(true);
  });
});

describe('BUILD 1: Delete game flow (Cancel Game icon, DeleteGame board)', () => {
  it('opens the delete sheet from the Cancel Game icon, with the title and the joined count', async () => {
    const root = await mount(rawEvent({ organizer_id: 'user-me', going_count: 3 }));
    expect(has(root, 'Delete game')).toBe(false);
    await pressLabelled(root, 'Cancel Game');
    expect(has(root, 'Delete Friday night doubles?')).toBe(true);
    expect(has(root, 'Delete game')).toBe(true);
    expect(has(root, 'Keep game')).toBe(true);
    expect(texts(root).some(text => text.includes('3 players joined'))).toBe(true);
    expect(mockPost).not.toHaveBeenCalled();
  });

  it('Keep game closes the sheet without a request', async () => {
    const root = await mount(rawEvent({ organizer_id: 'user-me' }));
    await pressLabelled(root, 'Cancel Game');
    await pressText(root, 'Keep game');
    expect(has(root, 'Delete game')).toBe(false);
    expect(mockPost).not.toHaveBeenCalled();
    expect(hasLabelled(root, 'Cancel Game')).toBe(true);
  });

  it('Delete game sends POST /events/{id}/cancel with the fixed host reason (no reason is typed) and closes the sheet', async () => {
    const root = await mount(rawEvent({ organizer_id: 'user-me' }));
    await pressLabelled(root, 'Cancel Game');
    expect(textInputs(root)).toHaveLength(0);
    await pressText(root, 'Delete game');

    expect(mockPost).toHaveBeenCalledTimes(1);
    expect(mockPost).toHaveBeenCalledWith(
      '/events/evt-1/cancel',
      { reason: 'Deleted by host' },
      expect.any(Object),
    );
    expect(has(root, 'Delete game')).toBe(false);
  });

  it('surfaces a backend cancel error via getApiErrorMessage', async () => {
    mockPost.mockRejectedValueOnce({
      response: { status: 400, data: { detail: 'Event is already cancelled' } },
    });
    const root = await mount(rawEvent({ organizer_id: 'user-me' }));
    await pressLabelled(root, 'Cancel Game');
    await pressText(root, 'Delete game');
    expect(has(root, 'Event is already cancelled')).toBe(true);
  });
});

describe('BUILD 2: Edit game wizard (4 steps; sport and who can play are locked)', () => {
  const NEXT = 'Next';
  const openWizard = async (raw: Record<string, unknown> = {}): Promise<Instance> => {
    const root = await mount(rawEvent({ organizer_id: 'user-me', ...raw }));
    await pressLabelled(root, 'Edit Game');
    return root;
  };
  const toReview = async (root: Instance): Promise<void> => {
    for (let step = 1; step < 4; step += 1) {
      await pressLabelled(root, NEXT);
    }
  };

  it('opens step 1 pre-populated with the current title and the sport and visibility locked', async () => {
    const root = await openWizard({ title: 'Original Title' });
    expect(has(root, 'Edit game')).toBe(true);
    expect(has(root, 'Step 1 of 4')).toBe(true);
    expect(has(root, 'Game details')).toBe(true);
    expect(textInputs(root)[0].props.value).toBe('Original Title');
    // Sport and Who can play show their value with the locked hint, not as controls.
    expect(has(root, 'badminton')).toBe(true);
    expect(has(root, 'Who can play')).toBe(true);
    expect(texts(root).filter(text => text === "Can't be changed after creating")).toHaveLength(2);
  });

  it('validates before moving on: an empty title stays on step 1, a capacity below the minimum stays on step 3', async () => {
    const root = await openWizard();
    await typeInto(textInputs(root)[0], '   ');
    await pressLabelled(root, NEXT);
    expect(has(root, 'Title cannot be empty.')).toBe(true);
    expect(has(root, 'Step 1 of 4')).toBe(true);

    await typeInto(textInputs(root)[0], 'Valid Title');
    await pressLabelled(root, NEXT);
    expect(has(root, 'Step 2 of 4')).toBe(true);
    await pressLabelled(root, NEXT);
    expect(has(root, 'Step 3 of 4')).toBe(true);

    const capacity = root.findAll(n => (n.type as unknown) === 'TextInput' && n.props.keyboardType === 'number-pad')[0];
    await typeInto(capacity, '0');
    await pressLabelled(root, NEXT);
    expect(has(root, 'Step 3 of 4')).toBe(true);
    expect(mockPatch).not.toHaveBeenCalled();
  });

  it('has no cost or currency field and no editable visibility or sport', async () => {
    const root = await openWizard();
    expect(has(root, 'Estimated Cost')).toBe(false);
    expect(has(root, 'Currency')).toBe(false);
    expect(has(root, 'Visibility')).toBe(false);
    expect(has(root, 'Invite Only')).toBe(false);
    expect(root.findAll(n => n.props.accessibilityLabel === 'Sport')).toHaveLength(0);
  });

  it('shows the sport display name, locked, and offers no other sport (no sport chips)', async () => {
    mockGet.mockImplementation((url: string) => {
      if (url === '/admin/sports/public') {
        return Promise.resolve({
          data: [
            { id: '1', name: 'badminton', slug: 'badminton', display_name: 'Badminton', is_active: true },
            { id: '2', name: 'squash', slug: 'squash', display_name: 'Squash', is_active: true },
          ],
        });
      }
      return Promise.resolve({ data: rawEvent({ organizer_id: 'user-me', sport: 'badminton' }) });
    });
    const props = {
      route: { key: 'k', name: 'EventDetail', params: { eventId: 'evt-1' } },
      navigation: { goBack },
    } as unknown as React.ComponentProps<typeof EventDetailScreen>;
    const root = await renderAsync(<EventDetailScreen {...props} />);
    await pressLabelled(root, 'Edit Game');

    expect(has(root, 'Badminton')).toBe(true);
    expect(has(root, 'Squash')).toBe(false);
  });

  it('saves with PATCH /events/{id}: the changed fields, never sport, visibility, waitlist, cost or an unchanged venue', async () => {
    const root = await openWizard();
    await typeInto(textInputs(root)[0], 'Edited Title');
    await pressLabelled(root, NEXT); // step 2
    await pressLabelled(root, NEXT); // step 3
    const capacity = root.findAll(n => (n.type as unknown) === 'TextInput' && n.props.keyboardType === 'number-pad')[0];
    await typeInto(capacity, '20');
    await pressLabelled(root, NEXT); // step 4 (review)
    expect(has(root, 'Review changes')).toBe(true);
    await pressLabelled(root, 'Save changes');

    expect(mockPatch).toHaveBeenCalledTimes(1);
    expect(mockPatch).toHaveBeenCalledWith(
      '/events/evt-1',
      expect.objectContaining({ title: 'Edited Title', capacity: 20 }),
      expect.any(Object),
    );
    const payload = mockPatch.mock.calls[0][1];
    for (const key of ['sport', 'visibility', 'allow_waitlist', 'estimated_cost_cents', 'estimated_cost_currency', 'venue_name', 'venue_id']) {
      expect(payload).not.toHaveProperty(key);
    }
    // The wizard closes on success.
    expect(has(root, 'Edit game')).toBe(false);
  });

  it.each([
    ['a 409 with a server message shows that message', { status: 409, data: { detail: 'Cannot edit an event that has already started' } }, 'Cannot edit an event that has already started'],
    ['a 409 game_ended shows the closure label', { status: 409, data: { code: 'game_ended' } }, 'This game has ended and can no longer be changed'],
    ['a 422 start_in_past shows the closure label', { status: 422, data: { code: 'start_in_past' } }, "Start time can't be in the past"],
  ])('on save, %s', async (_name, response, message) => {
    mockPatch.mockRejectedValueOnce({ response });
    const root = await openWizard();
    await toReview(root);
    await pressLabelled(root, 'Save changes');
    expect(has(root, message)).toBe(true);
    expect(has(root, 'Review changes')).toBe(true);
  });

  it('Back on step 1 closes the wizard without saving', async () => {
    const root = await openWizard();
    expect(has(root, 'Edit game')).toBe(true);
    await pressLabelled(root, 'Back');
    expect(has(root, 'Edit game')).toBe(false);
    expect(hasLabelled(root, 'Edit Game')).toBe(true);
    expect(mockPatch).not.toHaveBeenCalled();
  });
});

/** The two groups the signed-in organiser can invite (GET /settings/groups-owned + groups-member). */
function mockInviteGroups(): void {
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
}
const joined = (root: Instance): string => texts(root).join(' | ');

describe('BUILD 3: Group Invite Flow (invite picker, GV-5)', () => {
  it('opens the picker on Groups, loads user groups, and sends POST /events/{id}/invite-group per staged group', async () => {
    const root = await mount(rawEvent({ organizer_id: 'user-me' }));
    mockInviteGroups();
    mockPost.mockResolvedValueOnce({
      data: [{ id: 'inv-1', event_id: 'evt-1', invitee_user_id: 'u-1', status: 'pending' }],
    });

    await act(async () => {
      pressableLabelled(root, 'Invite groups').props.onPress();
    });

    expect(has(root, 'Badminton Club')).toBe(true);
    expect(has(root, 'Weekend Runners')).toBe(true);
    expect(has(root, 'Available')).toBe(true);

    // Stage Badminton Club: it moves to Selected and shows "−".
    await act(async () => {
      pressableLabelled(root, 'Invite Badminton Club').props.onPress();
    });
    expect(has(root, 'Selected')).toBe(true);
    expect(pressableLabelled(root, 'Remove Badminton Club')).toBeDefined();

    await act(async () => {
      pressableLabelled(root, 'Send 1 invites').props.onPress();
    });

    expect(mockPost).toHaveBeenCalledWith(
      '/events/evt-1/invite-group',
      { group_id: 'grp-1' },
      expect.any(Object),
    );
    expect(has(root, 'Sent 1 invites')).toBe(true);
  });

  it('surfaces the failed group by name with the server message', async () => {
    const root = await mount(rawEvent({ organizer_id: 'user-me' }));
    mockInviteGroups();
    mockPost.mockRejectedValueOnce({
      response: {
        status: 403,
        data: { detail: 'Only group admins can invite members' },
      },
    });

    await act(async () => {
      pressableLabelled(root, 'Invite groups').props.onPress();
    });
    await act(async () => {
      pressableLabelled(root, 'Invite Badminton Club').props.onPress();
    });
    await act(async () => {
      pressableLabelled(root, 'Send 1 invites').props.onPress();
    });

    expect(joined(root)).toContain('Could not invite: Badminton Club');
    expect(joined(root)).toContain('Only group admins can invite members');
  });

  it('supports staging multiple groups and posts an invite for each group with one Send', async () => {
    const root = await mount(rawEvent({ organizer_id: 'user-me' }));
    mockInviteGroups();
    mockPost.mockResolvedValue({
      data: [{ id: 'inv-1', event_id: 'evt-1', invitee_user_id: 'u-1', status: 'pending' }],
    });

    await act(async () => {
      pressableLabelled(root, 'Invite groups').props.onPress();
    });
    await act(async () => {
      pressableLabelled(root, 'Invite Badminton Club').props.onPress();
    });
    await act(async () => {
      pressableLabelled(root, 'Invite Weekend Runners').props.onPress();
    });
    await act(async () => {
      pressableLabelled(root, 'Send 2 invites').props.onPress();
    });

    expect(mockPost).toHaveBeenCalledWith(
      '/events/evt-1/invite-group',
      { group_id: 'grp-1' },
      expect.any(Object),
    );
    expect(mockPost).toHaveBeenCalledWith(
      '/events/evt-1/invite-group',
      { group_id: 'grp-2' },
      expect.any(Object),
    );
    expect(has(root, 'Sent 2 invites')).toBe(true);
  });

  it('a group already shared with the game is listed under "Already in this game" with no "+"', async () => {
    const root = await mount(rawEvent({ organizer_id: 'user-me', visibility: 'group', group_ids: ['grp-1'], group_names: ['Badminton Club'] }));
    mockInviteGroups();
    await act(async () => {
      pressableLabelled(root, 'Invite groups').props.onPress();
    });
    expect(has(root, 'Already in this game')).toBe(true);
    expect(root.findAll(n => n.props.accessibilityLabel === 'Invite Badminton Club')).toHaveLength(0);
  });
});

describe('BUILD C: Individual Invite Flow (invite picker, GV-5, AD-4)', () => {
  it('opens the picker on Players and sends POST /events/{id}/invite-user with user_id', async () => {
    mockPost.mockResolvedValueOnce({
      data: { id: 'inv-u1', event_id: 'evt-1', invitee_user_id: 'u-user-1', status: 'pending' },
    });

    const root = await mount(rawEvent({ organizer_id: 'user-me' }));

    await act(async () => {
      pressableLabelled(root, 'Invite players').props.onPress();
    });

    expect(has(root, 'Pick Alex')).toBe(true);

    // Stage Alex
    await act(async () => {
      pressableLabelled(root, 'Pick Alex').props.onPress();
    });

    // One Send for everything staged.
    await act(async () => {
      pressableLabelled(root, 'Send 1 invites').props.onPress();
    });

    expect(mockPost).toHaveBeenCalledWith(
      '/events/evt-1/invite-user',
      { user_id: 'u-user-1' },
      expect.any(Object),
    );
    expect(has(root, 'Sent 1 invites')).toBe(true);
  });

  it('surfaces error when individual invite fails', async () => {
    mockPost.mockRejectedValueOnce({
      response: {
        status: 409,
        data: { detail: 'User is already invited' },
      },
    });

    const root = await mount(rawEvent({ organizer_id: 'user-me' }));

    await act(async () => {
      pressableLabelled(root, 'Invite players').props.onPress();
    });

    await act(async () => {
      pressableLabelled(root, 'Pick Alex').props.onPress();
    });

    await act(async () => {
      pressableLabelled(root, 'Send 1 invites').props.onPress();
    });

    expect(joined(root)).toContain('Could not invite: Alex C');
    expect(joined(root)).toContain('User is already invited');
  });

  it('Back closes the picker without sending', async () => {
    const root = await mount(rawEvent({ organizer_id: 'user-me' }));

    await act(async () => {
      pressableLabelled(root, 'Invite players').props.onPress();
    });
    await act(async () => {
      pressableLabelled(root, 'Pick Alex').props.onPress();
    });

    await act(async () => {
      root.find(n => n.props.testID === 'invite-picker-back' && typeof n.props.onPress === 'function').props.onPress();
    });
    expect(has(root, 'Pick Alex')).toBe(false);
    expect(mockPost).not.toHaveBeenCalled();
  });

  it('sends POST /events/{id}/invite-email when an email is staged (Decision 25)', async () => {
    mockPost.mockResolvedValueOnce({
      data: {
        id: 'inv-eml-1',
        event_id: 'evt-1',
        invited_email: 'newcomer@example.com',
        status: 'pending',
      },
    });

    const root = await mount(rawEvent({ organizer_id: 'user-me' }));

    await act(async () => {
      pressableLabelled(root, 'Invite players').props.onPress();
    });

    expect(has(root, 'Pick Email')).toBe(true);

    await act(async () => {
      pressableLabelled(root, 'Pick Email').props.onPress();
    });

    await act(async () => {
      pressableLabelled(root, 'Send 1 invites').props.onPress();
    });

    expect(mockPost).toHaveBeenCalledWith(
      '/events/evt-1/invite-email',
      { email: 'newcomer@example.com' },
      expect.any(Object),
    );
    expect(has(root, 'Sent 1 invites')).toBe(true);
  });
});

describe('Game view layout (game-view-redesign: banner, details card, Remarks, Players)', () => {
  it('renders the back button (label My Games) and calls goBack on tap', async () => {
    const root = await mount(rawEvent());
    await pressLabelled(root, 'My Games');
    expect(goBack).toHaveBeenCalledTimes(1);
  });

  it('renders the Players block with "x of y joined" and one empty spot placeholder per remaining spot', async () => {
    const root = await mount(rawEvent({ capacity: 8, going_count: 7 }));
    expect(has(root, 'Players')).toBe(true);
    expect(has(root, '7 of 8 joined')).toBe(true);
    expect(texts(root).filter(text => text === '?')).toHaveLength(1);
  });

  it('shows the description under "Remarks" (no "About this game" card, no Cost row)', async () => {
    const root = await mount(
      rawEvent({
        description: 'Casual doubles, all skill levels welcome.',
        estimated_cost_cents: 1550,
        estimated_cost_currency: 'USD',
      }),
    );
    expect(has(root, 'Remarks')).toBe(true);
    expect(has(root, 'Casual doubles, all skill levels welcome.')).toBe(true);
    expect(has(root, 'About this game')).toBe(false);
    expect(has(root, 'Cost')).toBe(false);
  });

  describe('Details card (GV-2, GV-3) and section order for a non-organizer (AD-9)', () => {
    it('a public game shows the Invite type row as "Public", then Remarks, Players and the action, in that order', async () => {
      const root = await mount(rawEvent({ visibility: 'public', skill_level_requirement: 'beginner' }));
      expect(has(root, 'Invite type')).toBe(true);
      expect(has(root, 'Public')).toBe(true);
      expect(has(root, 'Event Details')).toBe(false);
      expect(has(root, 'Visibility')).toBe(false);
      expect(has(root, 'Waitlist')).toBe(false);

      const all = texts(root);
      const order = ['Invite type', 'Remarks', 'Players', 'Register'].map(label => all.indexOf(label));
      expect(order.every(index => index > -1)).toBe(true);
      expect([...order].sort((x, y) => x - y)).toEqual(order);
    });

    it('an invite-only game with no groups shows no Invite type row to a non-organizer (AD-2) and the Accept / Decline pair', async () => {
      const root = await mount(rawEvent({ visibility: 'invite_only' }));
      expect(has(root, 'Invite type')).toBe(false);
      expect(has(root, 'Accept')).toBe(true);
      expect(has(root, 'Decline')).toBe(true);
    });

    it('a group game with no group names shows no Invite type row to a non-organizer and the Join / Decline pair', async () => {
      const root = await mount(rawEvent({ visibility: 'group' }));
      expect(has(root, 'Invite type')).toBe(false);
      expect(has(root, 'Join')).toBe(true);
      expect(has(root, 'Decline')).toBe(true);
    });
  });

  it('shows the going players as avatars with initials under Players (the Players block, AD-3)', async () => {
    mockGet.mockImplementation((url: string) => {
      if (url === '/events/evt-1/participants') {
        return Promise.resolve({
          data: [
            { id: 'p-1', user_id: 'user-me', user_nickname: 'Pratheesh K', status: 'going' },
            { id: 'p-2', user_id: 'user-2', user_nickname: 'Rahul S', status: 'going' },
          ],
        });
      }
      if (url === '/config/client') {
        return Promise.resolve({ data: {} });
      }
      return Promise.resolve({ data: rawEvent({ going_count: 2 }) });
    });

    const props = {
      route: { key: 'k', name: 'EventDetail', params: { eventId: 'evt-1' } },
      navigation: { goBack },
    } as unknown as React.ComponentProps<typeof EventDetailScreen>;
    const root = await renderAsync(<EventDetailScreen {...props} />);

    expect(has(root, 'Players')).toBe(true);
    expect(has(root, '2 of 12 joined')).toBe(true);
    const avatars = root.findAll(n => n.props.testID === 'player-avatar' && typeof n.type === 'string');
    expect(avatars).toHaveLength(2);
    expect(texts(avatars[0])).toContain('P');
    expect(texts(avatars[1])).toContain('R');
  });
});

describe('keyboard avoidance (the Edit game wizard has TextInputs; the game view itself has none)', () => {
  const originalPlatform = Platform.OS;

  afterEach(() => {
    Platform.OS = originalPlatform;
  });

  it('wraps the wizard in a KeyboardAvoidingView with padding behavior on iOS', async () => {
    Platform.OS = 'ios';
    const root = await mount(rawEvent({ organizer_id: 'user-me' }));
    await pressLabelled(root, 'Edit Game');
    const kav = root.find(n => n.props.behavior === 'padding');
    expect(kav).toBeDefined();
    expect(kav.props.behavior).toBe('padding');
  });

  it('handles the keyboard on Android through KeyboardAwareScreen (no KeyboardAvoidingView behavior prop)', async () => {
    Platform.OS = 'android';
    const root = await mount(rawEvent({ organizer_id: 'user-me' }));
    await pressLabelled(root, 'Edit Game');
    expect(root.findAll(n => n.props.behavior === 'height')).toHaveLength(0);
    expect(root.findAll(n => n.props.behavior === 'padding')).toHaveLength(0);
    expect(root.findAll(n => n.props.keyboardShouldPersistTaps === 'handled').length).toBeGreaterThan(0);
  });

  it('the Edit game wizard (with its TextInput) renders inside the keyboard-aware scroll view', async () => {
    Platform.OS = 'android';
    const root = await mount(rawEvent({ organizer_id: 'user-me' }));
    await pressLabelled(root, 'Edit Game');
    const scroll = root.findAll(n => n.props.keyboardShouldPersistTaps === 'handled')[0];
    expect(scroll.findAll(n => (n.type as unknown) === 'TextInput').length).toBeGreaterThan(0);
  });
});

describe('share flow (organizer): invite message, then the game link', () => {
  const CONFIG = {
    android_store_url: 'https://play.example',
    link_base_url: 'https://links.example',
    app_links_enabled: true,
  };
  const MESSAGE =
    'Join GameOn SG 📲\n🤖 https://play.example\n\nhttps://links.example/l/game/evt-1?ref=user-me';

  beforeEach(() => {
    mockShareLabels = {
      'share.invite_message': 'Join GameOn SG 📲\n{store_links}',
      'share.invite_android_line': '🤖 {url}',
    };
  });

  it('opens the ShareActionSheet from the Share app link button on the Invite card', async () => {
    const root = await mount(rawEvent({ organizer_id: 'user-me' }), CONFIG);
    expect(hasLabelled(root, 'Share app link')).toBe(true);

    await pressLabelled(root, 'Share app link');

    expect(has(root, 'Share via WhatsApp')).toBe(true);
    expect(has(root, 'Share via other apps')).toBe(true);
    expect(has(root, 'Copy Link')).toBe(true);
  });

  it('system share: the invite message, a blank line, then the /l/ game link with ?ref= (message only, no url key)', async () => {
    const spy = jest.spyOn(Share, 'share').mockResolvedValueOnce({ action: 'sharedAction' });
    const root = await mount(rawEvent({ organizer_id: 'user-me' }), CONFIG);

    await pressLabelled(root, 'Share app link');
    await act(async () => {
      await pressableLabelled(root, 'Share via other apps').props.onPress();
    });

    expect(spy).toHaveBeenCalledWith({ message: MESSAGE });
  });

  it('with the link switch off the game link is the hash form', async () => {
    const spy = jest.spyOn(Share, 'share').mockResolvedValueOnce({ action: 'sharedAction' });
    const root = await mount(rawEvent({ organizer_id: 'user-me' }), { ...CONFIG, app_links_enabled: false });

    await pressLabelled(root, 'Share app link');
    await act(async () => {
      await pressableLabelled(root, 'Share via other apps').props.onPress();
    });

    expect(spy).toHaveBeenCalledWith({
      message: 'Join GameOn SG 📲\n🤖 https://play.example\n\nhttps://links.example/#event-detail/evt-1?ref=user-me',
    });
  });

  it('WhatsApp share carries the same message', async () => {
    const canOpenSpy = jest.spyOn(Linking, 'canOpenURL').mockResolvedValueOnce(true);
    const openSpy = jest.spyOn(Linking, 'openURL').mockResolvedValueOnce(undefined as never);
    const root = await mount(rawEvent({ organizer_id: 'user-me' }), CONFIG);

    await pressLabelled(root, 'Share app link');
    await act(async () => {
      await pressableLabelled(root, 'Share via WhatsApp').props.onPress();
    });

    expect(canOpenSpy).toHaveBeenCalledWith('whatsapp://send');
    expect(openSpy).toHaveBeenCalledWith(`whatsapp://send?text=${encodeURIComponent(MESSAGE)}`);
  });

  it('Copy Link copies the app share URL (FEEDBACK-001 AD-6) and shows the confirmation toast', async () => {
    const setStringSpy = jest.spyOn(Clipboard, 'setString');
    const root = await mount(rawEvent({ organizer_id: 'user-me' }), CONFIG);

    await pressLabelled(root, 'Share app link');
    act(() => pressableLabelled(root, 'Copy Link').props.onPress());

    expect(setStringSpy).toHaveBeenCalledWith(getShareUrl());
    expect(has(root, 'Link copied to clipboard')).toBe(true);
  });
});
