/**
 * Access consistency AC-10 (mobile AD-8): Home, All Games, All Tournaments, Groups and the
 * notifications list fetch on every focus and app foreground, and never render the previous
 * rows while the fetch is in flight or after it returns fewer rows.
 */
import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { getEvents } from '../../api/events';
import { getGroups } from '../../api/groups';
import { getNotificationHistory, getUnreadCount } from '../../api/notifications';
import { getProfile, getProfileSummary } from '../../api/profile';
import { getSports } from '../../api/sports';
import { getTournaments } from '../../api/tournaments';
import { createFocusNavigation } from '../../test-utils/focusNavigation';
import type { FocusNavigationDouble } from '../../test-utils/focusNavigation';
import { makeEvent } from '../../test-utils/makeEvent';
import { act, pressableWithText, renderAsync, texts } from '../../test-utils/render';
import type { Instance } from '../../test-utils/render';
import { __resetSportDisplayNamesCacheForTests } from '../../utils/labels';
import GamesScreen from '../GamesScreen';
import GroupsScreen from '../GroupsScreen';
import HomeScreen from '../HomeScreen';
import NotificationHistoryScreen from '../NotificationHistoryScreen';

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useScrollToTop: jest.fn(),
  useFocusEffect: jest.fn(),
}));
jest.mock('../../api/events', () => ({ getEvents: jest.fn() }));
jest.mock('../../api/groups', () => ({ getGroups: jest.fn(), getMyGroups: jest.fn() }));
jest.mock('../../api/notifications', () => ({
  getNotificationHistory: jest.fn(),
  getUnreadCount: jest.fn(),
  markNotificationRead: jest.fn(),
  markNotificationUnread: jest.fn(),
  markAllNotificationsRead: jest.fn(),
}));
jest.mock('../../api/profile', () => ({ getProfile: jest.fn(), getProfileSummary: jest.fn() }));
jest.mock('../../api/sports', () => ({ getSports: jest.fn() }));
jest.mock('../../api/tournaments', () => ({ getTournaments: jest.fn() }));
jest.mock('../../api/home', () => ({
  BUNDLED_FALLBACK_BANNER: { fallback: { id: 'fb', alt_text: 'fallback' }, banners: [], interval_seconds: 5 },
  getCachedBanners: jest.fn().mockResolvedValue(null),
  getCachedMenu: jest.fn().mockResolvedValue(null),
  getHomeBanners: jest.fn().mockRejectedValue(new Error('offline')),
  getHomeMenu: jest.fn().mockResolvedValue(null),
  getHomeSummary: jest.fn().mockRejectedValue(new Error('offline')),
}));
jest.mock('../../hooks/useUnreadCount', () => ({ refreshUnreadCount: jest.fn(), useUnreadBadgeCount: () => 0 }));
jest.mock('../../auth/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'me', nickname: 'sam', display_name: 'Sam' } }),
}));

const METRICS = { frame: { x: 0, y: 0, width: 360, height: 640 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };
const soon = (hours: number): string => new Date(Date.now() + hours * 3_600_000).toISOString();

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
}
function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(res => {
    resolve = res;
  });
  return { promise, resolve };
}

const eventsOf = (...titles: string[]) => ({
  items: titles.map((title, index) =>
    makeEvent({ id: `e-${title}`, title, current_user_rsvp_status: 'going', starts_at: soon(10 + index) }),
  ),
  total: titles.length,
  page: 1,
  page_size: titles.length,
});
const groupOf = (name: string) => ({
  id: `g-${name}`, name, description: '', owner_id: 'x', created_at: '2026-01-01T00:00:00Z',
  current_user_role: 'member', member_count: 3,
});
const groupsOf = (...names: string[]) => ({
  items: names.map(groupOf), total: names.length, page: 1, page_size: names.length,
});
const tournamentOf = (name: string) => ({
  id: `t-${name}`, name, description: '', sport: 'tennis', organiser_id: 'x', organiser_nickname: 'x',
  format: 'knockout', status: 'upcoming', registration_open: true, participant_count: 1, max_participants: 8,
  starts_at: '2026-12-01T10:00:00Z', created_at: '2026-09-01T10:00:00Z',
  current_user_registration_status: 'none', is_organiser: false,
});
const tournamentsOf = (...names: string[]) => ({
  items: names.map(tournamentOf), total: names.length, page: 1, page_size: names.length,
});
const noteOf = (title: string) => ({
  id: `n-${title}`, notification_type: 'event_changed', title, body: 'body', entity_id: 'e1',
  entity_type: 'event', created_at: new Date().toISOString(), read_at: null,
});

let nav: FocusNavigationDouble;

/** A navigation/route double typed as the screen's props. */
function props<C extends React.JSXElementConstructor<any>>(value: unknown): React.ComponentProps<C> {
  return value as React.ComponentProps<C>;
}

const withSafeArea = (node: React.ReactElement): React.ReactElement => (
  <SafeAreaProvider initialMetrics={METRICS}>{node}</SafeAreaProvider>
);
const has = (root: Instance, text: string): boolean => texts(root).some(x => x.includes(text));

beforeEach(() => {
  nav = createFocusNavigation();
  __resetSportDisplayNamesCacheForTests();
  (getEvents as jest.Mock).mockReset().mockResolvedValue(eventsOf('Alpha game', 'Beta game'));
  (getGroups as jest.Mock).mockReset().mockResolvedValue(groupsOf('Alpha group', 'Beta group'));
  (getTournaments as jest.Mock).mockReset().mockResolvedValue(tournamentsOf('Alpha cup', 'Beta cup'));
  (getSports as jest.Mock).mockReset().mockResolvedValue([]);
  (getProfile as jest.Mock).mockReset().mockResolvedValue({
    id: 'me', email: 'a@b.c', nickname: 'sam', display_name: 'Sam', avatar_url: null, skill_levels: [],
  });
  (getProfileSummary as jest.Mock).mockReset().mockResolvedValue({
    games_played: 1, games_hosted: 1, groups_count: 1, recent_games: [],
  });
  (getNotificationHistory as jest.Mock).mockReset().mockResolvedValue({
    items: [noteOf('Alpha note'), noteOf('Beta note')], next_cursor: null,
  });
  (getUnreadCount as jest.Mock).mockReset().mockResolvedValue({ count: 2 });
});

afterEach(() => {
  jest.restoreAllMocks();
});

/** Mounts a list screen, then runs the same checks for focus, foreground and fewer rows. */
interface ListCase {
  name: string;
  mount: () => Promise<Instance>;
  api: jest.Mock;
  /** A row that disappears when the server returns fewer rows. */
  gone: string;
  kept: string;
  /** What the API returns the second time: only the kept row. */
  fewer: () => unknown;
}

const CASES: ListCase[] = [
  {
    name: 'All Games',
    mount: () =>
      renderAsync(
        withSafeArea(
          <GamesScreen
            {...props<typeof GamesScreen>({
              navigation: nav.navigation,
              route: { key: 'k', name: 'TournamentsList', params: undefined },
            })}
          />,
        ),
      ),
    api: getEvents as jest.Mock,
    gone: 'Alpha game',
    kept: 'Beta game',
    fewer: () => eventsOf('Beta game'),
  },
  {
    name: 'All Tournaments',
    mount: () =>
      renderAsync(
        withSafeArea(
          <GamesScreen
            {...props<typeof GamesScreen>({
              navigation: nav.navigation,
              route: { key: 'k', name: 'TournamentsList', params: { segment: 'tournaments', entryKey: 1 } },
            })}
          />,
        ),
      ),
    api: getTournaments as jest.Mock,
    gone: 'Alpha cup',
    kept: 'Beta cup',
    fewer: () => tournamentsOf('Beta cup'),
  },
  {
    name: 'Groups',
    mount: () =>
      renderAsync(
        <GroupsScreen
          {...props<typeof GroupsScreen>({
            navigation: nav.navigation,
            route: { key: 'k', name: 'GroupsList', params: undefined },
          })}
        />,
      ),
    api: getGroups as jest.Mock,
    gone: 'Alpha group',
    kept: 'Beta group',
    fewer: () => groupsOf('Beta group'),
  },
  {
    name: 'Home (upcoming games)',
    mount: () =>
      renderAsync(
        withSafeArea(
          <HomeScreen
            {...props<typeof HomeScreen>({
              navigation: nav.navigation,
              route: { key: 'k', name: 'EventsList', params: undefined },
            })}
          />,
        ),
      ),
    api: getEvents as jest.Mock,
    gone: 'Alpha game',
    kept: 'Beta game',
    fewer: () => eventsOf('Beta game'),
  },
  {
    name: 'Notifications',
    mount: () => renderAsync(<NotificationHistoryScreen navigation={nav.navigation as never} />),
    api: getNotificationHistory as jest.Mock,
    gone: 'Alpha note',
    kept: 'Beta note',
    fewer: () => ({ items: [noteOf('Beta note')], next_cursor: null }),
  },
];

describe.each(CASES)('$name', ({ mount, api, gone, kept, fewer }) => {
  it('fetches on mount, on every focus, and on app foreground', async () => {
    const root = await mount();
    expect(has(root, gone)).toBe(true);
    const afterMount = api.mock.calls.length;
    expect(afterMount).toBeGreaterThanOrEqual(1);

    await act(async () => nav.fireFocus());
    const afterFocus = api.mock.calls.length;
    expect(afterFocus).toBeGreaterThan(afterMount);

    await act(async () => nav.foreground());
    expect(api.mock.calls.length).toBeGreaterThan(afterFocus);
  });

  it('does not refetch on foreground when it is not the focused screen', async () => {
    await mount();
    const before = api.mock.calls.length;
    nav.setFocused(false);
    await act(async () => nav.foreground());
    expect(api.mock.calls.length).toBe(before);
  });

  it('renders no previous rows while the fetch is in flight', async () => {
    const root = await mount();
    expect(has(root, gone)).toBe(true);
    expect(has(root, kept)).toBe(true);

    const pending = deferred<unknown>();
    api.mockReturnValueOnce(pending.promise);
    await act(async () => nav.fireFocus());

    expect(has(root, gone)).toBe(false);
    expect(has(root, kept)).toBe(false);

    await act(async () => pending.resolve(fewer()));
    expect(has(root, kept)).toBe(true);
    expect(has(root, gone)).toBe(false);
  });

  it('renders no previous rows after a refetch that returns fewer items', async () => {
    const root = await mount();
    api.mockResolvedValueOnce(fewer());
    await act(async () => nav.fireFocus());
    expect(has(root, kept)).toBe(true);
    expect(has(root, gone)).toBe(false);
  });

  it('shows the error state, not the old rows, when the refetch fails', async () => {
    const root = await mount();
    api.mockRejectedValueOnce(new Error('offline'));
    await act(async () => nav.fireFocus());
    expect(has(root, gone)).toBe(false);
    expect(has(root, kept)).toBe(false);
  });
});

describe('Notifications unread count', () => {
  it('is read from the server after every change, never adjusted locally', async () => {
    const { markNotificationRead } = jest.requireMock('../../api/notifications') as {
      markNotificationRead: jest.Mock;
    };
    markNotificationRead.mockReset().mockResolvedValue(undefined);
    const root = await renderAsync(<NotificationHistoryScreen navigation={nav.navigation as never} />);
    const callsBefore = (getUnreadCount as jest.Mock).mock.calls.length;
    // The server says 7 even though only two rows are on screen: the badge follows the server.
    (getUnreadCount as jest.Mock).mockResolvedValue({ count: 7 });
    await act(async () => {
      pressableWithText(root, 'Alpha note').props.onPress();
    });
    await act(async () => {}); // let the read call settle and the count be read back
    expect((getUnreadCount as jest.Mock).mock.calls.length).toBeGreaterThan(callsBefore);
    expect(texts(root)).toContain('7');
  });

  it('is not derived from the rows when the count call fails', async () => {
    (getUnreadCount as jest.Mock).mockReset().mockRejectedValue(new Error('offline'));
    const root = await renderAsync(<NotificationHistoryScreen navigation={nav.navigation as never} />);
    // Two unread rows are shown, but no count is computed from them.
    expect(texts(root)).not.toContain('2');
  });
});
