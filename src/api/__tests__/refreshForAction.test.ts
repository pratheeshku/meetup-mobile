/**
 * `refreshAccessTokenForAction()` (push actions AD-5): the background-action
 * variant of the refresh. Real `refreshClient`, fake transport and Keychain.
 * `refreshAccessToken()` must behave exactly as before.
 */
import * as Keychain from 'react-native-keychain';

import { ACCESS_SERVICE, deferred, installFakeBackend } from '../../test-utils/apiHarness';
import type { FakeBackend } from '../../test-utils/apiHarness';
import { refreshAccessToken, refreshAccessTokenForAction, SessionEndedError } from '../client';
import { clearTokens } from '../../storage/tokens';

jest.mock('../cookies', () => ({ clearCookieJar: jest.fn() }));

const mockSetPassword = Keychain.setGenericPassword as jest.Mock;

let backend: FakeBackend;

beforeEach(async () => {
  jest.clearAllMocks();
  jest.spyOn(console, 'log').mockImplementation(() => {});
  backend = installFakeBackend();
  await clearTokens();
  backend.stored[ACCESS_SERVICE] = 'old';
  backend.route = config =>
    config.url === '/auth/refresh' ? { data: { access_token: 'new' } } : { status: 200 };
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('refreshAccessTokenForAction', () => {
  it('POSTs /auth/refresh with no body, returns the token and persists it', async () => {
    await expect(refreshAccessTokenForAction()).resolves.toBe('new');

    const [refresh] = backend.callsTo('/auth/refresh');
    expect(refresh.method).toBe('post');
    expect(refresh.data).toBeUndefined();
    expect(refresh.withCredentials).toBe(true);
    expect(backend.stored[ACCESS_SERVICE]).toBe('new');
  });

  it('still returns the token when the Keychain write fails (locked device), and never throws', async () => {
    mockSetPassword.mockRejectedValueOnce(new Error('keychain locked'));

    await expect(refreshAccessTokenForAction()).resolves.toBe('new');

    expect(backend.stored[ACCESS_SERVICE]).toBe('old'); // not persisted
  });

  it('does not log the token or the storage error message', async () => {
    mockSetPassword.mockRejectedValueOnce(new Error('secret-detail new'));
    await refreshAccessTokenForAction();
    const logged = (console.log as jest.Mock).mock.calls.map(c => c.map(String).join(' ')).join('\n');
    expect(logged).not.toContain('secret-detail');
    expect(logged).not.toContain('new');
  });

  it('throws SessionEndedError when the session is gone, like the regular refresh', async () => {
    backend.route = () => ({ status: 401 });
    await expect(refreshAccessTokenForAction()).rejects.toBeInstanceOf(SessionEndedError);

    backend.route = () => ({ data: { access_token: null } });
    await expect(refreshAccessTokenForAction()).rejects.toMatchObject({ reason: 'no-session' });
  });

  it('propagates a network failure', async () => {
    backend.route = () => ({ network: true });
    await expect(refreshAccessTokenForAction()).rejects.toMatchObject({ code: 'ERR_NETWORK' });
  });

  it('shares the single network call with a concurrent regular refresh (one rotation)', async () => {
    const gate = deferred<void>();
    backend.route = async config => {
      if (config.url === '/auth/refresh') {
        await gate.promise;
        return { data: { access_token: 'new' } };
      }
      return { status: 200 };
    };

    const regular = refreshAccessToken();
    const forAction = refreshAccessTokenForAction();
    gate.resolve();

    await expect(Promise.all([regular, forAction])).resolves.toEqual(['new', 'new']);
    expect(backend.callsTo('/auth/refresh')).toHaveLength(1);
  });

  it('a concurrent action refresh still gets the token when the regular refresh fails to persist', async () => {
    const gate = deferred<void>();
    backend.route = async config => {
      if (config.url === '/auth/refresh') {
        await gate.promise;
        return { data: { access_token: 'new' } };
      }
      return { status: 200 };
    };
    mockSetPassword.mockRejectedValueOnce(new Error('keychain locked'));

    const regular = refreshAccessToken().catch(() => 'regular-failed');
    const forAction = refreshAccessTokenForAction();
    gate.resolve();

    await expect(forAction).resolves.toBe('new');
    await expect(regular).resolves.toBe('regular-failed');
    expect(backend.callsTo('/auth/refresh')).toHaveLength(1);
  });
});

describe('refreshAccessToken (unchanged behaviour)', () => {
  it('still throws when the Keychain write fails', async () => {
    mockSetPassword.mockRejectedValueOnce(new Error('keychain locked'));
    await expect(refreshAccessToken()).rejects.toThrow('keychain locked');
  });

  it('releases the single-flight slot after a failure', async () => {
    mockSetPassword.mockRejectedValueOnce(new Error('keychain locked'));
    await refreshAccessToken().catch(() => undefined);
    await expect(refreshAccessToken()).resolves.toBe('new');
    expect(backend.callsTo('/auth/refresh')).toHaveLength(2);
  });
});
