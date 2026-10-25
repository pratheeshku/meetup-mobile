/**
 * Tournament invitation push: Register + Decline (DES-MEETUP-ADDENDUM-tournament-registration AD-3, D-7; brief M6).
 * `register_mode` comes from the server: "direct" registers at once (one attempt, then the result message), "open_app" opens the app on the
 * confirmation sheet. The client never chooses the mode. API and token are mocked; nothing here touches a device.
 */
import { Platform } from 'react-native';
import notifee, { EventType } from 'react-native-notify-kit';
import type { Event } from 'react-native-notify-kit';

import { apiClient, refreshAccessTokenForAction } from '../../api/client';
import { navigationRef, resolveNotificationTarget } from '../notificationRouting';
import {
  displayPushActionNotification,
  getInitialPushActionNotification,
  handlePushActionEvent,
  registerPushActionCategories,
} from '../pushActions';
import { PUSH_ACTIONS_VERSION } from '../fcm';

jest.mock('../../api/client', () => ({
  apiClient: { get: jest.fn(), post: jest.fn(), delete: jest.fn() },
  refreshAccessTokenForAction: jest.fn(),
}));

const mockPost = apiClient.post as jest.Mock;
const mockRefresh = refreshAccessTokenForAction as jest.Mock;
const mockDisplay = notifee.displayNotification as jest.Mock;
const mockCancel = notifee.cancelNotification as jest.Mock;
const mockSetCategories = notifee.setNotificationCategories as jest.Mock;
const mockGetInitial = notifee.getInitialNotification as jest.Mock;

let navigateSpy: jest.Mock;

function pushData(extra: Record<string, string> = {}): Record<string, string> {
  return {
    notification_id: 'nid-1',
    notification_type: 'tournament_invited',
    entity_id: 'tour-1',
    tag: 'tag-1',
    delivery_id: 'del-1',
    title: 'Tournament Invitation: Summer Smash',
    body: 'Sport: badminton',
    ...extra,
  };
}

function press(type: EventType, actionId: string | undefined, data: Record<string, string>, id = 'tag-1'): Event {
  return {
    type,
    detail: { notification: { id, data }, ...(actionId ? { pressAction: { id: actionId } } : {}) },
  } as Event;
}

const lastResultTitle = (): string => mockDisplay.mock.calls[mockDisplay.mock.calls.length - 1][0].title;
const refusal = (status: number, code?: string) =>
  Object.assign(new Error('http'), { response: { status, data: { detail: 'RAW SERVER DETAIL', ...(code ? { code } : {}) } } });

beforeEach(() => {
  jest.resetAllMocks();
  mockRefresh.mockResolvedValue('tok-new');
  mockDisplay.mockResolvedValue('x');
  mockCancel.mockResolvedValue(undefined);
  mockSetCategories.mockResolvedValue(undefined);
  mockGetInitial.mockResolvedValue(null);
  jest.spyOn(navigationRef, 'isReady').mockReturnValue(true);
  navigateSpy = jest.spyOn(navigationRef, 'navigate').mockImplementation(() => undefined) as unknown as jest.Mock;
  jest.replaceProperty(Platform, 'OS', 'android');
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('capability version', () => {
  it('declares pushActionsVersion 2, or the server never applies the Register categories', () => {
    expect(PUSH_ACTIONS_VERSION).toBe(2);
  });
});

describe('Android buttons', () => {
  it('direct: Register and Decline, both in the background', async () => {
    await displayPushActionNotification(pushData({ register_mode: 'direct' }));
    const actions = mockDisplay.mock.calls[0][0].android.actions;
    expect(actions.map((a: { title: string }) => a.title)).toEqual(['Register', 'Decline']);
    expect(actions[0].pressAction).toEqual({ id: 'register' });
    expect(actions[1].pressAction).toEqual({ id: 'decline' });
  });

  it('open_app: Register launches the app, Decline stays in the background', async () => {
    await displayPushActionNotification(pushData({ register_mode: 'open_app' }));
    const actions = mockDisplay.mock.calls[0][0].android.actions;
    expect(actions[0].pressAction).toEqual({ id: 'register', launchActivity: 'default' });
    expect(actions[1].pressAction).toEqual({ id: 'decline' });
  });

  it('no register_mode (an older server): Accept and Decline as before', async () => {
    await displayPushActionNotification(pushData());
    expect(mockDisplay.mock.calls[0][0].android.actions.map((a: { title: string }) => a.title)).toEqual(['Accept', 'Decline']);
  });

  it('a game invitation keeps Accept and Decline whatever register_mode says', async () => {
    await displayPushActionNotification(pushData({ notification_type: 'event_invite', register_mode: 'direct' }));
    expect(mockDisplay.mock.calls[0][0].android.actions.map((a: { title: string }) => a.title)).toEqual(['Accept', 'Decline']);
  });
});

describe('Register in "direct" mode', () => {
  it('registers once with no body, under the in-memory token, and shows the free-registration result', async () => {
    mockPost.mockResolvedValue({ data: {} });
    await handlePushActionEvent(press(EventType.ACTION_PRESS, 'register', pushData({ register_mode: 'direct' })));
    expect(mockPost).toHaveBeenCalledTimes(1);
    const [url, body, ctx] = mockPost.mock.calls[0];
    expect(url).toBe('/tournaments/tour-1/registrations');
    expect(body).toBeUndefined();
    expect(ctx.headers.Authorization).toBe('Bearer tok-new');
    expect(ctx.correlationId).toMatch(/^[0-9a-f-]{36}$/);
    expect(lastResultTitle()).toBe("You're registered. Free registration.");
    expect(navigateSpy).not.toHaveBeenCalled();
  });

  it('ALREADY_REGISTERED reads "You are already registered."', async () => {
    mockPost.mockRejectedValue(refusal(409, 'ALREADY_REGISTERED'));
    await handlePushActionEvent(press(EventType.ACTION_PRESS, 'register', pushData({ register_mode: 'direct' })));
    expect(lastResultTitle()).toBe('You are already registered.');
  });

  it.each(['FEE_ACK_REQUIRED', 'FEE_CHANGED'])('%s (a fee set after the invitation) asks to open the app', async code => {
    mockPost.mockRejectedValue(refusal(409, code));
    await handlePushActionEvent(press(EventType.ACTION_PRESS, 'register', pushData({ register_mode: 'direct' })));
    expect(lastResultTitle()).toBe('Open the app to confirm the fee.');
  });

  it('another coded refusal shows its label, never the raw detail; one attempt only', async () => {
    mockPost.mockRejectedValue(refusal(409, 'TOURNAMENT_FULL'));
    await handlePushActionEvent(press(EventType.ACTION_PRESS, 'register', pushData({ register_mode: 'direct' })));
    expect(lastResultTitle()).toBe('This tournament is full.');
    expect(lastResultTitle()).not.toContain('RAW SERVER DETAIL');
    expect(mockPost).toHaveBeenCalledTimes(1);
  });

  it('an unknown failure is the generic registration label', async () => {
    mockPost.mockRejectedValue(refusal(500));
    await handlePushActionEvent(press(EventType.ACTION_PRESS, 'register', pushData({ register_mode: 'direct' })));
    expect(lastResultTitle()).toBe('Could not register. Please try again.');
  });

  it('a second press while one runs is ignored', async () => {
    let release: (value: unknown) => void = () => undefined;
    mockPost.mockReturnValue(new Promise(resolve => (release = resolve)));
    const data = pushData({ register_mode: 'direct' });
    const first = handlePushActionEvent(press(EventType.ACTION_PRESS, 'register', data));
    await handlePushActionEvent(press(EventType.ACTION_PRESS, 'register', data));
    release({ data: {} });
    await first;
    expect(mockPost).toHaveBeenCalledTimes(1);
  });
});

describe('Register in "open_app" mode', () => {
  it('makes no request; it clears the entry and opens the tournament on the confirmation sheet', async () => {
    await handlePushActionEvent(press(EventType.ACTION_PRESS, 'register', pushData({ register_mode: 'open_app' })));
    expect(mockPost).not.toHaveBeenCalled();
    expect(mockCancel).toHaveBeenCalledWith('tag-1');
    expect(navigateSpy).toHaveBeenCalledWith('Tournaments', {
      screen: 'TournamentDetail',
      params: { tournamentId: 'tour-1', openRegistration: true },
    });
  });

  it('a quit-state launch from that button is routed to the sheet too', async () => {
    mockGetInitial.mockResolvedValue({
      notification: { id: 'tag-1', data: pushData({ register_mode: 'open_app' }) },
      pressAction: { id: 'register' },
    });
    const payload = await getInitialPushActionNotification();
    expect(payload).toMatchObject({ notification_type: 'tournament_invited', entity_id: 'tour-1', open_registration: true });
  });

  it('a quit-state body tap still opens the tournament without the sheet', async () => {
    mockGetInitial.mockResolvedValue({
      notification: { id: 'tag-1', data: pushData({ register_mode: 'open_app' }) },
      pressAction: { id: 'default' },
    });
    const payload = await getInitialPushActionNotification();
    expect(payload?.open_registration).toBeUndefined();
  });

  it('routing carries openRegistration only when asked', () => {
    expect(resolveNotificationTarget('tournament_invited', 't1')).toEqual({
      tab: 'Tournaments',
      screen: 'TournamentDetail',
      params: { tournamentId: 't1' },
    });
    expect(resolveNotificationTarget('tournament_invited', 't1', { openRegistration: true })).toEqual({
      tab: 'Tournaments',
      screen: 'TournamentDetail',
      params: { tournamentId: 't1', openRegistration: true },
    });
  });
});

describe('Decline is unchanged', () => {
  it('Decline on a Register notification still posts the invitation response', async () => {
    mockPost.mockResolvedValue({ data: {} });
    await handlePushActionEvent(press(EventType.ACTION_PRESS, 'decline', pushData({ register_mode: 'direct' })));
    expect(mockPost.mock.calls[0][0]).toBe('/tournaments/tour-1/invitations/respond');
    expect(mockPost.mock.calls[0][1]).toEqual({ accept: false });
  });
});

describe('iOS categories', () => {
  it('registers the two server-chosen Register categories beside the existing three', async () => {
    jest.replaceProperty(Platform, 'OS', 'ios');
    await registerPushActionCategories();
    const categories = mockSetCategories.mock.calls[0][0] as Array<{ id: string; actions: Array<{ id: string; foreground?: boolean }> }>;
    const ids = categories.map(c => c.id);
    expect(ids).toEqual(expect.arrayContaining(['invite_game', 'invite_tournament', 'group_added', 'invite_tournament_register', 'invite_tournament_confirm']));
    const direct = categories.find(c => c.id === 'invite_tournament_register')!;
    expect(direct.actions.map(a => a.id)).toEqual(['register', 'decline']);
    expect(direct.actions[0].foreground).toBe(false);
    const confirm = categories.find(c => c.id === 'invite_tournament_confirm')!;
    expect(confirm.actions[0].foreground).toBe(true);
  });
});
