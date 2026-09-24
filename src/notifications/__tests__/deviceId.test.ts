/**
 * `getDeviceId()` (bug fix: device-scoped push-token registration). Covers
 * the memoization contract (one native call per process lifetime) and the
 * Android-only guard, using the centralised `react-native-device-info`
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

it('resolves an empty string without calling the native bridge off Android', async () => {
  jest.replaceProperty(Platform, 'OS', 'ios');

  await expect(getDeviceId()).resolves.toBe('');
  expect(mockGetAndroidId).not.toHaveBeenCalled();
});
