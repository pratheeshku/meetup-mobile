/**
 * Platform behaviour of the push layer (DES-MEETUP-ADDENDUM-IOS-App.md §3, §4),
 * run with the platform mocked as both `android` and `ios`.
 */
import { Alert, AppState, PermissionsAndroid, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import notifee from 'react-native-notify-kit';
import * as firebaseMessaging from '@react-native-firebase/messaging';

import { apiClient } from '../../api/client';
import { createNotificationChannels } from '../channels';
import { __resetDeviceIdCacheForTests } from '../deviceId';
import { displayEventNotification } from '../eventNotificationHandler';
import {
  hasNotificationPermission,
  registerBackgroundMessageHandler,
  registerDeviceToken,
  requestPermission,
} from '../fcm';
import { displayParticipantNotification } from '../participantHandler';
import { platformNotificationOptions } from '../platformOptions';
import { startPushRegistration } from '../pushRegistration';

jest.mock('../../api/client', () => ({
  apiClient: { post: jest.fn(), delete: jest.fn() },
}));

const mockPost = apiClient.post as jest.Mock;
const mockDisplay = notifee.displayNotification as jest.Mock;
const mockCreateChannel = notifee.createChannel as jest.Mock;
const mockHasPermission = firebaseMessaging.hasPermission as jest.Mock;
const mockRequestPermission = firebaseMessaging.requestPermission as jest.Mock;
const mockSetBackgroundHandler = firebaseMessaging.setBackgroundMessageHandler as jest.Mock;

const DATA = {
  notification_type: 'event_changed',
  entity_id: 'e1',
  title: 'Title',
  body: 'Body',
};
const IOS_OPTIONS = { foregroundPresentationOptions: { banner: true, sound: true, list: true } };

function setPlatform(os: 'android' | 'ios', version: number | string): void {
  jest.replaceProperty(Platform, 'OS', os);
  jest.spyOn(Platform, 'Version', 'get').mockReturnValue(version as never);
}

beforeEach(() => {
  jest.clearAllMocks();
  __resetDeviceIdCacheForTests();
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe.each([
  ['android', 34, 'MeetupMobile-Android/34'],
  ['ios', '17.4', 'MeetupMobile-iOS/17.4'],
] as const)('registerDeviceToken on %s', (os, version, userAgent) => {
  it('sends Platform.OS and a user agent built from Platform.OS and Platform.Version', async () => {
    setPlatform(os, version);
    mockPost.mockResolvedValueOnce({ status: 201 });

    await registerDeviceToken('tok');

    expect(mockPost).toHaveBeenCalledWith(
      '/notifications/mobile-subscriptions',
      expect.objectContaining({ deviceToken: 'tok', platform: os, userAgent }),
    );
    const body = mockPost.mock.calls[0][1];
    expect(body.deviceId).not.toBe('');
  });
});

describe('iOS notification permission', () => {
  beforeEach(() => setPlatform('ios', '17.4'));

  it.each([
    [1, true],
    [2, true],
    [0, false],
    [-1, false],
  ])('hasNotificationPermission maps Firebase status %s to %s', async (status, expected) => {
    mockHasPermission.mockResolvedValueOnce(status);

    await expect(hasNotificationPermission()).resolves.toBe(expected);
  });

  it('requestPermission uses the Firebase prompt', async () => {
    mockRequestPermission.mockResolvedValueOnce(1);

    await expect(requestPermission()).resolves.toBe(true);
    expect(mockRequestPermission).toHaveBeenCalledTimes(1);
  });
});

describe('permission rationale copy', () => {
  it.each(['android', 'ios'] as const)('names no platform (%s)', async os => {
    await AsyncStorage.clear();
    setPlatform(os, os === 'ios' ? '17.4' : 33);
    // The RN Jest preset mocks `currentState` as a function; real devices have a string.
    (AppState as unknown as { currentState: string }).currentState = 'active';
    mockHasPermission.mockResolvedValue(0);
    jest.spyOn(PermissionsAndroid, 'check').mockResolvedValue(false);
    jest.spyOn(PermissionsAndroid, 'request').mockResolvedValue('denied');
    const alertSpy = jest
      .spyOn(Alert, 'alert')
      .mockImplementation((_t, _m, buttons) => buttons?.[0]?.onPress?.());
    const stop = startPushRegistration();
    for (let i = 0; i < 50; i += 1) {
      await Promise.resolve();
    }
    stop();

    expect(alertSpy).toHaveBeenCalledTimes(1);
    expect(String(alertSpy.mock.calls[0][1])).not.toMatch(/android|ios|iphone|apple/i);
  });
});

describe('notification handlers', () => {
  it('platformNotificationOptions: ios block on iOS, nothing on Android', () => {
    setPlatform('ios', '17.4');
    expect(platformNotificationOptions()).toEqual({ ios: IOS_OPTIONS });
    setPlatform('android', 34);
    expect(platformNotificationOptions()).toEqual({});
  });

  it.each([
    ['participant', () => displayParticipantNotification({ ...DATA, notification_type: 'event_participant_added' })],
    ['event', () => displayEventNotification(DATA)],
  ])('%s handler adds the ios options on iOS, with no category or actions', async (_n, run) => {
    setPlatform('ios', '17.4');
    await run();

    const arg = mockDisplay.mock.calls[0][0];
    expect(arg.ios).toEqual(IOS_OPTIONS);
    expect(arg.ios).not.toHaveProperty('categoryId');
  });

  it.each([
    ['participant', () => displayParticipantNotification({ ...DATA, notification_type: 'event_participant_added' })],
    ['event', () => displayEventNotification(DATA)],
  ])('%s handler output has no ios key on Android', async (_n, run) => {
    setPlatform('android', 34);
    await run();

    const arg = mockDisplay.mock.calls[0][0];
    expect(arg).not.toHaveProperty('ios');
    expect(arg.android.actions).toHaveLength(2);
  });
});

describe('background handler (no duplicate notification)', () => {
  function getHandler(): (m: unknown) => Promise<void> {
    registerBackgroundMessageHandler();
    return mockSetBackgroundHandler.mock.calls[0][1];
  }

  it('iOS: renders nothing for a message that carries a notification block', async () => {
    setPlatform('ios', '17.4');
    const handler = getHandler();

    await handler({ data: DATA, notification: { title: 'Title', body: 'Body' } });

    expect(mockDisplay).not.toHaveBeenCalled();
  });

  it('Android: still renders the data-only message locally', async () => {
    setPlatform('android', 34);
    const handler = getHandler();

    await handler({ data: DATA });

    expect(mockDisplay).toHaveBeenCalledTimes(1);
  });
});

describe('notification channels', () => {
  it('are created on Android only', async () => {
    setPlatform('ios', '17.4');
    await createNotificationChannels();
    expect(mockCreateChannel).not.toHaveBeenCalled();

    setPlatform('android', 34);
    await createNotificationChannels();
    expect(mockCreateChannel).toHaveBeenCalledTimes(1);
  });
});
