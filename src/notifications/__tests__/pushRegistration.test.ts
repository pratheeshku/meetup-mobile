/**
 * Permission + registration lifecycle (`pushRegistration.ts`, DES §3.6,
 * R-070/R-072/R-075). Runs against the real `fcm.ts` with the centralised
 * Firebase mocks from `jest.setup.js`; only the API client and the RN
 * platform edges (Platform, PermissionsAndroid, Alert, AppState) are stubbed.
 */
import { Alert, AppState, PermissionsAndroid, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as firebaseMessaging from '@react-native-firebase/messaging';

import { apiClient } from '../../api/client';
import { RATIONALE_SHOWN_KEY, startPushRegistration } from '../pushRegistration';

jest.mock('../../api/client', () => ({
  apiClient: { post: jest.fn(), delete: jest.fn() },
}));

const mockPost = apiClient.post as jest.Mock;
const mockGetToken = firebaseMessaging.getToken as jest.Mock;
const mockOnTokenRefresh = firebaseMessaging.onTokenRefresh as jest.Mock;

const TOKEN = 'token-A:secret-material';
const REGISTER_URL = '/notifications/mobile-subscriptions';

/** Lets chained awaits (AsyncStorage mock, permission, token, POST) settle. */
async function flush(): Promise<void> {
  for (let i = 0; i < 50; i += 1) {
    await Promise.resolve();
  }
}

let appStateListener: (state: string) => void;
const removeAppStateListener = jest.fn();
let refreshListener: (token: string) => Promise<void>;
const unsubscribeRefresh = jest.fn();

let checkPermission: jest.SpyInstance;
let requestPermissionSpy: jest.SpyInstance;
let alertSpy: jest.SpyInstance;
let logSpy: jest.SpyInstance;

// The RN Jest preset mocks `AppState.currentState` as a function; real Android
// has a string. Assigned directly and restored after each test.
const originalCurrentState = AppState.currentState;
function setAppState(state: string): void {
  (AppState as unknown as { currentState: string }).currentState = state;
}

function setAndroidVersion(version: number): void {
  jest.replaceProperty(Platform, 'OS', 'android');
  jest.spyOn(Platform, 'Version', 'get').mockReturnValue(version);
}

beforeEach(async () => {
  // The default export is one long-lived in-memory instance; clear its state
  // so the "rationale shown" flag cannot leak between tests.
  await AsyncStorage.clear();
  jest.clearAllMocks();
  setAndroidVersion(34);

  mockPost.mockResolvedValue({ data: { id: 'sub-1' } });
  mockGetToken.mockResolvedValue(TOKEN);
  mockOnTokenRefresh.mockImplementation((_messaging: unknown, cb: (t: string) => Promise<void>) => {
    refreshListener = cb;
    return unsubscribeRefresh;
  });

  jest.spyOn(AppState, 'addEventListener').mockImplementation(((
    _type: string,
    cb: (state: string) => void,
  ) => {
    appStateListener = cb;
    return { remove: removeAppStateListener };
  }) as never);
  setAppState('active');

  checkPermission = jest.spyOn(PermissionsAndroid, 'check').mockResolvedValue(false);
  requestPermissionSpy = jest
    .spyOn(PermissionsAndroid, 'request')
    .mockResolvedValue(PermissionsAndroid.RESULTS.GRANTED);
  // Tap the rationale's single button immediately.
  alertSpy = jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => {
    buttons?.[0]?.onPress?.();
  });
  logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
  (AppState as unknown as { currentState: unknown }).currentState = originalCurrentState;
});

describe('permission (R-072)', () => {
  it('needs no prompt and no rationale below API 33, and still registers', async () => {
    setAndroidVersion(30);
    const stop = startPushRegistration();
    await flush();

    expect(checkPermission).not.toHaveBeenCalled();
    expect(requestPermissionSpy).not.toHaveBeenCalled();
    expect(alertSpy).not.toHaveBeenCalled();
    expect(await AsyncStorage.getItem(RATIONALE_SHOWN_KEY)).toBeNull();
    expect(mockPost).toHaveBeenCalledTimes(1);
    stop();
  });

  it('does not prompt or show the rationale when permission is already granted', async () => {
    checkPermission.mockResolvedValue(true);
    const stop = startPushRegistration();
    await flush();

    expect(alertSpy).not.toHaveBeenCalled();
    expect(requestPermissionSpy).not.toHaveBeenCalled();
    expect(mockPost).toHaveBeenCalledTimes(1);
    stop();
  });

  it('shows the rationale once, remembers it, then asks the system — in that order', async () => {
    const stop = startPushRegistration();
    await flush();

    expect(alertSpy).toHaveBeenCalledTimes(1);
    expect(requestPermissionSpy).toHaveBeenCalledTimes(1);
    expect(requestPermissionSpy).toHaveBeenCalledWith(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
    expect(alertSpy.mock.invocationCallOrder[0]).toBeLessThan(
      requestPermissionSpy.mock.invocationCallOrder[0],
    );
    expect(await AsyncStorage.getItem(RATIONALE_SHOWN_KEY)).toBe('1');
    // The rationale cannot be dismissed without pressing its button.
    expect(alertSpy.mock.calls[0][3]).toEqual({ cancelable: false });
    expect(mockPost).toHaveBeenCalledTimes(1);
    stop();
  });

  it('does not nag after a denial: no rationale, no system prompt, no registration', async () => {
    requestPermissionSpy.mockResolvedValue(PermissionsAndroid.RESULTS.DENIED);
    const stop = startPushRegistration();
    await flush();
    expect(alertSpy).toHaveBeenCalledTimes(1);
    expect(mockPost).not.toHaveBeenCalled();
    expect(mockGetToken).not.toHaveBeenCalled();

    appStateListener('active'); // next foreground
    await flush();
    stop();

    // A brand-new session (cold start) is gated by the same persisted flag.
    const nextColdStart = startPushRegistration();
    await flush();
    nextColdStart();

    expect(alertSpy).toHaveBeenCalledTimes(1);
    expect(requestPermissionSpy).toHaveBeenCalledTimes(1);
    expect(mockPost).not.toHaveBeenCalled();
  });

  it('never prompts when the rationale was already shown on an earlier launch', async () => {
    await AsyncStorage.setItem(RATIONALE_SHOWN_KEY, '1');
    const stop = startPushRegistration();
    await flush();

    expect(alertSpy).not.toHaveBeenCalled();
    expect(requestPermissionSpy).not.toHaveBeenCalled();
    expect(mockPost).not.toHaveBeenCalled();
    stop();
  });

  it('registers on a later foreground once the user grants it in system settings', async () => {
    await AsyncStorage.setItem(RATIONALE_SHOWN_KEY, '1');
    const stop = startPushRegistration();
    await flush();
    expect(mockPost).not.toHaveBeenCalled();

    checkPermission.mockResolvedValue(true);
    appStateListener('active');
    await flush();

    expect(alertSpy).not.toHaveBeenCalled();
    expect(mockPost).toHaveBeenCalledTimes(1);
    stop();
  });

  it('fails closed (no prompt, no registration) when the flag cannot be read', async () => {
    jest.spyOn(AsyncStorage, 'getItem').mockRejectedValue(new Error('storage down'));
    const stop = startPushRegistration();
    await flush();

    expect(alertSpy).not.toHaveBeenCalled();
    expect(requestPermissionSpy).not.toHaveBeenCalled();
    expect(mockPost).not.toHaveBeenCalled();
    stop();
  });

  it('fails closed when the flag cannot be written (would otherwise re-ask every launch)', async () => {
    jest.spyOn(AsyncStorage, 'setItem').mockRejectedValue(new Error('storage down'));
    const stop = startPushRegistration();
    await flush();

    expect(alertSpy).not.toHaveBeenCalled();
    expect(requestPermissionSpy).not.toHaveBeenCalled();
    expect(mockPost).not.toHaveBeenCalled();
    stop();
  });

  it('waits for the app to be in the foreground before showing anything', async () => {
    setAppState('background');
    const stop = startPushRegistration();
    await flush();
    expect(alertSpy).not.toHaveBeenCalled();
    expect(mockPost).not.toHaveBeenCalled();

    setAppState('active');
    appStateListener('active');
    await flush();
    expect(alertSpy).toHaveBeenCalledTimes(1);
    expect(mockPost).toHaveBeenCalledTimes(1);
    stop();
  });
});

describe('registration (R-070)', () => {
  beforeEach(() => {
    checkPermission.mockResolvedValue(true);
  });

  it('POSTs the token with the live-schema body {deviceToken, platform, userAgent}', async () => {
    const stop = startPushRegistration();
    await flush();

    expect(mockPost).toHaveBeenCalledWith(REGISTER_URL, {
      deviceToken: TOKEN,
      platform: 'android',
      userAgent: 'MeetupMobile-Android/34',
    });
    stop();
  });

  it('does not register twice in one session for the same token', async () => {
    const stop = startPushRegistration();
    await flush();
    appStateListener('active');
    await flush();
    appStateListener('active');
    await flush();

    expect(mockPost).toHaveBeenCalledTimes(1);
    stop();
  });

  it('does not double-register when a foreground event arrives mid-attempt', async () => {
    let releasePost!: () => void;
    mockPost.mockImplementation(
      () => new Promise<void>(resolve => { releasePost = () => resolve(); }),
    );
    const stop = startPushRegistration();
    await flush();
    appStateListener('active'); // e.g. returning from the system permission dialog
    await flush();
    releasePost();
    await flush();

    expect(mockPost).toHaveBeenCalledTimes(1);
    stop();
  });

  it('registers again if the token changed since the last registration', async () => {
    const stop = startPushRegistration();
    await flush();
    mockGetToken.mockResolvedValue('token-B');
    appStateListener('active');
    await flush();

    expect(mockPost).toHaveBeenCalledTimes(2);
    expect(mockPost.mock.calls[1][1].deviceToken).toBe('token-B');
    stop();
  });

  it('swallows a failure with a token-free log and retries on the next foreground', async () => {
    mockPost.mockRejectedValueOnce(
      Object.assign(new Error('boom'), { code: 'ERR_NETWORK', config: { data: TOKEN } }),
    );
    const stop = startPushRegistration();
    await flush();

    expect(mockPost).toHaveBeenCalledTimes(1);
    const logged = JSON.stringify(logSpy.mock.calls);
    expect(logged).toContain('ERR_NETWORK');
    expect(logged).not.toContain('token-A');
    expect(logged).not.toContain('secret-material');

    appStateListener('active');
    await flush();
    expect(mockPost).toHaveBeenCalledTimes(2);
    stop();

    // ...and a cold start (new session) retries too.
    mockPost.mockClear();
    const nextColdStart = startPushRegistration();
    await flush();
    expect(mockPost).toHaveBeenCalledTimes(1);
    nextColdStart();
  });

  it('swallows a failure to obtain the FCM token', async () => {
    mockGetToken.mockRejectedValueOnce(new Error('SERVICE_NOT_AVAILABLE'));
    const stop = startPushRegistration();
    await flush();

    expect(mockPost).not.toHaveBeenCalled();
    appStateListener('active');
    await flush();
    expect(mockPost).toHaveBeenCalledTimes(1);
    stop();
  });
});

describe('never registers while signed out', () => {
  it('ignores a permission result that arrives after stop()', async () => {
    let resolveCheck!: (granted: boolean) => void;
    checkPermission.mockImplementation(
      () => new Promise<boolean>(resolve => { resolveCheck = resolve; }),
    );
    const stop = startPushRegistration();
    stop();
    resolveCheck(true);
    await flush();

    expect(mockGetToken).not.toHaveBeenCalled();
    expect(mockPost).not.toHaveBeenCalled();
    expect(mockOnTokenRefresh).not.toHaveBeenCalled();
  });

  it('does not POST a token that resolves after stop()', async () => {
    checkPermission.mockResolvedValue(true);
    let resolveToken!: (token: string) => void;
    mockGetToken.mockImplementation(
      () => new Promise<string>(resolve => { resolveToken = resolve; }),
    );
    const stop = startPushRegistration();
    await flush();
    stop();
    resolveToken(TOKEN);
    await flush();

    expect(mockPost).not.toHaveBeenCalled();
  });

  it('removes its foreground listener and stops reacting to foreground events', async () => {
    checkPermission.mockResolvedValue(true);
    const stop = startPushRegistration();
    await flush();
    stop();
    expect(removeAppStateListener).toHaveBeenCalledTimes(1);

    mockGetToken.mockResolvedValue('token-B');
    appStateListener('active');
    await flush();
    expect(mockPost).toHaveBeenCalledTimes(1); // only the pre-stop registration
  });

  it('stop() is idempotent', async () => {
    checkPermission.mockResolvedValue(true);
    const stop = startPushRegistration();
    await flush();
    stop();
    stop();

    expect(removeAppStateListener).toHaveBeenCalledTimes(1);
    expect(unsubscribeRefresh).toHaveBeenCalledTimes(1);
  });
});

describe('token refresh (R-075)', () => {
  it('subscribes once when permission is granted and unsubscribes on stop', async () => {
    checkPermission.mockResolvedValue(true);
    const stop = startPushRegistration();
    await flush();
    appStateListener('active');
    await flush();

    expect(mockOnTokenRefresh).toHaveBeenCalledTimes(1);
    expect(unsubscribeRefresh).not.toHaveBeenCalled();
    stop();
    expect(unsubscribeRefresh).toHaveBeenCalledTimes(1);
  });

  it('does not subscribe while notifications are not permitted', async () => {
    await AsyncStorage.setItem(RATIONALE_SHOWN_KEY, '1');
    const stop = startPushRegistration();
    await flush();

    expect(mockOnTokenRefresh).not.toHaveBeenCalled();
    stop();
  });

  it('registers a rotated token and does not re-register it on the next foreground', async () => {
    checkPermission.mockResolvedValue(true);
    const stop = startPushRegistration();
    await flush();
    mockPost.mockClear();

    await refreshListener('token-rotated');
    expect(mockPost).toHaveBeenCalledTimes(1);
    expect(mockPost.mock.calls[0][1].deviceToken).toBe('token-rotated');

    mockGetToken.mockResolvedValue('token-rotated');
    appStateListener('active');
    await flush();
    expect(mockPost).toHaveBeenCalledTimes(1);
    stop();
  });

  it('a failed rotation registration is picked up by the next foreground attempt', async () => {
    checkPermission.mockResolvedValue(true);
    const stop = startPushRegistration();
    await flush();
    mockPost.mockClear();

    mockPost.mockRejectedValueOnce(new Error('offline'));
    await refreshListener('token-rotated'); // fcm.ts swallows this failure
    expect(mockPost).toHaveBeenCalledTimes(1);

    mockGetToken.mockResolvedValue('token-rotated');
    appStateListener('active');
    await flush();
    expect(mockPost).toHaveBeenCalledTimes(2);
    expect(mockPost.mock.calls[1][1].deviceToken).toBe('token-rotated');
    stop();
  });
});
