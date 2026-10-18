/** Home "Upcoming games": my games and open games together (earliest first), with Join on unjoined cards. */
import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { getEvents, rsvpEvent } from '../../api/events';
import { getProfile, getProfileSummary } from '../../api/profile';
import { getSports } from '../../api/sports';
import { makeEvent } from '../../test-utils/makeEvent';
import { act, renderAsync, texts } from '../../test-utils/render';
import type { Instance } from '../../test-utils/render';
import type { Event } from '../../types/event';
import HomeScreen from '../HomeScreen';

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useScrollToTop: jest.fn(),
  useFocusEffect: jest.fn(),
}));
jest.mock('../../api/events', () => ({ getEvents: jest.fn(), rsvpEvent: jest.fn() }));
jest.mock('../../api/groups', () => ({ getMyGroups: jest.fn(), getGroups: jest.fn().mockResolvedValue({ items: [] }) }));
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
const days = (d: number): string => new Date(Date.now() + d * 86_400_000).toISOString();

const feed = (): Event[] => [
  makeEvent({ id: 'host', title: 'Hosted four', organiser_id: 'me', starts_at: days(4) }),
  makeEvent({ id: 'open-late', title: 'Open late', starts_at: days(3) }),
  makeEvent({ id: 'going', title: 'Going game', current_user_rsvp_status: 'going', starts_at: days(2) }),
  makeEvent({ id: 'open-early', title: 'Open early', starts_at: days(1) }),
  makeEvent({ id: 'invite', title: 'Invite only', visibility: 'invite_only', starts_at: days(0.5) }),
  makeEvent({ id: 'past', title: 'Past open', starts_at: days(-1) }),
  makeEvent({ id: 'cancelled', title: 'Cancelled open', status: 'cancelled', starts_at: days(1.5) }),
];

let server: Event[] = [];

async function mount(): Promise<Instance> {
  const props = {
    navigation: { navigate: jest.fn(), addListener: jest.fn(() => jest.fn()) },
    route: { key: 'k', name: 'EventsList', params: undefined },
  } as unknown as React.ComponentProps<typeof HomeScreen>;
  return renderAsync(
    <SafeAreaProvider initialMetrics={METRICS}>
      <HomeScreen {...props} />
    </SafeAreaProvider>,
  );
}

const panelTexts = (root: Instance): string[] =>
  texts(root.find(n => n.props.testID === 'upcoming-games-tab-content' && typeof n.type === 'string'));
const titlesInOrder = (root: Instance): string[] =>
  panelTexts(root).filter(x => ['Hosted four', 'Open late', 'Going game', 'Open early', 'Invite only', 'Past open', 'Cancelled open'].includes(x));
const joinButtons = (root: Instance): Instance[] =>
  root.findAll(n => n.props.testID === 'card-join-button' && typeof n.props.onPress === 'function');

beforeEach(() => {
  server = feed();
  (getEvents as jest.Mock).mockReset().mockImplementation(async () => ({ items: server, total: server.length, page: 1, page_size: server.length }));
  (rsvpEvent as jest.Mock).mockReset().mockResolvedValue(undefined);
  (getSports as jest.Mock).mockReset().mockResolvedValue([]);
  (getProfile as jest.Mock).mockReset().mockResolvedValue({ id: 'me', email: 'a@b.c', nickname: 'sam', display_name: 'Sam', avatar_url: null, skill_levels: [] });
  (getProfileSummary as jest.Mock).mockReset().mockResolvedValue({ games_played: 0, games_hosted: 0, groups_count: 0, recent_games: [] });
});

describe('the list', () => {
  it('asks for up to the API maximum and no server-side mine/limit-2', async () => {
    await mount();
    const params = (getEvents as jest.Mock).mock.calls[0][0];
    expect(params).toMatchObject({ upcoming: true, limit: 100 });
    expect(params).not.toHaveProperty('mine');
  });

  it('shows my games and open games together, earliest start first, two rows', async () => {
    const root = await mount();
    expect(titlesInOrder(root)).toEqual(['Open early', 'Going game']);
  });

  it('still shows two rows when the earliest games are all open (client-side pick)', async () => {
    server = [
      makeEvent({ id: 'a', title: 'Open early', starts_at: days(1) }),
      makeEvent({ id: 'b', title: 'Open late', starts_at: days(2) }),
      makeEvent({ id: 'c', title: 'Going game', current_user_rsvp_status: 'going', starts_at: days(3) }),
    ];
    const root = await mount();
    expect(titlesInOrder(root)).toEqual(['Open early', 'Open late']);
  });

  it('excludes invite-only, past and cancelled games', async () => {
    const root = await mount();
    for (const title of ['Invite only', 'Past open', 'Cancelled open']) {
      expect(panelTexts(root)).not.toContain(title);
    }
  });

  it('shows the hosted game with a Hosting badge when it is among the first two', async () => {
    server = [makeEvent({ id: 'host', title: 'Hosted four', organiser_id: 'me', starts_at: days(1) })];
    const root = await mount();
    expect(titlesInOrder(root)).toEqual(['Hosted four']);
    expect(panelTexts(root)).toContain('Hosting');
    expect(joinButtons(root)).toHaveLength(0);
  });
});

describe('Join on cards', () => {
  it('only on games the user has not joined (rsvp none, not organiser)', async () => {
    const root = await mount();
    // rows: Open early (unjoined) and Going game (joined)
    expect(joinButtons(root)).toHaveLength(1);
    expect(joinButtons(root)[0].props.accessibilityLabel).toBe('Join, Open early');
    expect(panelTexts(root)).toContain('Going');
  });

  it('success: calls the RSVP, refreshes the list, the card becomes a Going card and the order is unchanged', async () => {
    const root = await mount();
    const before = (getEvents as jest.Mock).mock.calls.length;
    server = server.map(e => (e.id === 'open-early' ? { ...e, current_user_rsvp_status: 'going' as const } : e));
    await act(async () => {
      joinButtons(root)[0].props.onPress();
    });
    expect(rsvpEvent).toHaveBeenCalledWith('open-early', expect.objectContaining({ correlationId: expect.any(String) }));
    expect((getEvents as jest.Mock).mock.calls.length).toBeGreaterThan(before);
    expect(titlesInOrder(root)).toEqual(['Open early', 'Going game']);
    expect(joinButtons(root)).toHaveLength(0);
    expect(panelTexts(root).filter(x => x === 'Going')).toHaveLength(2);
    expect(root.findAll(n => n.props.testID === 'home-join-error')).toHaveLength(0);
  });

  it('failure: shows the backend error text under the card and keeps the Join button', async () => {
    (rsvpEvent as jest.Mock).mockRejectedValueOnce({ response: { status: 400, data: { detail: "Your skill level doesn't meet this game's requirement" } } });
    const root = await mount();
    const before = (getEvents as jest.Mock).mock.calls.length;
    await act(async () => {
      joinButtons(root)[0].props.onPress();
    });
    expect(panelTexts(root)).toContain("Your skill level doesn't meet this game's requirement");
    expect(joinButtons(root)).toHaveLength(1);
    expect((getEvents as jest.Mock).mock.calls.length).toBe(before); // no refresh on failure
  });

  it('failure without a detail: the generic message', async () => {
    (rsvpEvent as jest.Mock).mockRejectedValueOnce(new Error('network'));
    const root = await mount();
    await act(async () => {
      joinButtons(root)[0].props.onPress();
    });
    expect(panelTexts(root)).toContain('Could not join this game. Please try again.');
  });

  it('a new attempt clears the previous error', async () => {
    (rsvpEvent as jest.Mock).mockRejectedValueOnce({ response: { status: 403, data: { detail: 'Not a member' } } });
    const root = await mount();
    await act(async () => {
      joinButtons(root)[0].props.onPress();
    });
    expect(panelTexts(root)).toContain('Not a member');
    await act(async () => {
      joinButtons(root)[0].props.onPress();
    });
    expect(panelTexts(root)).not.toContain('Not a member');
  });
});

describe('Upcoming tile count', () => {
  it('still comes from the summary / is not derived from the whole feed', async () => {
    const root = await mount();
    const tile = root.find(n => n.props.testID === 'tab-tile-upcoming' && typeof n.type === 'string');
    // The summary call fails in this test, so the count falls back to the rows shown (at most 2), never the 100-game feed.
    const count = Number(texts(tile).find(x => /^\d+$/.test(x)));
    expect(count).toBeLessThanOrEqual(2);
  });
});
