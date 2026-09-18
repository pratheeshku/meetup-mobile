/**
 * Integration test for the Home dashboard: real screen + real selectors +
 * real child components; only the API and auth boundaries are mocked.
 *
 * Fixture design (signed-in user id `user-me`):
 * - going/waitlisted across three sports, four of them (cap = 3 hides the
 *   latest), sorted by start time
 * - public un-joined events, plus decoys that must NOT be recommended:
 *   one organised by the user (organiser_id match; `is_organiser` stays
 *   false, exactly as the real mapper returns it), one group-visibility,
 *   one cancelled
 * - My Games = going (3) + organised (1) = 4; the waitlisted one does not count
 */
import React from 'react';
import { RefreshControl } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { getEvents } from '../../api/events';
import { getMyGroups } from '../../api/groups';
import { makeEvent } from '../../test-utils/makeEvent';
import {
  act,
  pressableLabelled,
  pressableWithText,
  renderAsync,
  texts,
} from '../../test-utils/render';
import type { Instance } from '../../test-utils/render';
import type { Event } from '../../types/event';
import HomeScreen from '../HomeScreen';

jest.mock('../../api/events', () => ({ getEvents: jest.fn() }));
jest.mock('../../api/groups', () => ({ getMyGroups: jest.fn() }));
jest.mock('../../auth/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'user-me', nickname: 'Sam', email: 'sam@example.com' } }),
}));

const mockGetEvents = getEvents as jest.MockedFunction<typeof getEvents>;
const mockGetMyGroups = getMyGroups as jest.MockedFunction<typeof getMyGroups>;

const FEED: Event[] = [
  makeEvent({ id: 'up1', title: 'Up one', sport: 'badminton', current_user_rsvp_status: 'going', starts_at: '2026-09-24T10:00:00Z' }),
  makeEvent({ id: 'up2', title: 'Up two', sport: 'tennis', current_user_rsvp_status: 'going', starts_at: '2026-09-22T10:00:00Z' }),
  makeEvent({ id: 'up3', title: 'Up three', sport: 'badminton', current_user_rsvp_status: 'waitlisted', starts_at: '2026-09-23T10:00:00Z' }),
  makeEvent({ id: 'up4', title: 'Up four', sport: 'football', current_user_rsvp_status: 'going', starts_at: '2026-09-26T10:00:00Z' }),
  makeEvent({ id: 'rec1', title: 'Rec one', sport: 'badminton' }),
  makeEvent({ id: 'rec2', title: 'Rec two', sport: 'tennis' }),
  makeEvent({ id: 'own', title: 'My own event', sport: 'badminton', organiser_id: 'user-me', is_organiser: false }),
  makeEvent({ id: 'grp', title: 'Group only', sport: 'badminton', visibility: 'group' }),
  makeEvent({ id: 'can', title: 'Cancelled one', sport: 'badminton', status: 'cancelled' }),
];

const METRICS = {
  frame: { x: 0, y: 0, width: 360, height: 640 },
  insets: { top: 24, left: 0, right: 0, bottom: 0 },
};

function groupsResponse(count: number): Awaited<ReturnType<typeof getMyGroups>> {
  const items = Array.from({ length: count }, (_, i) => ({
    id: `g${i}`,
    name: `Group ${i}`,
    description: '',
    owner_id: 'x',
    created_at: '2026-01-01T00:00:00Z',
    current_user_role: 'member' as const,
  }));
  return { items, total: count, page: 1, page_size: count };
}

function eventsResponse(items: Event[]): Awaited<ReturnType<typeof getEvents>> {
  return { items, total: items.length, page: 1, page_size: items.length };
}

const navigate = jest.fn();

async function mount(): Promise<Instance> {
  const props = {
    navigation: { navigate },
    route: { key: 'k', name: 'EventsList' },
  } as unknown as React.ComponentProps<typeof HomeScreen>;
  return renderAsync(
    <SafeAreaProvider initialMetrics={METRICS}>
      <HomeScreen {...props} />
    </SafeAreaProvider>,
  );
}

/** Titles of the event cards currently shown, in display order. */
function cardTitles(root: Instance, prefix: RegExp): string[] {
  return texts(root).filter(text => prefix.test(text));
}

beforeEach(() => {
  navigate.mockReset();
  mockGetEvents.mockReset().mockResolvedValue(eventsResponse(FEED));
  mockGetMyGroups.mockReset().mockResolvedValue(groupsResponse(2));
});

describe('HomeScreen dashboard', () => {
  it('greets the signed-in user by nickname', async () => {
    const root = await mount();
    expect(texts(root)).toContain('Good to see you 👋');
    expect(texts(root)).toContain('Ready to play, Sam?');
  });

  it('enables Create Game and opens the CreateGame placeholder route on press', async () => {
    const root = await mount();
    const button = pressableLabelled(root, '+ Create Game');
    expect(button.props.disabled).toBe(false);
    act(() => button.props.onPress());
    expect(navigate).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith('CreateGame');
  });

  it('lists upcoming games soonest-first, capped at three, from going/waitlisted events only', async () => {
    const root = await mount();
    // up2 (22nd), up3 (23rd), up1 (24th); up4 (26th) is past the cap of 3.
    expect(cardTitles(root, /^Up /)).toEqual(['Up two', 'Up three', 'Up one']);
    expect(texts(root)).toContain('View all →');
  });

  it('recommends only public, un-joined, un-organised, un-cancelled events', async () => {
    const root = await mount();
    expect(cardTitles(root, /^Rec /)).toEqual(['Rec one', 'Rec two']);
    const all = texts(root);
    expect(all).not.toContain('My own event');
    expect(all).not.toContain('Group only');
    expect(all).not.toContain('Cancelled one');
  });

  it('shows the My Games (organised + going) and My Groups counts', async () => {
    const root = await mount();
    expect(texts(root)).toContain('4 active · tap to manage');
    expect(texts(root)).toContain('2 groups · tap to manage');
  });

  it('offers "All" (selected) plus one pill per sport in the feed, excluding cancelled-only sports', async () => {
    const root = await mount();
    // The pills are the only horizontal ScrollView on the screen.
    const pillRow = root.find(node => node.props.horizontal === true && node.props.showsHorizontalScrollIndicator === false);
    expect(texts(pillRow)).toEqual(['All', '🏸 Badminton', '⚽ Football', '🎾 Tennis']);
    expect(pressableLabelled(root, 'All sports').props.accessibilityState).toEqual({ selected: true });
  });

  it('filters both Upcoming and Recommended by the selected sport, but not the My Games count', async () => {
    const root = await mount();

    act(() => pressableLabelled(root, 'Badminton').props.onPress());
    expect(cardTitles(root, /^Up /)).toEqual(['Up three', 'Up one']);
    expect(cardTitles(root, /^Rec /)).toEqual(['Rec one']);
    expect(texts(root)).toContain('4 active · tap to manage');
    expect(pressableLabelled(root, 'Badminton').props.accessibilityState).toEqual({ selected: true });

    act(() => pressableLabelled(root, 'Tennis').props.onPress());
    expect(cardTitles(root, /^Up /)).toEqual(['Up two']);
    expect(cardTitles(root, /^Rec /)).toEqual(['Rec two']);

    act(() => pressableLabelled(root, 'All sports').props.onPress());
    expect(cardTitles(root, /^Up /)).toEqual(['Up two', 'Up three', 'Up one']);
    expect(cardTitles(root, /^Rec /)).toEqual(['Rec one', 'Rec two']);
  });

  it('shows each section’s empty state when the selected sport has no matches there', async () => {
    const root = await mount();
    act(() => pressableLabelled(root, 'Football').props.onPress());
    // Football: one upcoming (up4), no recommended.
    expect(cardTitles(root, /^Up /)).toEqual(['Up four']);
    expect(texts(root)).toContain('No public games to recommend right now.');
    expect(texts(root)).not.toContain('No upcoming games yet — join one below or create your own.');
  });

  it('opens Event Detail when a card is tapped', async () => {
    const root = await mount();
    act(() => pressableWithText(root, 'Rec two').props.onPress());
    expect(navigate).toHaveBeenCalledWith('EventDetail', { eventId: 'rec2' });
  });

  it('opens the Groups tab list when My Groups is tapped', async () => {
    const root = await mount();
    act(() => pressableLabelled(root, 'My Groups, 2 groups · tap to manage').props.onPress());
    expect(navigate).toHaveBeenCalledWith('Groups', { screen: 'GroupsList' });
  });

  it('leaves My Games inert (no pressable, no navigation)', async () => {
    const root = await mount();
    expect(() => pressableLabelled(root, 'My Games, 4 active · tap to manage')).toThrow(
      /found 0/,
    );
  });

  it('shows empty states, zero counts and only "All" for an empty feed', async () => {
    mockGetEvents.mockResolvedValue(eventsResponse([]));
    mockGetMyGroups.mockResolvedValue(groupsResponse(0));
    const root = await mount();
    const all = texts(root);
    expect(all).toContain('No upcoming games yet — join one below or create your own.');
    expect(all).toContain('No public games to recommend right now.');
    expect(all).toContain('0 active · tap to manage');
    expect(all).toContain('0 groups · tap to manage');
    expect(() => pressableLabelled(root, 'Badminton')).toThrow(/found 0/);
  });
});

describe('HomeScreen data loading', () => {
  it('fetches events and groups under ONE shared correlation ID (§3.12)', async () => {
    await mount();
    expect(mockGetEvents).toHaveBeenCalledTimes(1);
    expect(mockGetMyGroups).toHaveBeenCalledTimes(1);
    const eventsId = mockGetEvents.mock.calls[0][1]?.correlationId;
    const groupsId = mockGetMyGroups.mock.calls[0][0]?.correlationId;
    expect(eventsId).toEqual(expect.stringMatching(/^[0-9a-f-]{36}$/));
    expect(groupsId).toBe(eventsId);
  });

  it('shows an error with retry when events fail, and recovers on retry', async () => {
    mockGetEvents.mockRejectedValueOnce(new Error('network'));
    const root = await mount();
    expect(texts(root)).toContain('Could not load events. Please try again.');
    expect(texts(root)).not.toContain('Ready to play, Sam?');

    await act(async () => {
      pressablesRetry(root).props.onPress();
    });
    expect(texts(root)).toContain('Ready to play, Sam?');
    expect(mockGetEvents).toHaveBeenCalledTimes(2);
  });

  it('still renders the dashboard when only the groups request fails, dropping the count', async () => {
    mockGetMyGroups.mockRejectedValue(new Error('groups down'));
    const root = await mount();
    const all = texts(root);
    expect(all).not.toContain('Could not load events. Please try again.');
    expect(all).toContain('Ready to play, Sam?');
    expect(all).toContain('4 active · tap to manage');
    expect(all).toContain('Tap to manage');
  });

  it('falls back to "All" if a refresh removes the selected sport’s last event', async () => {
    const root = await mount();
    act(() => pressableLabelled(root, 'Tennis').props.onPress());
    expect(cardTitles(root, /^Up /)).toEqual(['Up two']);

    mockGetEvents.mockResolvedValue(eventsResponse(FEED.filter(event => event.sport !== 'tennis')));
    await act(async () => {
      root.findByType(RefreshControl).props.onRefresh();
    });

    expect(pressableLabelled(root, 'All sports').props.accessibilityState).toEqual({ selected: true });
    expect(cardTitles(root, /^Up /)).toEqual(['Up three', 'Up one', 'Up four']);
  });
});

/** ErrorView's retry control. */
function pressablesRetry(root: Instance): Instance {
  const retry = root.findAll(
    node => node.props.accessibilityRole === 'button' && typeof node.props.onPress === 'function',
  );
  if (retry.length !== 1) {
    throw new Error(`Expected exactly one retry button, found ${retry.length}`);
  }
  return retry[0];
}
