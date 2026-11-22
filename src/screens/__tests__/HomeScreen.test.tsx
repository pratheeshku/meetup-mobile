/**
 * Home dashboard, as shipped: GameOn SG top bar, banner, profile stats and the
 * "Upcoming games" / "My groups" folder tabs (board design-refs/home-v2;
 * DES-MEETUP-ADDENDUM-dashboard.md v1.9 AD-9, AD-12, AD-13, AD-20;
 * DES-MEETUP-ADDENDUM-closure-report.md AD-8). Integration test:
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
import { getGroups } from '../../api/groups';
import { getUpcoming } from '../../api/home';
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
  getGroups: jest.fn(),
}));
jest.mock('../../api/profile', () => ({ getProfile: jest.fn(), getProfileSummary: jest.fn() }));
jest.mock('../../api/sports', () => ({ getSports: jest.fn() }));
jest.mock('../../api/home', () => ({
  BUNDLED_FALLBACK_BANNER: { fallback: { id: 'fb', alt_text: 'fallback' }, banners: [], interval_seconds: 5 },
  getCachedBanners: jest.fn().mockResolvedValue(null),
  getCachedMenu: jest.fn().mockResolvedValue(null),
  getHomeBanners: jest.fn().mockRejectedValue(new Error('offline')),
  getHomeMenu: jest.fn().mockResolvedValue(null),
  getHomeSummary: jest.fn().mockRejectedValue(new Error('offline')),
  getUpcoming: jest.fn(),
}));
const mockUnread = { count: 0 };
const mockRefreshUnread = jest.fn();
jest.mock('../../hooks/useUnreadCount', () => ({
  refreshUnreadCount: () => mockRefreshUnread(),
  useUnreadBadgeCount: () => mockUnread.count,
}));
const mockUser: { current: Record<string, unknown> } = { current: {} };
jest.mock('../../auth/AuthContext', () => ({ useAuth: () => ({ user: mockUser.current }) }));

const mockGetEvents = getEvents as jest.MockedFunction<typeof getEvents>;
const mockGetGroups = getGroups as jest.MockedFunction<typeof getGroups>;
const mockGetUpcoming = getUpcoming as jest.MockedFunction<typeof getUpcoming>;
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

/**
 * What GET /home/upcoming returns for the user (AD-20): the user's own games in
 * the window, earliest first. The server decides; the client renders `items`.
 */
const UPCOMING_ITEMS: Event[] = [FEED[0], FEED[1], FEED[2]];
const upcomingOf = (items: Event[], total: number = items.length) => ({ items, total, window_days: 7 });

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

/** The two folder tabs have role "tab" (not "button"), so they are located by testID. */
const tapTab = (root: Instance, testID: 'tab-tile-upcoming' | 'tab-tile-groups') =>
  act(async () => {
    root
      .findAll(node => node.props.testID === testID && typeof node.props.onPress === 'function')[0]
      .props.onPress();
  });

const UPCOMING_PANEL = 'upcoming-games-tab-content';
const GROUPS_PANEL = 'your-groups-tab-content';

/** testIDs of the Home blocks, in document order. */
const sectionOrder = (root: Instance): string[] =>
  root
    .findAll(node => typeof node.type === 'string' && typeof node.props.testID === 'string')
    .map(node => node.props.testID as string)
    .filter(id => /^home-app-icon$|^home-banner-|^profile-stats-strip$|^home-tab-tiles$|-tab-content$/.test(id));

const rowTitles = (root: Instance, testID: string): string[] => {
  const section = root.find(node => typeof node.type === 'string' && node.props.testID === testID);
  return texts(section);
};

/** Sport chips are the pressables that carry a selected state. */
const chipLabels = (root: Instance): string[] =>
  root
    .findAll(
      node =>
        node.props.accessibilityRole === 'button' &&
        typeof node.props.onPress === 'function' &&
        node.props.accessibilityState?.selected !== undefined,
    )
    .map(node => node.props.accessibilityLabel as string);

/** Opens a row/card (a button whose label starts with `prefix`) and presses it. */
const pressRowStartingWith = (root: Instance, prefix: string) =>
  act(async () => {
    root
      .findAll(
        node =>
          node.props.accessibilityRole === 'button' &&
          typeof node.props.onPress === 'function' &&
          String(node.props.accessibilityLabel).startsWith(prefix),
      )[0]
      .props.onPress();
  });

beforeEach(() => {
  mockUser.current = { id: ME, nickname: 'sam99', display_name: 'Sam Smith', email: 'sam@example.com' };
  mockUnread.count = 0;
  navigate.mockReset();
  addListener.mockClear();
  mockRefreshUnread.mockReset();
  mockUseScrollToTop.mockReset();
  mockGetEvents.mockReset().mockResolvedValue(eventsOf(FEED));
  mockGetUpcoming.mockReset().mockResolvedValue(upcomingOf(UPCOMING_ITEMS));
  mockGetGroups.mockReset().mockResolvedValue({ items: GROUPS, total: 3, page: 1, page_size: 3 });
  mockGetSports.mockReset().mockResolvedValue(SPORTS);
  mockGetProfile.mockReset().mockResolvedValue(profileOf());
});

describe('layout and order (AD-1)', () => {
  it('renders top bar, banner, folder tabs and the Upcoming games panel — in that order', async () => {
    const root = await mount();
    const order = sectionOrder(root);
    expect(order[0]).toBe('home-app-icon');
    expect(order.slice(-3)).toEqual(['home-banner-fallback', 'home-tab-tiles', UPCOMING_PANEL]);
  });

  it('shows the tab headings and no orphan or legacy headings (AD-11)', async () => {
    const root = await mount();
    const all = texts(root);
    expect(all).toContain('Upcoming games');
    expect(all).toContain('My groups');
    await tapTab(root, 'tab-tile-groups');
    expect(rowTitles(root, GROUPS_PANEL)).toContain('My groups');
    const afterSwitch = texts(root);
    for (const legacy of ['My Games & Groups', 'Recent Results', 'Your Upcoming Games', 'Recommended for You']) {
      expect(afterSwitch).not.toContain(legacy);
    }
    expect(afterSwitch.join(' ')).not.toMatch(/tournament/i);
  });

  it('every heading has content under it in every state (rows, empty text, skeleton or error)', async () => {
    mockGetUpcoming.mockResolvedValue(upcomingOf([]));
    mockGetGroups.mockResolvedValue({ items: [], total: 0, page: 1, page_size: 0 });
    const root = await mount();
    expect(rowTitles(root, UPCOMING_PANEL).length).toBeGreaterThanOrEqual(2); // heading + body text
    await tapTab(root, 'tab-tile-groups');
    expect(rowTitles(root, GROUPS_PANEL).length).toBeGreaterThanOrEqual(2);
  });
});

describe('banner (AD-12, AD-13)', () => {
  it('greets with plain "Good to see you" and the same display name as before (not the nickname)', async () => {
    const all = texts(await mount());
    expect(all).toContain('Good to see you');
    expect(all).toContain('Ready to play, Sam Smith!');
    expect(all.some(text => text.includes('sam99'))).toBe(false);
  });

  it('falls back to the nickname only when the display name is empty', async () => {
    mockUser.current = { ...mockUser.current, display_name: ' ' };
    expect(texts(await mount())).toContain('Ready to play, sam99!');
  });

  it('shows the uploaded photo when the profile has one', async () => {
    mockGetProfile.mockResolvedValue(profileOf({ avatar_url: 'https://cdn.example/me.jpg' }));
    const root = await mount();
    const photo = pressableLabelled(root, 'Profile').find(
      node => typeof node.type === 'string' && node.props.testID === 'user-avatar-image',
    );
    expect(photo.props.source).toEqual({ uri: 'https://cdn.example/me.jpg' });
  });

  it('shows the letter avatar when there is no photo, and when the profile call fails', async () => {
    const none = await mount();
    expect(
      pressableLabelled(none, 'Profile').findAll(node => node.props.testID === 'user-avatar-placeholder'),
    ).not.toHaveLength(0);
    mockGetProfile.mockRejectedValue(new Error('down'));
    const failed = await mount();
    expect(
      pressableLabelled(failed, 'Profile').findAll(node => node.props.testID === 'user-avatar-placeholder'),
    ).not.toHaveLength(0);
    expect(texts(failed)).toContain('Ready to play, Sam Smith!');
  });

  it('shows the unread count badge on the bell, opens notifications and Profile', async () => {
    mockUnread.count = 4;
    const root = await mount();
    expect(root.findAll(node => node.props.testID === 'notification-badge')).not.toHaveLength(0);
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
    await act(async () => onFocus());
    expect(mockRefreshUnread).toHaveBeenCalledTimes(2);
  });
});

describe('list rules (AD-20)', () => {
  it('Upcoming games shows two rows, earliest first, with going, waitlisted and hosted games eligible', async () => {
    const section = rowTitles(await mount(), UPCOMING_PANEL);
    expect(section.filter(text => /^(Going|Waitlisted|Hosted) /.test(text))).toEqual([
      'Going badminton',
      'Waitlisted tennis',
    ]);
  });

  it('a hosted game appears in Upcoming games when the server returns it among the two earliest', async () => {
    mockGetUpcoming.mockResolvedValue(
      upcomingOf([
        makeEvent({ id: 'h', title: 'Hosted early', organiser_id: ME, starts_at: hours(2) }),
        makeEvent({ id: 'w', title: 'Wait later', current_user_rsvp_status: 'waitlisted', starts_at: hours(8) }),
        makeEvent({ id: 'g', title: 'Going latest', current_user_rsvp_status: 'going', starts_at: hours(9) }),
      ]),
    );
    const section = rowTitles(await mount(), UPCOMING_PANEL);
    expect(section).toContain('Hosted early');
    expect(section).toContain('Wait later');
    expect(section).not.toContain('Going latest');
  });

  it('never shows past or cancelled games anywhere', async () => {
    const all = texts(await mount());
    expect(all).not.toContain('Past going');
    expect(all).not.toContain('Cancelled hosted');
  });

  it('with a single registered game, Upcoming games shows it and the tile counts it', async () => {
    mockGetUpcoming.mockResolvedValue(
      upcomingOf([makeEvent({ id: 'only', title: 'Only game', current_user_rsvp_status: 'going', starts_at: hours(3) })]),
    );
    const root = await mount();
    expect(rowTitles(root, UPCOMING_PANEL)).toContain('Only game');
    expect(texts(root.find(node => node.props.testID === 'tab-tile-upcoming'))).toContain('1');
  });
});

describe('states: loading, empty, error — each section on its own (P7)', () => {
  it('shows skeletons while loading, never a blank page', async () => {
    let resolveUpcoming!: (value: ReturnType<typeof upcomingOf>) => void;
    mockGetUpcoming.mockReturnValue(new Promise(resolve => (resolveUpcoming = resolve)));
    mockGetGroups.mockReturnValue(new Promise(() => {}));
    const root = await mount();
    expect(
      root.find(node => node.props.testID === UPCOMING_PANEL).findAll(node => node.props.accessibilityRole === 'progressbar'),
    ).not.toHaveLength(0);
    expect(texts(root)).toContain('Ready to play, Sam Smith!');
    await act(async () => resolveUpcoming(upcomingOf(UPCOMING_ITEMS)));
    expect(rowTitles(root, UPCOMING_PANEL)).toContain('Going badminton');
    // Groups still loading: its own skeleton, others unaffected.
    await tapTab(root, 'tab-tile-groups');
    expect(
      root.find(node => node.props.testID === GROUPS_PANEL).findAll(node => node.props.accessibilityRole === 'progressbar'),
    ).not.toHaveLength(0);
  });

  it('shows the empty copy for each tab', async () => {
    mockGetUpcoming.mockResolvedValue(upcomingOf([]));
    mockGetGroups.mockResolvedValue({ items: [], total: 0, page: 1, page_size: 0 });
    const root = await mount();
    expect(texts(root).filter(t => t === 'No games in the next 7 days')).toHaveLength(1);
    await tapTab(root, 'tab-tile-groups');
    expect(texts(root)).toContain("You haven't joined any groups yet.");
  });

  it('upcoming failing shows the games error (with Retry) and leaves groups, chips and top bar working', async () => {
    mockGetUpcoming.mockRejectedValue(new Error('500'));
    mockGetEvents.mockRejectedValue(new Error('500'));
    const root = await mount();
    const all = texts(root);
    expect(all.filter(t => t === "Couldn't load your games")).toHaveLength(1);
    expect(chipLabels(root)).toContain('Tennis');
    expect(all).toContain('Ready to play, Sam Smith!');
    // Tile: games count dropped (not a wrong 0); groups count still shown.
    expect(texts(root.find(node => node.props.testID === 'tab-tile-upcoming'))).toContain('—');
    expect(texts(root.find(node => node.props.testID === 'tab-tile-groups'))).toContain('3');
    await tapTab(root, 'tab-tile-groups');
    expect(rowTitles(root, GROUPS_PANEL)).toContain('Group g1');
  });

  it('groups failing shows only the groups error; the Upcoming tab is unaffected', async () => {
    mockGetGroups.mockRejectedValue(new Error('500'));
    const root = await mount();
    expect(rowTitles(root, UPCOMING_PANEL)).toContain('Going badminton');
    expect(texts(root.find(node => node.props.testID === 'tab-tile-upcoming'))).toContain('3');
    await tapTab(root, 'tab-tile-groups');
    expect(rowTitles(root, GROUPS_PANEL)).toContain("Couldn't load your groups");
  });

  it('sports failing leaves only the All chip; every section still loads', async () => {
    mockGetSports.mockRejectedValue(new Error('500'));
    const root = await mount();
    expect(chipLabels(root)).toEqual(['All']);
    expect(rowTitles(root, UPCOMING_PANEL)).toContain('Going badminton');
  });

  it('Retry reloads only the failed section and recovers', async () => {
    mockGetUpcoming.mockRejectedValueOnce(new Error('500')).mockResolvedValue(upcomingOf(UPCOMING_ITEMS));
    mockGetEvents.mockRejectedValueOnce(new Error('500'));
    const root = await mount();
    const groupsCalls = mockGetGroups.mock.calls.length;
    const retries = root.findAll(
      node => node.props.accessibilityRole === 'button' && node.props.accessibilityLabel === 'Retry',
    );
    expect(retries.length).toBeGreaterThan(0);
    await act(async () => retries[0].props.onPress());
    expect(mockGetUpcoming).toHaveBeenCalledTimes(2);
    expect(mockGetGroups).toHaveBeenCalledTimes(groupsCalls);
    expect(rowTitles(root, UPCOMING_PANEL)).toContain('Going badminton');
  });
});

describe('sport chips (AD-9)', () => {
  const chipSelected = (root: Instance, label: string): boolean =>
    pressableLabelled(root, label).props.accessibilityState.selected === true;

  it('shows All first, then the admin sports, with All selected when the user has no skill sports', async () => {
    const root = await mount();
    expect(chipLabels(root)).toEqual(['All', 'Badminton', 'Basketball', 'Football', 'Tennis']);
    expect(chipSelected(root, 'All')).toBe(true);
    // Unfiltered: the user's games are visible.
    expect(rowTitles(root, UPCOMING_PANEL)).toContain('Going badminton');
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
    // AD-20: the sport chips do not filter the Upcoming tab, so the list is unchanged.
    expect(rowTitles(root, UPCOMING_PANEL)).toContain('Going badminton');
    expect(rowTitles(root, UPCOMING_PANEL)).toContain('Waitlisted tennis');
  });

  it('multi-select: tapping toggles a chip; the Upcoming list and count never change with it (AD-20)', async () => {
    mockGetProfile.mockResolvedValue(profileOf({ skill_levels: [{ sport: 'tennis', skill_level: 'expert' }] }));
    const root = await mount();
    const upcomingBefore = rowTitles(root, UPCOMING_PANEL);
    const tileBefore = texts(root.find(node => node.props.testID === 'tab-tile-upcoming'));
    await tap(root, 'Badminton');
    expect(chipSelected(root, 'Tennis')).toBe(true);
    expect(chipSelected(root, 'Badminton')).toBe(true);
    await tap(root, 'Tennis');
    expect(chipSelected(root, 'Tennis')).toBe(false);
    expect(rowTitles(root, UPCOMING_PANEL)).toEqual(upcomingBefore);
    expect(texts(root.find(node => node.props.testID === 'tab-tile-upcoming'))).toEqual(tileBefore);
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
    expect(mockGetUpcoming).toHaveBeenCalledTimes(2);
    expect(chipSelected(root, 'Football')).toBe(true);
    expect(chipSelected(root, 'Badminton')).toBe(false);
    expect(chipSelected(root, 'All')).toBe(false);
  });

  it('never filters My groups or the tile counts', async () => {
    const root = await mount();
    const tileTexts = () => texts(root.find(node => node.props.testID === 'home-tab-tiles'));
    const unfilteredTiles = tileTexts();
    await tap(root, 'Basketball');
    expect(tileTexts()).toEqual(unfilteredTiles);
    expect(unfilteredTiles).toEqual(['3', 'Upcoming games', 'This week', '3', 'My groups', 'Active groups']);
    await tapTab(root, 'tab-tile-groups');
    expect(rowTitles(root, GROUPS_PANEL)).toEqual(expect.arrayContaining(['Group g1', 'Group g2']));
  });
});

describe('entry points and navigation', () => {
  it('Upcoming games View all opens Games', async () => {
    const root = await mount();
    await tap(root, 'View all Upcoming games');
    expect(navigate).toHaveBeenCalledWith('Tournaments', {
      screen: 'TournamentsList',
      params: expect.objectContaining({ scope: 'all', entryKey: expect.any(Number), segment: 'games' }),
    });
  });

  it('the My groups tile switches to the groups panel and the Upcoming tile switches back', async () => {
    const root = await mount();
    expect(root.findAll(node => node.props.testID === GROUPS_PANEL)).toHaveLength(0);
    await tapTab(root, 'tab-tile-groups');
    expect(root.findAll(node => node.props.testID === UPCOMING_PANEL)).toHaveLength(0);
    expect(rowTitles(root, GROUPS_PANEL)).toContain('Group g1');
    await tapTab(root, 'tab-tile-upcoming');
    expect(rowTitles(root, UPCOMING_PANEL)).toContain('Going badminton');
    expect(navigate).not.toHaveBeenCalled();
  });

  it('opens game detail from a row, and a group from a group row', async () => {
    const root = await mount();
    await pressRowStartingWith(root, 'Going badminton');
    expect(navigate).toHaveBeenCalledWith('EventDetail', { eventId: 'going-b' });
    await tapTab(root, 'tab-tile-groups');
    await pressRowStartingWith(root, 'Group g1');
    expect(navigate).toHaveBeenCalledWith('Groups', {
      screen: 'GroupDetail',
      params: { groupId: 'g1' },
      initial: false,
    });
  });

  it('My groups View all opens the existing Groups screen', async () => {
    const root = await mount();
    await tapTab(root, 'tab-tile-groups');
    await tap(root, 'View all My groups');
    expect(navigate).toHaveBeenCalledWith('Groups', { screen: 'GroupsList' });
  });
});
