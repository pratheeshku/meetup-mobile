/**
 * Access consistency AC-10 (mobile AD-8): game, tournament and group detail fetch on every focus and
 * app foreground (a push or deep link that opens a detail already on the stack included), and a 404
 * closes the screen with one neutral "no longer available" message.
 */
import React from 'react';

import { apiClient } from '../../api/client';
import { getGroup } from '../../api/groups';
import { getFixtures, getRegistrations, getTournament } from '../../api/tournaments';
import { getSports } from '../../api/sports';
import AccessNoticeToast from '../../components/AccessNoticeToast';
import { clearAccessNotice, isAccessNoticeShowing } from '../../navigation/accessNotice';
import { resolveNotificationTarget } from '../../notifications/notificationRouting';
import { createFocusNavigation } from '../../test-utils/focusNavigation';
import type { FocusNavigationDouble } from '../../test-utils/focusNavigation';
import { act, render, renderAsync, texts } from '../../test-utils/render';
import type { Instance } from '../../test-utils/render';
import { __resetSportDisplayNamesCacheForTests } from '../../utils/labels';
import EventDetailScreen from '../EventDetailScreen';
import GroupDetailScreen from '../GroupDetailScreen';
import TournamentDetailScreen from '../TournamentDetailScreen';

jest.mock('../../api/client', () => ({ apiClient: { get: jest.fn(), patch: jest.fn(), post: jest.fn() } }));
jest.mock('../../api/groups', () => ({
  getGroup: jest.fn(),
  createGroupInvitation: jest.fn(),
  inviteMember: jest.fn(),
  removeMember: jest.fn(),
  updateMemberRole: jest.fn(),
  getMyGroups: jest.fn(),
}));
jest.mock('../../api/users', () => ({ searchUsers: jest.fn() }));
jest.mock('../../api/sports', () => ({ getSports: jest.fn() }));
jest.mock('../../api/tournaments', () => ({
  getTournament: jest.fn(),
  getFixtures: jest.fn(),
  getRegistrations: jest.fn(),
  registerForTournament: jest.fn(),
  withdrawFromTournament: jest.fn(),
  cancelTournament: jest.fn(),
}));
jest.mock('../../auth/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'user-me', nickname: 'Sam' } }),
}));

const mockGet = apiClient.get as jest.Mock;
const mockGetGroup = getGroup as jest.Mock;
const mockGetTournament = getTournament as jest.Mock;

const NOT_FOUND = { response: { status: 404, data: { detail: 'Not found' } } };
const NOTICE = 'This is no longer available.';

const rawEvent = {
  id: 'evt-1', organizer_id: 'someone', sport: 'badminton', title: 'Friday doubles', visibility: 'public',
  capacity: 8, starts_at: '2999-09-25T18:00:00Z', ends_at: '2999-09-25T20:00:00Z', allow_waitlist: true,
  status: 'upcoming', venue_name: 'Hall', going_count: 1, user_rsvp_status: null, skill_level_requirement: 'all_levels',
};
const GROUP = {
  id: 'g-1', name: 'Sunday League', description: '', owner_id: 'someone', member_count: 1,
  created_at: '2026-01-01T00:00:00Z', current_user_role: 'member', members: [],
};
const TOURNAMENT = {
  id: 't-1', name: 'Summer Smash', description: '', sport: 'tennis', organiser_id: 'org', organiser_nickname: 'org',
  format: 'knockout', status: 'upcoming', registration_open: true, participant_count: 4, max_participants: 8,
  starts_at: '2026-10-01T10:00:00Z', created_at: '2026-09-01T10:00:00Z',
  current_user_registration_status: 'none', is_organiser: false,
};

let nav: FocusNavigationDouble;

function props<C extends React.JSXElementConstructor<any>>(value: unknown): React.ComponentProps<C> {
  return value as React.ComponentProps<C>;
}

const mountEvent = (eventId = 'evt-1'): Promise<Instance> =>
  renderAsync(
    <EventDetailScreen
      {...props<typeof EventDetailScreen>({
        navigation: nav.navigation,
        route: { key: 'k', name: 'EventDetail', params: { eventId } },
      })}
    />,
  );
const mountGroup = (groupId = 'g-1'): Promise<Instance> =>
  renderAsync(
    <GroupDetailScreen
      {...props<typeof GroupDetailScreen>({
        navigation: nav.navigation,
        route: { key: 'k', name: 'GroupDetail', params: { groupId } },
      })}
    />,
  );
const mountTournament = (tournamentId = 't-1'): Promise<Instance> =>
  renderAsync(
    <TournamentDetailScreen
      {...props<typeof TournamentDetailScreen>({
        navigation: nav.navigation,
        route: { key: 'k', name: 'TournamentDetail', params: { tournamentId } },
      })}
    />,
  );

/** `GET /events/{id}`; `/participants` and `/config/...` calls return harmless data. */
function eventApi(behaviour: () => unknown): void {
  mockGet.mockImplementation((url: string) => {
    if (url.includes('/participants')) {
      return Promise.resolve({ data: [] });
    }
    if (url.startsWith('/events/')) {
      return Promise.resolve().then(behaviour as () => never);
    }
    return Promise.resolve({ data: {} });
  });
}
const eventFetches = (): number =>
  mockGet.mock.calls.filter(([url]) => /^\/events\/[^/]+$/.test(String(url))).length;

beforeEach(() => {
  nav = createFocusNavigation();
  clearAccessNotice();
  __resetSportDisplayNamesCacheForTests();
  mockGet.mockReset();
  eventApi(() => ({ data: rawEvent }));
  mockGetGroup.mockReset().mockResolvedValue(GROUP);
  mockGetTournament.mockReset().mockResolvedValue(TOURNAMENT);
  (getFixtures as jest.Mock).mockReset().mockResolvedValue([]);
  (getRegistrations as jest.Mock).mockReset().mockResolvedValue([]);
  (getSports as jest.Mock).mockReset().mockRejectedValue(new Error('down'));
});

afterEach(() => {
  clearAccessNotice();
  jest.restoreAllMocks();
});

interface DetailCase {
  name: string;
  mount: () => Promise<Instance>;
  fetches: () => number;
  /** Make the detail fetch answer 404 from now on. */
  gone: () => void;
  /** Make the detail fetch fail with a server error from now on. */
  broken: () => void;
  title: string;
}

const DETAILS: DetailCase[] = [
  {
    name: 'Game detail',
    mount: () => mountEvent(),
    fetches: eventFetches,
    gone: () => eventApi(() => Promise.reject(NOT_FOUND)),
    broken: () => eventApi(() => Promise.reject({ response: { status: 500 } })),
    title: 'Friday doubles',
  },
  {
    name: 'Tournament detail',
    mount: () => mountTournament(),
    fetches: () => mockGetTournament.mock.calls.length,
    gone: () => mockGetTournament.mockRejectedValue(NOT_FOUND),
    broken: () => mockGetTournament.mockRejectedValue({ response: { status: 500 } }),
    title: 'Summer Smash',
  },
  {
    name: 'Group detail',
    mount: () => mountGroup(),
    fetches: () => mockGetGroup.mock.calls.length,
    gone: () => mockGetGroup.mockRejectedValue(NOT_FOUND),
    broken: () => mockGetGroup.mockRejectedValue({ response: { status: 500 } }),
    title: 'Sunday League',
  },
];

describe.each(DETAILS)('$name', ({ mount, fetches, gone, broken, title }) => {
  it('fetches on mount, on every focus, and on app foreground', async () => {
    const root = await mount();
    expect(texts(root).some(x => x.includes(title))).toBe(true);
    const afterMount = fetches();
    expect(afterMount).toBeGreaterThanOrEqual(1);
    await act(async () => nav.fireFocus());
    const afterFocus = fetches();
    expect(afterFocus).toBeGreaterThan(afterMount);
    await act(async () => nav.foreground());
    expect(fetches()).toBeGreaterThan(afterFocus);
  });

  it('a 404 on open goes back and shows the neutral message once', async () => {
    gone();
    await mount();
    expect(nav.navigation.goBack).toHaveBeenCalledTimes(1);
    expect(isAccessNoticeShowing()).toBe(true);
    const toast = render(<AccessNoticeToast />);
    expect(texts(toast).filter(x => x === NOTICE)).toHaveLength(1);
  });

  it('a 404 on a later focus closes the screen once, even if the next trigger also gets a 404', async () => {
    const root = await mount();
    expect(texts(root).some(x => x.includes(title))).toBe(true);
    gone();
    await act(async () => nav.fireFocus());
    await act(async () => nav.foreground());
    expect(nav.navigation.goBack).toHaveBeenCalledTimes(1);
    expect(isAccessNoticeShowing()).toBe(true);
  });

  it('never shows a forbidden / removed message for a 404', async () => {
    gone();
    const root = await mount();
    const all = texts(root).join(' ').toLowerCase();
    expect(all).not.toMatch(/forbidden|removed|not allowed|permission/);
  });

  it('does not close the screen for a server error', async () => {
    const root = await mount();
    broken();
    await act(async () => nav.fireFocus());
    expect(nav.navigation.goBack).not.toHaveBeenCalled();
    expect(isAccessNoticeShowing()).toBe(false);
    expect(root).toBeDefined();
  });
});

describe('a push whose target now returns 404', () => {
  it.each([
    ['event_changed', mountEvent, () => eventApi(() => Promise.reject(NOT_FOUND))],
    ['tournament_invited', mountTournament, () => mockGetTournament.mockRejectedValue(NOT_FOUND)],
    ['group_invite', mountGroup, () => mockGetGroup.mockRejectedValue(NOT_FOUND)],
  ] as const)('%s opens the detail, which closes with the message and does not crash', async (type, mountScreen, gone) => {
    const target = resolveNotificationTarget(type, 'target-id');
    expect('params' in target).toBe(true);
    gone();
    const params = (target as { params: Record<string, string> }).params;
    const id = Object.values(params)[0];
    const root = await mountScreen(id);
    expect(root).toBeDefined();
    expect(nav.navigation.goBack).toHaveBeenCalledTimes(1);
    expect(isAccessNoticeShowing()).toBe(true);
  });

  it('a stack-root detail with nowhere to go back to still shows the message and does not crash', async () => {
    nav.navigation.canGoBack.mockReturnValue(false);
    eventApi(() => Promise.reject(NOT_FOUND));
    await mountEvent();
    expect(nav.navigation.goBack).not.toHaveBeenCalled();
    expect(isAccessNoticeShowing()).toBe(true);
  });
});
