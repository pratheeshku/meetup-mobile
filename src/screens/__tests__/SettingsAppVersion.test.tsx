/** Settings: version line and long-press support text (five lines, no personal data, /health best effort). */
import React from 'react';
import { Platform } from 'react-native';
import DeviceInfo from 'react-native-device-info';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { getNotificationSettings } from '../../api/profile';
import { copyTextToClipboard } from '../../utils/shareLink';
import { act, renderAsync, texts } from '../../test-utils/render';
import type { Instance } from '../../test-utils/render';
import { HEALTH_TIMEOUT_MS } from '../../utils/supportInfo';
import { bundledT } from '../../labels/LabelsContext';
import SettingsScreen from '../SettingsScreen';

jest.mock('../../api/profile', () => ({
  getNotificationSettings: jest.fn(),
  updateNotificationSettings: jest.fn(),
  requestDeletion: jest.fn(),
  parseOwnsGroupsError: jest.fn(),
}));
jest.mock('../../utils/shareLink', () => ({
  ...jest.requireActual('../../utils/shareLink'),
  copyTextToClipboard: jest.fn(),
}));

const mockCopy = copyTextToClipboard as jest.Mock;
const device = DeviceInfo as unknown as Record<string, jest.Mock>;
const METRICS = { frame: { x: 0, y: 0, width: 360, height: 640 }, insets: { top: 0, left: 0, right: 0, bottom: 24 } };
const NOW = new Date('2026-10-17T08:30:00.000Z');

const originalFetch = globalThis.fetch;
const originalOS = Platform.OS;
const setOS = (os: 'android' | 'ios'): void => {
  Object.defineProperty(Platform, 'OS', { configurable: true, get: () => os });
};
const mockFetch = jest.fn();

async function mount(): Promise<Instance> {
  const props = { navigation: { goBack: jest.fn(), navigate: jest.fn() } } as unknown as React.ComponentProps<typeof SettingsScreen>;
  return renderAsync(
    <SafeAreaProvider initialMetrics={METRICS}>
      <SettingsScreen {...props} />
    </SafeAreaProvider>,
  );
}
const versionNode = (root: Instance): Instance =>
  root.findAll(n => n.props.testID === 'settings-app-version' && typeof n.props.onLongPress === 'function')[0];
const longPress = async (root: Instance): Promise<void> => {
  await act(async () => {
    await versionNode(root).props.onLongPress();
  });
};

beforeEach(() => {
  setOS('android');
  jest.useFakeTimers({ now: NOW });
  globalThis.fetch = mockFetch as unknown as typeof fetch;
  mockFetch.mockReset().mockResolvedValue({ ok: true, json: async () => ({ status: 'ok', version: '2.5.0' }) });
  mockCopy.mockReset();
  (getNotificationSettings as jest.Mock).mockReset().mockResolvedValue({ push_enabled: true, email_enabled: true });
  device.getVersion.mockReset().mockReturnValue('1.2.3');
  device.getBuildNumber.mockReset().mockReturnValue('45');
  device.getBrand.mockReset().mockReturnValue('Google');
  device.getModel.mockReset().mockReturnValue('Pixel 8');
  device.getSystemVersion.mockReset().mockReturnValue('15');
  device.getApiLevel.mockReset().mockResolvedValue(35);
});
afterEach(() => {
  setOS(originalOS as 'android' | 'ios');
  globalThis.fetch = originalFetch;
  act(() => {
    jest.runOnlyPendingTimers();
  });
  jest.useRealTimers();
});

describe('version line', () => {
  it('renders "Version {version} ({build})" from DeviceInfo, last in the list, via the label key', async () => {
    const root = await mount();
    expect(texts(root)).toContain('Version 1.2.3 (45)');
    expect(bundledT('mob.settings.app_version', { version: '1.2.3', build: '45' })).toBe('Version 1.2.3 (45)');
    const all = texts(root);
    expect(all[all.length - 1]).toBe('Version 1.2.3 (45)'); // last item on the screen
    expect(all.indexOf('Version 1.2.3 (45)')).toBeGreaterThan(all.indexOf(bundledT('mob.settings.section_danger')));
  });

  it('does not call /health on open', async () => {
    await mount();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('does not crash when DeviceInfo throws', async () => {
    for (const fn of ['getVersion', 'getBuildNumber', 'getBrand', 'getModel', 'getSystemVersion']) {
      device[fn].mockImplementation(() => {
        throw new Error('native module missing');
      });
    }
    device.getApiLevel.mockRejectedValue(new Error('native module missing'));
    const root = await mount();
    expect(texts(root)).toContain('Version unknown (unknown)');
    await longPress(root);
    expect(mockCopy).toHaveBeenCalledTimes(1);
    expect(mockCopy.mock.calls[0][0]).toBe(
      [
        'App: unknown (unknown)',
        'Server: 2.5.0',
        'Device: unknown unknown',
        'Android: unknown (API unknown)',
        'Time: 2026-10-17T08:30:00.000Z',
      ].join('\n'),
    );
  });
});

describe('long press copies the support text', () => {
  it('copies exactly the five lines and shows "Copied"', async () => {
    const root = await mount();
    await longPress(root);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockCopy).toHaveBeenCalledTimes(1);
    expect(mockCopy.mock.calls[0][0]).toBe(
      [
        'App: 1.2.3 (45)',
        'Server: 2.5.0',
        'Device: Google Pixel 8',
        'Android: 15 (API 35)',
        'Time: 2026-10-17T08:30:00.000Z',
      ].join('\n'),
    );
    expect(texts(root)).toContain('Copied');
  });

  it('iOS: "iOS: {version}" with no API level, device line unchanged', async () => {
    setOS('ios');
    device.getBrand.mockReturnValue('Apple');
    device.getModel.mockReturnValue('iPhone 16');
    device.getSystemVersion.mockReturnValue('18.1');
    const root = await mount();
    await longPress(root);
    expect(mockCopy.mock.calls[0][0]).toBe(
      [
        'App: 1.2.3 (45)',
        'Server: 2.5.0',
        'Device: Apple iPhone 16',
        'iOS: 18.1',
        'Time: 2026-10-17T08:30:00.000Z',
      ].join('\n'),
    );
    expect(device.getApiLevel).not.toHaveBeenCalled();
  });

  it('iOS: still five lines and no personal data', async () => {
    setOS('ios');
    const root = await mount();
    await longPress(root);
    const text: string = mockCopy.mock.calls[0][0];
    const lines = text.split('\n');
    expect(lines).toHaveLength(5);
    expect(lines.map(line => line.split(':')[0])).toEqual(['App', 'Server', 'Device', 'iOS', 'Time']);
    expect(text).not.toMatch(/user|name|email|phone|token|device ?id|android|push|ip\b|@/i);
  });

  it('requests /health at the API root with no credentials', async () => {
    const root = await mount();
    await longPress(root);
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe('https://meetups.duckdns.org/health');
    expect(JSON.stringify(init.headers ?? {})).not.toMatch(/authorization|cookie|token/i);
  });

  it('contains no personal or identifying data: five lines, only the expected prefixes', async () => {
    const root = await mount();
    await longPress(root);
    const text: string = mockCopy.mock.calls[0][0];
    const lines = text.split('\n');
    expect(lines).toHaveLength(5);
    expect(lines.map(line => line.split(':')[0])).toEqual(['App', 'Server', 'Device', 'Android', 'Time']);
    expect(text).not.toMatch(/user|name|email|phone|token|device ?id|android ?id|push|ip\b|@/i);
    expect(device.getAndroidId).not.toHaveBeenCalled();
  });

  it.each([
    ['a network error', () => mockFetch.mockRejectedValue(new Error('offline'))],
    ['a non-OK status', () => mockFetch.mockResolvedValue({ ok: false, json: async () => ({ version: '9' }) })],
    ['a missing version field', () => mockFetch.mockResolvedValue({ ok: true, json: async () => ({ status: 'ok' }) })],
    ['invalid JSON', () => mockFetch.mockResolvedValue({ ok: true, json: async () => { throw new Error('bad json'); } })],
  ])('writes "Server: unknown" after %s', async (_name, arrange) => {
    arrange();
    const root = await mount();
    await longPress(root);
    const lines = (mockCopy.mock.calls[0][0] as string).split('\n');
    expect(lines[1]).toBe('Server: unknown');
    expect(lines).toHaveLength(5);
  });

  it('gives up on /health after 3 seconds and still copies', async () => {
    mockFetch.mockImplementation(
      (_url: string, init: { signal: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          init.signal.addEventListener('abort', () => reject(new Error('aborted')));
        }),
    );
    const root = await mount();
    let pending!: Promise<void>;
    await act(async () => {
      pending = versionNode(root).props.onLongPress();
      jest.advanceTimersByTime(HEALTH_TIMEOUT_MS + 1);
      await pending;
    });
    expect((mockCopy.mock.calls[0][0] as string).split('\n')[1]).toBe('Server: unknown');
  });

  it('keeps a multi-line server value on one line', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ version: '1.0\nUser: someone@example.com' }) });
    const root = await mount();
    await longPress(root);
    expect((mockCopy.mock.calls[0][0] as string).split('\n')).toHaveLength(5);
  });
});
