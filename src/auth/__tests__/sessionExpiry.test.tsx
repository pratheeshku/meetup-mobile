/**
 * Expiry path (internal-testing stopgap, Option A): a 401 when there is no
 * refresh token to renew the session with must end in a clean logged-out
 * state showing "Session expired. Please sign in again." — no crash, no
 * retry loop, no `POST /auth/refresh`.
 *
 * Uses the REAL `apiClient` (interceptors unmodified); only the HTTP adapter
 * and native modules are stubbed, so this exercises the actual
 * 401 -> refresh attempt -> clearTokens -> `auth-expired` chain.
 */
import React from 'react';
import { AxiosError } from 'axios';
import type { AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import * as Keychain from 'react-native-keychain';
import ReactTestRenderer from 'react-test-renderer';

import { apiClient } from '../../api/client';
import { authEvents } from '../../api/authEvents';
import { act } from '../../test-utils/render';
import { AuthProvider, useAuth } from '../AuthContext';
import { SESSION_EXPIRED_MESSAGE } from '../messages';

jest.mock('../../notifications/fcm', () => ({
  deregisterDeviceToken: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../notifications/pushRegistration', () => ({
  startPushRegistration: jest.fn(() => jest.fn()),
}));

const mockGetPassword = Keychain.getGenericPassword as jest.Mock;
const mockSetPassword = Keychain.setGenericPassword as jest.Mock;
const mockResetPassword = Keychain.resetGenericPassword as jest.Mock;

const ACCESS_SERVICE = 'com.meetupmobile.auth.accessToken';
const USER = { id: 'u1', email: 'a@b.c', nickname: 'ann', display_name: 'Ann' };

type Route = (config: InternalAxiosRequestConfig) => { status: number; data?: unknown };
let route: Route;
let adapter: jest.Mock;
const requestedUrls = (): string[] => adapter.mock.calls.map(call => call[0].url as string);

function respond(config: InternalAxiosRequestConfig, status: number, data: unknown): Promise<AxiosResponse> {
  const response = { status, statusText: String(status), data, headers: {}, config } as AxiosResponse;
  if (status >= 200 && status < 300) {
    return Promise.resolve(response);
  }
  return Promise.reject(new AxiosError(`HTTP ${status}`, 'ERR_BAD_REQUEST', config, {}, response));
}

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

/** Keychain state: which services currently hold a token. */
let stored: Record<string, string>;

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'log').mockImplementation(() => {});
  stored = {};
  mockGetPassword.mockImplementation(async (options: { service: string }) =>
    stored[options.service] ? { password: stored[options.service] } : false,
  );
  mockSetPassword.mockImplementation(async (_u: string, password: string, options: { service: string }) => {
    if (!password) {
      throw new Error('you passed empty or null username/password');
    }
    stored[options.service] = password;
    return { service: 'mock', storage: 'KeystoreAESGCM_NoAuth' };
  });
  mockResetPassword.mockImplementation(async (options: { service: string }) => {
    delete stored[options.service];
    return true;
  });

  route = () => ({ status: 200, data: {} });
  adapter = jest.fn(async (config: InternalAxiosRequestConfig) => {
    const { status, data } = route(config);
    return respond(config, status, data);
  });
  apiClient.defaults.adapter = adapter;
});

afterEach(() => {
  ReactTestRenderer.act(() => {
    mounted?.unmount();
  });
  mounted = null;
  jest.restoreAllMocks();
});

describe('cold start with a stored access token and no refresh token', () => {
  it('ends logged out with the expiry notice: no loop, no refresh request', async () => {
    stored[ACCESS_SERVICE] = 'expired-access';
    route = () => ({ status: 401 });

    await mount();

    expect(auth.isLoading).toBe(false);
    expect(auth.user).toBeNull();
    expect(auth.sessionExpired).toBe(true);
    // Exactly the one original request: no retry, and never POST /auth/refresh.
    expect(requestedUrls()).toEqual(['/users/me']);
    // Stale token cleared, so the next launch starts clean.
    expect(stored[ACCESS_SERVICE]).toBeUndefined();
  });

  it('does not raise the notice when restore fails for a non-auth reason (offline)', async () => {
    stored[ACCESS_SERVICE] = 'access';
    adapter.mockImplementation(async (config: InternalAxiosRequestConfig) =>
      Promise.reject(new AxiosError('Network Error', 'ERR_NETWORK', config)),
    );

    await mount();

    expect(auth.user).toBeNull();
    expect(auth.sessionExpired).toBe(false);
  });
});

describe('mid-session expiry after a refresh-token-less sign-in', () => {
  it('sign-in works, then a later 401 logs out cleanly with the notice', async () => {
    route = config =>
      config.url === '/auth/login'
        ? { status: 200, data: { access_token: 'acc', user: USER } }
        : { status: 401 };
    await mount();
    await act(async () => {
      await auth.signInWithEmail('a@b.c', 'pw');
    });
    expect(auth.user).toEqual(USER);
    expect(auth.sessionExpired).toBe(false);
    expect(stored[ACCESS_SERVICE]).toBe('acc');

    await act(async () => {
      await expect(apiClient.get('/events')).rejects.toBeTruthy();
    });

    expect(auth.user).toBeNull();
    expect(auth.sessionExpired).toBe(true);
    expect(requestedUrls()).toEqual(['/auth/login', '/events']);
    expect(requestedUrls()).not.toContain('/auth/refresh');
  });

  it('concurrent 401s each fail once — no retry storm, no refresh request', async () => {
    route = config =>
      config.url === '/auth/login'
        ? { status: 200, data: { access_token: 'acc', user: USER } }
        : { status: 401 };
    await mount();
    await act(async () => {
      await auth.signInWithEmail('a@b.c', 'pw');
    });

    await act(async () => {
      await Promise.allSettled([apiClient.get('/a'), apiClient.get('/b'), apiClient.get('/c')]);
    });

    expect(auth.user).toBeNull();
    expect(auth.sessionExpired).toBe(true);
    expect(requestedUrls().filter(url => url === '/auth/refresh')).toHaveLength(0);
    expect(requestedUrls()).toHaveLength(1 + 3); // login + one attempt per call
  });

  it('re-signing in after expiry clears the notice', async () => {
    route = config =>
      config.url === '/auth/login'
        ? { status: 200, data: { access_token: 'acc', user: USER } }
        : { status: 401 };
    await mount();
    await act(async () => {
      await auth.signInWithEmail('a@b.c', 'pw');
    });
    await act(async () => {
      await apiClient.get('/events').catch(() => undefined);
    });
    expect(auth.sessionExpired).toBe(true);

    await act(async () => {
      await auth.signInWithEmail('a@b.c', 'pw');
    });

    expect(auth.user).toEqual(USER);
    expect(auth.sessionExpired).toBe(false);
  });
});

describe('the notice is only for a session that existed', () => {
  it('a wrong-password login (401) does NOT show "Session expired"', async () => {
    route = () => ({ status: 401 });
    await mount();

    await act(async () => {
      await expect(auth.signInWithEmail('a@b.c', 'bad')).rejects.toBeTruthy();
    });

    expect(auth.user).toBeNull();
    expect(auth.sessionExpired).toBe(false);
  });

  it('a manual sign-out whose POST /auth/logout hits a 401 does NOT show the notice', async () => {
    route = config =>
      config.url === '/auth/login'
        ? { status: 200, data: { access_token: 'acc', user: USER } }
        : { status: 401 }; // /auth/logout -> 401 -> client emits auth-expired
    await mount();
    await act(async () => {
      await auth.signInWithEmail('a@b.c', 'pw');
    });

    await act(async () => {
      await auth.signOut();
    });

    expect(requestedUrls()).toContain('/auth/logout');
    expect(auth.user).toBeNull();
    expect(auth.sessionExpired).toBe(false);
  });

  it('a stray auth-expired event while signed out does not raise the notice', async () => {
    await mount();

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
