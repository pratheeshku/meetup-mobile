/**
 * dashboard-profile-stats: the Played/Hosted/Groups strip lives on Home, directly
 * below the banner; a Won tile appears only for games_won > 0; a failed
 * profile-summary call hides the block silently; pull-to-refresh refetches.
 */
import React from 'react';
import { RefreshControl } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { getEvents } from '../../api/events';
import { getProfile, getProfileSummary } from '../../api/profile';
import { getSports } from '../../api/sports';
import { act, renderAsync, texts } from '../../test-utils/render';
import type { Instance } from '../../test-utils/render';
import HomeScreen from '../HomeScreen';

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useScrollToTop: jest.fn(),
  useFocusEffect: jest.fn(),
}));
jest.mock('../../api/events', () => ({ getEvents: jest.fn() }));
jest.mock('../../api/groups', () => ({
  getMyGroups: jest.fn().mockResolvedValue({ items: [], total: 0, page: 1, page_size: 1 }),
  getGroups: jest.fn().mockResolvedValue({ items: [], total: 0, page: 1, page_size: 1 }),
  getCachedHomeGroups: jest.fn().mockResolvedValue([]),
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
}));
jest.mock('../../hooks/useUnreadCount', () => ({
  refreshUnreadCount: jest.fn(),
  useUnreadBadgeCount: () => 0,
}));
jest.mock('../../auth/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'me', nickname: 'sam', display_name: 'Sam' } }),
}));

const mockSummary = getProfileSummary as jest.Mock;

const METRICS = {
  frame: { x: 0, y: 0, width: 360, height: 640 },
  insets: { top: 24, left: 0, right: 0, bottom: 0 },
};
const mount = (): Promise<Instance> => {
  const props = {
    navigation: { navigate: jest.fn(), addListener: jest.fn(() => jest.fn()) },
    route: { key: 'k', name: 'EventsList', params: undefined },
  } as unknown as React.ComponentProps<typeof HomeScreen>;
  return renderAsync(
    <SafeAreaProvider initialMetrics={METRICS}>
      <HomeScreen {...props} />
    </SafeAreaProvider>,
  );
};

const strip = (root: Instance): Instance[] =>
  root.findAll(n => n.props.testID === 'profile-stats-strip' && typeof n.type === 'string');
const columns = (root: Instance): number =>
  strip(root)[0].findAll(n => typeof n.type === 'string' && n.props.style && JSON.stringify(n.props.style).includes('"flex":1')).length;

beforeEach(() => {
  (getEvents as jest.Mock).mockReset().mockResolvedValue({ items: [], total: 0, page: 1, page_size: 1 });
  (getSports as jest.Mock).mockReset().mockResolvedValue([]);
  (getProfile as jest.Mock).mockReset().mockResolvedValue({
    id: 'me', email: 'a@b.c', nickname: 'sam', display_name: 'Sam', avatar_url: null, skill_levels: [],
  });
  mockSummary.mockReset().mockResolvedValue({
    games_played: 12, games_hosted: 3, groups_count: 2, recent_games: [],
  });
});

describe('Home stats strip', () => {
  it('appears directly below the banner and above the tab tiles', async () => {
    const root = await mount();
    const ids = root
      .findAll(n => typeof n.type === 'string' && typeof n.props.testID === 'string')
      .map(n => n.props.testID as string);
    const banner = ids.findIndex(id => id.startsWith('home-banner'));
    const stats = ids.indexOf('profile-stats-strip');
    const tiles = ids.indexOf('home-tab-tiles');
    expect(banner).toBeGreaterThanOrEqual(0);
    expect(stats).toBeGreaterThan(banner);
    expect(tiles).toBeGreaterThan(stats);
    expect(texts(root)).toEqual(expect.arrayContaining(['12', 'Played', '3', 'Hosted', '2', 'Groups']));
  });

  it('shows exactly three tiles when games_won is absent', async () => {
    const root = await mount();
    expect(texts(root)).not.toContain('Won');
    expect(root.findAll(n => n.props.testID === 'profile-stat-won')).toHaveLength(0);
    expect(columns(root)).toBe(3);
  });

  it('shows exactly three tiles when games_won is 0', async () => {
    mockSummary.mockResolvedValue({ games_played: 1, games_hosted: 0, groups_count: 0, games_won: 0, recent_games: [] });
    const root = await mount();
    expect(texts(root)).not.toContain('Won');
    expect(columns(root)).toBe(3);
  });

  it('shows a fourth Won tile when games_won > 0', async () => {
    mockSummary.mockResolvedValue({ games_played: 12, games_hosted: 3, groups_count: 2, games_won: 5, recent_games: [] });
    const root = await mount();
    expect(texts(root)).toEqual(expect.arrayContaining(['Won', '5']));
    expect(columns(root)).toBe(4);
  });

  it('hides the block silently when the summary call fails (no error text)', async () => {
    mockSummary.mockRejectedValue(new Error('500'));
    const root = await mount();
    expect(strip(root)).toHaveLength(0);
    expect(texts(root).join(' ')).not.toMatch(/Played|Hosted/);
  });

  it('does not block Home: the rest renders while the summary is pending', async () => {
    mockSummary.mockReturnValue(new Promise(() => {}));
    const root = await mount();
    expect(strip(root)).toHaveLength(0);
    expect(root.findAll(n => n.props.testID === 'home-tab-tiles').length).toBeGreaterThan(0);
  });

  it('pull-to-refresh refetches the stats', async () => {
    const root = await mount();
    const before = mockSummary.mock.calls.length;
    mockSummary.mockResolvedValue({ games_played: 99, games_hosted: 3, groups_count: 2, recent_games: [] });
    await act(async () => {
      await root.findByType(RefreshControl).props.onRefresh();
    });
    expect(mockSummary.mock.calls.length).toBeGreaterThan(before);
    expect(texts(root)).toContain('99');
  });
});
