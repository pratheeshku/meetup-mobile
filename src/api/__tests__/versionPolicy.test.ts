/**
 * Version-policy fetch over the REAL axios instance (transport faked).
 *
 * Request: `GET {ENV.API_BASE_URL}/app/version-policy`, 5 s timeout, NO
 * `Authorization` header, NO cookies (`withCredentials: false`).
 * Response: { android: { min_version_code: int, store_url: string } }.
 * Fails open — every failure resolves `null` and logs only an error tag.
 */
import { ENV } from '../../../config/env';
import { installFakeBackend } from '../../test-utils/apiHarness';
import type { FakeBackend, FakeReply } from '../../test-utils/apiHarness';
import { fetchVersionPolicy, parseVersionPolicy } from '../versionPolicy';

const STORE = 'https://play.google.com/store/apps/details?id=org.duckdns.meetups';
const goodBody = { android: { min_version_code: 7, store_url: STORE } };

let backend: FakeBackend;
let log: jest.SpyInstance;

const serve = (reply: FakeReply): void => {
  backend.route = () => reply;
};
const logged = (): string => log.mock.calls.map(call => call.join(' ')).join('\n');

beforeEach(() => {
  backend = installFakeBackend();
  log = jest.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('the request', () => {
  it('is GET /app/version-policy on the configured API host, 5 s timeout, no auth header, no cookies', async () => {
    // A signed-in session must not leak into this request.
    backend.stored['com.meetupmobile.auth.accessToken'] = 'live-access-token';
    serve({ data: goodBody });

    await fetchVersionPolicy();

    expect(backend.requests).toHaveLength(1);
    const [request] = backend.requests;
    expect(request.url).toBe('/app/version-policy');
    expect(request.method).toBe('get');
    expect(request.baseURL).toBe(ENV.API_BASE_URL); // the single config constant
    expect(request.timeout).toBe(5000);
    expect(request.authorization).toBeUndefined();
    expect(request.withCredentials).toBe(false);
  });

  it('is made once per call', async () => {
    serve({ data: goodBody });

    await fetchVersionPolicy();
    await fetchVersionPolicy();

    expect(backend.callsTo('/app/version-policy')).toHaveLength(2);
  });
});

describe('a well-formed policy', () => {
  it('resolves { minVersionCode, storeUrl }', async () => {
    serve({ data: goodBody });

    await expect(fetchVersionPolicy()).resolves.toEqual({ minVersionCode: 7, storeUrl: STORE });
    expect(log).not.toHaveBeenCalled();
  });

  it('ignores unrelated extra fields (other platforms, future keys)', async () => {
    serve({ data: { ...goodBody, ios: { min_version_code: 99 }, android: { ...goodBody.android, note: 'x' } } });

    await expect(fetchVersionPolicy()).resolves.toEqual({ minVersionCode: 7, storeUrl: STORE });
  });

  it('accepts a minimum of 0 (nothing is blocked)', async () => {
    serve({ data: { android: { min_version_code: 0, store_url: STORE } } });

    await expect(fetchVersionPolicy()).resolves.toEqual({ minVersionCode: 0, storeUrl: STORE });
  });
});

describe('fails open — resolves null, never rejects', () => {
  it.each([
    ['a network error', { network: true }, 'ERR_NETWORK'],
    ['a timeout', { timeout: true }, 'ECONNABORTED'],
    ['HTTP 500', { status: 500 }, '500'],
    ['HTTP 503', { status: 503 }, '503'],
    ['HTTP 404', { status: 404 }, '404'],
    ['HTTP 401', { status: 401 }, '401'],
    ['HTTP 403', { status: 403 }, '403'],
    ['HTTP 429', { status: 429 }, '429'],
    ['HTTP 204 (success, but not 200)', { status: 204, data: '' }, 'status-204'],
    ['HTTP 201 (success, but not 200)', { status: 201, data: goodBody }, 'status-201'],
  ])('%s', async (_label, reply, tag) => {
    serve(reply);

    await expect(fetchVersionPolicy()).resolves.toBeNull();

    expect(logged()).toContain(tag);
  });

  it('a transport that throws something that is not an axios error', async () => {
    backend.route = () => {
      throw new Error('boom');
    };

    await expect(fetchVersionPolicy()).resolves.toBeNull();
  });
});

describe('a malformed or missing field is "no update required"', () => {
  it.each([
    ['an empty object', {}],
    ['null', null],
    ['a string', 'update now'],
    ['an array', [goodBody]],
    ['android missing', { ios: { min_version_code: 5, store_url: STORE } }],
    ['android null', { android: null }],
    ['android a string', { android: 'yes' }],
    ['android an array', { android: [7, STORE] }],
    ['min_version_code missing', { android: { store_url: STORE } }],
    ['min_version_code null', { android: { min_version_code: null, store_url: STORE } }],
    ['min_version_code a numeric string', { android: { min_version_code: '7', store_url: STORE } }],
    ['min_version_code fractional', { android: { min_version_code: 7.5, store_url: STORE } }],
    ['min_version_code negative', { android: { min_version_code: -1, store_url: STORE } }],
    ['min_version_code a boolean', { android: { min_version_code: true, store_url: STORE } }],
    ['min_version_code beyond safe integers', { android: { min_version_code: 2 ** 60, store_url: STORE } }],
    ['store_url missing', { android: { min_version_code: 7 } }],
    ['store_url null', { android: { min_version_code: 7, store_url: null } }],
    ['store_url empty', { android: { min_version_code: 7, store_url: '' } }],
    ['store_url a number', { android: { min_version_code: 7, store_url: 5 } }],
    ['store_url an object', { android: { min_version_code: 7, store_url: { href: STORE } } }],
  ])('%s', async (_label, body) => {
    serve({ data: body });

    await expect(fetchVersionPolicy()).resolves.toBeNull();
    expect(parseVersionPolicy(body)).toBeNull();
    expect(logged()).toContain('malformed');
  });
});

describe('logging discipline (R-111)', () => {
  it('logs only an error tag, never a value from the response', async () => {
    serve({
      data: { android: { min_version_code: 'SECRET-MIN-VALUE', store_url: 'https://evil.example/SECRET-URL' } },
    });

    await fetchVersionPolicy();

    expect(log).toHaveBeenCalledTimes(1);
    expect(logged()).toContain('malformed');
    expect(logged()).not.toContain('SECRET');
    expect(logged()).not.toContain('evil.example');
  });

  it('a failed request logs its tag, not the request URL or headers', async () => {
    serve({ network: true });

    await fetchVersionPolicy();

    expect(logged()).toContain('ERR_NETWORK');
    expect(logged()).not.toContain(ENV.API_BASE_URL);
  });
});
