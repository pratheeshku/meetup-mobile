/**
 * Silent refresh at app start (mirrors the PWA): with NO stored access token
 * the 30-day refresh cookie may still be alive, so the app asks the backend
 * once. Real `AuthProvider` + REAL `apiClient`; transport, Keychain and cookie
 * jar faked.
 *
 *   { access_token: 'x' }    -> session restored, no notice
 *   { access_token: null }   -> never signed in / signed out: quietly no session
 *   401                      -> a cookie existed but was rejected: notice
 */
import React from 'react';
import { AppState, Platform } from 'react-native';
import * as Keychain from 'react-native-keychain';
import ReactTestRenderer from 'react-test-renderer';

import { clearCookieJar } from '../../api/cookies';
import { ACCESS_SERVICE, installFakeBackend } from '../../test-utils/apiHarness';
import type { FakeBackend, FakeReply } from '../../test-utils/apiHarness';
import { act } from '../../test-utils/render';
import { delay } from '../../utils/delay';
import { AuthProvider, useAuth } from '../AuthContext';
import * as googleAuth from '../googleAuth';
import { SESSION_RESTORE_BACKOFF_MS } from '../sessionRestore';

jest.mock('../../utils/delay', () => {
  const actual = jest.requireActual('../../utils/delay') as typeof import('../../utils/delay');
  return { ...actual, delay: jest.fn(() => Promise.resolve()) };
});

jest.mock('../../api/cookies', () => ({ clearCookieJar: jest.fn() }));
jest.mock('../../notifications/fcm', () => ({ deregisterDeviceToken: jest.fn() }));
jest.mock('../../notifications/pushRegistration', () => ({
  startPushRegistration: jest.fn(() => jest.fn()),
}));

const mockClearCookieJar = clearCookieJar as jest.Mock;

const USER = { id: 'u1', email: 'a@b.c', nickname: 'ann', display_name: 'Ann' };

let backend: FakeBackend;
let auth: ReturnType<typeof useAuth>;
function Probe(): null {
  auth = useAuth();
  return null;
}

let mounted: ReactTestRenderer.ReactTestRenderer | null = null;
const mount = async (): Promise<void> => {
  await ReactTestRenderer.act(async () => {
    mounted = ReactTestRenderer.create(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
  });
};

/** Refresh answers `refreshReply`; `/users/me` accepts only `valid`. */
function serve(refreshReply: FakeReply, valid = 'fresh'): void {
  backend.route = config => {
    if (config.url === '/auth/refresh') {
      return refreshReply;
    }
    return backend.authorizationOf(config) === `Bearer ${valid}` ? { data: USER } : { status: 401 };
  };
}

// Jest's default platform is iOS; these suites exercise the Android-only
// Google sign-in path (not offered on iOS, DES-MEETUP-ADDENDUM-IOS-App.md §3).
beforeEach(() => {
  jest.replaceProperty(Platform, 'OS', 'android');
});

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'log').mockImplementation(() => {});
  mockClearCookieJar.mockResolvedValue(true);
  backend = installFakeBackend();
});

afterEach(() => {
  ReactTestRenderer.act(() => {
    mounted?.unmount();
  });
  mounted = null;
  jest.restoreAllMocks();
});

describe('no stored access token', () => {
  it('cookie alive: refreshes once (no body, credentials), stores the token, restores the user', async () => {
    serve({ data: { access_token: 'fresh' } });

    await mount();

    expect(backend.urls()).toEqual(['/auth/refresh', '/users/me']);
    const [refresh, me] = backend.requests;
    expect(refresh.method).toBe('post');
    expect(refresh.data).toBeUndefined();
    expect(refresh.withCredentials).toBe(true);
    expect(refresh.authorization).toBeUndefined();
    expect(me.authorization).toBe('Bearer fresh');
    expect(backend.stored[ACCESS_SERVICE]).toBe('fresh');
    expect(auth.isLoading).toBe(false);
    expect(auth.user).toEqual(USER);
    expect(auth.sessionExpired).toBe(false);
  });

  it('no cookie ({ access_token: null }): no session, no notice, nothing cleared, one request', async () => {
    serve({ data: { access_token: null } });

    await mount();

    expect(backend.urls()).toEqual(['/auth/refresh']);
    expect(auth.isLoading).toBe(false);
    expect(auth.user).toBeNull();
    expect(auth.sessionExpired).toBe(false);
    expect(auth.sessionCheckPendingRetry).toBe(false);
    expect(mockClearCookieJar).not.toHaveBeenCalled();
    expect(logged()).toContain('[auth] routing to login cause=refresh-no-session status=200');
    expect(logged()).not.toContain('a@b.c');
  });

  it('cookie rejected (401): the session ended — notice raised, local state cleared, not retried', async () => {
    serve({ status: 401 });

    await mount();

    expect(backend.urls()).toEqual(['/auth/refresh']);
    expect(auth.user).toBeNull();
    expect(auth.sessionExpired).toBe(true);
    expect(auth.sessionCheckPendingRetry).toBe(false);
    expect(mockClearCookieJar).toHaveBeenCalledTimes(1);
    expect(logged()).toContain('[auth] routing to login cause=refresh-rejected status=401');
    expect(logged()).not.toContain('a@b.c');
  });

  it.each([
    ['offline', { network: true }, 'network'],
    ['a timeout', { timeout: true }, 'network'],
    ['a server error', { status: 500 }, 'server'],
    ['a rate limit', { status: 429 }, 'rate_limit'],
  ] as const)(
    'refresh fails with %s: retry splash, session kept, not sent to login',
    async (_label, reply, failure) => {
      serve(reply);

      await mount();

      expect(backend.callsTo('/auth/refresh')).toHaveLength(3);
      expect(delay).toHaveBeenNthCalledWith(1, SESSION_RESTORE_BACKOFF_MS[0], expect.any(AbortSignal));
      expect(delay).toHaveBeenNthCalledWith(2, SESSION_RESTORE_BACKOFF_MS[1], expect.any(AbortSignal));
      expect(auth.isLoading).toBe(false);
      expect(auth.user).toBeNull();
      expect(auth.sessionExpired).toBe(false);
      expect(auth.sessionCheckPendingRetry).toBe(true);
      expect(auth.sessionCheckFailure).toBe(failure);
      expect(mockClearCookieJar).not.toHaveBeenCalled();
      expect(logged()).not.toContain('routing to login');
    },
  );

  it('refresh succeeds but the profile fetch fails offline: retry splash, access token kept', async () => {
    backend.route = config =>
      config.url === '/auth/refresh' ? { data: { access_token: 'fresh' } } : { network: true };

    await mount();

    expect(auth.user).toBeNull();
    expect(auth.sessionExpired).toBe(false);
    expect(auth.sessionCheckPendingRetry).toBe(true);
    expect(auth.sessionCheckFailure).toBe('network');
    expect(backend.stored[ACCESS_SERVICE]).toBe('fresh');
    expect(mockClearCookieJar).not.toHaveBeenCalled();
    expect(backend.callsTo('/users/me')).toHaveLength(3);
    expect(logged()).not.toContain('routing to login');
  });

  it('a later Retry after a transient failure restores the session without a new login', async () => {
    let refreshes = 0;
    backend.route = config => {
      if (config.url !== '/auth/refresh') {
        return backend.authorizationOf(config) === 'Bearer fresh' ? { data: USER } : { network: true };
      }
      refreshes += 1;
      return refreshes <= 3 ? { network: true } : { data: { access_token: 'fresh' } };
    };

    await mount();
    expect(auth.sessionCheckPendingRetry).toBe(true);
    expect(auth.user).toBeNull();

    await act(async () => {
      auth.retrySessionCheck();
    });

    expect(auth.user).toEqual(USER);
    expect(auth.sessionCheckPendingRetry).toBe(false);
    expect(auth.sessionExpired).toBe(false);
    expect(mockClearCookieJar).not.toHaveBeenCalled();
  });

  it('resuming the app while the retry splash is up runs the check again', async () => {
    let refreshes = 0;
    backend.route = config => {
      if (config.url !== '/auth/refresh') {
        return backend.authorizationOf(config) === 'Bearer fresh' ? { data: USER } : { status: 401 };
      }
      refreshes += 1;
      return refreshes <= 3 ? { status: 503 } : { data: { access_token: 'fresh' } };
    };
    const emit = installAppState();

    await mount();
    expect(auth.sessionCheckPendingRetry).toBe(true);

    await act(async () => {
      emit('background');
      emit('active');
    });

    expect(auth.user).toEqual(USER);
    expect(auth.sessionCheckPendingRetry).toBe(false);
    expect(mockClearCookieJar).not.toHaveBeenCalled();
  });
});

describe('with a stored access token', () => {
  it('a valid token restores the session with no refresh at all', async () => {
    backend.stored[ACCESS_SERVICE] = 'fresh';
    serve({ data: { access_token: 'unused' } });

    await mount();

    expect(backend.urls()).toEqual(['/users/me']);
    expect(auth.user).toEqual(USER);
  });
});

describe('the Keychain read throws during start-up', () => {
  // e.g. an invalidated Keystore key: reading the stored token rejects.
  beforeEach(() => {
    (Keychain.getGenericPassword as jest.Mock).mockRejectedValue(new Error('keystore key invalidated'));
  });

  it('a live cookie renews the session even when later Keychain reads fail', async () => {
    serve({ data: { access_token: 'fresh' } });

    await mount();

    expect(auth.isLoading).toBe(false);
    expect(auth.user).toEqual(USER);
    expect(auth.sessionExpired).toBe(false);
    expect(auth.sessionCheckPendingRetry).toBe(false);
    expect(backend.urls()).toEqual(['/auth/refresh', '/users/me']);
    expect(backend.callsTo('/users/me')[0].authorization).toBe('Bearer fresh');
    expect(logged()).not.toContain('routing to login');
    expect(logged()).not.toContain('keystore key invalidated');
    expect(logged().split(/\s+/)).not.toContain('fresh');
  });

  it('the network is down: retry splash, cookie kept, splash released', async () => {
    serve({ network: true });

    await mount();

    expect(auth.isLoading).toBe(false);
    expect(auth.user).toBeNull();
    expect(auth.sessionExpired).toBe(false);
    expect(auth.sessionCheckPendingRetry).toBe(true);
    expect(backend.callsTo('/auth/refresh')).toHaveLength(3);
    expect(mockClearCookieJar).not.toHaveBeenCalled();
    expect(logged()).not.toContain('routing to login');
  });

  it('there is no cookie ({ access_token: null }): login, no notice, nothing cleared', async () => {
    serve({ data: { access_token: null } });

    await mount();

    expect(auth.isLoading).toBe(false);
    expect(auth.user).toBeNull();
    expect(auth.sessionExpired).toBe(false);
    expect(auth.sessionCheckPendingRetry).toBe(false);
    expect(backend.callsTo('/auth/refresh')).toHaveLength(1);
    expect(mockClearCookieJar).not.toHaveBeenCalled();
    expect(logged()).toContain('[auth] routing to login cause=refresh-no-session status=200');
    expect(logged()).not.toContain('keystore key invalidated');
  });

  it('a rejected cookie (401) ends the session and routes to login', async () => {
    serve({ status: 401 });

    await mount();

    expect(auth.user).toBeNull();
    expect(auth.sessionExpired).toBe(true);
    expect(auth.sessionCheckPendingRetry).toBe(false);
    expect(backend.callsTo('/auth/refresh')).toHaveLength(1);
    expect(mockClearCookieJar).toHaveBeenCalledTimes(1);
    expect(logged()).toContain('[auth] routing to login cause=refresh-rejected status=401');
  });

  it('logs only an error tag, never a value', async () => {
    serve({ data: { access_token: null } });

    await mount();

    expect(logged()).toContain('stored token unreadable');
    expect(logged()).not.toContain('keystore key invalidated');
  });

  it('an unexpected start-up error releases the splash onto the retry state (no crash, not login)', async () => {
    // A throw OUTSIDE the guarded token read, at the very start of restore.
    const configure = jest.spyOn(googleAuth, 'configureGoogleSignIn').mockImplementation(() => {
      throw new Error('native module unavailable');
    });

    await mount();

    expect(configure).toHaveBeenCalledTimes(1); // not an auth rejection, and not a transient retry
    expect(auth.isLoading).toBe(false);
    expect(auth.user).toBeNull();
    expect(auth.sessionCheckPendingRetry).toBe(true);
    expect(auth.sessionExpired).toBe(false);
    expect(logged()).not.toContain('routing to login');
    expect(logged()).not.toContain('native module unavailable');
  });
});

function logged(): string {
  return (console.log as jest.Mock).mock.calls.map(call => call.map(String).join(' ')).join('\n');
}

/** Captures the AppState listener AuthProvider registers and replays transitions. */
function installAppState(): (state: string) => void {
  let handler: ((state: string) => void) | null = null;
  (AppState as unknown as { currentState: string }).currentState = 'active';
  jest.spyOn(AppState, 'addEventListener').mockImplementation(((
    _type: string,
    next: (state: string) => void,
  ) => {
    handler = next;
    return { remove: jest.fn() };
  }) as typeof AppState.addEventListener);
  return state => {
    if (!handler) {
      throw new Error('AppState listener was not registered');
    }
    handler(state);
  };
}
