/**
 * Device-token endpoints in `fcm.ts`, checked against the live OpenAPI:
 * `POST /notifications/mobile-subscriptions` (body `MobilePushTokenRegisterRequest`)
 * and `DELETE /notifications/mobile-subscriptions/{device_token}` (free-form
 * string path segment).
 */
import { PermissionsAndroid, Platform } from 'react-native';
import * as firebaseMessaging from '@react-native-firebase/messaging';

import { apiClient } from '../../api/client';
import { deregisterDeviceToken, hasNotificationPermission, registerDeviceToken } from '../fcm';

jest.mock('../../api/client', () => ({
  apiClient: { post: jest.fn(), delete: jest.fn() },
}));

const mockDelete = apiClient.delete as jest.Mock;
const mockPost = apiClient.post as jest.Mock;
const mockGetToken = firebaseMessaging.getToken as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  jest.replaceProperty(Platform, 'OS', 'android');
  jest.spyOn(Platform, 'Version', 'get').mockReturnValue(34);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('deregisterDeviceToken', () => {
  it('percent-encodes the device token in the DELETE path', async () => {
    // Real FCM tokens contain ':' (and can contain '-', '_'); the encoding
    // must also neutralise '/', '?', '#', '+' and spaces.
    mockGetToken.mockResolvedValueOnce('dXyz:APA91b/x?y#z+w q');
    mockDelete.mockResolvedValueOnce({ status: 204 });

    await deregisterDeviceToken();

    expect(mockDelete).toHaveBeenCalledTimes(1);
    expect(mockDelete.mock.calls[0][0]).toBe(
      '/notifications/mobile-subscriptions/dXyz%3AAPA91b%2Fx%3Fy%23z%2Bw%20q',
    );
  });

  it('passes the correlation id and timeout through to the request config', async () => {
    mockGetToken.mockResolvedValueOnce('tok');
    mockDelete.mockResolvedValueOnce({ status: 204 });

    await deregisterDeviceToken({ correlationId: 'cid-1', timeout: 5000 });

    expect(mockDelete).toHaveBeenCalledWith('/notifications/mobile-subscriptions/tok', {
      correlationId: 'cid-1',
      timeout: 5000,
    });
  });
});

describe('registerDeviceToken', () => {
  it('sends deviceToken, platform "android" and a userAgent', async () => {
    mockPost.mockResolvedValueOnce({ data: { id: 'x' } });

    await registerDeviceToken('tok');

    expect(mockPost).toHaveBeenCalledWith('/notifications/mobile-subscriptions', {
      deviceToken: 'tok',
      platform: 'android',
      userAgent: 'MeetupMobile-Android/34',
    });
  });
});

describe('hasNotificationPermission', () => {
  it('is true without checking anything below API 33', async () => {
    jest.spyOn(Platform, 'Version', 'get').mockReturnValue(32);
    const check = jest.spyOn(PermissionsAndroid, 'check');

    await expect(hasNotificationPermission()).resolves.toBe(true);
    expect(check).not.toHaveBeenCalled();
  });

  it.each([true, false])('reflects POST_NOTIFICATIONS on API 33+ (%s)', async granted => {
    const check = jest.spyOn(PermissionsAndroid, 'check').mockResolvedValue(granted);

    await expect(hasNotificationPermission()).resolves.toBe(granted);
    expect(check).toHaveBeenCalledWith(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
  });
});
