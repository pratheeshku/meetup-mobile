/**
 * `getDeviceId()` (bug fix: device-scoped push-token registration). Covers
 * the memoization contract (one native call per process lifetime) and the
 * Android path (the iOS path is covered by `deviceIdIos.test.ts`), using the centralised `react-native-device-info`
 * mock from `jest.setup.js`.
 */
import { Platform } from 'react-native';
import DeviceInfo from 'react-native-device-info';

import { __resetDeviceIdCacheForTests, getDeviceId } from '../deviceId';

const mockGetAndroidId = DeviceInfo.getAndroidId as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  __resetDeviceIdCacheForTests();
  jest.replaceProperty(Platform, 'OS', 'android');
});

afterEach(() => {
  jest.restoreAllMocks();
});

it('resolves the native Android ID', async () => {
  mockGetAndroidId.mockResolvedValueOnce('device-abc');

  await expect(getDeviceId()).resolves.toBe('device-abc');
});

it('memoizes the value and calls the native bridge only once', async () => {
  mockGetAndroidId.mockResolvedValue('device-abc');

  await getDeviceId();
  await getDeviceId();
  await getDeviceId();

  expect(mockGetAndroidId).toHaveBeenCalledTimes(1);
});
