/**
 * Sign-out against the REAL `apiClient` (transport, Keychain and cookie jar
 * faked). `POST /auth/logout` exists in the backend OpenAPI (no body, 200), so
 * it is called — with credentials, so the refresh cookie reaches the server —
 * and then the local Keychain tokens and the cookie jar are cleared, whatever
 * the network did.
 */
import * as Keychain from 'react-native-keychain';
import { GoogleSignin } from '@react-native-google-signin/google-signin';

import { clearCookieJar } from '../../api/cookies';
import { deregisterDeviceToken } from '../../notifications/fcm';
import { ACCESS_SERVICE, installFakeBackend } from '../../test-utils/apiHarness';
import type { FakeBackend } from '../../test-utils/apiHarness';
import { signOut } from '../googleAuth';

jest.mock('../../api/cookies', () => ({ clearCookieJar: jest.fn() }));
jest.mock('../../notifications/fcm', () => ({ deregisterDeviceToken: jest.fn() }));

const mockClearCookieJar = clearCookieJar as jest.Mock;
const mockReset = Keychain.resetGenericPassword as jest.Mock;
const mockGoogleSignOut = GoogleSignin.signOut as jest.Mock;

let backend: FakeBackend;

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'log').mockImplementation(() => {});
  mockClearCookieJar.mockResolvedValue(true);
  (deregisterDeviceToken as jest.Mock).mockResolvedValue(undefined);
  mockGoogleSignOut.mockResolvedValue(null);
  backend = installFakeBackend();
  backend.stored[ACCESS_SERVICE] = 'live-access';
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('signOut', () => {
  it('calls POST /auth/logout with credentials and no body, then clears tokens and the cookie jar — in that order', async () => {
    await signOut();

    const [logout] = backend.callsTo('/auth/logout');
    expect(logout.method).toBe('post');
    expect(logout.data).toBeUndefined();
    expect(logout.withCredentials).toBe(true); // the refresh cookie must reach the server
    expect(logout.authorization).toBe('Bearer live-access');

    expect(backend.stored[ACCESS_SERVICE]).toBeUndefined();
    expect(mockClearCookieJar).toHaveBeenCalledTimes(1);

    const order = [
      mockGoogleSignOut.mock.invocationCallOrder[0],
      mockReset.mock.invocationCallOrder[0],
      mockClearCookieJar.mock.invocationCallOrder[0],
    ];
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it('still clears tokens and the cookie jar when the server is unreachable', async () => {
    backend.route = () => ({ network: true });

    await expect(signOut()).resolves.toBeUndefined();

    expect(backend.stored[ACCESS_SERVICE]).toBeUndefined();
    expect(mockClearCookieJar).toHaveBeenCalledTimes(1);
  });

  it('a 401 from /auth/logout is not refreshed, and local state is still cleared', async () => {
    backend.route = () => ({ status: 401 });

    await expect(signOut()).resolves.toBeUndefined();

    expect(backend.callsTo('/auth/refresh')).toHaveLength(0);
    expect(backend.stored[ACCESS_SERVICE]).toBeUndefined();
    expect(mockClearCookieJar).toHaveBeenCalledTimes(1);
  });

  it('completes even if the cookie jar cannot be cleared', async () => {
    mockClearCookieJar.mockResolvedValue(false);

    await expect(signOut()).resolves.toBeUndefined();

    expect(backend.stored[ACCESS_SERVICE]).toBeUndefined();
  });
});
