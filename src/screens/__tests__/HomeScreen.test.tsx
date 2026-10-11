/**
 * Home dashboard (DES-MEETUP-ADDENDUM-dashboard.md v1.4). Integration test:
 * the REAL screen, hooks, selectors and child components are rendered and
 * driven (presses, refresh); only the API / auth / unread-count boundaries
 * are mocked. All cases EXECUTE the code — none is a source-string check.
 *
 * Fixture (signed-in user `user-me`; start times are relative to "now" so the
 * future/past rules stay valid whenever the suite runs).
 */
import React from 'react';
import { RefreshControl } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { getEvents } from '../../api/events';
import { getMyGroups } from '../../api/groups';
import { getProfile } from '../../api/profile';
import { getSports } from '../../api/sports';
import { makeEvent } from '../../test-utils/makeEvent';
import {
  act,
  pressableLabelled,
  renderAsync,
  texts,
} from '../../test-utils/render';
import type { Instance } from '../../test-utils/render';
import type { Event } from '../../types/event';
import type { UserProfile } from '../../types/user';
import HomeScreen from '../HomeScreen';

const mockUseScrollToTop = jest.fn();
jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  return {
    ...actual,
    useScrollToTop: (...args: unknown[]) => mockUseScrollToTop(...args),
    useFocusEffect: jest.fn(),
  };
});
jest.mock('../../api/events', () => ({ getEvents: jest.fn() }));
jest.mock('../../api/groups', () => ({
  getMyGroups: jest.fn(),
  getCachedHomeGroups: jest.fn().mockResolvedValue([]),
}));
jest.mock('../../api/profile', () => ({ getProfile: jest.fn() }));
jest.mock('../../api/sports', () => ({ getSports: jest.fn() }));
const mockUnread = { count: 0 };
const mockRefreshUnread = jest.fn();
jest.mock('../../hooks/useUnreadCount', () => ({
  refreshUnreadCount: () => mockRefreshUnread(),
  useUnreadBadgeCount: () => mockUnread.count,
}));
const mockUser: { current: Record<string, unknown> } = { current: {} };
jest.mock('../../auth/AuthContext', () => ({ useAuth: () => ({ user: mockUser.current }) }));

const mockGetEvents = getEvents as jest.MockedFunction<typeof getEvents>;
const mockGetMyGroups = getMyGroups as jest.MockedFunction<typeof getMyGroups>;
const mockGetProfile = getProfile as jest.MockedFunction<typeof getProfile>;
const mockGetSports = getSports as jest.MockedFunction<typeof getSports>;

const ME = 'user-me';
const hours = (h: number): string => new Date(Date.now() + h * 3_600_000).toISOString();

const FEED: Event[] = [
  makeEvent({ id: 'going-b', title: 'Going badminton', sport: 'badminton', current_user_rsvp_status: 'going', starts_at: hours(10) }),
  makeEvent({ id: 'wait-t', title: 'Waitlisted tennis', sport: 'tennis', current_user_rsvp_status: 'waitlisted', starts_at: hours(20) }),
  makeEvent({ id: 'host-f', title: 'Hosted football', sport: 'football', organiser_id: ME, starts_at: hours(30) }),
  makeEvent({ id: 'open-t1', title: 'Open tennis one', sport: 'tennis', starts_at: hours(5) }),
  makeEvent({ id: 'open-b2', title: 'Open badminton two', sport: 'badminton', starts_at: hours(15) }),
  makeEvent({ id: 'open-t3', title: 'Open tennis three', sport: 'tennis', starts_at: hours(25) }),
  // Never shown:
  makeEvent({ id: 'past', title: 'Past going', current_user_rsvp_status: 'going', starts_at: hours(-2) }),
  makeEvent({ id: 'cancelled', title: 'Cancelled hosted', organiser_id: ME, status: 'cancelled', starts_at: hours(3) }),
  makeEvent({ id: 'declined', title: 'Declined game', current_user_rsvp_status: 'withdrawn', starts_at: hours(4) }),
  makeEvent({ id: 'group-only', title: 'Group only', visibility: 'group', starts_at: hours(6) }),
];

const SPORTS = [
  { name: 'badminton', display_name: 'Badminton', slug: 'badminton' },
  { name: 'basketball', display_name: 'Basketball', slug: 'basketball' },
  { name: 'football', display_name: 'Football', slug: 'football' },
  { name: 'tennis', display_name: 'Tennis', slug: 'tennis' },
];

const GROUPS = ['g1', 'g2', 'g3'].map(id => ({
  id,
  name: `Group ${id}`,
  description: '',
  owner_id: 'x',
  created_at: '2026-01-01T00:00:00Z',
  current_user_role: 'member' as const,
}));

const eventsOf = (items: Event[]) => ({ items, total: items.length, page: 1, page_size: items.length });
const profileOf = (overrides: Partial<UserProfile> = {}): UserProfile => ({
  id: ME,
  email: 'sam@example.com',
  nickname: 'sam99',
  display_name: 'Sam Smith',
  avatar_url: null,
  skill_levels: [],
  ...overrides,
});

const METRICS = {
  frame: { x: 0, y: 0, width: 360, height: 640 },
  insets: { top: 24, left: 0, right: 0, bottom: 0 },
};
const navigate = jest.fn();
const addListener = jest.fn(() => jest.fn());

function element(): React.ReactElement {
  const props = {
    navigation: { navigate, addListener },
    route: { key: 'k', name: 'EventsList', params: undefined },
  } as unknown as React.ComponentProps<typeof HomeScreen>;
  return (
    <SafeAreaProvider initialMetrics={METRICS}>
      <HomeScreen {...props} />
    </SafeAreaProvider>
  );
}
const mount = (): Promise<Instance> => renderAsync(element());

const tap = (root: Instance, label: string) => act(async () => pressableLabelled(root, label).props.onPress());

/** testIDs of the section containers, in document order. */
const sectionOrder = (root: Instance): string[] =>
  root
    .findAll(node => typeof node.type === 'string' && typeof node.props.testID === 'string')
    .map(node => node.props.testID as string)
    .filter(id => /-section$|^shortcut-tiles$|^dashboard-banner$/.test(id));

const rowTitles = (root: Instance, testID: string): string[] => {
  const section = root.find(node => typeof node.type === 'string' && node.props.testID === testID);
  return texts(section);
};

beforeEach(() => {
  mockUser.current = { id: ME, nickname: 'sam99', display_name: 'Sam Smith', email: 'sam@example.com' };
  mockUnread.count = 0;
  navigate.mockReset();
  addListener.mockClear();
  mockRefreshUnread.mockReset();
  mockUseScrollToTop.mockReset();
  mockGetEvents.mockReset().mockResolvedValue(eventsOf(FEED));
  mockGetMyGroups.mockReset().mockResolvedValue({ items: GROUPS, total: 3, page: 1, page_size: 3 });
  mockGetSports.mockReset().mockResolvedValue(SPORTS);
  mockGetProfile.mockReset().mockResolvedValue(profileOf());
});

describe('layout and order (AD-1)', () => {
  it('renders banner, next game, sports, My games, My groups, Recommended, shortcut tiles — in that order', async () => {
    const root = await mount();
    expect(sectionOrder(root)).toEqual([
      'dashboard-banner',
      'next-game-section',
      'sports-section',
      'my-games-section',
      'my-groups-section',
      'recommended-section',
      'shortcut-tiles',
    ]);
  });

  it('shows the three section headings and no orphan or legacy headings (AD-11)', async () => {
    const all = texts(await mount());
    for (const heading of ['My games', 'My groups', 'Recommended for you']) {
      expect(all).toContain(heading);
    }
    for (const legacy of ['My Games & Groups', 'Recent Results', 'Your Upcoming Games', 'Recommended for You']) {
      expect(all).not.toContain(legacy);
    }
    expect(all.join(' ')).not.toMatch(/tournament/i);
  });

  it('every heading has content under it in every state (rows, empty text, skeleton or error)', async () => {
    mockGetEvents.mockResolvedValue(eventsOf([]));
    mockGetMyGroups.mockResolvedValue({ items: [], total: 0, page: 1, page_size: 0 });
    const root = await mount();
    for (const id of ['my-games-section', 'my-groups-section', 'recommended-section']) {
      expect(rowTitles(root, id).length).toBeGreaterThanOrEqual(2); // heading + body text
    }
  });
});

describe('banner (AD-12, AD-13)', () => {
  it('greets with plain "Good to see you" and the same display name as before (not the nickname)', async () => {
    const all = texts(await mount());
    expect(all).toContain('Good to see you');
    expect(all).toContain('Ready to play, Sam Smith?');
    expect(all.some(text => text.includes('sam99'))).toBe(false);
  });

  it('falls back to the nickname only when the display name is empty', async () => {
    mockUser.current = { ...mockUser.current, display_name: ' ' };
    expect(texts(await mount())).toContain('Ready to play, sam99?');
  });

  it('shows the uploaded photo when the profile has one', async () => {
    mockGetProfile.mockResolvedValue(profileOf({ avatar_url: 'https://cdn.example/me.jpg' }));
    const root = await mount();
    const photo = root.find(node => typeof node.type === 'string' && node.props.testID === 'banner-avatar-photo');
    expect(photo.props.source).toEqual({ uri: 'https://cdn.example/me.jpg' });
  });

  it('shows the letter avatar when there is no photo, and when the profile call fails', async () => {
    const none = await mount();
    expect(none.findAll(node => node.props.testID === 'banner-avatar-letter')).not.toHaveLength(0);
    mockGetProfile.mockRejectedValue(new Error('down'));
    const failed = await mount();
    expect(failed.findAll(node => node.props.testID === 'banner-avatar-letter')).not.toHaveLength(0);
    expect(texts(failed)).toContain('Ready to play, Sam Smith?');
  });

  it('shows the unread count on the bell, opens notifications and Profile', async () => {
    mockUnread.count = 4;
    const root = await mount();
    expect(texts(root)).toContain('4');
    await tap(root, 'Notifications, 4 unread');
    expect(navigate).toHaveBeenCalledWith('NotificationHistory');
    await tap(root, 'Profile');
    expect(navigate).toHaveBeenCalledWith('Profile', { screen: 'ProfileHome' });
  });

  it('syncs the unread count on mount and when the screen regains focus', async () => {
    await mount();
    expect(mockRefreshUnread).toHaveBeenCalledTimes(1);
    const onFocus = (addListener.mock.calls as unknown as Array<[string, () => void]>).find(
      ([name]) => name === 'focus',
    )?.[1] as () => void;
    onFocus();
    expect(mockRefreshUnread).toHaveBeenCalledTimes(2);
  });
});

describe('list rules (AD-14, AD-7 reversed)', () => {
  it('My games shows two rows, earliest first, with going, waitlisted and hosted games eligible', async () => {
    const section = rowTitles(await mount(), 'my-games-section');
    expect(section.filter(text => /^(Going|Waitlisted|Hosted) /.test(text))).toEqual([
      'Going badminton',
      'Waitlisted tennis',
    ]);
  });

  it('a hosted game appears in My games when it is among the two earliest', async () => {
    mockGetEvents.mockResolvedValue(
      eventsOf([
        makeEvent({ id: 'h', title: 'Hosted early', organiser_id: ME, starts_at: hours(2) }),
        makeEvent({ id: 'w', title: 'Wait later', current_user_rsvp_status: 'waitlisted', starts_at: hours(8) }),
        makeEvent({ id: 'g', title: 'Going latest', current_user_rsvp_status: 'going', starts_at: hours(9) }),
      ]),
    );
    const section = rowTitles(await mount(), 'my-games-section');
    expect(section).toContain('Hosted early');
    expect(section).toContain('Wait later');
    expect(section).not.toContain('Going latest');
  });

  it('never shows past or cancelled games anywhere', async () => {
    const all = texts(await mount());
    expect(all).not.toContain('Past going');
    expect(all).not.toContain('Cancelled hosted');
  });

  it('Recommended shows two open public games, earliest first, excluding hosted, accepted, declined and non-public', async () => {
    const section = rowTitles(await mount(), 'recommended-section');
    expect(section.filter(text => text.startsWith('Open '))).toEqual(['Open tennis one', 'Open badminton two']);
    const all = section.join('|');
    for (const excluded of ['Hosted football', 'Going badminton', 'Waitlisted tennis', 'Declined game', 'Group only']) {
      expect(all).not.toContain(excluded);
    }
  });

  it('with a single registered game, the next-game card and My games both show it', async () => {
    mockGetEvents.mockResolvedValue(
      eventsOf([makeEvent({ id: 'only', title: 'Only game', current_user_rsvp_status: 'going', starts_at: hours(3) })]),
    );
    const root = await mount();
    expect(rowTitles(root, 'next-game-section')).toContain('Only game');
    expect(rowTitles(root, 'my-games-section')).toContain('Only game');
  });

  it('the next-game card is the soonest registered game', async () => {
    expect(rowTitles(await mount(), 'next-game-section')).toContain('Going badminton');
  });
});

describe('states: loading, empty, error — each section on its own (P7)', () => {
  it('shows skeletons while loading, never a blank page', async () => {
    let resolveEvents!: (value: ReturnType<typeof eventsOf>) => void;
    mockGetEvents.mockReturnValue(new Promise(resolve => (resolveEvents = resolve)));
    mockGetMyGroups.mockReturnValue(new Promise(() => {}));
    const root = await mount();
    expect(root.findAll(node => node.props.testID === 'next-game-skeleton')).not.toHaveLength(0);
    expect(root.findAll(node => node.props.accessibilityRole === 'progressbar').length).toBeGreaterThanOrEqual(3);
    expect(texts(root)).toContain('Ready to play, Sam Smith?');
    await act(async () => resolveEvents(eventsOf(FEED)));
    expect(rowTitles(root, 'my-games-section')).toContain('Going badminton');
    // Groups still loading: its own skeleton, others unaffected.
    expect(root.findAll(node => node.props.accessibilityRole === 'progressbar')).not.toHaveLength(0);
  });

  it('shows the empty copy for each section', async () => {
    mockGetEvents.mockResolvedValue(eventsOf([]));
    mockGetMyGroups.mockResolvedValue({ items: [], total: 0, page: 1, page_size: 0 });
    const all = texts(await mount());
    expect(all.filter(t => t === 'No upcoming games yet — join one below or create your own.')).toHaveLength(2);
    expect(all).toContain("You haven't joined any groups yet.");
    expect(all).toContain('No public games to recommend right now.');
  });

  it('events failing shows the games error (with Retry) in its three sections, and leaves groups, chips and banner working', async () => {
    mockGetEvents.mockRejectedValue(new Error('500'));
    const root = await mount();
    const all = texts(root);
    expect(all.filter(t => t === "Couldn't load your games")).toHaveLength(2);
    expect(all).toContain("Couldn't load recommendations");
    expect(rowTitles(root, 'my-groups-section')).toContain('Group g1');
    expect(all).toContain('Tennis');
    expect(all).toContain('Ready to play, Sam Smith?');
    // Tile: games count dropped (not a wrong 0); groups count still shown.
    expect(all).toContain('3 groups');
    expect(all.some(t => t.endsWith('active'))).toBe(false);
  });

  it('groups failing shows only the groups error; games sections are unaffected', async () => {
    mockGetMyGroups.mockRejectedValue(new Error('500'));
    const root = await mount();
    expect(rowTitles(root, 'my-groups-section')).toContain("Couldn't load your groups");
    expect(rowTitles(root, 'my-games-section')).toContain('Going badminton');
    expect(rowTitles(root, 'recommended-section')).toContain('Open tennis one');
    expect(texts(root).some(t => t.endsWith('active'))).toBe(true);
  });

  it('sports failing leaves only the All chip; every section still loads', async () => {
    mockGetSports.mockRejectedValue(new Error('500'));
    const root = await mount();
    expect(texts(root)).toContain('All');
    expect(texts(root)).not.toContain('Tennis');
    expect(rowTitles(root, 'my-games-section')).toContain('Going badminton');
  });

  it('Retry reloads only the failed section and recovers', async () => {
    mockGetEvents.mockRejectedValueOnce(new Error('500')).mockResolvedValue(eventsOf(FEED));
    const root = await mount();
    const groupsCalls = mockGetMyGroups.mock.calls.length;
    const retries = root.findAll(
      node => node.props.accessibilityRole === 'button' && node.props.accessibilityLabel === 'Retry',
    );
    expect(retries.length).toBeGreaterThan(0);
    await act(async () => retries[0].props.onPress());
    expect(mockGetEvents).toHaveBeenCalledTimes(2);
    expect(mockGetMyGroups).toHaveBeenCalledTimes(groupsCalls);
    expect(rowTitles(root, 'my-games-section')).toContain('Going badminton');
  });
});

describe('sport chips (AD-9)', () => {
  const chipSelected = (root: Instance, label: string): boolean =>
    pressableLabelled(root, label).props.accessibilityState.selected === true;

  it('shows All first, then the admin sports, with All selected when the user has no skill sports', async () => {
    const root = await mount();
    const chipLabels = root
      .find(node => typeof node.type === 'string' && node.props.testID === 'sports-section')
      .findAll(node => node.props.accessibilityRole === 'button' && typeof node.props.onPress === 'function')
      .map(node => node.props.accessibilityLabel);
    expect(chipLabels).toEqual(['All', 'Badminton', 'Basketball', 'Football', 'Tennis']);
    expect(chipSelected(root, 'All')).toBe(true);
    // Unfiltered: all my games and open games visible.
    expect(rowTitles(root, 'recommended-section')).toContain('Open tennis one');
  });

  it('defaults to the user\'s skill sports that are in the admin list', async () => {
    mockGetProfile.mockResolvedValue(
      profileOf({
        skill_levels: [
          { sport: 'tennis', skill_level: 'expert' },
          { sport: 'rugby', skill_level: 'expert' },
        ],
      }),
    );
    const root = await mount();
    expect(chipSelected(root, 'Tennis')).toBe(true);
    expect(chipSelected(root, 'All')).toBe(false);
    expect(chipSelected(root, 'Badminton')).toBe(false);
    // The default filters the lists: tennis only.
    expect(rowTitles(root, 'next-game-section')).toContain('Waitlisted tennis');
    expect(rowTitles(root, 'next-game-section')).not.toContain('Going badminton');
    expect(rowTitles(root, 'recommended-section')).toContain('Open tennis one');
    expect(rowTitles(root, 'recommended-section')).not.toContain('Open badminton two');
  });

  it('multi-select: tapping toggles a chip; the lists change with it (asserting the lists, not just the chip)', async () => {
    mockGetProfile.mockResolvedValue(profileOf({ skill_levels: [{ sport: 'tennis', skill_level: 'expert' }] }));
    const root = await mount();
    await tap(root, 'Badminton');
    expect(chipSelected(root, 'Tennis')).toBe(true);
    expect(chipSelected(root, 'Badminton')).toBe(true);
    expect(rowTitles(root, 'next-game-section')).toContain('Going badminton');
    expect(rowTitles(root, 'recommended-section')).toContain('Open tennis one');
    expect(rowTitles(root, 'recommended-section')).toContain('Open badminton two');
    await tap(root, 'Tennis');
    expect(chipSelected(root, 'Tennis')).toBe(false);
    expect(rowTitles(root, 'recommended-section')).not.toContain('Open tennis one');
  });

  it('All is exclusive; clearing every sport selects All', async () => {
    const root = await mount();
    await tap(root, 'Tennis');
    await tap(root, 'Football');
    expect(chipSelected(root, 'All')).toBe(false);
    await tap(root, 'All');
    expect(chipSelected(root, 'All')).toBe(true);
    expect(chipSelected(root, 'Tennis')).toBe(false);
    expect(chipSelected(root, 'Football')).toBe(false);
    await tap(root, 'Tennis');
    await tap(root, 'Tennis');
    expect(chipSelected(root, 'All')).toBe(true);
  });

  it('clicking All then a sport selects that sport', async () => {
    mockGetProfile.mockResolvedValue(profileOf({ skill_levels: [{ sport: 'tennis', skill_level: 'expert' }] }));
    const root = await mount();
    await tap(root, 'All');
    await tap(root, 'Football');
    expect(chipSelected(root, 'Football')).toBe(true);
    expect(chipSelected(root, 'All')).toBe(false);
    expect(chipSelected(root, 'Tennis')).toBe(false);
  });

  it("keeps the user's selection across a re-render and a data reload (pull to refresh)", async () => {
    mockGetProfile.mockResolvedValue(profileOf({ skill_levels: [{ sport: 'tennis', skill_level: 'expert' }] }));
    const root = await mount();
    await tap(root, 'All');
    await tap(root, 'Football');
    // A reload now returns different skill levels; the choice must survive it.
    mockGetProfile.mockResolvedValue(profileOf({ skill_levels: [{ sport: 'badminton', skill_level: 'beginner' }] }));
    await act(async () => {
      await root.findByType(RefreshControl).props.onRefresh();
    });
    expect(mockGetEvents).toHaveBeenCalledTimes(2);
    expect(chipSelected(root, 'Football')).toBe(true);
    expect(chipSelected(root, 'Badminton')).toBe(false);
    expect(chipSelected(root, 'All')).toBe(false);
  });

  it('never filters My groups or the tile counts', async () => {
    const root = await mount();
    const unfilteredTiles = texts(root.find(node => node.props.testID === 'shortcut-tiles'));
    await tap(root, 'Basketball');
    expect(rowTitles(root, 'my-groups-section')).toEqual(
      expect.arrayContaining(['Group g1', 'Group g2']),
    );
    expect(texts(root.find(node => node.props.testID === 'shortcut-tiles'))).toEqual(unfilteredTiles);
    expect(unfilteredTiles).toEqual(['My games', '3 active', 'My groups', '3 groups']);
  });

  it('shows "No {sport} games here — clear the filter to see all" when a filter empties a section', async () => {
    const root = await mount();
    await tap(root, 'Basketball');
    const message = 'No Basketball games here — clear the filter to see all';
    expect(rowTitles(root, 'next-game-section')).toContain(message);
    expect(rowTitles(root, 'my-games-section')).toContain(message);
    expect(rowTitles(root, 'recommended-section')).toContain(message);
    // Groups keep their own copy, not the games message.
    expect(rowTitles(root, 'my-groups-section')).not.toContain(message);
  });
});

describe('entry points and navigation', () => {
  const gamesParams = (scope: string) => ({
    screen: 'TournamentsList',
    params: expect.objectContaining({ scope, entryKey: expect.any(Number) }),
  });

  it('My games View all opens Games with scope Mine', async () => {
    const root = await mount();
    await tap(root, 'View all My games');
    expect(navigate).toHaveBeenCalledWith('Tournaments', gamesParams('mine'));
  });

  it('Recommended View all opens Games with scope Open', async () => {
    const root = await mount();
    await tap(root, 'View all Recommended for you');
    expect(navigate).toHaveBeenCalledWith('Tournaments', gamesParams('open'));
  });

  it('the My games tile opens Games with scope All; the My groups tile opens the Groups screen', async () => {
    const root = await mount();
    await tap(root, 'My games, 3 active');
    expect(navigate).toHaveBeenCalledWith('Tournaments', gamesParams('all'));
    await tap(root, 'My groups, 3 groups');
    expect(navigate).toHaveBeenCalledWith('Groups', { screen: 'GroupsList' });
  });

  it('opens game detail from a row and from the next-game card, and a group from a group row', async () => {
    const root = await mount();
    const row = root.findAll(
      node => node.props.accessibilityRole === 'button' && String(node.props.accessibilityLabel).startsWith('Open tennis one'),
    )[0];
    await act(async () => row.props.onPress());
    expect(navigate).toHaveBeenCalledWith('EventDetail', { eventId: 'open-t1' });
    const next = root.findAll(
      node => node.props.accessibilityRole === 'button' && String(node.props.accessibilityLabel).startsWith('Next game'),
    )[0];
    await act(async () => next.props.onPress());
    expect(navigate).toHaveBeenCalledWith('EventDetail', { eventId: 'going-b' });
    await tap(root, 'Group g1');
    expect(navigate).toHaveBeenCalledWith('Groups', {
      screen: 'GroupDetail',
      params: { groupId: 'g1' },
      initial: false,
    });
  });

  it('My groups View all opens the existing Groups screen', async () => {
    const root = await mount();
    await tap(root, 'View all My groups');
    expect(navigate).toHaveBeenCalledWith('Groups', { screen: 'GroupsList' });
  });
});
