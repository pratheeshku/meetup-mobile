/**
 * Refresh flow of the REAL `apiClient` (interceptors, single-flight and token
 * storage unmodified; only the transport and native Keychain are faked).
 *
 * Contract under test: `POST /auth/refresh` takes NO body and reads the
 * HttpOnly `refresh_token` cookie, returning `{access_token}`,
 * `{access_token: null}` (no cookie) or 401 (invalid / expired / reused).
 * Tokens rotate on every call, and two refreshes with the same cookie would
 * trip reuse detection — hence exactly one refresh in flight, ever.
 */
import * as Keychain from 'react-native-keychain';

import { ACCESS_SERVICE, REFRESH_SERVICE, deferred, installFakeBackend } from '../../test-utils/apiHarness';
import type { FakeBackend } from '../../test-utils/apiHarness';
import { apiClient, endSession, refreshAccessToken, SessionEndedError } from '../client';
import { authEvents } from '../authEvents';
import { clearCookieJar } from '../cookies';

jest.mock('../cookies', () => ({ clearCookieJar: jest.fn() }));

const mockClearCookieJar = clearCookieJar as jest.Mock;
const mockSetPassword = Keychain.setGenericPassword as jest.Mock;

let backend: FakeBackend;
let expired: jest.Mock;
let unsubscribe: () => void;

/** A fake API whose bearer token validity can change over time. */
function serverWithValidToken(getValid: () => string, onRefresh: () => { status?: number; data?: unknown; network?: boolean }) {
  backend.route = config => {
    if (config.url === '/auth/refresh') {
      return onRefresh();
    }
    return backend.authorizationOf(config) === `Bearer ${getValid()}`
      ? { status: 200, data: { ok: config.url } }
      : { status: 401 };
  };
}

async function until(condition: () => boolean, tries = 100): Promise<void> {
  for (let i = 0; i < tries && !condition(); i += 1) {
    await new Promise<void>(resolve => setTimeout(resolve, 0));
  }
  if (!condition()) {
    throw new Error('condition not reached');
  }
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'log').mockImplementation(() => {});
  mockClearCookieJar.mockResolvedValue(true);
  backend = installFakeBackend();
  backend.stored[ACCESS_SERVICE] = 'old';
  expired = jest.fn();
  unsubscribe = authEvents.on('auth-expired', expired);
});

afterEach(() => {
  unsubscribe();
  jest.restoreAllMocks();
});

describe('refresh success and retry', () => {
  it('refreshes once — POST /auth/refresh, no body, credentials, no bearer — then retries the request once with the new token', async () => {
    serverWithValidToken(() => 'new', () => ({ data: { access_token: 'new' } }));

    const response = await apiClient.get('/events');

    expect(response.data).toEqual({ ok: '/events' });
    expect(backend.urls()).toEqual(['/events', '/auth/refresh', '/events']);

    const [original, refresh, retry] = backend.requests;
    expect(original.authorization).toBe('Bearer old');
    expect(refresh.method).toBe('post');
    expect(refresh.data).toBeUndefined(); // NO body
    expect(refresh.withCredentials).toBe(true); // cookie sent / stored by the networking layer
    expect(refresh.authorization).toBeUndefined(); // cookie only, no bearer
    expect(retry.authorization).toBe('Bearer new');
    expect(original.withCredentials).toBe(true);

    expect(backend.stored[ACCESS_SERVICE]).toBe('new');
    expect(backend.stored[REFRESH_SERVICE]).toBeUndefined(); // refresh token is never held by JS
    expect(mockSetPassword).toHaveBeenCalledTimes(1);
    expect(expired).not.toHaveBeenCalled();
    expect(mockClearCookieJar).not.toHaveBeenCalled();
  });

  it('a later expiry refreshes again (the single-flight slot is released)', async () => {
    let valid = 'a1';
    let issued = 0;
    serverWithValidToken(
      () => valid,
      () => {
        issued += 1;
        valid = `a${issued + 1}`;
        return { data: { access_token: valid } };
      },
    );
    backend.stored[ACCESS_SERVICE] = 'a1';

    await apiClient.get('/first'); // a1 valid
    valid = 'expired-now'; // access token expires
    backend.stored[ACCESS_SERVICE] = 'a1';
    await apiClient.get('/second'); // 401 -> refresh #1 -> a2
    valid = 'expired-again';
    await apiClient.get('/third').catch(() => undefined); // 401 -> refresh #2

    expect(backend.callsTo('/auth/refresh')).toHaveLength(2);
  });

  it('does not refresh when there is no stored access token (signed out)', async () => {
    backend.stored = {};
    backend.route = () => ({ status: 401 });

    await expect(apiClient.get('/events')).rejects.toMatchObject({ response: { status: 401 } });

    expect(backend.urls()).toEqual(['/events']);
    expect(expired).not.toHaveBeenCalled();
  });

  it('does not refresh for a 401 from an /auth/ endpoint (e.g. wrong password)', async () => {
    backend.route = () => ({ status: 401 });

    await expect(apiClient.post('/auth/login', { email: 'a@b.c', password: 'bad' })).rejects.toMatchObject({
      response: { status: 401 },
    });

    expect(backend.urls()).toEqual(['/auth/login']);
    expect(expired).not.toHaveBeenCalled();
    expect(backend.stored[ACCESS_SERVICE]).toBe('old'); // untouched
  });
});

describe('the session ended', () => {
  it.each([
    ['refresh returns { access_token: null } (no cookie)', { data: { access_token: null } }],
    ['refresh returns 401 (invalid, expired or reused)', { status: 401 }],
  ])('%s -> clear tokens + cookie jar, raise auth-expired once, no retry', async (_label, reply) => {
    backend.route = config => (config.url === '/auth/refresh' ? reply : { status: 401 });

    await expect(apiClient.get('/events')).rejects.toMatchObject({ response: { status: 401 } });

    expect(backend.urls()).toEqual(['/events', '/auth/refresh']); // original NOT retried
    expect(backend.stored[ACCESS_SERVICE]).toBeUndefined();
    expect(mockClearCookieJar).toHaveBeenCalledTimes(1);
    expect(expired).toHaveBeenCalledTimes(1);
  });

  it('a 401 even after a successful refresh ends the session — one refresh, one retry, no loop', async () => {
    backend.route = config => (config.url === '/auth/refresh' ? { data: { access_token: 'new' } } : { status: 401 });

    await expect(apiClient.get('/events')).rejects.toMatchObject({ response: { status: 401 } });

    expect(backend.urls()).toEqual(['/events', '/auth/refresh', '/events']);
    expect(expired).toHaveBeenCalledTimes(1);
    expect(backend.stored[ACCESS_SERVICE]).toBeUndefined();
  });

  it('still raises auth-expired when clearing local state fails', async () => {
    (Keychain.resetGenericPassword as jest.Mock).mockRejectedValue(new Error('keystore unavailable'));
    backend.route = config =>
      config.url === '/auth/refresh' ? { data: { access_token: null } } : { status: 401 };

    await expect(apiClient.get('/events')).rejects.toBeTruthy();

    expect(expired).toHaveBeenCalledTimes(1);
  });
});

describe('a transport failure while refreshing keeps the session', () => {
  it.each([
    ['network error', { network: true }],
    ['HTTP 500', { status: 500 }],
  ])('%s: request fails with its 401, tokens kept, no logout, refresh NOT retried', async (_label, reply) => {
    backend.route = config => (config.url === '/auth/refresh' ? reply : { status: 401 });

    await expect(apiClient.get('/events')).rejects.toMatchObject({ response: { status: 401 } });

    expect(backend.callsTo('/auth/refresh')).toHaveLength(1); // never retried
    expect(backend.stored[ACCESS_SERVICE]).toBe('old');
    expect(mockClearCookieJar).not.toHaveBeenCalled();
    expect(expired).not.toHaveBeenCalled();
  });
});

describe('single-flight', () => {
  it('three concurrent 401s produce exactly ONE refresh; all three retry once with the new token', async () => {
    const gate = deferred();
    serverWithValidToken(
      () => 'new',
      () => ({ data: { access_token: 'new' } }),
    );
    const refreshRoute = backend.route;
    backend.route = async config => {
      if (config.url === '/auth/refresh') {
        await gate.promise; // hold the refresh open while the other 401s arrive
      }
      return refreshRoute(config);
    };

    const all = Promise.all([apiClient.get('/a'), apiClient.get('/b'), apiClient.get('/c')]);
    await until(() => ['/a', '/b', '/c'].every(url => backend.callsTo(url).length === 1));
    await until(() => backend.callsTo('/auth/refresh').length === 1);
    // Let every 401 reach the interceptor while the single refresh is still open.
    await new Promise<void>(resolve => setTimeout(resolve, 20));
    expect(backend.callsTo('/auth/refresh')).toHaveLength(1);

    gate.resolve();
    const responses = await all;

    expect(responses.map(response => response.data)).toEqual([{ ok: '/a' }, { ok: '/b' }, { ok: '/c' }]);
    expect(backend.callsTo('/auth/refresh')).toHaveLength(1);
    for (const url of ['/a', '/b', '/c']) {
      const calls = backend.callsTo(url);
      expect(calls).toHaveLength(2); // original + exactly one retry
      expect(calls[0].authorization).toBe('Bearer old');
      expect(calls[1].authorization).toBe('Bearer new');
    }
    expect(backend.requests).toHaveLength(3 + 1 + 3);
    expect(expired).not.toHaveBeenCalled();
  });

  it('a 401 that arrives AFTER the refresh finished retries with the stored token — no second refresh', async () => {
    const lateGate = deferred();
    serverWithValidToken(
      () => 'new',
      () => ({ data: { access_token: 'new' } }),
    );
    const inner = backend.route;
    backend.route = async config => {
      // '/late' was sent with the old token; its 401 is delivered only after the refresh is done.
      if (config.url === '/late' && backend.authorizationOf(config) === 'Bearer old') {
        await lateGate.promise;
      }
      return inner(config);
    };

    const early = apiClient.get('/early');
    const late = apiClient.get('/late');
    await early; // 401 -> refresh -> retry OK
    expect(backend.callsTo('/auth/refresh')).toHaveLength(1);

    lateGate.resolve(); // now the late 401 lands
    await late;

    expect(backend.callsTo('/auth/refresh')).toHaveLength(1); // still ONE rotation
    const lateCalls = backend.callsTo('/late');
    expect(lateCalls).toHaveLength(2);
    expect(lateCalls[1].authorization).toBe('Bearer new');
  });

  it('concurrent 401s during a refresh that ENDS the session all fail; one refresh, one end-of-session', async () => {
    const gate = deferred();
    backend.route = async config => {
      if (config.url === '/auth/refresh') {
        await gate.promise;
        return { status: 401 };
      }
      return { status: 401 };
    };

    const settled = Promise.allSettled([apiClient.get('/a'), apiClient.get('/b'), apiClient.get('/c')]);
    await until(() => backend.callsTo('/auth/refresh').length === 1);
    await new Promise<void>(resolve => setTimeout(resolve, 20));
    gate.resolve();
    const results = await settled;

    expect(results.every(result => result.status === 'rejected')).toBe(true);
    expect(backend.callsTo('/auth/refresh')).toHaveLength(1);
    expect(expired).toHaveBeenCalledTimes(1);
    expect(mockClearCookieJar).toHaveBeenCalledTimes(1);
    expect(backend.requests).toHaveLength(3 + 1); // no retries at all
  });
});

describe('refreshAccessToken (used by the app-start silent refresh)', () => {
  it('resolves the new token and stores only the access token', async () => {
    backend.route = () => ({ data: { access_token: 'fresh' } });

    await expect(refreshAccessToken()).resolves.toBe('fresh');

    expect(backend.stored[ACCESS_SERVICE]).toBe('fresh');
    expect(mockSetPassword).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['no-session', { data: { access_token: null } }],
    ['no-session', { data: {} }],
    ['rejected', { status: 401 }],
  ])('throws SessionEndedError(%s) for %j', async (reason, reply) => {
    backend.route = () => reply;

    const error = await refreshAccessToken().catch(e => e);

    expect(error).toBeInstanceOf(SessionEndedError);
    expect(error.reason).toBe(reason);
    expect(backend.stored[ACCESS_SERVICE]).toBe('old'); // this call alone does not clear anything
  });

  it('rethrows transport failures as-is (not a session end)', async () => {
    backend.route = () => ({ network: true });

    const error = await refreshAccessToken().catch(e => e);

    expect(error).not.toBeInstanceOf(SessionEndedError);
    expect(error.code).toBe('ERR_NETWORK');
  });

  it('shares one in-flight refresh between direct callers', async () => {
    const gate = deferred();
    backend.route = async () => {
      await gate.promise;
      return { data: { access_token: 'fresh' } };
    };

    const first = refreshAccessToken();
    const second = refreshAccessToken();
    gate.resolve();

    await expect(Promise.all([first, second])).resolves.toEqual(['fresh', 'fresh']);
    expect(backend.callsTo('/auth/refresh')).toHaveLength(1);
  });
});

describe('endSession', () => {
  it('concurrent callers share one run: one clear, one event', async () => {
    await Promise.all([endSession(), endSession(), endSession()]);

    expect(mockClearCookieJar).toHaveBeenCalledTimes(1);
    expect(expired).toHaveBeenCalledTimes(1);
  });
});
