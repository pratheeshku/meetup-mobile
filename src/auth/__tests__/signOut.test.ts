/**
 * Offline-safe sign-out (`googleAuth.signOut`, DES §3.5/§5.2, R-013, R-030):
 * local state always clears; the two network steps are best-effort and
 * time-boxed; order stays deregister -> logout -> Google -> Keystore.
 * `POST /auth/logout` verified against the live OpenAPI (no body).
 */
import { GoogleSignin } from '@react-native-google-signin/google-signin';

import { apiClient } from '../../api/client';
import { clearCookieJar } from '../../api/cookies';
import { clearTokens } from '../../storage/tokens';
import { deregisterDeviceToken } from '../../notifications/fcm';
import { signOut } from '../googleAuth';

jest.mock('../../api/client', () => ({ apiClient: { post: jest.fn() } }));
jest.mock('../../api/cookies', () => ({ clearCookieJar: jest.fn() }));
jest.mock('../../storage/tokens', () => ({ clearTokens: jest.fn(), saveTokens: jest.fn() }));
jest.mock('../../notifications/fcm', () => ({ deregisterDeviceToken: jest.fn() }));

const mockPost = apiClient.post as jest.Mock;
const mockClearTokens = clearTokens as jest.Mock;
const mockClearCookieJar = clearCookieJar as jest.Mock;
const mockDeregister = deregisterDeviceToken as jest.Mock;
const mockGoogleSignOut = GoogleSignin.signOut as jest.Mock;

let logSpy: jest.SpyInstance;

beforeEach(() => {
  jest.clearAllMocks();
  mockDeregister.mockResolvedValue(undefined);
  mockPost.mockResolvedValue({ status: 200 });
  mockGoogleSignOut.mockResolvedValue(null);
  mockClearTokens.mockResolvedValue(undefined);
  mockClearCookieJar.mockResolvedValue(true);
  logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

function axiosNetworkError(): Error {
  return Object.assign(new Error('Network Error'), {
    code: 'ERR_NETWORK',
    config: { headers: { Authorization: 'Bearer live-access-token' } },
  });
}

describe('signOut', () => {
  it('runs deregister -> logout -> Google sign-out -> clearTokens -> clearCookieJar, sharing one correlation id and a short timeout', async () => {
    await signOut();

    const [deregisterConfig] = mockDeregister.mock.calls[0];
    const [logoutUrl, logoutBody, logoutConfig] = mockPost.mock.calls[0];
    expect(logoutUrl).toBe('/auth/logout');
    expect(logoutBody).toBeUndefined();
    expect(deregisterConfig.correlationId).toBeTruthy();
    expect(logoutConfig.correlationId).toBe(deregisterConfig.correlationId);
    expect(deregisterConfig.timeout).toBe(5000);
    expect(logoutConfig.timeout).toBe(5000);

    const order = [
      mockDeregister.mock.invocationCallOrder[0],
      mockPost.mock.invocationCallOrder[0],
      mockGoogleSignOut.mock.invocationCallOrder[0],
      mockClearTokens.mock.invocationCallOrder[0],
      mockClearCookieJar.mock.invocationCallOrder[0],
    ];
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it('still clears local state when POST /auth/logout fails (offline)', async () => {
    mockPost.mockRejectedValue(axiosNetworkError());

    await expect(signOut()).resolves.toBeUndefined();

    expect(mockGoogleSignOut).toHaveBeenCalledTimes(1);
    expect(mockClearTokens).toHaveBeenCalledTimes(1);
  });

  it('still calls logout and clears local state when de-registration fails', async () => {
    mockDeregister.mockRejectedValue(axiosNetworkError());

    await expect(signOut()).resolves.toBeUndefined();

    expect(mockPost).toHaveBeenCalledTimes(1);
    expect(mockGoogleSignOut).toHaveBeenCalledTimes(1);
    expect(mockClearTokens).toHaveBeenCalledTimes(1);
  });

  it('does not hang when de-registration never settles (e.g. FCM getToken stalls offline)', async () => {
    jest.useFakeTimers();
    mockDeregister.mockReturnValue(new Promise(() => {}));

    const done = jest.fn();
    const pending = signOut().then(done);
    await jest.advanceTimersByTimeAsync(4999);
    expect(done).not.toHaveBeenCalled();
    expect(mockPost).not.toHaveBeenCalled();

    await jest.advanceTimersByTimeAsync(2);
    await pending;

    expect(mockPost).toHaveBeenCalledTimes(1);
    expect(mockClearTokens).toHaveBeenCalledTimes(1);
  });

  it('still clears Keystore when the Google sign-out throws', async () => {
    mockGoogleSignOut.mockRejectedValue(new Error('not signed in with Google'));

    await expect(signOut()).resolves.toBeUndefined();

    expect(mockClearTokens).toHaveBeenCalledTimes(1);
  });

  it('logs only a status/code tag — never the error object, headers or tokens', async () => {
    mockDeregister.mockRejectedValue(axiosNetworkError());
    mockPost.mockRejectedValue(axiosNetworkError());

    await signOut();

    const logged = JSON.stringify(logSpy.mock.calls);
    expect(logged).toContain('ERR_NETWORK');
    expect(logged).not.toContain('Bearer');
    expect(logged).not.toContain('live-access-token');
  });

  it('propagates a Keystore failure (tokens could not be removed) rather than hiding it', async () => {
    mockClearTokens.mockRejectedValue(new Error('keystore unavailable'));

    await expect(signOut()).rejects.toThrow('keystore unavailable');
  });
});
