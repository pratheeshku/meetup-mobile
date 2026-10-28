/**
 * Series on the game view (er-m-series, AD-8; A38 board of record). The real screen and API layer run; only the HTTP client and the native
 * alert are doubles. Checks: the chip and line come from `series` only; the accept note; Skip and Leave for an active member; the organizer's
 * "this game" versus "this and following" choice with the exact bodies; labelled server codes, never the server text.
 */
import React from 'react';
import { Alert } from 'react-native';

import { apiClient } from '../../api/client';
import { act, renderAsync, texts } from '../../test-utils/render';
import type { Instance } from '../../test-utils/render';
import { __resetSportDisplayNamesCacheForTests } from '../../utils/labels';
import EventDetailScreen from '../EventDetailScreen';

jest.mock('../../api/client', () => ({ apiClient: { get: jest.fn(), patch: jest.fn(), post: jest.fn() } }));
jest.mock('../../auth/AuthContext', () => ({ useAuth: () => ({ user: { id: 'user-me', nickname: 'Sam' } }) }));
jest.mock('../../components/UserSearchPicker', () => ({ __esModule: true, default: () => null }));

const mockGet = apiClient.get as jest.Mock;
const mockPost = apiClient.post as jest.Mock;
const mockPatch = apiClient.patch as jest.Mock;

const series = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  rule_id: 'rule-1',
  interval: 1,
  ends_on: null,
  occurrence_limit: 6,
  index: 2,
  total: 6,
  my_membership: 'none',
  ...over,
});

function rawEvent(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'evt-1',
    organizer_id: 'someone-else',
    sport: 'badminton',
    title: 'Friday night doubles',
    description: '',
    visibility: 'public',
    capacity: 12,
    starts_at: new Date(Date.now() + 2 * 3600 * 1000).toISOString(),
    ends_at: new Date(Date.now() + 4 * 3600 * 1000).toISOString(),
    estimated_cost_cents: null,
    allow_waitlist: true,
    recurrence_rule_id: 'rule-1',
    status: 'upcoming',
    venue_name: 'Riverside Courts',
    venue_address: '123 River Rd',
    organizer_nickname: 'Pat',
    organizer_display_name: null,
    going_count: 5,
    user_rsvp_status: null,
    skill_level_requirement: 'all_levels',
    series: series(),
    ...overrides,
  };
}

async function mount(raw: Record<string, unknown>): Promise<Instance> {
  mockGet.mockReset().mockImplementation((url: string) => (url.includes('/participants') ? Promise.resolve({ data: [] }) : Promise.resolve({ data: raw })));
  mockPost.mockReset().mockResolvedValue({ data: {} });
  mockPatch.mockReset().mockResolvedValue({ data: raw });
  const props = { route: { key: 'k', name: 'EventDetail', params: { eventId: 'evt-1' } }, navigation: { goBack: jest.fn() } } as unknown as React.ComponentProps<typeof EventDetailScreen>;
  return renderAsync(<EventDetailScreen {...props} />);
}

const byId = (root: Instance, id: string): Instance[] => root.findAll(n => n.props.testID === id && typeof n.type === 'string');
const use = (root: Instance, id: string, prop: string): Instance => {
  const found = root.findAll(n => n.props.testID === id && typeof n.props[prop] === 'function')[0];
  if (!found) throw new Error(`nothing to use: ${id}`);
  return found;
};
const press = async (root: Instance, id: string): Promise<void> => {
  await act(async () => use(root, id, 'onPress').props.onPress());
};
const type = async (root: Instance, id: string, value: string): Promise<void> => {
  await act(async () => use(root, id, 'onChangeText').props.onChangeText(value));
};
const all = (root: Instance): string => texts(root).join(' | ');
const alertPress = async (label: string): Promise<void> => {
  const calls = (Alert.alert as jest.Mock).mock.calls;
  const button = (calls[calls.length - 1][2] as { text: string; onPress?: () => void }[]).find(b => b.text === label);
  if (!button?.onPress) throw new Error(`no alert button ${label}`);
  await act(async () => {
    await button.onPress?.();
  });
};
const pressableLabelled = (root: Instance, label: string): Instance =>
  root.findAll(n => n.props.accessibilityLabel === label && typeof n.props.onPress === 'function')[0];
const callsTo = (mock: jest.Mock, url: string): unknown[][] => mock.mock.calls.filter(c => c[0] === url);

beforeEach(() => {
  __resetSportDisplayNamesCacheForTests();
  jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
});
afterEach(() => jest.restoreAllMocks());

describe('chip and line (from series only)', () => {
  it('shows "Weekly · n of N" and the end after N games', async () => {
    const root = await mount(rawEvent());
    expect(all(byId(root, 'series-info')[0])).toContain('Weekly · 2 of 6');
    expect(all(byId(root, 'series-line')[0])).toBe('Repeats weekly · Ends after 6 games');
  });

  it('a legacy rolling series has no total: "Weekly · game 3" and no end', async () => {
    const root = await mount(rawEvent({ series: series({ occurrence_limit: null, total: null, index: 3 }) }));
    expect(all(byId(root, 'series-info')[0])).toContain('Weekly · game 3');
    expect(all(byId(root, 'series-line')[0])).toBe('Repeats weekly');
  });

  it('an interval and an end date: "Repeats every 2 weeks · Ends on {date}", the date only formatted', async () => {
    const root = await mount(rawEvent({ series: series({ interval: 2, occurrence_limit: null, ends_on: '2099-03-01' }) }));
    expect(all(byId(root, 'series-line')[0])).toBe('Repeats every 2 weeks · Ends on 1 Mar 2099');
  });

  it('a game that is not in a series shows neither', async () => {
    const root = await mount(rawEvent({ recurrence_rule_id: null, series: null }));
    expect(byId(root, 'series-info')).toHaveLength(0);
  });
});

describe('the person who has not joined, and an active member', () => {
  it('sees the note that accepting joins the whole series; a going non-member keeps Decline, no Skip, no Leave', async () => {
    const root = await mount(rawEvent());
    expect(all(byId(root, 'series-accept-note')[0])).toBe('Accepting joins every future game of this series. Declining applies to this game only.');
    const going = await mount(rawEvent({ user_rsvp_status: 'going' }));
    expect(byId(going, 'series-skip-button')).toHaveLength(0);
    expect(byId(going, 'series-leave')).toHaveLength(0);
    expect(byId(going, 'decline-button').length).toBeGreaterThan(0);
  });

  it('an active member who is going gets Skip this game (the existing withdraw, membership stays) and Leave series', async () => {
    const root = await mount(rawEvent({ user_rsvp_status: 'going', series: series({ my_membership: 'active' }) }));
    expect(byId(root, 'decline-button')).toHaveLength(0);
    await press(root, 'series-skip-button');
    await alertPress('Skip this game');
    const rsvp = callsTo(mockPost, '/events/evt-1/rsvp')[0];
    expect(rsvp[1]).toEqual({ action: 'withdrawn' });
    expect(all(root)).toContain('You skipped this game. You are still in the series.');
  });

  it('Leave series confirms, posts once with one correlation id, and shows games_left', async () => {
    const root = await mount(rawEvent({ user_rsvp_status: 'going', series: series({ my_membership: 'active' }) }));
    mockPost.mockResolvedValueOnce({ data: { left: true, games_left: 4 } });
    await press(root, 'series-leave');
    expect(callsTo(mockPost, '/events/evt-1/series/leave')).toHaveLength(0);
    await alertPress('Leave series');
    const call = callsTo(mockPost, '/events/evt-1/series/leave')[0];
    expect(call[1]).toBeUndefined();
    expect((call[2] as { correlationId: string }).correlationId).toEqual(expect.any(String));
    expect(all(root)).toContain('You left the series. You were withdrawn from 4 game(s).');
  });

  it('SERIES_ORGANIZER_CANNOT_LEAVE shows its label, not the server text', async () => {
    const root = await mount(rawEvent({ user_rsvp_status: 'going', series: series({ my_membership: 'active' }) }));
    mockPost.mockRejectedValueOnce({ response: { status: 409, data: { code: 'SERIES_ORGANIZER_CANNOT_LEAVE', detail: 'raw server text' } } });
    await press(root, 'series-leave');
    await alertPress('Leave series');
    expect(all(root)).toContain('The organizer cannot leave their own series. Cancel it instead.');
    expect(all(root)).not.toContain('raw server text');
  });
});

describe('the organizer', () => {
  const organizer = (over: Record<string, unknown> = {}) => rawEvent({ organizer_id: 'user-me', user_rsvp_status: 'going', series: series({ my_membership: 'active' }), ...over });

  it('sees no Leave series and no Skip', async () => {
    const root = await mount(organizer());
    expect(byId(root, 'series-leave')).toHaveLength(0);
    expect(byId(root, 'series-skip-button')).toHaveLength(0);
  });

  it('Edit asks which games; "This and following games" sends start_time and duration_minutes only to PATCH /series', async () => {
    const root = await mount(organizer());
    await act(async () => pressableLabelled(root, 'Edit Game').props.onPress());
    const buttons = ((Alert.alert as jest.Mock).mock.calls.at(-1)![2] as { text: string }[]).map(b => b.text);
    expect(buttons).toEqual(['This game', 'This and following games', 'Cancel']);
    await alertPress('This and following games');
    await type(root, 'series-edit-time', '20:30');
    await type(root, 'series-edit-duration', '90');
    await press(root, 'series-edit-save');
    const call = callsTo(mockPatch, '/events/evt-1/series')[0];
    expect(call[1]).toEqual({ start_time: '20:30', duration_minutes: 90 });
    expect((call[2] as { correlationId: string }).correlationId).toEqual(expect.any(String));
    expect(all(root)).toContain('This and the following games were updated.');
  });

  it('with nothing to send the sheet says so; SERIES_HAS_PARTICIPANTS shows its label', async () => {
    const root = await mount(organizer());
    await act(async () => pressableLabelled(root, 'Edit Game').props.onPress());
    await alertPress('This and following games');
    await press(root, 'series-edit-save');
    expect(all(byId(root, 'series-edit-error')[0])).toBe('Change the start time or the duration first.');
    expect(mockPatch).not.toHaveBeenCalled();
    await type(root, 'series-edit-time', '19:00');
    mockPatch.mockRejectedValueOnce({ response: { status: 409, data: { code: 'SERIES_HAS_PARTICIPANTS', detail: 'raw server text' } } });
    await press(root, 'series-edit-save');
    const text = all(byId(root, 'series-edit-error')[0]);
    expect(text).toContain('Players have already joined games this change would move or cancel');
    expect(text).not.toContain('raw server text');
  });

  it('Cancel asks which games; "This and following games" confirms, then posts to /series/cancel with a reason', async () => {
    const root = await mount(organizer());
    await act(async () => pressableLabelled(root, 'Cancel Game').props.onPress());
    await alertPress('This and following games');
    expect(callsTo(mockPost, '/events/evt-1/series/cancel')).toHaveLength(0);
    await alertPress('This and following games');
    const call = callsTo(mockPost, '/events/evt-1/series/cancel')[0];
    expect(call[1]).toEqual({ reason: expect.any(String) });
    expect(all(root)).toContain('This and the following games were cancelled.');
  });

  it('a game that is not in a series keeps the single Edit and Cancel behaviour (no scope question)', async () => {
    const root = await mount(rawEvent({ organizer_id: 'user-me', recurrence_rule_id: null, series: null }));
    await act(async () => pressableLabelled(root, 'Cancel Game').props.onPress());
    expect(Alert.alert).not.toHaveBeenCalled();
  });
});
