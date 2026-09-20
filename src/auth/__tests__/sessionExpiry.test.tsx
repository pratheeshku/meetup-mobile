/**
 * Session expiry as the user experiences it, through the real `AuthProvider`,
 * the REAL `apiClient` and its refresh flow (only the transport, Keychain and
 * cookie jar are faked).
 *
 * When the backend ends the session (`POST /auth/refresh` returns
 * `{access_token: null}` or 401) the app must land in a clean logged-out
 * state showing "Session expired. Please sign in again." — no crash, no retry
 * loop, and never for a session that did not exist (wrong password, manual
 * sign-out, never signed in).
 */
import React from 'react';
import ReactTestRenderer from 'react-test-renderer';

import { apiClient } from '../../api/client';
import { authEvents } from '../../api/authEvents';
import { clearCookieJar } from '../../api/cookies';
import { ACCESS_SERVICE, installFakeBackend } from '../../test-utils/apiHarness';
import type { FakeBackend, FakeReply } from '../../test-utils/apiHarness';
import { act } from '../../test-utils/render';
import { AuthProvider, useAuth } from '../AuthContext';
import { SESSION_EXPIRED_MESSAGE } from '../messages';

jest.mock('../../api/cookies', () => ({ clearCookieJar: jest.fn() }));
jest.mock('../../notifications/fcm', () => ({
  deregisterDeviceToken: jest.fn().mockResolvedValue(undefined),
}));
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

// `authEvents` is a module-level singleton, so every provider must be unmounted
// after its test — a still-mounted provider from an earlier test would keep
// listening and overwrite `auth` with its own (stale) state.
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

/**
 * A backend that logs in as USER (issuing `issued`), accepts only `valid()` as
 * a bearer token, and answers `/auth/refresh` with `refreshReply()`.
 */
function serve(options: { valid: () => string; refreshReply: () => FakeReply; issued?: string }): void {
  backend.route = config => {
    if (config.url === '/auth/login') {
      return { data: { access_token: options.issued ?? 'acc', user: USER } };
    }
    if (config.url === '/auth/refresh') {
      return options.refreshReply();
    }
    if (config.url === '/auth/logout') {
      return { status: 401 }; // even a failing logout must not look like an expiry
    }
    return backend.authorizationOf(config) === `Bearer ${options.valid()}`
      ? { data: config.url === '/users/me' ? USER : { ok: true } }
      : { status: 401 };
  };
}

/**
 * Mounts against a neutral backend, then forgets the app-start silent refresh
 * (a signed-out start makes one `/auth/refresh` call) so a test can count only
 * the traffic it provokes.
 */
const mountSignedOut = async (): Promise<void> => {
  await mount();
  backend.requests.length = 0;
};

const signInByEmail = async (): Promise<void> => {
  await act(async () => {
    await auth.signInWithEmail('a@b.c', 'pw');
  });
};

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

describe('cold start with a stored access token', () => {
  it.each([
    ['null access_token', { data: { access_token: null } }],
    ['a 401', { status: 401 }],
  ])('refresh answers %s -> logged out, notice shown, no loop', async (_label, refreshReply) => {
    backend.stored[ACCESS_SERVICE] = 'expired-access';
    serve({ valid: () => 'never', refreshReply: () => refreshReply });

    await mount();

    expect(auth.isLoading).toBe(false);
    expect(auth.user).toBeNull();
    expect(auth.sessionExpired).toBe(true);
    expect(backend.urls()).toEqual(['/users/me', '/auth/refresh']); // one refresh, no retry
    expect(backend.stored[ACCESS_SERVICE]).toBeUndefined();
    expect(mockClearCookieJar).toHaveBeenCalledTimes(1);
  });

  it('an expired access token with a live cookie is renewed silently: user restored, no notice', async () => {
    backend.stored[ACCESS_SERVICE] = 'expired-access';
    serve({ valid: () => 'fresh', refreshReply: () => ({ data: { access_token: 'fresh' } }) });

    await mount();

    expect(auth.user).toEqual(USER);
    expect(auth.sessionExpired).toBe(false);
    expect(backend.urls()).toEqual(['/users/me', '/auth/refresh', '/users/me']);
    expect(backend.stored[ACCESS_SERVICE]).toBe('fresh');
  });

  it('does not raise the notice when restore fails for a non-auth reason (offline)', async () => {
    backend.stored[ACCESS_SERVICE] = 'access';
    backend.route = () => ({ network: true });

    await mount();

    expect(auth.user).toBeNull();
    expect(auth.sessionExpired).toBe(false);
  });
});

describe('mid-session expiry', () => {
  it.each([
    ['null access_token', { data: { access_token: null } }],
    ['a 401', { status: 401 }],
  ])('refresh answers %s -> logged out cleanly with the notice', async (_label, refreshReply) => {
    await mountSignedOut();
    serve({ valid: () => 'acc', refreshReply: () => refreshReply });
    await signInByEmail();
    expect(auth.user).toEqual(USER);
    expect(auth.sessionExpired).toBe(false);

    await act(async () => {
      // The 15-minute access token lapses: the server stops accepting it.
      serve({ valid: () => 'lapsed', refreshReply: () => refreshReply });
      await expect(apiClient.get('/events')).rejects.toBeTruthy();
    });

    expect(auth.user).toBeNull();
    expect(auth.sessionExpired).toBe(true);
    expect(backend.callsTo('/auth/refresh')).toHaveLength(1);
    expect(backend.stored[ACCESS_SERVICE]).toBeUndefined();
  });

  it('a successful refresh keeps the user signed in with no notice', async () => {
    await mountSignedOut();
    serve({ valid: () => 'acc', refreshReply: () => ({ data: { access_token: 'acc2' } }) });
    await signInByEmail();

    await act(async () => {
      serve({ valid: () => 'acc2', refreshReply: () => ({ data: { access_token: 'acc2' } }) });
      await apiClient.get('/events');
    });

    expect(auth.user).toEqual(USER);
    expect(auth.sessionExpired).toBe(false);
    expect(backend.stored[ACCESS_SERVICE]).toBe('acc2');
  });

  it('concurrent 401s that end the session: one refresh, one clean logout, one notice', async () => {
    await mountSignedOut();
    serve({ valid: () => 'acc', refreshReply: () => ({ status: 401 }) });
    await signInByEmail();
    serve({ valid: () => 'lapsed', refreshReply: () => ({ status: 401 }) });

    await act(async () => {
      await Promise.allSettled([apiClient.get('/a'), apiClient.get('/b'), apiClient.get('/c')]);
    });

    expect(auth.user).toBeNull();
    expect(auth.sessionExpired).toBe(true);
    expect(backend.callsTo('/auth/refresh')).toHaveLength(1);
    expect(mockClearCookieJar).toHaveBeenCalledTimes(1);
  });

  it('re-signing in after expiry clears the notice', async () => {
    await mountSignedOut();
    serve({ valid: () => 'lapsed', refreshReply: () => ({ status: 401 }) });
    await signInByEmail();
    await act(async () => {
      await apiClient.get('/events').catch(() => undefined);
    });
    expect(auth.sessionExpired).toBe(true);

    await signInByEmail();

    expect(auth.user).toEqual(USER);
    expect(auth.sessionExpired).toBe(false);
  });
});

describe('the notice is only for a session that existed', () => {
  it('a wrong-password login (401) shows no notice and triggers no refresh', async () => {
    await mountSignedOut();
    backend.route = () => ({ status: 401 });

    await act(async () => {
      await expect(auth.signInWithEmail('a@b.c', 'bad')).rejects.toBeTruthy();
    });

    expect(auth.user).toBeNull();
    expect(auth.sessionExpired).toBe(false);
    expect(backend.callsTo('/auth/refresh')).toHaveLength(0);
  });

  it('a manual sign-out whose POST /auth/logout answers 401 shows no notice', async () => {
    await mountSignedOut();
    serve({ valid: () => 'acc', refreshReply: () => ({ status: 401 }) });
    await signInByEmail();

    await act(async () => {
      await auth.signOut();
    });

    expect(backend.urls()).toContain('/auth/logout');
    expect(auth.user).toBeNull();
    expect(auth.sessionExpired).toBe(false);
  });

  it('a stray auth-expired event while signed out does not raise the notice', async () => {
    await mountSignedOut();

    await act(async () => {
      authEvents.emit('auth-expired');
    });

    expect(auth.user).toBeNull();
    expect(auth.sessionExpired).toBe(false);
  });
});

it('exposes the exact user-facing message', () => {
  expect(SESSION_EXPIRED_MESSAGE).toBe('Session expired. Please sign in again.');
});
