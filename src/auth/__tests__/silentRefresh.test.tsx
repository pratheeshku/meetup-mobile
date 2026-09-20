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
import ReactTestRenderer from 'react-test-renderer';

import { clearCookieJar } from '../../api/cookies';
import { ACCESS_SERVICE, installFakeBackend } from '../../test-utils/apiHarness';
import type { FakeBackend, FakeReply } from '../../test-utils/apiHarness';
import { AuthProvider, useAuth } from '../AuthContext';

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
    expect(mockClearCookieJar).not.toHaveBeenCalled();
  });

  it('cookie rejected (401): the session ended — notice raised, local state cleared, not retried', async () => {
    serve({ status: 401 });

    await mount();

    expect(backend.urls()).toEqual(['/auth/refresh']);
    expect(auth.user).toBeNull();
    expect(auth.sessionExpired).toBe(true);
    expect(mockClearCookieJar).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['offline', { network: true }],
    ['a server error', { status: 500 }],
  ])('refresh fails with %s: no session, no notice, not retried', async (_label, reply) => {
    serve(reply);

    await mount();

    expect(backend.callsTo('/auth/refresh')).toHaveLength(1);
    expect(auth.isLoading).toBe(false);
    expect(auth.user).toBeNull();
    expect(auth.sessionExpired).toBe(false);
  });

  it('refresh succeeds but the profile fetch fails offline: signed out, no notice', async () => {
    backend.route = config =>
      config.url === '/auth/refresh' ? { data: { access_token: 'fresh' } } : { network: true };

    await mount();

    expect(auth.user).toBeNull();
    expect(auth.sessionExpired).toBe(false);
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
