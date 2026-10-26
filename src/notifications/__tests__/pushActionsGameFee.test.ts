/**
 * Game invitation pushes with a fee (teams-payments AD-8): the server sends `register_mode=open_app` and iOS category `invite_game_confirm`. Accept
 * then opens the app on the game (where the fee is confirmed); Decline stays in the background. A free game ("direct" or no mode) keeps Accept and
 * Decline in the background.
 */
import { Platform } from 'react-native';
import notifee, { EventType } from 'react-native-notify-kit';
import type { Event } from 'react-native-notify-kit';

import { apiClient, refreshAccessTokenForAction } from '../../api/client';
import { navigationRef } from '../notificationRouting';
import {
  IOS_CATEGORY_GAME_CONFIRM,
  displayPushActionNotification,
  getInitialPushActionNotification,
  handlePushActionEvent,
  registerModeOf,
  registerPushActionCategories,
} from '../pushActions';

jest.mock('../../api/client', () => ({
  apiClient: { get: jest.fn(), post: jest.fn(), delete: jest.fn() },
  refreshAccessTokenForAction: jest.fn(),
}));

const mockPost = apiClient.post as jest.Mock;
const mockDisplay = notifee.displayNotification as jest.Mock;
const mockCancel = notifee.cancelNotification as jest.Mock;
const mockSetCategories = notifee.setNotificationCategories as jest.Mock;
const mockGetInitial = notifee.getInitialNotification as jest.Mock;

const data = (extra: Record<string, string> = {}): Record<string, string> => ({
  notification_id: 'nid-1',
  notification_type: 'event_invite',
  entity_id: 'evt-1',
  tag: 'tag-1',
  delivery_id: 'del-1',
  title: 'Game invitation',
  body: 'Friday doubles',
  ...extra,
});
const press = (actionId: string | undefined, d: Record<string, string>): Event =>
  ({ type: actionId ? EventType.ACTION_PRESS : EventType.PRESS, detail: { notification: { id: 'tag-1', data: d }, ...(actionId ? { pressAction: { id: actionId } } : {}) } }) as Event;

let navigateSpy: jest.Mock;

beforeEach(() => {
  jest.resetAllMocks();
  (refreshAccessTokenForAction as jest.Mock).mockResolvedValue('tok');
  mockDisplay.mockResolvedValue('x');
  mockCancel.mockResolvedValue(undefined);
  mockPost.mockResolvedValue({ data: { participation_status: 'going' } });
  navigateSpy = jest.fn();
  jest.spyOn(navigationRef, 'isReady').mockReturnValue(true);
  jest.spyOn(navigationRef, 'navigate').mockImplementation(navigateSpy);
});

describe('registerModeOf', () => {
  it('reads the mode of a game invitation as well as a tournament invitation', () => {
    expect(registerModeOf(data({ register_mode: 'open_app' }))).toBe('open_app');
    expect(registerModeOf(data({ register_mode: 'direct' }))).toBe('direct');
    expect(registerModeOf(data({ register_mode: 'whatever' }))).toBeNull();
    expect(registerModeOf(data({ notification_type: 'group_invite', register_mode: 'open_app' }))).toBeNull();
  });
});

describe('Android display', () => {
  it('a game with a fee: Accept launches the app, Decline does not; the buttons are still Accept and Decline', async () => {
    await displayPushActionNotification(data({ register_mode: 'open_app' }));
    const actions = mockDisplay.mock.calls[0][0].android.actions as { title: string; pressAction: { id: string; launchActivity?: string } }[];
    expect(actions.map(a => a.title)).toEqual(['Accept', 'Decline']);
    expect(actions[0].pressAction).toEqual({ id: 'accept', launchActivity: 'default' });
    expect(actions[1].pressAction).toEqual({ id: 'decline' });
  });

  it('a free game (direct, or no mode) keeps both buttons in the background', async () => {
    for (const extra of [{ register_mode: 'direct' }, {}] as Record<string, string>[]) {
      mockDisplay.mockClear();
      await displayPushActionNotification(data(extra));
      const actions = mockDisplay.mock.calls[0][0].android.actions as { pressAction: { launchActivity?: string } }[];
      expect(actions.every(a => a.pressAction.launchActivity === undefined)).toBe(true);
    }
  });
});

describe('Accept on a game with a fee opens the app instead of calling the server', () => {
  it('clears the entry, opens the game, and posts nothing', async () => {
    await handlePushActionEvent(press('accept', data({ register_mode: 'open_app' })));
    expect(mockPost).not.toHaveBeenCalled();
    expect(mockCancel).toHaveBeenCalledWith('tag-1');
    expect(navigateSpy).toHaveBeenCalledWith('Home', { screen: 'EventDetail', params: { eventId: 'evt-1' } });
  });

  it('Decline still runs in the background', async () => {
    await handlePushActionEvent(press('decline', data({ register_mode: 'open_app' })));
    expect(mockPost).toHaveBeenCalledWith('/events/evt-1/invitations/respond', { accept: false }, expect.anything());
  });

  it('a free game Accept still posts accept with no fee', async () => {
    await handlePushActionEvent(press('accept', data({ register_mode: 'direct' })));
    expect(mockPost).toHaveBeenCalledWith('/events/evt-1/invitations/respond', { accept: true }, expect.anything());
  });

  it('a fee set after a free-game invitation went out answers "open the app", never a registration without the fee', async () => {
    mockPost.mockRejectedValueOnce(Object.assign(new Error('http'), { response: { status: 409, data: { code: 'FEE_ACK_REQUIRED', detail: 'x', registration_fee_cents: 500 } } }));
    await handlePushActionEvent(press('accept', data({ register_mode: 'direct' })));
    expect(mockDisplay.mock.calls[mockDisplay.mock.calls.length - 1][0].title).toBe('Open the app to confirm the fee.');
  });
});

describe('quit-state launch from the Accept button', () => {
  it('lands on the game with the open-registration flag, like the tournament Register button', async () => {
    mockGetInitial.mockResolvedValue({ pressAction: { id: 'accept' }, notification: { id: 'tag-1', data: data({ register_mode: 'open_app' }) } });
    expect(await getInitialPushActionNotification()).toMatchObject({ notification_type: 'event_invite', entity_id: 'evt-1', open_registration: true });
  });

  it('a free game Accept is not a launch', async () => {
    mockGetInitial.mockResolvedValue({ pressAction: { id: 'accept' }, notification: { id: 'tag-1', data: data({ register_mode: 'direct' }) } });
    expect(await getInitialPushActionNotification()).toBeNull();
  });
});

describe('iOS categories', () => {
  it('registers invite_game_confirm: Accept opens the app (foreground), Decline does not', async () => {
    Object.defineProperty(Platform, 'OS', { value: 'ios', configurable: true });
    await registerPushActionCategories();
    const categories = mockSetCategories.mock.calls[0][0] as { id: string; actions: { id: string; foreground: boolean }[] }[];
    const confirm = categories.find(c => c.id === IOS_CATEGORY_GAME_CONFIRM)!;
    expect(IOS_CATEGORY_GAME_CONFIRM).toBe('invite_game_confirm');
    expect(confirm.actions.map(a => [a.id, a.foreground])).toEqual([['accept', true], ['decline', false]]);
    expect(categories.find(c => c.id === 'invite_game')!.actions[0].foreground).toBe(false);
  });
});
