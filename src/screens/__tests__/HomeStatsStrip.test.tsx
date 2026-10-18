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
import { StyleSheet } from 'react-native';
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
const wonTile = (root: Instance): Instance[] =>
  root.findAll(n => n.props.testID === 'profile-stat-won' && typeof n.type === 'string');
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

describe('Home stats strip layout', () => {
  it('cells are ordered Played, Won, Hosted, Groups', async () => {
    const root = await mount();
    const ids = root
      .findAll(n => typeof n.type === 'string' && /^profile-stat-/.test(String(n.props.testID)))
      .map(n => n.props.testID);
    expect(ids).toEqual(['profile-stat-played', 'profile-stat-won', 'profile-stat-hosted', 'profile-stat-groups']);
    const labels = texts(strip(root)[0]).filter(x => ['Played', 'Won', 'Hosted', 'Groups'].includes(x));
    expect(labels).toEqual(['Played', 'Won', 'Hosted', 'Groups']);
  });

  it('is one fixed 56dp card with a 1.5dp border and three 1 x 26 dividers', async () => {
    const root = await mount();
    const card = StyleSheet.flatten(strip(root)[0].props.style);
    expect(card).toMatchObject({ height: 56, borderWidth: 1.5, flexDirection: 'row', alignItems: 'center' });
    const dividers = strip(root)[0]
      .findAll(n => typeof n.type === 'string')
      .filter(n => {
        const st = StyleSheet.flatten(n.props.style);
        return st?.width === 1 && st?.height === 26;
      });
    expect(dividers).toHaveLength(3);
  });

  it('values and labels are single-line and fit their cell (1.3 font scale safe)', async () => {
    const root = await mount();
    const cellTexts = strip(root)[0].findAll(n => (n.type as unknown) === 'Text');
    expect(cellTexts).toHaveLength(8);
    for (const node of cellTexts) {
      expect(node.props.numberOfLines).toBe(1);
      expect(node.props.adjustsFontSizeToFit).toBe(true);
    }
  });

  it('value colours: Played primary, Won purple, Hosted dark warning, Groups dark success', async () => {
    const root = await mount();
    const valueColor = (id: string): string => {
      const cell = root.find(n => n.props.testID === id && typeof n.type === 'string');
      const value = cell.findAll(n => (n.type as unknown) === 'Text')[0];
      return String(StyleSheet.flatten(value.props.style).color);
    };
    expect(valueColor('profile-stat-played')).toBe('#1565C0');
    expect(valueColor('profile-stat-won')).toBe('#8B5CF6');
    expect(valueColor('profile-stat-hosted')).toBe('#B45309');
    expect(valueColor('profile-stat-groups')).toBe('#166534');
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
    expect(texts(root)).toEqual(
      expect.arrayContaining(['12', 'Played', '3', 'Hosted', '2', 'Groups', 'Won', '0']),
    );
  });

  it('renders 0 for the Won tile when games_won is absent', async () => {
    const root = await mount();
    expect(texts(root)).toEqual(expect.arrayContaining(['Won', '0']));
    expect(wonTile(root)).toHaveLength(1);
    expect(columns(root)).toBe(4);
  });

  it('renders 0 for the Won tile when games_won is 0', async () => {
    mockSummary.mockResolvedValue({ games_played: 1, games_hosted: 0, groups_count: 0, games_won: 0, recent_games: [] });
    const root = await mount();
    expect(texts(root)).toEqual(expect.arrayContaining(['Won', '0']));
    expect(wonTile(root)).toHaveLength(1);
    expect(columns(root)).toBe(4);
  });

  it('renders the value for the Won tile when games_won is present', async () => {
    mockSummary.mockResolvedValue({ games_played: 12, games_hosted: 3, groups_count: 2, games_won: 3, recent_games: [] });
    const root = await mount();
    expect(texts(root)).toEqual(expect.arrayContaining(['Won', '3']));
    expect(wonTile(root)).toHaveLength(1);
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
