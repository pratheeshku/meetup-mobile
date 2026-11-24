/**
 * Force-update gate: REAL `ForceUpdateGate`, `useForceUpdate` and
 * `ForceUpdateScreen`, with the version-policy fetch running over a faked
 * transport. Only `AppState` (to simulate returning to the foreground),
 * `BackHandler` and `Linking` are stubbed.
 *
 * Blocked  <=>  installed versionCode < min_version_code.
 * Everything else (equal, above, any failure, unreadable installed version) is
 * "no update required" — the gate fails open.
 */
import React from 'react';
import { AppState, BackHandler, Keyboard, Linking, Platform, Text } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Config from 'react-native-config';
import DeviceInfo from 'react-native-device-info';
import ReactTestRenderer from 'react-test-renderer';

import { deferred, installFakeBackend } from '../../test-utils/apiHarness';
import type { FakeBackend, FakeReply } from '../../test-utils/apiHarness';
import { act, pressables, pressableWithText, texts } from '../../test-utils/render';
import type { Instance } from '../../test-utils/render';
import { PLAY_STORE_FALLBACK_URL } from '../../utils/playStoreUrl';
import ForceUpdateGate from '../ForceUpdateGate';

const STORE = 'https://play.google.com/store/apps/details?id=org.duckdns.meetups';
const APP = 'APP CONTENT';
const TITLE = 'Update required';
const MESSAGE = 'Please update GameOn SG to continue.';
const INSTALLED = 5;

const policy = (min: number, storeUrl: unknown = STORE): FakeReply => ({
  data: { android: { min_version_code: min, store_url: storeUrl } },
});

/** The full additive shape (app-update-prompt 4.2). */
const fullPolicy = (
  android: { min: number; latest: number },
  ios: { min: number; latest: number; url?: string } | null = null,
  reminderHours = 24,
): FakeReply => ({
  data: {
    android: { min_version_code: android.min, store_url: STORE, latest_version_code: android.latest },
    ...(ios ? { ios: { min_build: ios.min, latest_build: ios.latest, store_url: ios.url ?? IOS_STORE } } : {}),
    reminder_hours: reminderHours,
  },
});
const IOS_STORE = 'https://apps.apple.com/sg/app/gameon-sg/id123';
const PROMPT_TITLE = 'New version available';

let backend: FakeBackend;
let mounted: ReactTestRenderer.ReactTestRenderer | null = null;

/** The `change` handler the gate registered with AppState, and the removal spy. */
let appStateHandler: (state: string) => void;
let removeAppState: jest.Mock;
/** Live hardware-back handlers (registered and not yet removed). */
let backHandlers: Array<() => boolean>;

const mountGate = async (): Promise<Instance> => {
  await ReactTestRenderer.act(async () => {
    mounted = ReactTestRenderer.create(
      <ForceUpdateGate>
        <Text>{APP}</Text>
      </ForceUpdateGate>,
    );
  });
  return (mounted as unknown as ReactTestRenderer.ReactTestRenderer).root;
};

const emitAppState = async (state: string): Promise<void> => {
  await act(async () => {
    appStateHandler(state);
  });
};

const policyRequests = (): number => backend.callsTo('/app/version-policy').length;
const isBlocked = (root: Instance): boolean => texts(root).includes(TITLE);
const showsApp = (root: Instance): boolean => texts(root).includes(APP);

beforeEach(async () => {
  jest.clearAllMocks();
  jest.replaceProperty(Platform, 'OS', 'android');
  await AsyncStorage.clear();
  backend = installFakeBackend();
  backend.route = () => policy(INSTALLED); // equal by default: not blocked
  (Config as Record<string, unknown>).VERSION_CODE = INSTALLED;
  jest.spyOn(console, 'log').mockImplementation(() => {});

  removeAppState = jest.fn();
  (AppState as unknown as { currentState: string }).currentState = 'active';
  (AppState.addEventListener as jest.Mock).mockImplementation((_event: string, handler: (s: string) => void) => {
    appStateHandler = handler;
    return { remove: removeAppState };
  });

  backHandlers = [];
  jest.spyOn(BackHandler, 'addEventListener').mockImplementation(((_event: string, handler: () => boolean) => {
    backHandlers.push(handler);
    return { remove: () => {
        backHandlers.splice(backHandlers.indexOf(handler), 1);
      },
    };
  }) as never);

  (Linking.openURL as jest.Mock).mockReset();
  (Linking.openURL as jest.Mock).mockResolvedValue(undefined);
});

afterEach(() => {
  ReactTestRenderer.act(() => {
    mounted?.unmount();
  });
  mounted = null;
  delete (Config as Record<string, unknown>).VERSION_CODE;
  jest.restoreAllMocks();
});

describe('installed versionCode vs min_version_code', () => {
  it('BELOW the minimum: shows the blocking screen and not the app', async () => {
    backend.route = () => policy(INSTALLED + 1);

    const root = await mountGate();

    expect(texts(root)).toEqual(expect.arrayContaining([TITLE, MESSAGE, 'Update']));
    expect(showsApp(root)).toBe(false);
  });

  it('EQUAL to the minimum: the app is shown', async () => {
    backend.route = () => policy(INSTALLED);

    const root = await mountGate();

    expect(showsApp(root)).toBe(true);
    expect(isBlocked(root)).toBe(false);
  });

  it('ABOVE the minimum: the app is shown', async () => {
    backend.route = () => policy(INSTALLED - 1);

    const root = await mountGate();

    expect(showsApp(root)).toBe(true);
    expect(isBlocked(root)).toBe(false);
  });

  it.each([
    ['a minimum of 0', 0],
    ['a minimum far below', 1],
  ])('%s: the app is shown', async (_label, min) => {
    backend.route = () => policy(min);

    expect(showsApp(await mountGate())).toBe(true);
  });

  it('a very large minimum blocks', async () => {
    backend.route = () => policy(2_147_483_647);

    expect(isBlocked(await mountGate())).toBe(true);
  });

  it('blocks by exactly one code: installed 5, min 6', async () => {
    backend.route = () => policy(6);
    expect(isBlocked(await mountGate())).toBe(true);
  });
});

describe('launch', () => {
  it('makes exactly one policy request at launch', async () => {
    await mountGate();

    expect(policyRequests()).toBe(1);
  });

  it('renders the app immediately, without waiting for the policy', async () => {
    const gate = deferred();
    backend.route = async () => {
      await gate.promise;
      return policy(INSTALLED + 1);
    };

    const root = await mountGate();
    expect(showsApp(root)).toBe(true); // the policy has not answered yet
    expect(isBlocked(root)).toBe(false);

    await act(async () => {
      gate.resolve();
    });
    expect(isBlocked(root)).toBe(true); // ...and takes over once it does
    expect(showsApp(root)).toBe(false);
  });
});

describe('fails open: no update required', () => {
  it.each([
    ['a network error', { network: true }],
    ['a timeout', { timeout: true }],
    ['HTTP 500', { status: 500 }],
    ['HTTP 404', { status: 404 }],
    ['HTTP 204', { status: 204, data: '' }],
    ['an empty body', { data: {} }],
    ['android missing', { data: { ios: { min_version_code: 99, store_url: STORE } } }],
    ['min_version_code missing', { data: { android: { store_url: STORE } } }],
    ['min_version_code a string', { data: { android: { min_version_code: '99', store_url: STORE } } }],
    ['min_version_code fractional', { data: { android: { min_version_code: 99.5, store_url: STORE } } }],
    ['store_url missing', { data: { android: { min_version_code: 99 } } }],
    ['store_url not a string', { data: { android: { min_version_code: 99, store_url: 42 } } }],
  ])('%s -> the app is shown even though a "higher" minimum may be present', async (_label, reply) => {
    backend.route = () => reply;

    const root = await mountGate();

    expect(showsApp(root)).toBe(true);
    expect(isBlocked(root)).toBe(false);
    expect(backHandlers).toHaveLength(0);
  });

  it.each([
    ['missing', undefined],
    ['not a number', 'abc'],
    ['zero', 0],
  ])('an installed versionCode that is %s -> the app is shown', async (_label, value) => {
    (Config as Record<string, unknown>).VERSION_CODE = value;
    backend.route = () => policy(999);

    const root = await mountGate();

    expect(showsApp(root)).toBe(true);
    expect(isBlocked(root)).toBe(false);
  });

  it('logs only an error tag, never a value from the response', async () => {
    const log = jest.spyOn(console, 'log').mockImplementation(() => {});
    backend.route = () => ({ data: { android: { min_version_code: 'SECRET-MIN', store_url: 'https://evil.example/SECRET' } } });

    await mountGate();

    const output = log.mock.calls.map(call => call.join(' ')).join('\n');
    expect(output).toContain('malformed');
    expect(output).not.toContain('SECRET');
    expect(output).not.toContain('evil.example');
  });
});

describe('re-check each time the app returns to the foreground', () => {
  it('fetches again on background -> active', async () => {
    await mountGate();
    expect(policyRequests()).toBe(1);

    await emitAppState('background');
    expect(policyRequests()).toBe(1); // leaving does not fetch
    await emitAppState('active');

    expect(policyRequests()).toBe(2);
  });

  it('fetches again on inactive -> active, and on every later return', async () => {
    await mountGate();

    await emitAppState('inactive');
    await emitAppState('active');
    await emitAppState('background');
    await emitAppState('active');

    expect(policyRequests()).toBe(3);
  });

  it('does not fetch for an "active" event when the app never left the foreground', async () => {
    await mountGate();

    await emitAppState('active');

    expect(policyRequests()).toBe(1);
  });

  it('a build that has become too old is blocked on resume', async () => {
    const root = await mountGate();
    expect(showsApp(root)).toBe(true);

    backend.route = () => policy(INSTALLED + 1);
    await emitAppState('background');
    await emitAppState('active');

    expect(isBlocked(root)).toBe(true);
    expect(showsApp(root)).toBe(false);
  });

  it('is unblocked on resume once the policy no longer requires an update', async () => {
    backend.route = () => policy(INSTALLED + 1);
    const root = await mountGate();
    expect(isBlocked(root)).toBe(true);

    backend.route = () => policy(INSTALLED);
    await emitAppState('background');
    await emitAppState('active');

    expect(isBlocked(root)).toBe(false);
    expect(showsApp(root)).toBe(true);
    expect(backHandlers).toHaveLength(0); // the back-button guard is released too
  });

  it('a failed re-check fails open, like a failed launch check', async () => {
    backend.route = () => policy(INSTALLED + 1);
    const root = await mountGate();
    expect(isBlocked(root)).toBe(true);

    backend.route = () => ({ network: true });
    await emitAppState('background');
    await emitAppState('active');

    expect(isBlocked(root)).toBe(false);
  });

  it('a slow EARLIER response cannot overwrite a newer one', async () => {
    const slowLaunch = deferred();
    let call = 0;
    backend.route = async () => {
      call += 1;
      if (call === 1) {
        await slowLaunch.promise; // the launch check is slow...
        return policy(INSTALLED + 1); // ...and (stale) says "blocked"
      }
      return policy(INSTALLED); // the resume check answers first: fine
    };

    const root = await mountGate();
    await emitAppState('background');
    await emitAppState('active');
    expect(isBlocked(root)).toBe(false);

    await act(async () => {
      slowLaunch.resolve();
    });

    expect(isBlocked(root)).toBe(false); // the stale answer was ignored
    expect(showsApp(root)).toBe(true);
  });

  it('stops listening on unmount, and a late answer after unmount is harmless', async () => {
    const error = jest.spyOn(console, 'error').mockImplementation(() => {});
    const gate = deferred();
    backend.route = async () => {
      await gate.promise;
      return policy(INSTALLED + 1);
    };
    await mountGate();

    await act(async () => {
      mounted?.unmount();
    });
    mounted = null;
    await act(async () => {
      gate.resolve();
    });

    expect(removeAppState).toHaveBeenCalledTimes(1);
    expect(error).not.toHaveBeenCalled(); // no state update on an unmounted component
  });
});

describe('the blocking screen', () => {
  beforeEach(() => {
    backend.route = () => policy(INSTALLED + 1);
  });

  it('has the required title, text and an Update button — nothing else to press', async () => {
    const root = await mountGate();

    expect(texts(root)).toEqual(expect.arrayContaining([TITLE, MESSAGE]));
    expect(pressables(root)).toHaveLength(1);
    expect(pressableWithText(root, 'Update')).toBeTruthy();
  });

  it('the Android back button is consumed and does not bypass the gate', async () => {
    const root = await mountGate();

    expect(backHandlers).toHaveLength(1);
    let handled: boolean | undefined;
    await act(async () => {
      handled = backHandlers[0]();
    });

    expect(handled).toBe(true); // press consumed: no navigation, no exit
    expect(isBlocked(root)).toBe(true);
    expect(showsApp(root)).toBe(false);
  });

  it('back stays consumed however many times it is pressed', async () => {
    const root = await mountGate();

    for (let i = 0; i < 5; i += 1) {
      expect(backHandlers[0]()).toBe(true);
    }

    expect(isBlocked(root)).toBe(true);
  });

  it('registers no back handler when not blocked', async () => {
    backend.route = () => policy(INSTALLED);

    await mountGate();

    expect(backHandlers).toHaveLength(0);
  });

  it('pressing Update does not dismiss the screen', async () => {
    const root = await mountGate();

    await act(async () => {
      await pressableWithText(root, 'Update').props.onPress();
    });

    expect(isBlocked(root)).toBe(true);
    expect(showsApp(root)).toBe(false);
  });
});

describe('the Update button: URL validation', () => {
  const press = async (root: Instance): Promise<void> => {
    await act(async () => {
      await pressableWithText(root, 'Update').props.onPress();
    });
  };

  it('opens store_url when it is https on exactly play.google.com', async () => {
    const url = 'https://play.google.com/store/apps/details?id=org.duckdns.meetups&hl=en';
    backend.route = () => policy(INSTALLED + 1, url);

    await press(await mountGate());

    expect(Linking.openURL).toHaveBeenCalledTimes(1);
    expect(Linking.openURL).toHaveBeenCalledWith(url);
  });

  it.each([
    ['http', 'http://play.google.com/store/apps/details?id=org.duckdns.meetups'],
    ['another host', 'https://evil.example/store/apps/details?id=org.duckdns.meetups'],
    ['a look-alike host', 'https://play.google.com.evil.example/store'],
    ['userinfo hiding the host', 'https://play.google.com@evil.example/store'],
    ['a port', 'https://play.google.com:8443/store'],
    ['a market:// link', 'market://details?id=org.duckdns.meetups'],
    ['a javascript: URL', ['java', 'script:alert(1)'].join('')], // built by concatenation: keeps the script-URL lint rule quiet
    ['an intent:// URL', 'intent://details?id=org.duckdns.meetups#Intent;scheme=market;end'],
  ])('%s -> opens the Play page for org.duckdns.meetups instead', async (_label, url) => {
    backend.route = () => policy(INSTALLED + 1, url);

    await press(await mountGate());

    expect(Linking.openURL).toHaveBeenCalledTimes(1);
    expect(Linking.openURL).toHaveBeenCalledWith(PLAY_STORE_FALLBACK_URL);
    expect(Linking.openURL).not.toHaveBeenCalledWith(url);
  });

  it('if opening the given URL fails, it falls back to the Play page; the screen stays', async () => {
    const url = 'https://play.google.com/store/apps/details?id=org.duckdns.meetups&x=1';
    backend.route = () => policy(INSTALLED + 1, url);
    (Linking.openURL as jest.Mock).mockRejectedValueOnce(new Error('no handler'));

    const root = await mountGate();
    await press(root);

    expect((Linking.openURL as jest.Mock).mock.calls.map(call => call[0])).toEqual([url, PLAY_STORE_FALLBACK_URL]);
    expect(isBlocked(root)).toBe(true);
  });

  it('if nothing can open the store, pressing Update does not throw and the screen stays', async () => {
    backend.route = () => policy(INSTALLED + 1);
    (Linking.openURL as jest.Mock).mockRejectedValue(new Error('no handler'));

    const root = await mountGate();
    await press(root);

    expect(Linking.openURL).toHaveBeenCalledTimes(1); // already the fallback: no retry loop
    expect(isBlocked(root)).toBe(true);
  });

  it('a failed open logs only a tag, never the URL', async () => {
    const log = jest.spyOn(console, 'log').mockImplementation(() => {});
    backend.route = () => policy(INSTALLED + 1, 'https://play.google.com/store/apps/details?id=SECRET-APP');
    (Linking.openURL as jest.Mock).mockRejectedValue(new Error('no handler for https://play.google.com/SECRET'));

    await press(await mountGate());

    const output = log.mock.calls.map(call => call.join(' ')).join('\n');
    expect(output).toContain('opening the store page failed');
    expect(output).not.toContain('SECRET');
  });
});

describe('the optional prompt (app-update-prompt AU-01, AD-7, section 4.4)', () => {
  const showsPrompt = (root: Instance): boolean => texts(root).includes(PROMPT_TITLE);
  const pressLater = async (root: Instance): Promise<void> => {
    await act(async () => {
      await pressableWithText(root, 'Later').props.onPress();
    });
  };

  it('A1: latest 0 and min 0 -> nothing shown', async () => {
    backend.route = () => fullPolicy({ min: 0, latest: 0 });
    const root = await mountGate();
    expect(showsPrompt(root)).toBe(false);
    expect(isBlocked(root)).toBe(false);
    expect(showsApp(root)).toBe(true);
  });

  it('A2: installed below latest -> the prompt over the app, with Update and Later', async () => {
    backend.route = () => fullPolicy({ min: 0, latest: INSTALLED + 2 });
    const root = await mountGate();
    expect(showsApp(root)).toBe(true);
    expect(texts(root)).toEqual(
      expect.arrayContaining([
        PROMPT_TITLE,
        'A new version of GameOn SG is available. Update now to get the latest features and fixes.',
        'Update',
        'Later',
      ]),
    );
  });

  it('A3: installed equal to latest -> nothing shown', async () => {
    backend.route = () => fullPolicy({ min: 0, latest: INSTALLED });
    expect(showsPrompt(await mountGate())).toBe(false);
  });

  it('A4: below the minimum -> the blocking screen and never the prompt (required wins)', async () => {
    backend.route = () => fullPolicy({ min: INSTALLED + 1, latest: INSTALLED + 3 });
    const root = await mountGate();
    expect(isBlocked(root)).toBe(true);
    expect(showsPrompt(root)).toBe(false);
  });

  it('A5: at or above the minimum and below latest -> the prompt', async () => {
    backend.route = () => fullPolicy({ min: INSTALLED, latest: INSTALLED + 1 });
    const root = await mountGate();
    expect(isBlocked(root)).toBe(false);
    expect(showsPrompt(root)).toBe(true);
  });

  it('Update opens the store link and leaves the prompt up', async () => {
    backend.route = () => fullPolicy({ min: 0, latest: INSTALLED + 1 });
    const root = await mountGate();
    await act(async () => {
      await pressableWithText(root, 'Update').props.onPress();
    });
    expect(Linking.openURL).toHaveBeenCalledWith(STORE);
    expect(showsPrompt(root)).toBe(true);
  });

  it('Later closes the prompt and records the time and the dismissed build on the device', async () => {
    backend.route = () => fullPolicy({ min: 0, latest: INSTALLED + 1 });
    const root = await mountGate();
    await pressLater(root);
    expect(showsPrompt(root)).toBe(false);
    expect(showsApp(root)).toBe(true);
    const stored = JSON.parse((await AsyncStorage.getItem('app_update.later')) as string);
    expect(stored.latestBuild).toBe(INSTALLED + 1);
    expect(typeof stored.at).toBe('number');
  });

  it('A6: after Later, a foreground check within the reminder interval shows nothing', async () => {
    backend.route = () => fullPolicy({ min: 0, latest: INSTALLED + 1 });
    const root = await mountGate();
    await pressLater(root);
    await emitAppState('background');
    await emitAppState('active');
    expect(showsPrompt(root)).toBe(false);
  });

  it('after the reminder interval has passed, the prompt comes back', async () => {
    await AsyncStorage.setItem(
      'app_update.later',
      JSON.stringify({ at: Date.now() - 25 * 60 * 60 * 1000, latestBuild: INSTALLED + 1 }),
    );
    backend.route = () => fullPolicy({ min: 0, latest: INSTALLED + 1 }, null, 24);
    expect(showsPrompt(await mountGate())).toBe(true);
  });

  it('the admin reminder interval is honoured (1 hour)', async () => {
    await AsyncStorage.setItem(
      'app_update.later',
      JSON.stringify({ at: Date.now() - 2 * 60 * 60 * 1000, latestBuild: INSTALLED + 1 }),
    );
    backend.route = () => fullPolicy({ min: 0, latest: INSTALLED + 1 }, null, 1);
    expect(showsPrompt(await mountGate())).toBe(true);
  });

  it('A7: after Later, a new latest build brings the prompt back at once', async () => {
    backend.route = () => fullPolicy({ min: 0, latest: INSTALLED + 1 });
    const root = await mountGate();
    await pressLater(root);
    backend.route = () => fullPolicy({ min: 0, latest: INSTALLED + 2 });
    await emitAppState('background');
    await emitAppState('active');
    expect(showsPrompt(root)).toBe(true);
  });

  it('A8: the policy endpoint unreachable -> nothing shown', async () => {
    backend.route = () => ({ network: true });
    expect(showsPrompt(await mountGate())).toBe(false);
  });

  it('does not interrupt typing: with the keyboard open the prompt waits for the next check', async () => {
    const isVisible = jest.spyOn(Keyboard, 'isVisible').mockReturnValue(true);
    backend.route = () => fullPolicy({ min: 0, latest: INSTALLED + 1 });
    const root = await mountGate();
    expect(showsPrompt(root)).toBe(false);

    isVisible.mockReturnValue(false);
    await emitAppState('background');
    await emitAppState('active');
    expect(showsPrompt(root)).toBe(true);
  });

  it('the keyboard never holds back the blocking screen', async () => {
    jest.spyOn(Keyboard, 'isVisible').mockReturnValue(true);
    backend.route = () => fullPolicy({ min: INSTALLED + 1, latest: 0 });
    expect(isBlocked(await mountGate())).toBe(true);
  });

  it('Android back on the prompt acts as Later', async () => {
    backend.route = () => fullPolicy({ min: 0, latest: INSTALLED + 1 });
    const root = await mountGate();
    const modal = root.findAll(node => typeof node.props.onRequestClose === 'function')[0];
    await act(async () => {
      modal.props.onRequestClose();
    });
    expect(showsPrompt(root)).toBe(false);
    expect(await AsyncStorage.getItem('app_update.later')).not.toBeNull();
  });
});

describe('iOS (app-update-prompt AU-01, AU-02, 4.3)', () => {
  beforeEach(() => {
    jest.replaceProperty(Platform, 'OS', 'ios');
    (DeviceInfo.getBuildNumber as jest.Mock).mockReturnValue('60');
  });

  it('uses the ios object and the installed CFBundleVersion: below latest -> the prompt', async () => {
    backend.route = () => fullPolicy({ min: 0, latest: 0 }, { min: 0, latest: 61 });
    expect(texts(await mountGate())).toContain(PROMPT_TITLE);
  });

  it('below the iOS minimum -> the blocking screen', async () => {
    backend.route = () => fullPolicy({ min: 0, latest: 0 }, { min: 61, latest: 61 });
    expect(isBlocked(await mountGate())).toBe(true);
  });

  it('ignores the Android values on iOS', async () => {
    backend.route = () => fullPolicy({ min: 999, latest: 999 }, { min: 0, latest: 60 });
    const root = await mountGate();
    expect(isBlocked(root)).toBe(false);
    expect(texts(root)).not.toContain(PROMPT_TITLE);
  });

  it('an older server with no ios object -> nothing shown on iOS', async () => {
    backend.route = () => policy(999);
    const root = await mountGate();
    expect(isBlocked(root)).toBe(false);
    expect(showsApp(root)).toBe(true);
  });

  it('a build number that is not a plain whole number fails open', async () => {
    (DeviceInfo.getBuildNumber as jest.Mock).mockReturnValue('60.1');
    backend.route = () => fullPolicy({ min: 0, latest: 0 }, { min: 99, latest: 99 });
    expect(isBlocked(await mountGate())).toBe(false);
  });

  it('Update opens an apps.apple.com or testflight.apple.com link', async () => {
    const url = 'https://testflight.apple.com/join/abc';
    backend.route = () => fullPolicy({ min: 0, latest: 0 }, { min: 61, latest: 61, url });
    const root = await mountGate();
    await act(async () => {
      await pressableWithText(root, 'Update').props.onPress();
    });
    expect(Linking.openURL).toHaveBeenCalledWith(url);
  });

  it('an iOS link off the allow-list is never opened', async () => {
    backend.route = () => fullPolicy({ min: 0, latest: 0 }, { min: 61, latest: 61, url: 'https://evil.example/app' });
    const root = await mountGate();
    await act(async () => {
      await pressableWithText(root, 'Update').props.onPress();
    });
    expect(Linking.openURL).not.toHaveBeenCalled();
    expect(isBlocked(root)).toBe(true);
  });
});
