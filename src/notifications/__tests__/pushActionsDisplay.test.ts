/**
 * Wiring of push-action rendering in `fcm.ts`: foreground `onMessage` and the
 * headless background handler (Android data-only), plus the registration field.
 */
import { Platform } from 'react-native';
import notifee from 'react-native-notify-kit';
import * as firebaseMessaging from '@react-native-firebase/messaging';

import { apiClient } from '../../api/client';
import { __resetDeviceIdCacheForTests } from '../deviceId';
import { onMessage, registerBackgroundMessageHandler, registerDeviceToken } from '../fcm';
import { dismissBanner, getBannerState } from '../notificationBannerStore';

jest.mock('../../api/client', () => ({
  apiClient: { post: jest.fn(), delete: jest.fn() },
}));
jest.mock('../../hooks/useUnreadCount', () => ({ refreshUnreadCount: jest.fn() }));

const mockOnMessage = firebaseMessaging.onMessage as jest.Mock;
const mockSetBackground = firebaseMessaging.setBackgroundMessageHandler as jest.Mock;
const mockDisplay = notifee.displayNotification as jest.Mock;
const mockPost = apiClient.post as jest.Mock;

const DATA = {
  notification_id: 'nid-1',
  notification_type: 'event_invite',
  entity_id: 'evt-1',
  tag: 'tag-1',
  delivery_id: 'del-1',
  title: 'Game Invitation: X',
  body: 'Sport: badminton',
};

let deliver: (message: unknown) => void;

beforeEach(() => {
  jest.clearAllMocks();
  jest.replaceProperty(Platform, 'OS', 'android');
  jest.spyOn(console, 'log').mockImplementation(() => {});
  mockOnMessage.mockImplementation((_m: unknown, cb: (message: unknown) => void) => {
    deliver = cb;
    return () => {};
  });
  onMessage();
});

afterEach(() => {
  dismissBanner();
  jest.restoreAllMocks();
});

describe('Android foreground', () => {
  it.each(['event_invite', 'tournament_invited', 'group_invite'])(
    'data-only %s renders locally with buttons, no banner',
    type => {
      deliver({ messageId: 'm1', data: { ...DATA, notification_type: type } });
      expect(mockDisplay).toHaveBeenCalledTimes(1);
      expect(mockDisplay.mock.calls[0][0].android.actions).toHaveLength(2);
      expect(getBannerState()).toBeNull();
    },
  );

  it('a push WITH a notification block keeps the banner (flag off or old path)', () => {
    deliver({ messageId: 'm2', notification: { title: 't', body: 'b' }, data: DATA });
    expect(mockDisplay).not.toHaveBeenCalled();
    expect(getBannerState()).not.toBeNull();
  });
});

describe('background message handler', () => {
  function handler(): (message: unknown) => Promise<void> {
    registerBackgroundMessageHandler();
    return mockSetBackground.mock.calls[0][1];
  }

  it('Android data-only action push is rendered with buttons', async () => {
    await handler()({ data: DATA });
    expect(mockDisplay).toHaveBeenCalledTimes(1);
    expect(mockDisplay.mock.calls[0][0].id).toBe('tag-1');
    expect(mockDisplay.mock.calls[0][0].title).toBe(DATA.title);
  });

  it('iOS alert push is never re-rendered (the system already showed it)', async () => {
    jest.replaceProperty(Platform, 'OS', 'ios');
    await handler()({ notification: { title: 't', body: 'b' }, data: DATA });
    expect(mockDisplay).not.toHaveBeenCalled();
  });

  it('a display failure does not reject the headless task', async () => {
    mockDisplay.mockRejectedValueOnce(new Error('denied'));
    await expect(handler()({ data: DATA })).resolves.toBeUndefined();
  });
});

describe('registration field', () => {
  it.each(['android', 'ios'] as const)('sends pushActionsVersion: 1 on %s', async os => {
    jest.replaceProperty(Platform, 'OS', os);
    __resetDeviceIdCacheForTests();
    mockPost.mockResolvedValue({ data: {} });

    await registerDeviceToken('tok');

    expect(mockPost).toHaveBeenCalledWith(
      '/notifications/mobile-subscriptions',
      expect.objectContaining({ deviceToken: 'tok', platform: os, pushActionsVersion: 1 }),
    );
  });
});
