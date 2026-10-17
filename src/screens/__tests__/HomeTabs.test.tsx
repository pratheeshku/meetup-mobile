/** Home folder tabs: Upcoming games (default) / My groups switch in place; the panel follows the active tab. */
import React from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { getEvents } from '../../api/events';
import { getGroups } from '../../api/groups';
import { getProfile, getProfileSummary } from '../../api/profile';
import { getSports } from '../../api/sports';
import { makeEvent } from '../../test-utils/makeEvent';
import { act, renderAsync, texts } from '../../test-utils/render';
import type { Instance } from '../../test-utils/render';
import HomeScreen from '../HomeScreen';

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useScrollToTop: jest.fn(),
  useFocusEffect: jest.fn(),
}));
jest.mock('../../api/events', () => ({ getEvents: jest.fn() }));
jest.mock('../../api/groups', () => ({ getMyGroups: jest.fn(), getGroups: jest.fn(), getCachedHomeGroups: jest.fn().mockResolvedValue([]) }));
jest.mock('../../api/profile', () => ({ getProfile: jest.fn(), getProfileSummary: jest.fn() }));
jest.mock('../../api/sports', () => ({ getSports: jest.fn() }));
jest.mock('../../api/home', () => ({
  BUNDLED_FALLBACK_BANNER: { fallback: { id: 'fb', alt_text: 'fallback' }, banners: [], interval_seconds: 5 },
  getCachedBanners: jest.fn().mockResolvedValue(null),
  getCachedMenu: jest.fn().mockResolvedValue(null),
  getHomeBanners: jest.fn().mockRejectedValue(new Error('offline')),
  getHomeMenu: jest.fn().mockResolvedValue(null),
  getHomeSummary: jest.fn().mockRejectedValue(new Error('offline')),
}));
jest.mock('../../hooks/useUnreadCount', () => ({ refreshUnreadCount: jest.fn(), useUnreadBadgeCount: () => 0 }));
jest.mock('../../auth/AuthContext', () => ({ useAuth: () => ({ user: { id: 'me', nickname: 'sam', display_name: 'Sam' } }) }));

const METRICS = { frame: { x: 0, y: 0, width: 360, height: 640 }, insets: { top: 24, left: 0, right: 0, bottom: 0 } };
const navigate = jest.fn();

const GROUP = {
  id: 'g-1', name: 'Sunday Footballers', description: '', owner_id: 'x', owner_nickname: 'x',
  created_at: '2026-01-01T00:00:00Z', current_user_role: 'member', member_count: 4,
};

async function mount(): Promise<Instance> {
  const props = {
    navigation: { navigate, addListener: jest.fn(() => jest.fn()) },
    route: { key: 'k', name: 'EventsList', params: undefined },
  } as unknown as React.ComponentProps<typeof HomeScreen>;
  return renderAsync(
    <SafeAreaProvider initialMetrics={METRICS}>
      <HomeScreen {...props} />
    </SafeAreaProvider>,
  );
}
const tab = (root: Instance, id: string): Instance => root.find(n => n.props.testID === id && typeof n.type === 'string');
const panel = (root: Instance): Instance =>
  root.find(n => typeof n.type === 'string' && /(upcoming-games|your-groups)-tab-content/.test(String(n.props.testID)));
const press = async (node: Instance): Promise<void> => {
  // The host View has no onPress; walk up to the Pressable that owns it.
  let target: Instance | null = node;
  while (target && typeof target.props.onPress !== 'function') target = target.parent;
  if (!target) throw new Error('nothing pressable');
  const found = target;
  await act(async () => {
    found.props.onPress();
  });
};

beforeEach(() => {
  navigate.mockReset();
  (getEvents as jest.Mock).mockReset().mockResolvedValue({
    items: [makeEvent({ id: 'e1', title: 'Sunday Doubles', current_user_rsvp_status: 'going', starts_at: new Date(Date.now() + 86_400_000).toISOString() })], total: 1, page: 1, page_size: 2,
  });
  (getGroups as jest.Mock).mockReset().mockResolvedValue({ items: [GROUP], total: 1, page: 1, page_size: 3 });
  (getSports as jest.Mock).mockReset().mockResolvedValue([]);
  (getProfile as jest.Mock).mockReset().mockResolvedValue({ id: 'me', email: 'a@b.c', nickname: 'sam', display_name: 'Sam', avatar_url: null, skill_levels: [] });
  (getProfileSummary as jest.Mock).mockReset().mockResolvedValue({ games_played: 1, games_hosted: 1, groups_count: 1, recent_games: [] });
});

describe('folder tabs', () => {
  it('defaults to Upcoming games: games list and panel heading, groups list hidden', async () => {
    const root = await mount();
    expect(tab(root, 'tab-tile-upcoming').props.accessibilityState.selected).toBe(true);
    expect(tab(root, 'tab-tile-groups').props.accessibilityState.selected).toBe(false);
    const all = texts(panel(root));
    expect(all).toContain('Upcoming games'); // panel heading
    expect(all).toContain('View all');
    expect(all.some(x => x.includes('Sunday Doubles'))).toBe(true);
    expect(all).not.toContain('Sunday Footballers');
  });

  it('pressing the groups tab shows the groups list, hides the games list, and the heading becomes "My groups"', async () => {
    const root = await mount();
    await press(tab(root, 'tab-tile-groups'));
    expect(tab(root, 'tab-tile-groups').props.accessibilityState.selected).toBe(true);
    const all = texts(panel(root));
    expect(all).toContain('My groups');
    expect(all).not.toContain('Upcoming games');
    expect(all.some(x => x.includes('Sunday Footballers'))).toBe(true);
    expect(all.some(x => x.includes('Sunday Doubles'))).toBe(false);
    // the tab itself is titled My groups too ("Your groups" is gone)
    expect(texts(tab(root, 'tab-tile-groups'))).toContain('My groups');
    expect(texts(root)).not.toContain('Your groups');
  });

  it('switches in place: no navigation and no refetch, and it switches back', async () => {
    const root = await mount();
    const eventCalls = (getEvents as jest.Mock).mock.calls.length;
    const groupCalls = (getGroups as jest.Mock).mock.calls.length;
    await press(tab(root, 'tab-tile-groups'));
    await press(tab(root, 'tab-tile-upcoming'));
    expect(navigate).not.toHaveBeenCalled();
    expect((getEvents as jest.Mock).mock.calls.length).toBe(eventCalls);
    expect((getGroups as jest.Mock).mock.calls.length).toBe(groupCalls);
    expect(texts(panel(root))).toContain('Upcoming games');
  });

  it('keeps each tab\'s title, count and subtitle', async () => {
    const root = await mount();
    const upcoming = texts(tab(root, 'tab-tile-upcoming'));
    expect(upcoming).toEqual(expect.arrayContaining(['Upcoming games', 'This week']));
    const groups = texts(tab(root, 'tab-tile-groups'));
    expect(groups).toEqual(expect.arrayContaining(['My groups', 'Active groups']));
  });
});

describe('folder geometry', () => {
  it('active tab 104 tall, idle 92; active has no bottom border and overlaps the panel by 1.5', async () => {
    const root = await mount();
    const active = StyleSheet.flatten(tab(root, 'tab-tile-upcoming').props.style);
    const idle = StyleSheet.flatten(tab(root, 'tab-tile-groups').props.style);
    expect(active).toMatchObject({ height: 104, borderBottomWidth: 0, marginBottom: -1.5, zIndex: 2, elevation: 0, borderTopLeftRadius: 16, borderTopRightRadius: 16, borderBottomLeftRadius: 0 });
    expect(idle).toMatchObject({ height: 92, borderBottomWidth: 0, borderTopLeftRadius: 16 });
    expect(active.backgroundColor).not.toBe(idle.backgroundColor);
    expect(active.borderColor).not.toBe('#1D4ED8'); // not the dark brand blue
    const row = StyleSheet.flatten(root.find(n => n.props.testID === 'home-tab-tiles' && typeof n.type === 'string').props.style);
    expect(row).toMatchObject({ flexDirection: 'row', gap: 4, alignItems: 'flex-end', marginTop: 12, marginHorizontal: 16 });
  });

  it('panel has the active tab\'s tint and border and a square corner under the active tab', async () => {
    const root = await mount();
    const active = StyleSheet.flatten(tab(root, 'tab-tile-upcoming').props.style);
    const first = StyleSheet.flatten(panel(root).props.style);
    expect(first).toMatchObject({ padding: 10, borderWidth: 1.5, borderRadius: 18, borderTopLeftRadius: 0, marginTop: 0, marginHorizontal: 16, zIndex: 1 });
    expect(first.backgroundColor).toBe(active.backgroundColor);
    expect(first.borderColor).toBe(active.borderColor);

    await press(tab(root, 'tab-tile-groups'));
    const second = StyleSheet.flatten(panel(root).props.style);
    expect(second).toMatchObject({ borderTopRightRadius: 0, borderRadius: 18 });
    expect(second.borderTopLeftRadius).toBeUndefined();
  });
});
