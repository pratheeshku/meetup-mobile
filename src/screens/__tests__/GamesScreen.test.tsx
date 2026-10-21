/**
 * Games tab screen (DES-MEETUP-ADDENDUM-dashboard.md AD-5, AD-15). The REAL
 * screen, shared list module, hooks and child components are rendered and
 * driven; only API/auth boundaries are mocked. All cases EXECUTE the code.
 */
import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { getEvents } from '../../api/events';
import { getProfile } from '../../api/profile';
import { getSports } from '../../api/sports';
import { getTournaments } from '../../api/tournaments';
import { makeEvent } from '../../test-utils/makeEvent';
import { act, pressableLabelled, renderAsync, texts } from '../../test-utils/render';
import type { Instance } from '../../test-utils/render';
import type { Event } from '../../types/event';
import type { Tournament } from '../../types/tournament';
import type { UserProfile } from '../../types/user';
import { __resetSportDisplayNamesCacheForTests } from '../../utils/labels';
import GamesScreen from '../GamesScreen';

jest.mock('../../api/events', () => ({ getEvents: jest.fn() }));
jest.mock('../../api/profile', () => ({ getProfile: jest.fn() }));
jest.mock('../../api/sports', () => ({ getSports: jest.fn() }));
jest.mock('../../api/tournaments', () => ({ getTournaments: jest.fn() }));
const mockUser: { current: Record<string, unknown> } = { current: {} };
jest.mock('../../auth/AuthContext', () => ({ useAuth: () => ({ user: mockUser.current }) }));

const mockGetEvents = getEvents as jest.MockedFunction<typeof getEvents>;
const mockGetProfile = getProfile as jest.MockedFunction<typeof getProfile>;
const mockGetSports = getSports as jest.MockedFunction<typeof getSports>;
const mockGetTournaments = getTournaments as jest.MockedFunction<typeof getTournaments>;

const ME = 'user-me';
const hours = (h: number): string => new Date(Date.now() + h * 3_600_000).toISOString();

const FEED: Event[] = [
  makeEvent({ id: 'host', title: 'Hosted football', sport: 'football', organiser_id: ME, starts_at: hours(30) }),
  makeEvent({ id: 'going', title: 'Going badminton', sport: 'badminton', current_user_rsvp_status: 'going', starts_at: hours(10) }),
  makeEvent({ id: 'wait', title: 'Waitlisted tennis', sport: 'tennis', current_user_rsvp_status: 'waitlisted', starts_at: hours(20) }),
  makeEvent({ id: 'open1', title: 'Open tennis', sport: 'tennis', starts_at: hours(5) }),
  makeEvent({ id: 'open2', title: 'Open badminton', sport: 'badminton', starts_at: hours(15) }),
  makeEvent({ id: 'past', title: 'Past going', current_user_rsvp_status: 'going', starts_at: hours(-2) }),
  makeEvent({ id: 'cancelled', title: 'Cancelled open', status: 'cancelled', starts_at: hours(3) }),
  makeEvent({ id: 'declined', title: 'Declined game', current_user_rsvp_status: 'withdrawn', starts_at: hours(4) }),
];
const SPORTS = [
  { name: 'badminton', display_name: 'Badminton', slug: 'badminton' },
  { name: 'basketball', display_name: 'Basketball', slug: 'basketball' },
  { name: 'football', display_name: 'Football', slug: 'football' },
  { name: 'tennis', display_name: 'Tennis', slug: 'tennis' },
];
const TOURNAMENT: Tournament = {
  id: 't-1',
  name: 'Summer Smash',
  description: '',
  sport: 'tennis',
  organiser_id: 'o',
  organiser_nickname: 'org',
  format: 'knockout',
  status: 'upcoming',
  registration_open: true,
  participant_count: 4,
  max_participants: 8,
  starts_at: '2026-12-01T10:00:00Z',
  created_at: '2026-09-01T10:00:00Z',
  current_user_registration_status: 'registered',
  is_organiser: false,
};

const eventsOf = (items: Event[]) => ({ items, total: items.length, page: 1, page_size: items.length });
const profileOf = (skills: UserProfile['skill_levels'] = []): UserProfile => ({
  id: ME,
  email: 'e@x.com',
  nickname: 'n',
  skill_levels: skills,
});

const METRICS = { frame: { x: 0, y: 0, width: 360, height: 640 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };
const navigate = jest.fn();
const parentNavigate = jest.fn();

type Params = { refreshKey?: number; scope?: 'all' | 'mine' | 'open'; entryKey?: number } | undefined;
function element(params?: Params): React.ReactElement {
  const props = {
    navigation: { navigate, getParent: () => ({ navigate: parentNavigate }) },
    route: { key: 'k', name: 'TournamentsList', params },
  } as unknown as React.ComponentProps<typeof GamesScreen>;
  return (
    <SafeAreaProvider initialMetrics={METRICS}>
      <GamesScreen {...props} />
    </SafeAreaProvider>
  );
}
const mount = (params?: Params): Promise<Instance> => renderAsync(element(params));
/** The Games tab opened from Home on the All scope (the default is Mine since game-view-redesign GV-1). */
const mountAll = (): Promise<Instance> => mount({ scope: 'all', entryKey: 1 });
const tap = (root: Instance, label: string) => act(async () => pressableLabelled(root, label).props.onPress());
/** The segmented switch's buttons carry the `tab` role. */
const segment = (root: Instance, label: string): Instance => {
  const matches = root.findAll(
    node =>
      node.props.accessibilityRole === 'tab' &&
      node.props.accessibilityLabel === label &&
      typeof node.props.onPress === 'function',
  );
  if (matches.length !== 1) {
    throw new Error(`Expected one segment "${label}", found ${matches.length}`);
  }
  return matches[0];
};
const tapSegment = (root: Instance, label: string) => act(async () => segment(root, label).props.onPress());
const selected = (root: Instance, label: string): boolean =>
  pressableLabelled(root, label).props.accessibilityState.selected === true;

/** Game titles in the list, in order (rows are the only "going" carriers). */
const listTitles = (root: Instance): string[] => {
  const list = root.find(node => node.props.testID === 'games-list' && typeof node.type !== 'string');
  return texts(list).filter(text =>
    ['Hosted football', 'Going badminton', 'Waitlisted tennis', 'Open tennis', 'Open badminton', 'Past going', 'Cancelled open', 'Declined game'].includes(text),
  );
};

beforeEach(() => {
  mockUser.current = { id: ME };
  navigate.mockReset();
  parentNavigate.mockReset();
  mockGetEvents.mockReset().mockResolvedValue(eventsOf(FEED));
  mockGetProfile.mockReset().mockResolvedValue(profileOf());
  mockGetSports.mockReset().mockResolvedValue(SPORTS);
  mockGetTournaments.mockReset().mockResolvedValue({ items: [TOURNAMENT], total: 1, page: 1, page_size: 1 });
  __resetSportDisplayNamesCacheForTests();
});

describe('switch', () => {
  it('shows a "Games | Tournaments" switch and defaults to Games', async () => {
    const root = await mount();
    expect(segment(root, 'Games')).toBeDefined();
    expect(segment(root, 'Tournaments')).toBeDefined();
    expect(segment(root, 'Games').props.accessibilityState).toEqual({ selected: true });
    expect(listTitles(root).length).toBeGreaterThan(0);
  });

  it('does not load tournaments until the Tournaments segment is opened', async () => {
    await mount();
    expect(mockGetTournaments).not.toHaveBeenCalled();
  });

  it('Tournaments shows the existing tournaments list unchanged (name, format, registration badge, counts)', async () => {
    const root = await mount();
    await tapSegment(root, 'Tournaments');
    const all = texts(root);
    expect(all).toContain('Summer Smash');
    expect(all).toContain('Registered');
    expect(all).toContain('Status: upcoming');
    expect(all).toContain('4/8 registered');
    expect(mockGetTournaments).toHaveBeenCalledTimes(1);
  });

  it('opens tournament detail from a tournament card', async () => {
    const root = await mount();
    await tapSegment(root, 'Tournaments');
    const card = root.findAll(
      node => node.props.accessibilityRole === 'button' && texts(node).includes('Summer Smash'),
    )[0];
    await act(async () => card.props.onPress());
    expect(navigate).toHaveBeenCalledWith('TournamentDetail', { tournamentId: 't-1' });
  });

  it('keeps each segment\'s own state when switching (scope, sport chips; only entering My games refetches, for history)', async () => {
    const root = await mountAll();
    await tap(root, 'Mine games');
    await tap(root, 'Tennis');
    expect(selected(root, 'Mine games')).toBe(true);
    await tapSegment(root, 'Tournaments');
    await tapSegment(root, 'Games');
    expect(selected(root, 'Mine games')).toBe(true);
    expect(selected(root, 'Tennis')).toBe(true);
    expect(listTitles(root)).toEqual(['Waitlisted tennis']);
    // One load on mount, one when My games asked for history; segment switches add none.
    expect(mockGetEvents).toHaveBeenCalledTimes(2);
    expect(mockGetEvents).toHaveBeenLastCalledWith({ history: true }, expect.anything());
    expect(mockGetTournaments).toHaveBeenCalledTimes(1);
  });

  it('a failing tournaments call does not affect the Games segment, and vice versa', async () => {
    mockGetTournaments.mockRejectedValue(new Error('500'));
    const root = await mount();
    await tapSegment(root, 'Tournaments');
    expect(texts(root).some(text => text.includes('Could not load tournaments'))).toBe(true);
    await tapSegment(root, 'Games');
    expect(listTitles(root).length).toBeGreaterThan(0);

    mockGetEvents.mockRejectedValue(new Error('500'));
    mockGetTournaments.mockResolvedValue({ items: [TOURNAMENT], total: 1, page: 1, page_size: 1 });
    const second = await mount();
    expect(texts(second)).toContain("Couldn't load your games");
    await tapSegment(second, 'Tournaments');
    expect(texts(second)).toContain('Summer Smash');
  });

  it('a new refreshKey (tournament created) selects Tournaments and reloads it', async () => {
    const root = await mount({ refreshKey: 7 });
    expect(segment(root, 'Tournaments').props.accessibilityState).toEqual({ selected: true });
    expect(texts(root)).toContain('Summer Smash');
    expect(mockGetTournaments).toHaveBeenCalledTimes(2); // mount load + refreshKey refetch (unchanged behaviour)
  });
});

describe('Games list (AD-15)', () => {
  it('is the union of My games and Open games, future and non-cancelled only, earliest first', async () => {
    expect(listTitles(await mountAll())).toEqual([
      'Open tennis', // +5h
      'Going badminton', // +10h
      'Open badminton', // +15h
      'Waitlisted tennis', // +20h
      'Hosted football', // +30h
    ]);
  });

  it('shows one badge per row: Hosting, Going, Waitlisted or Open, and the going count', async () => {
    const root = await mountAll();
    const row = (title: string): string[] =>
      texts(root.findAll(node => node.props.accessibilityRole === 'button' && texts(node).includes(title))[0]);
    expect(row('Hosted football')).toContain('Hosting');
    expect(row('Going badminton')).toContain('Going');
    expect(row('Waitlisted tennis')).toContain('Waitlisted');
    expect(row('Open tennis')).toContain('Open');
    expect(row('Open tennis')).toContain('5/12 going');
    for (const title of ['Hosted football', 'Going badminton', 'Waitlisted tennis', 'Open tennis']) {
      const badges = row(title).filter(text => ['Hosting', 'Going', 'Waitlisted', 'Open'].includes(text));
      expect(badges).toHaveLength(1);
    }
  });

  it('T1: opens on Mine without a route scope; chips read Mine | Public | All; Open and All still filter', async () => {
    const root = await mount();
    expect(selected(root, 'Mine games')).toBe(true);
    expect(selected(root, 'Open games')).toBe(false);
    expect(selected(root, 'All games')).toBe(false);
    const chipOrder = root
      .findAll(
        node =>
          node.props.accessibilityRole === 'button' &&
          ['Mine games', 'Open games', 'All games'].includes(node.props.accessibilityLabel) &&
          typeof node.props.onPress === 'function',
      )
      .map(node => node.props.accessibilityLabel);
    expect(chipOrder).toEqual(['Mine games', 'Open games', 'All games']);
    expect(texts(root).filter(text => ['Mine', 'Public', 'All'].includes(text)).slice(0, 3)).toEqual([
      'Mine',
      'Public',
      'All',
    ]);
    // My games also lists past games (after the upcoming ones).
    expect(listTitles(root)).toEqual(['Going badminton', 'Waitlisted tennis', 'Hosted football', 'Past going']);
    await tap(root, 'Open games');
    expect(listTitles(root)).toEqual(['Open tennis', 'Open badminton']);
    await tap(root, 'All games');
    expect(listTitles(root)).toHaveLength(5);
  });

  it('T1: a route scope from Home is still honoured over the Mine default', async () => {
    const root = await mountAll();
    expect(selected(root, 'All games')).toBe(true);
    expect(selected(root, 'Mine games')).toBe(false);
  });

  it('GV-1: the Active | All switch sits in the scope-chip row with its semantics unchanged', async () => {
    const root = await mount();
    const chip = root.findAll(node => typeof node.type === 'string' && node.props.accessibilityLabel === 'Mine games')[0];
    const hasSwitch = (node: Instance): boolean =>
      node.findAll(n => n.props.accessibilityRole === 'tab' && n.props.accessibilityLabel === 'Active games').length > 0;
    let row = chip.parent;
    while (row && !hasSwitch(row)) {
      row = row.parent;
    }
    // The nearest ancestor holding both is the scope-chip row, not the list or the sport chips.
    expect(row).not.toBeNull();
    expect(row!.findAll(n => n.props.testID === 'games-list')).toHaveLength(0);
    expect(row!.findAll(n => n.props.accessibilityLabel === 'Tennis')).toHaveLength(0);
    expect(segment(root, 'Active games').props.accessibilityState).toEqual({ selected: true });
    expect(texts(root)).toEqual(expect.arrayContaining(['Active', 'All']));
    mockGetEvents.mockClear();
    await tapSegment(root, 'All games');
    expect(segment(root, 'All games').props.accessibilityState).toEqual({ selected: true });
    expect(mockGetEvents).toHaveBeenLastCalledWith({ view: 'all', history: true }, expect.anything());
  });

  it('scope chips combine with the sport chips (multi-select, All exclusive)', async () => {
    const root = await mount();
    await tap(root, 'Open games');
    await tap(root, 'Tennis');
    expect(listTitles(root)).toEqual(['Open tennis']);
    await tap(root, 'Badminton');
    expect(listTitles(root)).toEqual(['Open tennis', 'Open badminton']);
    await tap(root, 'Mine games');
    expect(listTitles(root)).toEqual(['Going badminton', 'Waitlisted tennis', 'Past going']);
    await tap(root, 'All');
    expect(listTitles(root)).toEqual(['Going badminton', 'Waitlisted tennis', 'Hosted football', 'Past going']);
  });

  it('uses the same sport defaults as Home: the user\'s skill sports, otherwise All', async () => {
    mockGetProfile.mockResolvedValue(profileOf([{ sport: 'tennis', skill_level: 'expert' }]));
    const root = await mountAll();
    expect(selected(root, 'Tennis')).toBe(true);
    expect(selected(root, 'All')).toBe(false);
    expect(listTitles(root)).toEqual(['Open tennis', 'Waitlisted tennis']);
    mockGetProfile.mockResolvedValue(profileOf([]));
    const none = await mountAll();
    expect(selected(none, 'All')).toBe(true);
    expect(listTitles(none)).toHaveLength(5);
  });

  it('shows the filtered-empty message, or the scope\'s own empty copy without a sport filter', async () => {
    const root = await mount();
    await tap(root, 'Basketball');
    expect(texts(root)).toContain('No Basketball games here — clear the filter to see all');
    await tap(root, 'All');
    mockGetEvents.mockResolvedValue(eventsOf([]));
    const empty = await mount();
    expect(texts(empty)).toContain('No upcoming games yet — join one below or create your own.');
    await tap(empty, 'Open games');
    expect(texts(empty)).toContain('No public games to recommend right now.');
  });

  it('opens game detail from a row', async () => {
    const root = await mountAll();
    const row = root.findAll(
      node => node.props.accessibilityRole === 'button' && texts(node).includes('Open tennis'),
    )[0];
    await act(async () => row.props.onPress());
    expect(parentNavigate).toHaveBeenCalledWith('Home', {
      screen: 'EventDetail',
      params: { eventId: 'open1' },
      initial: false,
    });
  });

  it('shows a skeleton while loading and the error copy with a working Retry', async () => {
    mockGetEvents.mockRejectedValueOnce(new Error('500'));
    const root = await mount();
    expect(texts(root)).toContain("Couldn't load your games");
    await tap(root, 'Retry');
    expect(listTitles(root).length).toBeGreaterThan(0);

    mockGetEvents.mockReturnValue(new Promise(() => {}));
    const loading = await mount();
    expect(loading.findAll(node => node.props.testID === 'games-skeleton')).not.toHaveLength(0);
  });
});

describe('Home entry points (scope params)', () => {
  it('opens on the requested scope from the route params', async () => {
    const mine = await mount({ scope: 'mine', entryKey: 1 });
    expect(selected(mine, 'Mine games')).toBe(true);
    expect(listTitles(mine)).toEqual(['Going badminton', 'Waitlisted tennis', 'Hosted football', 'Past going']);
    const open = await mount({ scope: 'open', entryKey: 2 });
    expect(selected(open, 'Open games')).toBe(true);
    expect(listTitles(open)).toEqual(['Open tennis', 'Open badminton']);
  });

  it('a later entry (new entryKey) re-applies its scope and returns to Games, even from Tournaments', async () => {
    let renderer!: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(async () => {
      renderer = ReactTestRenderer.create(element({ scope: 'all', entryKey: 1 }));
    });
    const root = renderer.root;
    await tapSegment(root, 'Tournaments');
    await ReactTestRenderer.act(async () => {
      renderer.update(element({ scope: 'open', entryKey: 2 }));
    });
    expect(segment(root, 'Games').props.accessibilityState).toEqual({ selected: true });
    expect(selected(root, 'Open games')).toBe(true);
    // Same scope again with a new key still counts as a new entry.
    await tap(root, 'Mine games');
    await ReactTestRenderer.act(async () => {
      renderer.update(element({ scope: 'open', entryKey: 3 }));
    });
    expect(selected(root, 'Open games')).toBe(true);
  });
});

describe('Display status on My games', () => {
  const MIXED: Event[] = [
    makeEvent({ id: 'later', title: 'Hosted football', sport: 'football', organiser_id: ME, starts_at: hours(30), display_status: 'active' }),
    makeEvent({ id: 'soon', title: 'Going badminton', sport: 'badminton', current_user_rsvp_status: 'going', starts_at: hours(10), display_status: 'active' }),
    makeEvent({ id: 'old', title: 'Past going', current_user_rsvp_status: 'going', starts_at: hours(-50), display_status: 'completed' }),
    makeEvent({ id: 'cx', title: 'Cancelled open', organiser_id: ME, status: 'cancelled', starts_at: hours(-5), display_status: 'cancelled' }),
    makeEvent({ id: 'open-cx', title: 'Open tennis', sport: 'tennis', status: 'cancelled', starts_at: hours(5), display_status: 'cancelled' }),
  ];
  const pills = (root: Instance): string[] =>
    root.findAll(n => /^game-status-pill-/.test(String(n.props.testID)) && typeof n.type === 'string').map(n => n.props.testID);

  beforeEach(() => {
    mockGetEvents.mockResolvedValue(eventsOf(MIXED));
  });

  it('orders upcoming active first, then past games most recent first', async () => {
    const root = await mount({ scope: 'mine', entryKey: 1 });
    expect(listTitles(root)).toEqual(['Going badminton', 'Hosted football', 'Cancelled open', 'Past going']);
  });

  it('shows one status pill per row (active, cancelled, completed) next to the role badge', async () => {
    const root = await mount({ scope: 'mine', entryKey: 1 });
    expect(pills(root)).toEqual([
      'game-status-pill-active',
      'game-status-pill-active',
      'game-status-pill-cancelled',
      'game-status-pill-completed',
    ]);
    const list = root.find(n => n.props.testID === 'games-list' && typeof n.type !== 'string');
    expect(texts(list)).toEqual(expect.arrayContaining(['Active', 'Cancelled', 'Completed', 'Hosting', 'Going']));
  });

  it('requests history for My games only; other scopes do not show pills or past games', async () => {
    const root = await mount({ scope: 'mine', entryKey: 1 });
    expect(mockGetEvents).toHaveBeenLastCalledWith({ history: true }, expect.anything());
    await tap(root, 'Open games');
    expect(mockGetEvents).toHaveBeenLastCalledWith(undefined, expect.anything());
    expect(listTitles(root)).not.toContain('Cancelled open');
    expect(listTitles(root)).not.toContain('Past going');
    expect(listTitles(root)).not.toContain('Open tennis');
    expect(pills(root)).toEqual([]);
  });
});
