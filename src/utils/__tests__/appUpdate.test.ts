/**
 * App update decision, Later record, iOS build number and update-link allow-list
 * (DES-MEETUP-ADDENDUM-app-update-prompt AD-1, AD-7, AD-8, AD-9, AD-10, section 4.4).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import Config from 'react-native-config';
import DeviceInfo from 'react-native-device-info';

import { decideUpdate, LATER_STORAGE_KEY, loadLater, saveLater } from '../appUpdate';
import { getInstalledBuild, getInstalledIosBuild } from '../installedVersion';
import {
  APP_STORE_FALLBACK_URL,
  appStoreFallbackUrl,
  isAllowedIosStoreUrl,
  PLAY_STORE_FALLBACK_URL,
  PLAY_STORE_STAGING_FALLBACK_URL,
  playStoreFallbackUrl,
  resolveUpdateUrl,
} from '../playStoreUrl';

const HOUR = 60 * 60 * 1000;
const NOW = 1_800_000_000_000;
const STORE = 'https://play.google.com/store/apps/details?id=org.duckdns.meetups';
const policy = (minBuild: number, latestBuild: number) => ({ minBuild, latestBuild, storeUrl: STORE });

describe('decideUpdate (section 4.4)', () => {
  it.each([
    ['A1 latest 0, min 0', policy(0, 0), 116, 'none'],
    ['A2 latest 120, min 0, installed 116', policy(0, 120), 116, 'prompt'],
    ['A3 installed equal to latest', policy(0, 120), 120, 'none'],
    ['A4 below the minimum: block', policy(118, 120), 116, 'block'],
    ['A5 at or above min, below latest', policy(118, 120), 119, 'prompt'],
    ['a minimum above the latest still blocks (AD-8)', policy(130, 120), 125, 'block'],
    ['above both', policy(118, 120), 121, 'none'],
  ])('%s', (_label, given, installed, kind) => {
    expect(decideUpdate(given, installed, null, 24, NOW).kind).toBe(kind);
  });

  it('A8 / AD-9: no policy or an unreadable installed build -> none', () => {
    expect(decideUpdate(null, 116, null, 24, NOW).kind).toBe('none');
    expect(decideUpdate(policy(200, 200), null, null, 24, NOW).kind).toBe('none');
  });

  it('A6: Later 1 hour ago for the same latest build, reminder 24 -> none', () => {
    expect(decideUpdate(policy(0, 120), 116, { at: NOW - HOUR, latestBuild: 120 }, 24, NOW).kind).toBe('none');
  });

  it('A7: Later for an older latest build -> prompt again', () => {
    expect(decideUpdate(policy(0, 121), 116, { at: NOW - HOUR, latestBuild: 120 }, 24, NOW).kind).toBe('prompt');
  });

  it('the prompt returns once the reminder interval has passed', () => {
    const later = { at: NOW - 24 * HOUR, latestBuild: 120 };
    expect(decideUpdate(policy(0, 120), 116, later, 24, NOW).kind).toBe('prompt');
    expect(decideUpdate(policy(0, 120), 116, later, 25, NOW).kind).toBe('none');
  });

  it('a Later time in the future (clock moved back) does not suppress the prompt', () => {
    expect(decideUpdate(policy(0, 120), 116, { at: NOW + HOUR, latestBuild: 120 }, 24, NOW).kind).toBe('prompt');
  });

  it('a Later never suppresses the blocking screen', () => {
    expect(decideUpdate(policy(118, 120), 116, { at: NOW - HOUR, latestBuild: 120 }, 24, NOW).kind).toBe('block');
  });

  it('the decision carries the store link and the offered build', () => {
    expect(decideUpdate(policy(0, 120), 116, null, 24, NOW)).toEqual({ kind: 'prompt', storeUrl: STORE, latestBuild: 120 });
    expect(decideUpdate(policy(118, 0), 116, null, 24, NOW)).toEqual({ kind: 'block', storeUrl: STORE });
  });
});

describe('Later record (AD-7, device only)', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('round-trips the time and the dismissed build', async () => {
    await saveLater({ at: NOW, latestBuild: 120 });
    await expect(loadLater()).resolves.toEqual({ at: NOW, latestBuild: 120 });
  });

  it.each([
    ['nothing stored', null],
    ['not JSON', 'nope'],
    ['a wrong shape', JSON.stringify({ at: 'x', latestBuild: 120 })],
    ['a fractional build', JSON.stringify({ at: NOW, latestBuild: 1.5 })],
  ])('%s -> null', async (_label, raw) => {
    if (raw !== null) {
      await AsyncStorage.setItem(LATER_STORAGE_KEY, raw);
    }
    await expect(loadLater()).resolves.toBeNull();
  });
});

describe('installed iOS build (AD-1)', () => {
  afterEach(() => {
    (DeviceInfo.getBuildNumber as jest.Mock).mockReturnValue('45');
    delete (Config as Record<string, unknown>).VERSION_CODE;
  });

  it('reads CFBundleVersion as a whole number', () => {
    (DeviceInfo.getBuildNumber as jest.Mock).mockReturnValue('60');
    expect(getInstalledIosBuild()).toBe(60);
    expect(getInstalledBuild('ios')).toBe(60);
  });

  it.each([['1.6'], ['60a'], [''], ['0']])('"%s" is unreadable (fails open)', value => {
    (DeviceInfo.getBuildNumber as jest.Mock).mockReturnValue(value);
    expect(getInstalledIosBuild()).toBeNull();
  });

  it('a throwing native call is unreadable', () => {
    (DeviceInfo.getBuildNumber as jest.Mock).mockImplementation(() => {
      throw new Error('native');
    });
    expect(getInstalledIosBuild()).toBeNull();
  });

  it('Android keeps reading versionCode', () => {
    (Config as Record<string, unknown>).VERSION_CODE = 116;
    expect(getInstalledBuild('android')).toBe(116);
  });
});

describe('update link allow-list (AD-10)', () => {
  afterEach(() => {
    delete (Config as Record<string, unknown>).APP_ENV;
  });

  it.each([
    'https://apps.apple.com/sg/app/gameon-sg/id123',
    'https://testflight.apple.com/join/abc',
    'https://apps.apple.com',
  ])('iOS accepts %s', url => {
    expect(isAllowedIosStoreUrl(url)).toBe(true);
    expect(resolveUpdateUrl('ios', url)).toBe(url);
  });

  it.each([
    ['http', 'http://apps.apple.com/app/id1'],
    ['another host', 'https://evil.example/app'],
    ['a look-alike host', 'https://apps.apple.com.evil.example/app'],
    ['userinfo', 'https://apps.apple.com@evil.example/app'],
    ['a port', 'https://apps.apple.com:444/app'],
    ['itms-apps', 'itms-apps://apps.apple.com/app/id1'],
    ['over 500 characters', `https://apps.apple.com/${'a'.repeat(500)}`],
    ['the Play host', STORE],
  ])('iOS refuses %s: production falls back to the built-in App Store page, staging has none (null)', (_label, url) => {
    expect(isAllowedIosStoreUrl(url)).toBe(false);
    expect(resolveUpdateUrl('ios', url)).toBe(APP_STORE_FALLBACK_URL);
    (Config as Record<string, unknown>).APP_ENV = 'staging';
    expect(resolveUpdateUrl('ios', url)).toBeNull();
  });

  it('the built-in App Store page is the production app (Apple ID 6818480691); staging builds have none', () => {
    expect(APP_STORE_FALLBACK_URL).toBe('https://apps.apple.com/app/id6818480691');
    expect(isAllowedIosStoreUrl(APP_STORE_FALLBACK_URL)).toBe(true);
    expect(appStoreFallbackUrl()).toBe(APP_STORE_FALLBACK_URL);
    (Config as Record<string, unknown>).APP_ENV = 'staging';
    expect(appStoreFallbackUrl()).toBeNull();
  });

  it('Android over 500 characters falls back to the built-in page', () => {
    expect(resolveUpdateUrl('android', `https://play.google.com/${'a'.repeat(500)}`)).toBe(PLAY_STORE_FALLBACK_URL);
  });

  it('the built-in Play page follows the build: production id, or the staging id on a staging build', () => {
    expect(playStoreFallbackUrl()).toBe(PLAY_STORE_FALLBACK_URL);
    (Config as Record<string, unknown>).APP_ENV = 'staging';
    expect(playStoreFallbackUrl()).toBe(PLAY_STORE_STAGING_FALLBACK_URL);
    expect(PLAY_STORE_STAGING_FALLBACK_URL).toBe('https://play.google.com/store/apps/details?id=org.duckdns.meetups.staging');
    expect(resolveUpdateUrl('android', 'https://evil.example/')).toBe(PLAY_STORE_STAGING_FALLBACK_URL);
  });
});
