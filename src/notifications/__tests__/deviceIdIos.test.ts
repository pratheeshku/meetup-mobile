/**
 * iOS `getDeviceId()` (DES-MEETUP-ADDENDUM-IOS-App.md §3): a UUID generated
 * once and kept in the Keychain; never empty; the Android bridge is not used.
 */
import { Platform } from 'react-native';
import DeviceInfo from 'react-native-device-info';
import * as Keychain from 'react-native-keychain';

import { __resetDeviceIdCacheForTests, getDeviceId } from '../deviceId';

const mockGet = Keychain.getGenericPassword as jest.Mock;
const mockSet = Keychain.setGenericPassword as jest.Mock;
const mockGetAndroidId = DeviceInfo.getAndroidId as jest.Mock;

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

beforeEach(() => {
  jest.clearAllMocks();
  __resetDeviceIdCacheForTests();
  jest.replaceProperty(Platform, 'OS', 'ios');
  mockGet.mockResolvedValue(false);
  mockSet.mockResolvedValue({ service: 'mock', storage: 'keychain' });
});

afterEach(() => {
  jest.restoreAllMocks();
});

it('generates a non-empty UUID once, stores it in the Keychain, and returns it', async () => {
  const id = await getDeviceId();

  expect(id).toMatch(UUID_V4);
  expect(mockSet).toHaveBeenCalledTimes(1);
  expect(mockSet).toHaveBeenCalledWith(
    expect.any(String),
    id,
    expect.objectContaining({ accessible: 'AccessibleAfterFirstUnlockThisDeviceOnly' }),
  );
  expect(mockGetAndroidId).not.toHaveBeenCalled();
});

it('is stable across calls in one process', async () => {
  const first = await getDeviceId();
  const second = await getDeviceId();

  expect(second).toBe(first);
  expect(mockSet).toHaveBeenCalledTimes(1);
});

it('returns the id already in the Keychain after a reinstall or relaunch, without writing', async () => {
  mockGet.mockResolvedValue({ username: 'device_id', password: 'existing-id', service: 'x' });

  await expect(getDeviceId()).resolves.toBe('existing-id');
  expect(mockSet).not.toHaveBeenCalled();
});

it('rejects (never returns an empty string) when the Keychain write fails, and retries next call', async () => {
  mockSet.mockResolvedValueOnce(false);

  await expect(getDeviceId()).rejects.toThrow();

  const id = await getDeviceId();
  expect(id).not.toBe('');
});

it('does not mint a replacement id when the Keychain read throws', async () => {
  mockGet.mockRejectedValueOnce(new Error('keychain unavailable'));

  await expect(getDeviceId()).rejects.toThrow('keychain unavailable');
  expect(mockSet).not.toHaveBeenCalled();
});
