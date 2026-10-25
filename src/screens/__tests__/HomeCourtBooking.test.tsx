/**
 * Home (tournament-experience AD-T2, board HomeBooking): the "Create a game in seconds" card is gone and the Book a
 * court block shows the admin's providers, hidden when there are none; Book opens the provider link in the system
 * browser. Create game stays on the centre + of the bottom bar (CreateTabButton), not on Home.
 */
import React from 'react';
import { Linking, StyleSheet } from 'react-native';
import { colors } from '../../theme/tokens';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { getCourtBooking } from '../../api/home';
import { getEvents } from '../../api/events';
import { getGroups } from '../../api/groups';
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
jest.mock('../../api/groups', () => ({ getMyGroups: jest.fn(), getGroups: jest.fn() }));
jest.mock('../../api/profile', () => ({ getProfile: jest.fn(), getProfileSummary: jest.fn() }));
jest.mock('../../api/sports', () => ({ getSports: jest.fn() }));
jest.mock('../../api/home', () => ({
  BUNDLED_FALLBACK_BANNER: { fallback: { id: 'fb', alt_text: 'fallback' }, banners: [], interval_seconds: 5 },
  getCachedBanners: jest.fn().mockResolvedValue(null),
  getCachedMenu: jest.fn().mockResolvedValue(null),
  getHomeBanners: jest.fn().mockRejectedValue(new Error('offline')),
  getHomeMenu: jest.fn().mockResolvedValue(null),
  getHomeSummary: jest.fn().mockRejectedValue(new Error('offline')),
  getCourtBooking: jest.fn(),
}));
jest.mock('../../hooks/useUnreadCount', () => ({ refreshUnreadCount: jest.fn(), useUnreadBadgeCount: () => 0 }));
jest.mock('../../auth/AuthContext', () => ({ useAuth: () => ({ user: { id: 'me', nickname: 'sam', display_name: 'Sam' } }) }));

const METRICS = { frame: { x: 0, y: 0, width: 360, height: 640 }, insets: { top: 24, left: 0, right: 0, bottom: 0 } };
const navigate = jest.fn();

const PROVIDERS = [
  { id: 'p1', name: 'CourtHub', description: 'Book badminton and tennis courts.', booking_url: 'https://courthub.example/book', logo_url: null },
  { id: 'p2', name: 'CourtNow', description: 'Hourly court rentals.', booking_url: 'https://courtnow.example', logo_url: null },
];

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
const block = (root: Instance): Instance[] => root.findAll(n => n.props.testID === 'court-booking-block' && typeof n.type === 'string');

beforeEach(() => {
  navigate.mockReset();
  (getEvents as jest.Mock).mockReset().mockResolvedValue({ items: [], total: 0, page: 1, page_size: 2 });
  (getGroups as jest.Mock).mockReset().mockResolvedValue({ items: [], total: 0, page: 1, page_size: 3 });
  (getSports as jest.Mock).mockReset().mockResolvedValue([]);
  (getProfile as jest.Mock).mockReset().mockResolvedValue({ id: 'me', email: 'a@b.c', nickname: 'sam', display_name: 'Sam', avatar_url: null, skill_levels: [] });
  (getProfileSummary as jest.Mock).mockReset().mockResolvedValue({ games_played: 0, games_hosted: 0, groups_count: 0, recent_games: [] });
  (getCourtBooking as jest.Mock).mockReset().mockResolvedValue(PROVIDERS);
});

describe('Home: Create a game card removed, Book a court added', () => {
  it('has no "Create a game in seconds" card and no Create Game button on the page', async () => {
    const root = await mount();
    const all = texts(root);
    expect(all.join(' ')).not.toMatch(/Create a game in seconds/i);
    expect(all).not.toContain('Create Game');
    expect(root.findAll(n => n.props.testID === 'create-game-card')).toHaveLength(0);
  });

  it('shows each provider in order with its description and a Book link', async () => {
    const root = await mount();
    expect(block(root)).toHaveLength(1);
    const all = texts(block(root)[0]);
    expect(all).toContain('Book a court');
    expect(all).toContain('Reserve a court with one of our booking partners.');
    expect(all.indexOf('CourtHub')).toBeLessThan(all.indexOf('CourtNow'));
    expect(all).toContain('Book badminton and tennis courts.');
    expect(all).toContain('Opens in your browser');
    expect(all.filter(x => x === 'Book')).toHaveLength(2);
  });

  it('tournament-registration AD-8: every Book button is the call-to-action blue with white text, whatever the row', async () => {
    (getCourtBooking as jest.Mock).mockResolvedValue([
      ...PROVIDERS,
      { id: 'p3', name: 'CourtThree', description: 'Third.', booking_url: 'https://three.example', logo_url: null },
      { id: 'p4', name: 'CourtFour', description: 'Fourth.', booking_url: 'https://four.example', logo_url: null },
    ]);
    const root = await mount();
    const backgrounds = ['p1', 'p2', 'p3', 'p4'].map(id => {
      const node = root.findAll(n => n.props.testID === `court-book-${id}` && typeof n.props.onPress === 'function')[0];
      const style = typeof node.props.style === 'function' ? node.props.style({ pressed: false }) : node.props.style;
      return StyleSheet.flatten(style).backgroundColor;
    });
    expect(new Set(backgrounds).size).toBe(1);
    expect(backgrounds[0]).toBe(colors.ctaBlue);
    const labels = block(root)[0].findAll(n => (n.type as unknown) === 'Text' && n.props.children === 'Book');
    labels.forEach(label => expect(StyleSheet.flatten(label.props.style).color).toBe(colors.white));
  });

  it('is hidden when the list is empty, and when the call fails', async () => {
    (getCourtBooking as jest.Mock).mockResolvedValue([]);
    expect(block(await mount())).toHaveLength(0);
    (getCourtBooking as jest.Mock).mockRejectedValue(new Error('down'));
    expect(block(await mount())).toHaveLength(0);
  });

  it('Book opens the provider link in the system browser and sends nothing about the user', async () => {
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    const root = await mount();
    const button = root.findAll(n => n.props.testID === 'court-book-p1' && typeof n.props.onPress === 'function')[0];
    expect(button.props.accessibilityLabel).toBe('Book a court with CourtHub');
    await act(async () => {
      button.props.onPress();
    });
    expect(open).toHaveBeenCalledWith('https://courthub.example/book');
    expect(getCourtBooking as jest.Mock).toHaveBeenCalledWith();
    open.mockRestore();
  });
});
