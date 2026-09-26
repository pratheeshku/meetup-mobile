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
import { RefreshControl, ScrollView } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import ReactTestRenderer from 'react-test-renderer';

import { getEvents } from '../../api/events';
import { getMyGroups } from '../../api/groups';

const mockUseScrollToTop = jest.fn();
jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  return {
    ...actual,
    useScrollToTop: (...args: unknown[]) => mockUseScrollToTop(...args),
  };
});
import { getSkillLevels } from '../../api/profile';
import { getSports } from '../../api/sports';
import { makeEvent } from '../../test-utils/makeEvent';
import {
  act,
  pressableLabelled,
  pressableWithText,
  renderAsync,
  texts,
} from '../../test-utils/render';
import type { Instance } from '../../test-utils/render';
import { __resetSportDisplayNamesCacheForTests } from '../../utils/labels';
import type { Event } from '../../types/event';
import type { SkillLevel } from '../../types/user';
import HomeScreen from '../HomeScreen';

jest.mock('../../api/events', () => ({ getEvents: jest.fn() }));
jest.mock('../../api/groups', () => ({ getMyGroups: jest.fn() }));
// ADDENDUM-MOBILE-SPORTS-FILTER-PRESELECT-001: mocked so the sport-filter
// pre-selection fetch never makes a real `GET /users/me/skill-levels` call
// (which would otherwise hang in this environment and stall every test —
// same reasoning as the `api/sports` mock below).
jest.mock('../../api/profile', () => ({ getSkillLevels: jest.fn() }));
// Two independent things read `GET /admin/sports/public` here: `EventCard`
// via `useSportDisplayName` (BUG-M02, its own module-wide cache in
// `utils/labels.ts`), and — as of BUG-M06 — the sport pill row itself
// (`HomeScreen` calls `getSports()` directly). Both share this one mock;
// `beforeEach` below sets a default fixture the pill-row tests rely on.
jest.mock('../../api/sports', () => ({ getSports: jest.fn() }));
const mockUser: { current: Record<string, unknown> } = { current: {} };
jest.mock('../../auth/AuthContext', () => ({
  useAuth: () => ({ user: mockUser.current }),
}));

const mockGetEvents = getEvents as jest.MockedFunction<typeof getEvents>;
const mockGetMyGroups = getMyGroups as jest.MockedFunction<typeof getMyGroups>;
const mockGetSkillLevels = getSkillLevels as jest.MockedFunction<typeof getSkillLevels>;
const mockGetSports = getSports as jest.MockedFunction<typeof getSports>;

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

// BUG-M06 default admin sports fixture: matches most of FEED's sports
// (badminton, football, tennis), plus `basketball`, which deliberately has
// NO event anywhere in FEED — this is what proves the pill row is
// admin-sourced, not feed-derived. `sportEmoji()`'s real (untouched)
// SPORT_EMOJI map supplies the emoji for all four.
const ADMIN_SPORTS: Awaited<ReturnType<typeof getSports>> = [
  { name: 'badminton', display_name: 'Badminton' },
  { name: 'basketball', display_name: 'Basketball' },
  { name: 'football', display_name: 'Football' },
  { name: 'tennis', display_name: 'Tennis' },
];

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

async function mount(params?: { filter?: 'mine' }): Promise<Instance> {
  const props = {
    navigation: { navigate },
    route: { key: 'k', name: 'EventsList', params },
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
  mockUser.current = {
    id: 'user-me',
    nickname: 'sam99',
    display_name: 'Sam Smith',
    email: 'sam@example.com',
  };
  navigate.mockReset();
  mockGetEvents.mockReset().mockResolvedValue(eventsResponse(FEED));
  mockGetMyGroups.mockReset().mockResolvedValue(groupsResponse(2));
  // Zero rows by default: every existing test below asserts today's
  // unaffected default ("All" selected on load) unless it opts into
  // skill levels itself.
  mockGetSkillLevels.mockReset().mockResolvedValue([]);
  mockGetSports.mockReset().mockResolvedValue(ADMIN_SPORTS);
  mockUseScrollToTop.mockReset();
  __resetSportDisplayNamesCacheForTests();
});

describe('HomeScreen dashboard', () => {
  it('greets the signed-in user by display name, not nickname', async () => {
    const root = await mount();
    expect(texts(root)).toContain('Good to see you 👋');
    expect(texts(root)).toContain('Ready to play, Sam Smith?');
    expect(texts(root).some(text => text.includes('sam99'))).toBe(false);
  });

  it('falls back to the nickname only when display name is empty', async () => {
    mockUser.current = { ...mockUser.current, display_name: '  ' };
    expect(texts(await mount())).toContain('Ready to play, sam99?');
  });

  it('has no Create Game control on the dashboard (it is the tab bar FAB now)', async () => {
    const root = await mount();
    expect(texts(root).some(text => text.includes('Create Game'))).toBe(false);
    expect(() => pressableLabelled(root, '+ Create Game')).toThrow(/found 0/);
    expect(navigate).not.toHaveBeenCalledWith('CreateGame');
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

  it('offers "All" (selected) plus one pill per admin sport (BUG-M06), including one with no event in the feed', async () => {
    const root = await mount();
    // The pills are the only horizontal ScrollView on the screen.
    const pillRow = root.find(node => node.props.horizontal === true && node.props.showsHorizontalScrollIndicator === false);
    // `basketball` is in ADMIN_SPORTS but has no event anywhere in FEED —
    // its pill still renders, proving the row is admin-sourced, not
    // feed-derived.
    expect(texts(pillRow)).toEqual(['All', '🏸 Badminton', '🏀 Basketball', '⚽ Football', '🎾 Tennis']);
    expect(pressableLabelled(root, 'All sports').props.accessibilityState).toEqual({ selected: true });
  });

  it('falls through to the sections’ existing empty-state copy when a pill has zero matching events (BUG-M06)', async () => {
    const root = await mount();
    act(() => pressableLabelled(root, 'Basketball').props.onPress());
    expect(pressableLabelled(root, 'Basketball').props.accessibilityState).toEqual({ selected: true });
    expect(cardTitles(root, /^(Up |Rec )/)).toEqual([]);
    expect(texts(root)).toContain('No upcoming games yet — join one below or create your own.');
    expect(texts(root)).toContain('No public games to recommend right now.');
    // My Games is deliberately independent of the sport filter.
    expect(texts(root)).toContain('4 active · tap to manage');
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

  it('switches to the filtered My Games view when the My Games tile is tapped (BUG-M04)', async () => {
    const root = await mount();
    act(() => pressableLabelled(root, 'My Games, 4 active · tap to manage').props.onPress());
    expect(navigate).toHaveBeenCalledWith('EventsList', { filter: 'mine' });
  });

  it('shows empty states and zero counts for an empty feed, but still renders admin sport pills (BUG-M06)', async () => {
    mockGetEvents.mockResolvedValue(eventsResponse([]));
    mockGetMyGroups.mockResolvedValue(groupsResponse(0));
    const root = await mount();
    expect(texts(root)).toContain('No upcoming games yet — join one below or create your own.');
    expect(texts(root)).toContain('No public games to recommend right now.');
    expect(texts(root)).toContain('0 active · tap to manage');
    expect(texts(root)).toContain('0 groups · tap to manage');
    // Pills are admin-sourced (BUG-M06), independent of the (empty) feed —
    // Badminton still renders and is selectable, unlike the old
    // feed-derived behaviour this replaces.
    act(() => pressableLabelled(root, 'Badminton').props.onPress());
    expect(pressableLabelled(root, 'Badminton').props.accessibilityState).toEqual({ selected: true });
    expect(texts(root)).toContain('No upcoming games yet — join one below or create your own.');
  });

  it('shows only "All" when the admin sports fetch fails, degrading like the groups tile (Proposed Assumption)', async () => {
    mockGetSports.mockRejectedValue(new Error('sports down'));
    const root = await mount();
    expect(texts(root)).not.toContain('Could not load events. Please try again.');
    const pillRow = root.find(node => node.props.horizontal === true && node.props.showsHorizontalScrollIndicator === false);
    expect(texts(pillRow)).toEqual(['All']);
    expect(pressableLabelled(root, 'All sports').props.accessibilityState).toEqual({ selected: true });
  });
});

describe('HomeScreen — My Games filtered view (BUG-M04)', () => {
  it('shows only organised-or-going events, soonest first, hiding the normal dashboard sections', async () => {
    const root = await mount({ filter: 'mine' });
    const all = texts(root);
    // Sorted by starts_at: up2 (22nd), up1 (24th), own (25th), up4 (26th).
    expect(cardTitles(root, /^(Up |My own)/)).toEqual([
      'Up two',
      'Up one',
      'My own event',
      'Up four',
    ]);
    expect(all).not.toContain('Rec one');
    expect(all).not.toContain('Group only');
    expect(all).not.toContain('Cancelled one');
    expect(all).toContain('My Games');
    expect(all).not.toContain('Your Upcoming Games');
    expect(all).not.toContain('Recommended for You');
    expect(all).not.toContain('My Games & Groups');
  });

  it('returns to the normal dashboard when "All" is tapped', async () => {
    const root = await mount({ filter: 'mine' });
    act(() => pressableWithText(root, '← All').props.onPress());
    expect(navigate).toHaveBeenCalledWith('EventsList', { filter: undefined });
  });

  it('shows the empty-state copy when the user has no games', async () => {
    mockGetEvents.mockResolvedValue(eventsResponse([]));
    const root = await mount({ filter: 'mine' });
    expect(texts(root)).toContain("You don't have any games yet — join one or create your own.");
  });

  it('offers filter pills: All (selected), Hosting, Joined, Waitlist', async () => {
    const root = await mount({ filter: 'mine' });
    expect(pressableLabelled(root, 'All').props.accessibilityState).toEqual({ selected: true });
    expect(pressableLabelled(root, 'Hosting').props.accessibilityState).toEqual({ selected: false });
    expect(pressableLabelled(root, 'Joined').props.accessibilityState).toEqual({ selected: false });
    expect(pressableLabelled(root, 'Waitlist').props.accessibilityState).toEqual({ selected: false });
  });

  it('filters by Hosting, Joined, and Waitlist', async () => {
    const root = await mount({ filter: 'mine' });

    // Tap Hosting -> only 'My own event'
    act(() => pressableLabelled(root, 'Hosting').props.onPress());
    expect(cardTitles(root, /^(Up |My own)/)).toEqual(['My own event']);

    // Tap Joined -> 'Up two', 'Up one', 'Up four'
    act(() => pressableLabelled(root, 'Joined').props.onPress());
    expect(cardTitles(root, /^(Up |My own)/)).toEqual(['Up two', 'Up one', 'Up four']);

    // Tap Waitlist -> 'Up three' (FEED has up3 as waitlisted)
    act(() => pressableLabelled(root, 'Waitlist').props.onPress());
    expect(cardTitles(root, /^Up /)).toEqual(['Up three']);
  });
});

describe('HomeScreen data loading', () => {
  it('fetches events, groups and admin sports under ONE shared correlation ID (§3.12, BUG-M06)', async () => {
    await mount();
    expect(mockGetEvents).toHaveBeenCalledTimes(1);
    expect(mockGetMyGroups).toHaveBeenCalledTimes(1);
    // `mockGetSports` is shared with `EventCard`'s independent
    // `useSportDisplayName` (BUG-M02, its own module-wide cache in
    // `utils/labels.ts`) — that call carries no `correlationId` at all, so
    // it's filtered out here; only the pill row's own direct call
    // (HomeScreen's `loadDashboard`) is asserted against §3.12.
    expect(directSportsCalls(mockGetSports)).toHaveLength(1);
    const eventsId = mockGetEvents.mock.calls[0][1]?.correlationId;
    const groupsId = mockGetMyGroups.mock.calls[0][0]?.correlationId;
    const sportsId = directSportsCalls(mockGetSports)[0][0]?.correlationId;
    expect(eventsId).toEqual(expect.stringMatching(/^[0-9a-f-]{36}$/));
    expect(groupsId).toBe(eventsId);
    expect(sportsId).toBe(eventsId);
  });

  it('refetches admin sports on every refresh, unlike the one-shot skill-level pre-select (BUG-M06)', async () => {
    const root = await mount();
    // See the correlation-ID test above for why `EventCard`'s own,
    // separately-cached `getSports()` call is filtered out here.
    expect(directSportsCalls(mockGetSports)).toHaveLength(1);
    await act(async () => {
      root.findByType(RefreshControl).props.onRefresh();
    });
    expect(directSportsCalls(mockGetSports)).toHaveLength(2);
  });

  it('shows an error with retry when events fail, and recovers on retry', async () => {
    mockGetEvents.mockRejectedValueOnce(new Error('network'));
    const root = await mount();
    expect(texts(root)).toContain('Could not load events. Please try again.');
    expect(texts(root)).not.toContain('Ready to play, Sam?');

    await act(async () => {
      pressablesRetry(root).props.onPress();
    });
    expect(texts(root)).toContain('Ready to play, Sam Smith?');
    expect(mockGetEvents).toHaveBeenCalledTimes(2);
  });

  it('still renders the dashboard when only the groups request fails, dropping the count', async () => {
    mockGetMyGroups.mockRejectedValue(new Error('groups down'));
    const root = await mount();
    const all = texts(root);
    expect(all).not.toContain('Could not load events. Please try again.');
    expect(all).toContain('Ready to play, Sam Smith?');
    expect(all).toContain('4 active · tap to manage');
    expect(all).toContain('Tap to manage');
  });

  it('keeps the selected sport pill after a refresh removes its last event, showing the empty state instead of falling back to "All" (BUG-M06)', async () => {
    const root = await mount();
    act(() => pressableLabelled(root, 'Tennis').props.onPress());
    expect(cardTitles(root, /^Up /)).toEqual(['Up two']);

    mockGetEvents.mockResolvedValue(eventsResponse(FEED.filter(event => event.sport !== 'tennis')));
    await act(async () => {
      root.findByType(RefreshControl).props.onRefresh();
    });

    // Tennis is admin-sourced (BUG-M06) and its pill still exists after
    // refresh (ADMIN_SPORTS is unchanged), so the selection is preserved —
    // it no longer resets to "All" just because the feed emptied out.
    expect(pressableLabelled(root, 'Tennis').props.accessibilityState).toEqual({ selected: true });
    expect(cardTitles(root, /^Up /)).toEqual([]);
    expect(texts(root)).toContain('No upcoming games yet — join one below or create your own.');
  });

  it('falls back to "All" if a refresh drops the selected sport from the admin list itself', async () => {
    const root = await mount();
    act(() => pressableLabelled(root, 'Tennis').props.onPress());
    expect(cardTitles(root, /^Up /)).toEqual(['Up two']);

    mockGetSports.mockResolvedValue(ADMIN_SPORTS.filter(sport => sport.name !== 'tennis'));
    await act(async () => {
      root.findByType(RefreshControl).props.onRefresh();
    });

    expect(pressableLabelled(root, 'All sports').props.accessibilityState).toEqual({ selected: true });
    expect(() => pressableLabelled(root, 'Tennis')).toThrow(/found 0/);
    // Capped at three (MAX_SECTION_ITEMS) — same cap as the "All" case
    // elsewhere in this file; 'Up four' is past it.
    expect(cardTitles(root, /^Up /)).toEqual(['Up two', 'Up three', 'Up one']);
  });
});

function skillLevel(sport: string, skill_level: SkillLevel['skill_level']): SkillLevel {
  return { sport, skill_level };
}

describe('HomeScreen sport-filter pre-selection (ADDENDUM-MOBILE-SPORTS-FILTER-PRESELECT-001)', () => {
  it('pre-selects the sport ranked highest by skill level on initial load', async () => {
    mockGetSkillLevels.mockResolvedValue([skillLevel('tennis', 'Expert')]);
    const root = await mount();
    expect(pressableLabelled(root, 'Tennis').props.accessibilityState).toEqual({ selected: true });
    expect(pressableLabelled(root, 'All sports').props.accessibilityState).toEqual({ selected: false });
    // Filtering itself is unaffected — the same client-side filter as a manual tap.
    expect(cardTitles(root, /^Up /)).toEqual(['Up two']);
  });

  it('falls back to "All" when the pre-selected sport has no matching admin sport pill (BUG-M06)', async () => {
    // Volleyball: a real top-tier skill level, but not present in
    // ADMIN_SPORTS (the mocked admin sports list), so no pill exists for it.
    mockGetSkillLevels.mockResolvedValue([skillLevel('volleyball', 'Expert')]);
    const root = await mount();
    expect(pressableLabelled(root, 'All sports').props.accessibilityState).toEqual({ selected: true });
    expect(() => pressableLabelled(root, 'Volleyball')).toThrow(/found 0/);
    // The dashboard renders normally (unfiltered), not stuck in error/loading.
    expect(cardTitles(root, /^Up /)).toEqual(['Up two', 'Up three', 'Up one']);
  });

  it('fetches skill levels once on initial load and never re-applies the pre-select on refresh, so a manual selection survives', async () => {
    mockGetSkillLevels.mockResolvedValue([skillLevel('tennis', 'Expert')]);
    const root = await mount();
    expect(mockGetSkillLevels).toHaveBeenCalledTimes(1);
    expect(pressableLabelled(root, 'Tennis').props.accessibilityState).toEqual({ selected: true });

    // User freely taps a different pill, per item 5's requirement.
    act(() => pressableLabelled(root, 'Badminton').props.onPress());
    expect(pressableLabelled(root, 'Badminton').props.accessibilityState).toEqual({ selected: true });

    await act(async () => {
      root.findByType(RefreshControl).props.onRefresh();
    });
    expect(mockGetSkillLevels).toHaveBeenCalledTimes(1);
    expect(pressableLabelled(root, 'Badminton').props.accessibilityState).toEqual({ selected: true });
  });

  it('shares the same correlation ID as getEvents()/getMyGroups() on the initial load', async () => {
    await mount();
    const eventsId = mockGetEvents.mock.calls[0][1]?.correlationId;
    const skillLevelsId = mockGetSkillLevels.mock.calls[0][0]?.correlationId;
    expect(skillLevelsId).toBe(eventsId);
  });
});

/**
 * `mockGetSports` is shared between HomeScreen's own direct pill-row fetch
 * (BUG-M06, always called with `{ correlationId }`) and `EventCard`'s
 * independent `useSportDisplayName` fetch (BUG-M02, called with no
 * arguments at all, via its own module-wide cache in `utils/labels.ts`).
 * This isolates the former so §3.12 correlation-ID / refetch-cadence
 * assertions aren't thrown off by the latter, unrelated call.
 */
function directSportsCalls(
  mock: jest.MockedFunction<typeof getSports>,
): Parameters<typeof getSports>[] {
  return mock.mock.calls.filter(call => call[0]?.correlationId !== undefined);
}

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

describe('HomeScreen scroll resets', () => {
  it('wires useScrollToTop with the ScrollView ref', async () => {
    await mount();
    expect(mockUseScrollToTop).toHaveBeenCalledWith(
      expect.objectContaining({ current: expect.anything() }),
    );
  });

  it('scrolls to top without animation when isMyGamesFilterActive flips', async () => {
    const scrollToSpy = jest.spyOn(ScrollView.prototype, 'scrollTo').mockImplementation();
    try {
      let renderer!: ReactTestRenderer.ReactTestRenderer;
      await ReactTestRenderer.act(async () => {
        renderer = ReactTestRenderer.create(
          <SafeAreaProvider initialMetrics={METRICS}>
            <HomeScreen
              navigation={{ navigate } as any}
              route={{ key: 'k', name: 'EventsList', params: undefined } as any}
            />
          </SafeAreaProvider>,
        );
      });

      scrollToSpy.mockClear();

      // Flip filter to 'mine' (entering "My Games")
      await ReactTestRenderer.act(async () => {
        renderer.update(
          <SafeAreaProvider initialMetrics={METRICS}>
            <HomeScreen
              navigation={{ navigate } as any}
              route={{ key: 'k', name: 'EventsList', params: { filter: 'mine' } } as any}
            />
          </SafeAreaProvider>,
        );
      });

      expect(scrollToSpy).toHaveBeenCalledWith({ y: 0, animated: false });

      scrollToSpy.mockClear();

      // Flip filter back to undefined (leaving "My Games")
      await ReactTestRenderer.act(async () => {
        renderer.update(
          <SafeAreaProvider initialMetrics={METRICS}>
            <HomeScreen
              navigation={{ navigate } as any}
              route={{ key: 'k', name: 'EventsList', params: undefined } as any}
            />
          </SafeAreaProvider>,
        );
      });

      expect(scrollToSpy).toHaveBeenCalledWith({ y: 0, animated: false });
    } finally {
      scrollToSpy.mockRestore();
    }
  });
});

