/**
 * ac-m-followup. (1) A 404 returned by an ACTION on an open game / group / tournament detail goes
 * through the same close-and-message path as a 404 detail fetch; other errors keep their handling.
 * (2) After the user's OWN successful cancel / delete / leave / withdraw, a later 404 shows the
 * existing completion flow only: never "no longer available".
 */
import React from 'react';
import { Alert } from 'react-native';

import { apiClient } from '../../api/client';
import {
  deleteGroup,
  getGroup,
  getGroupMemberCard,
  removeMember,
  updateMemberRole,
} from '../../api/groups';
import {
  cancelTournament,
  getFixtures,
  getRegistrations,
  getTournament,
  registerForTournament,
  respondToTournamentInvitation,
  withdrawFromTournament,
} from '../../api/tournaments';
import { getSports } from '../../api/sports';
import { clearAccessNotice, isAccessNoticeShowing } from '../../navigation/accessNotice';
import { showCompletion } from '../../navigation/showCompletion';
import { createFocusNavigation } from '../../test-utils/focusNavigation';
import type { FocusNavigationDouble } from '../../test-utils/focusNavigation';
import { act, renderAsync, texts } from '../../test-utils/render';
import type { Instance } from '../../test-utils/render';
import { __resetSportDisplayNamesCacheForTests } from '../../utils/labels';
import EventDetailScreen from '../EventDetailScreen';
import GroupDetailScreen from '../GroupDetailScreen';
import TournamentDetailScreen from '../TournamentDetailScreen';

jest.mock('../../api/client', () => ({ apiClient: { get: jest.fn(), patch: jest.fn(), post: jest.fn() } }));
jest.mock('../../api/groups', () => ({
  getGroup: jest.fn(),
  getGroupMemberCard: jest.fn(),
  deleteGroup: jest.fn(),
  removeMember: jest.fn(),
  updateMemberRole: jest.fn(),
  createGroupInvitation: jest.fn(),
  inviteMember: jest.fn(),
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
  respondToTournamentInvitation: jest.fn(),
}));
jest.mock('../../navigation/showCompletion', () => ({ showCompletion: jest.fn() }));
jest.mock('../../auth/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'user-me', nickname: 'Sam' } }),
}));

const mockGet = apiClient.get as jest.Mock;
const mockPost = apiClient.post as jest.Mock;
const mockGetGroup = getGroup as jest.Mock;
const mockGetTournament = getTournament as jest.Mock;
const mockShowCompletion = showCompletion as jest.Mock;

const NOT_FOUND = { response: { status: 404, data: { detail: 'Not found' } } };
const CONFLICT = { response: { status: 409, data: { detail: 'Game is full' } } };

const baseEvent = {
  id: 'evt-1', organizer_id: 'someone', sport: 'badminton', title: 'Friday doubles', visibility: 'public',
  capacity: 8, starts_at: '2999-09-25T18:00:00Z', ends_at: '2999-09-25T20:00:00Z', allow_waitlist: true,
  status: 'upcoming', venue_name: 'Hall', going_count: 1, user_rsvp_status: null, skill_level_requirement: 'all_levels',
};
const GROUP_MEMBER = {
  id: 'g-1', name: 'Sunday League', description: '', owner_id: 'someone', member_count: 2,
  created_at: '2026-01-01T00:00:00Z', current_user_role: 'member',
  members: [
    { user_id: 'someone', nickname: 'boss', display_name: 'Boss', photo_url: null, role: 'owner', joined_at: '2026-01-01T00:00:00Z' },
    { user_id: 'user-me', nickname: 'sam', display_name: 'Sam', photo_url: null, role: 'member', joined_at: '2026-01-02T00:00:00Z' },
  ],
};
const GROUP_OWNER = {
  ...GROUP_MEMBER, owner_id: 'user-me', current_user_role: 'owner',
  members: [
    { user_id: 'user-me', nickname: 'sam', display_name: 'Sam', photo_url: null, role: 'owner', joined_at: '2026-01-01T00:00:00Z' },
    { user_id: 'u-2', nickname: 'alex', display_name: 'Alex', photo_url: null, role: 'member', joined_at: '2026-01-02T00:00:00Z' },
  ],
};
const baseTournament = {
  id: 't-1', name: 'Summer Smash', description: '', sport: 'tennis', organiser_id: 'org', organiser_nickname: 'org',
  format: 'knockout', status: 'upcoming', registration_open: true, participant_count: 4, max_participants: 8,
  starts_at: '2026-10-01T10:00:00Z', created_at: '2026-09-01T10:00:00Z',
};
const MY_REGISTRATION = {
  id: 'r-1', user_id: 'user-me', nickname: 'sam', registered_at: '2026-09-02T10:00:00Z', status: 'registered',
};

let nav: FocusNavigationDouble;
let event: Record<string, unknown>;

function props<C extends React.JSXElementConstructor<any>>(value: unknown): React.ComponentProps<C> {
  return value as React.ComponentProps<C>;
}
const mountEvent = (): Promise<Instance> =>
  renderAsync(
    <EventDetailScreen
      {...props<typeof EventDetailScreen>({
        navigation: nav.navigation,
        route: { key: 'k', name: 'EventDetail', params: { eventId: 'evt-1' } },
      })}
    />,
  );
const mountGroup = (): Promise<Instance> =>
  renderAsync(
    <GroupDetailScreen
      {...props<typeof GroupDetailScreen>({
        navigation: nav.navigation,
        route: { key: 'k', name: 'GroupDetail', params: { groupId: 'g-1' } },
      })}
    />,
  );
const mountTournament = (): Promise<Instance> =>
  renderAsync(
    <TournamentDetailScreen
      {...props<typeof TournamentDetailScreen>({
        navigation: nav.navigation,
        route: { key: 'k', name: 'TournamentDetail', params: { tournamentId: 't-1' } },
      })}
    />,
  );

/** `GET /events/{id}` answers from `event`, or 404 once `eventGone` is set. */
let eventGone = false;
function setUpEventApi(): void {
  mockGet.mockImplementation((url: string) => {
    if (url.includes('/participants')) {
      return Promise.resolve({ data: [] });
    }
    if (/^\/events\/[^/]+$/.test(url)) {
      return eventGone ? Promise.reject(NOT_FOUND) : Promise.resolve({ data: event });
    }
    return Promise.resolve({ data: {} });
  });
}

const press = (node: Instance) => act(async () => node.props.onPress());
/** The touchable that carries this text (it may have no button role). */
function byText(root: Instance, text: string): Instance {
  const match = root.findAll(n => typeof n.props.onPress === 'function' && texts(n).includes(text))[0];
  if (!match) {
    throw new Error(`No touchable with text "${text}"`);
  }
  return match;
}
/** The pressable with this accessibility label (`last` when the same label appears twice). */
function byLabel(root: Instance, label: string, which: 'first' | 'last' = 'first'): Instance {
  const matches = root.findAll(n => n.props.accessibilityLabel === label && typeof n.props.onPress === 'function');
  if (matches.length === 0) {
    throw new Error(`No pressable labelled "${label}"`);
  }
  return which === 'first' ? matches[0] : matches[matches.length - 1];
}
/** Long-press a member row on Group detail to open its action card. */
const openMemberCard = (root: Instance, displayName: string): Promise<void> =>
  act(async () => {
    root
      .findAll(n => typeof n.props.onLongPress === 'function' && texts(n).includes(displayName))[0]
      .props.onLongPress();
  });
const goneNow = (): boolean => isAccessNoticeShowing();
const noticeText = 'This is no longer available.';

beforeEach(() => {
  nav = createFocusNavigation();
  clearAccessNotice();
  __resetSportDisplayNamesCacheForTests();
  eventGone = false;
  event = { ...baseEvent };
  setUpEventApi();
  mockPost.mockReset().mockResolvedValue({ data: {} });
  mockShowCompletion.mockReset();
  mockGetGroup.mockReset().mockResolvedValue(GROUP_MEMBER);
  (getGroupMemberCard as jest.Mock).mockReset().mockResolvedValue({
    user_id: 'u-2',
    display_name: 'Alex',
    nickname: 'alex',
    photo_url: null,
    is_self: false,
    relation: 'member',
    allowed_actions: [
      { key: 'make_admin', requires_approval: false },
      { key: 'remove_from_group', requires_approval: false },
    ],
  });
  (removeMember as jest.Mock).mockReset().mockResolvedValue(undefined);
  (updateMemberRole as jest.Mock).mockReset().mockResolvedValue(undefined);
  (deleteGroup as jest.Mock).mockReset().mockResolvedValue(undefined);
  mockGetTournament.mockReset().mockResolvedValue(baseTournament);
  (getFixtures as jest.Mock).mockReset().mockResolvedValue([]);
  (getRegistrations as jest.Mock).mockReset().mockResolvedValue([]);
  (getSports as jest.Mock).mockReset().mockRejectedValue(new Error('down'));
  (registerForTournament as jest.Mock).mockReset().mockResolvedValue(undefined);
  (withdrawFromTournament as jest.Mock).mockReset().mockResolvedValue(undefined);
  (cancelTournament as jest.Mock).mockReset().mockResolvedValue(undefined);
  (respondToTournamentInvitation as jest.Mock).mockReset().mockResolvedValue(undefined);
});

afterEach(() => {
  clearAccessNotice();
  jest.restoreAllMocks();
});

describe('1. a 404 returned by an action closes the screen with the message (except member role / remove)', () => {
  describe('game detail', () => {
    it('Join (RSVP) 404: goes back, shows the message once', async () => {
      const root = await mountEvent();
      mockPost.mockRejectedValueOnce(NOT_FOUND);
      await press(byLabel(root, 'Join'));
      expect(nav.navigation.goBack).toHaveBeenCalledTimes(1);
      expect(goneNow()).toBe(true);
    });

    it('Join with another error keeps today\'s handling: the backend text, screen stays', async () => {
      const root = await mountEvent();
      mockPost.mockRejectedValueOnce(CONFLICT);
      await press(byLabel(root, 'Join'));
      expect(texts(root)).toContain('Game is full');
      expect(nav.navigation.goBack).not.toHaveBeenCalled();
      expect(goneNow()).toBe(false);
    });

    it('Leave 404: goes back, shows the message', async () => {
      event = { ...baseEvent, user_rsvp_status: 'going' };
      const root = await mountEvent();
      mockPost.mockRejectedValueOnce(NOT_FOUND);
      await press(byLabel(root, 'Decline'));
      expect(nav.navigation.goBack).toHaveBeenCalledTimes(1);
      expect(goneNow()).toBe(true);
    });

    it('Leave with a server error keeps the generic leave error', async () => {
      event = { ...baseEvent, user_rsvp_status: 'going' };
      const root = await mountEvent();
      mockPost.mockRejectedValueOnce({ response: { status: 500 } });
      await press(byLabel(root, 'Decline'));
      expect(texts(root).some(x => /leave/i.test(x) && x.length > 5)).toBe(true);
      expect(nav.navigation.goBack).not.toHaveBeenCalled();
      expect(goneNow()).toBe(false);
    });

    it('host Delete game 404: goes back with the message (the game was already gone)', async () => {
      event = { ...baseEvent, organizer_id: 'user-me' };
      const root = await mountEvent();
      await press(byLabel(root, 'Cancel Game'));
      mockPost.mockRejectedValueOnce(NOT_FOUND);
      await press(byText(root, 'Delete game'));
      expect(nav.navigation.goBack).toHaveBeenCalledTimes(1);
      expect(goneNow()).toBe(true);
      expect(mockShowCompletion).not.toHaveBeenCalled();
    });
  });

  describe('group detail', () => {
    it('Leave group 404: goes back, shows the message', async () => {
      const root = await mountGroup();
      (removeMember as jest.Mock).mockRejectedValueOnce(NOT_FOUND);
      const alert = jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => {
        buttons?.find(b => b.style === 'destructive')?.onPress?.();
      });
      await press(byLabel(root, 'Leave Group'));
      await act(async () => {});
      expect(alert).toHaveBeenCalled();
      expect(nav.navigation.goBack).toHaveBeenCalledTimes(1);
      expect(goneNow()).toBe(true);
      expect(mockShowCompletion).not.toHaveBeenCalled();
    });

    it('Leave group with another error keeps the leave error and stays', async () => {
      const root = await mountGroup();
      (removeMember as jest.Mock).mockRejectedValueOnce({ response: { status: 500 } });
      jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => {
        buttons?.find(b => b.style === 'destructive')?.onPress?.();
      });
      await press(byLabel(root, 'Leave Group'));
      await act(async () => {});
      expect(nav.navigation.goBack).not.toHaveBeenCalled();
      expect(goneNow()).toBe(false);
      expect(root).toBeDefined();
    });

    // User menu (DES-MEETUP-ADDENDUM-user-details-menu.md AD-5): a 404 from a member action closes
    // the menu, shows the neutral notice and refetches the group; the screen itself closes only if
    // that refetch is a 404 too. Any other failure shows its message and refetches.
    it('remove member 404: the menu closes with the neutral notice and the group is refetched, no goBack', async () => {
      mockGetGroup.mockResolvedValue(GROUP_OWNER);
      const root = await mountGroup();
      (removeMember as jest.Mock).mockRejectedValueOnce(NOT_FOUND);
      await openMemberCard(root, 'Alex');
      await press(byLabel(root, 'Remove from group'));
      const loads = mockGetGroup.mock.calls.length;
      await press(byLabel(root, 'Yes'));
      expect(nav.navigation.goBack).not.toHaveBeenCalled();
      expect(goneNow()).toBe(true);
      expect(mockGetGroup.mock.calls.length).toBeGreaterThan(loads);
      expect(mockShowCompletion).not.toHaveBeenCalled();
    });

    it('change role 404: the menu closes with the neutral notice and the group is refetched, no goBack', async () => {
      mockGetGroup.mockResolvedValue(GROUP_OWNER);
      const root = await mountGroup();
      (updateMemberRole as jest.Mock).mockRejectedValueOnce(NOT_FOUND);
      await openMemberCard(root, 'Alex');
      const loads = mockGetGroup.mock.calls.length;
      await press(byLabel(root, 'Make admin'));
      await press(byLabel(root, 'Yes'));
      expect(nav.navigation.goBack).not.toHaveBeenCalled();
      expect(goneNow()).toBe(true);
      expect(mockGetGroup.mock.calls.length).toBeGreaterThan(loads);
      expect(mockShowCompletion).not.toHaveBeenCalled();
    });

    it('change role with another error shows the action-failed message and refetches', async () => {
      mockGetGroup.mockResolvedValue(GROUP_OWNER);
      const root = await mountGroup();
      (updateMemberRole as jest.Mock).mockRejectedValueOnce({ response: { status: 500 } });
      await openMemberCard(root, 'Alex');
      await press(byLabel(root, 'Make admin'));
      await press(byLabel(root, 'Yes'));
      expect(nav.navigation.goBack).not.toHaveBeenCalled();
      expect(goneNow()).toBe(false);
      expect(texts(root)).toContain('Could not complete this action. Please try again.');
    });

    it('Delete group 404: goes back, shows the message', async () => {
      mockGetGroup.mockResolvedValue(GROUP_OWNER);
      const root = await mountGroup();
      await press(byLabel(root, 'Delete group'));
      (deleteGroup as jest.Mock).mockRejectedValueOnce(NOT_FOUND);
      await press(byLabel(root, 'Delete group', 'last'));
      expect(nav.navigation.goBack).toHaveBeenCalledTimes(1);
      expect(goneNow()).toBe(true);
      expect(mockShowCompletion).not.toHaveBeenCalled();
    });
  });

  describe('tournament detail', () => {
    it('Register 404: goes back, shows the message', async () => {
      const root = await mountTournament();
      (registerForTournament as jest.Mock).mockRejectedValueOnce(NOT_FOUND);
      await press(byLabel(root, 'Register'));
      expect(nav.navigation.goBack).toHaveBeenCalledTimes(1);
      expect(goneNow()).toBe(true);
    });

    it('Register with another error keeps the register error', async () => {
      const root = await mountTournament();
      (registerForTournament as jest.Mock).mockRejectedValueOnce({ response: { status: 500 } });
      await press(byLabel(root, 'Register'));
      expect(nav.navigation.goBack).not.toHaveBeenCalled();
      expect(goneNow()).toBe(false);
    });

    it('Withdraw 404: goes back, shows the message', async () => {
      (getRegistrations as jest.Mock).mockResolvedValue([MY_REGISTRATION]);
      const root = await mountTournament();
      (withdrawFromTournament as jest.Mock).mockRejectedValueOnce(NOT_FOUND);
      await press(byLabel(root, 'Decline'));
      expect(nav.navigation.goBack).toHaveBeenCalledTimes(1);
      expect(goneNow()).toBe(true);
    });

    it('accepting an invitation that answers 404: goes back, shows the message', async () => {
      mockGetTournament.mockResolvedValue({ ...baseTournament, my_invitation_status: 'pending' });
      const root = await mountTournament();
      (respondToTournamentInvitation as jest.Mock).mockRejectedValueOnce(NOT_FOUND);
      await press(byLabel(root, 'Accept'));
      expect(nav.navigation.goBack).toHaveBeenCalledTimes(1);
      expect(goneNow()).toBe(true);
    });
  });
});

describe('2. the user\'s own successful action never shows "no longer available"', () => {
  describe('game detail', () => {
    it('host deletes the game: completion flow shown; a later 404 closes quietly, no message', async () => {
      event = { ...baseEvent, organizer_id: 'user-me' };
      const root = await mountEvent();
      await press(byLabel(root, 'Cancel Game'));
      await press(byText(root, 'Delete game'));
      expect(mockShowCompletion).toHaveBeenCalledTimes(1);
      expect(mockShowCompletion.mock.calls[0][0].flow).toBe('game_cancelled');

      // The user comes back to the detail (completion dismissed): the game is gone.
      eventGone = true;
      await act(async () => nav.fireFocus());
      expect(goneNow()).toBe(false);
      expect(texts(root)).not.toContain(noticeText);
      expect(nav.navigation.goBack).toHaveBeenCalledTimes(1); // closed quietly
    });

    it('leaving the game: the refetch that 404s closes quietly, no message, no error text', async () => {
      event = { ...baseEvent, user_rsvp_status: 'going' };
      const root = await mountEvent();
      eventGone = true;
      await press(byLabel(root, 'Decline'));
      expect(mockPost).toHaveBeenCalled();
      expect(goneNow()).toBe(false);
      expect(nav.navigation.goBack).toHaveBeenCalledTimes(1);
      expect(texts(root).join(' ')).not.toMatch(/could not leave/i);
    });

    it('a 404 with no own action still shows the message (control)', async () => {
      const root = await mountEvent();
      eventGone = true;
      await act(async () => nav.fireFocus());
      expect(goneNow()).toBe(true);
      expect(root).toBeDefined();
    });
  });

  describe('group detail', () => {
    it('leaving the group: completion shown; a later 404 closes quietly, no message', async () => {
      const root = await mountGroup();
      jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => {
        buttons?.find(b => b.style === 'destructive')?.onPress?.();
      });
      await press(byLabel(root, 'Leave Group'));
      await act(async () => {});
      expect(mockShowCompletion).toHaveBeenCalledTimes(1);
      expect(mockShowCompletion.mock.calls[0][0].flow).toBe('group_left');

      mockGetGroup.mockRejectedValue(NOT_FOUND);
      await act(async () => nav.fireFocus());
      expect(goneNow()).toBe(false);
      expect(nav.navigation.goBack).toHaveBeenCalledTimes(1);
    });

    it('owner deletes the group: completion shown; a later 404 closes quietly, no message', async () => {
      mockGetGroup.mockResolvedValue(GROUP_OWNER);
      const root = await mountGroup();
      await press(byLabel(root, 'Delete group'));
      await press(byLabel(root, 'Delete group', 'last'));
      expect(mockShowCompletion).toHaveBeenCalledTimes(1);
      expect(mockShowCompletion.mock.calls[0][0].flow).toBe('group_deleted');

      mockGetGroup.mockRejectedValue(NOT_FOUND);
      await act(async () => nav.foreground());
      expect(goneNow()).toBe(false);
      expect(nav.navigation.goBack).toHaveBeenCalledTimes(1);
    });
  });

  describe('tournament detail', () => {
    it('withdrawing: the refetch inside the action that 404s closes quietly, no message, no error', async () => {
      (getRegistrations as jest.Mock).mockResolvedValue([MY_REGISTRATION]);
      const root = await mountTournament();
      mockGetTournament.mockRejectedValue(NOT_FOUND);
      await press(byLabel(root, 'Decline'));
      expect(goneNow()).toBe(false);
      expect(nav.navigation.goBack).toHaveBeenCalledTimes(1);
      expect(texts(root).join(' ')).not.toMatch(/could not withdraw/i);
    });

    it('organiser cancels the tournament: completion shown; a later 404 closes quietly, no message', async () => {
      mockGetTournament.mockResolvedValue({ ...baseTournament, organiser_id: 'user-me' });
      const root = await mountTournament();
      await press(byLabel(root, 'Cancel Tournament'));
      expect(mockShowCompletion).toHaveBeenCalledTimes(1);
      expect(mockShowCompletion.mock.calls[0][0].flow).toBe('tournament_cancelled');

      mockGetTournament.mockRejectedValue(NOT_FOUND);
      await act(async () => nav.fireFocus());
      expect(goneNow()).toBe(false);
      expect(nav.navigation.goBack).toHaveBeenCalledTimes(1);
    });

    it('declining an invitation: the refetch that 404s closes quietly, no message', async () => {
      mockGetTournament.mockResolvedValue({ ...baseTournament, my_invitation_status: 'pending' });
      const root = await mountTournament();
      mockGetTournament.mockRejectedValue(NOT_FOUND);
      await press(byLabel(root, 'Decline'));
      expect(goneNow()).toBe(false);
      expect(nav.navigation.goBack).toHaveBeenCalledTimes(1);
    });

    it('accepting an invitation whose refetch 404s is NOT the user\'s removal: shows the message', async () => {
      mockGetTournament.mockResolvedValue({ ...baseTournament, my_invitation_status: 'pending' });
      const root = await mountTournament();
      mockGetTournament.mockRejectedValue(NOT_FOUND);
      await press(byLabel(root, 'Accept'));
      expect(goneNow()).toBe(true);
      expect(nav.navigation.goBack).toHaveBeenCalledTimes(1);
      expect(root).toBeDefined();
    });
  });
});
