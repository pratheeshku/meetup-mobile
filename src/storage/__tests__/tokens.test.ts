/**
 * `saveTokens` with an optional refresh token (internal-testing stopgap,
 * Option A). The live backend's `TokenResponse` has no `refresh_token`, so an
 * absent refresh token must not fail the save — previously the empty
 * refresh write was rejected natively AFTER the access token had already been
 * stored, failing an otherwise successful sign-in.
 */
import * as Keychain from 'react-native-keychain';

import { saveTokens } from '../tokens';

const mockSet = Keychain.setGenericPassword as jest.Mock;
const mockReset = Keychain.resetGenericPassword as jest.Mock;

const ACCESS_SERVICE = 'com.meetupmobile.auth.accessToken';
const REFRESH_SERVICE = 'com.meetupmobile.auth.refreshToken';

beforeEach(() => {
  mockSet.mockReset();
  mockReset.mockReset();
  // Mirrors the native module: an empty/null password is REJECTED
  // (`E_EMPTY_PARAMETERS`), it does not resolve `false`.
  mockSet.mockImplementation(async (_username: string, password: string) => {
    if (!password) {
      throw new Error('you passed empty or null username/password');
    }
    return { service: 'mock', storage: 'KeystoreAESGCM_NoAuth' };
  });
});

const writtenServices = (): string[] => mockSet.mock.calls.map(call => call[2].service);

describe('saveTokens', () => {
  it('writes both entries when a refresh token is provided', async () => {
    await saveTokens('access-1', 'refresh-1');

    expect(mockSet).toHaveBeenCalledTimes(2);
    expect(writtenServices().sort()).toEqual([ACCESS_SERVICE, REFRESH_SERVICE].sort());
    const byService = Object.fromEntries(mockSet.mock.calls.map(call => [call[2].service, call[1]]));
    expect(byService[ACCESS_SERVICE]).toBe('access-1');
    expect(byService[REFRESH_SERVICE]).toBe('refresh-1');
  });

  it.each([
    ['undefined', undefined],
    ['null', null],
    ['an empty string', ''],
  ])('writes only the access token and resolves when the refresh token is %s', async (_label, refresh) => {
    await expect(saveTokens('access-1', refresh)).resolves.toBeUndefined();

    expect(mockSet).toHaveBeenCalledTimes(1);
    expect(writtenServices()).toEqual([ACCESS_SERVICE]);
    expect(mockSet.mock.calls[0][1]).toBe('access-1');
  });

  it('omitting the argument entirely is the same as absent', async () => {
    await expect(saveTokens('access-1')).resolves.toBeUndefined();
    expect(writtenServices()).toEqual([ACCESS_SERVICE]);
  });

  it('never attempts an empty write and leaves the refresh entry untouched', async () => {
    await saveTokens('access-1', undefined);

    expect(mockSet.mock.calls.every(call => Boolean(call[1]))).toBe(true);
    expect(mockReset).not.toHaveBeenCalled();
  });
});

describe('saveTokens — still fails closed', () => {
  it('throws when the access-token write reports failure', async () => {
    mockSet.mockResolvedValue(false);

    await expect(saveTokens('access-1', undefined)).rejects.toThrow(
      'Failed to persist tokens to secure storage',
    );
  });

  it('throws when a provided refresh token fails to persist', async () => {
    mockSet.mockImplementation(async (_username: string, _password: string, options: { service: string }) =>
      options.service === REFRESH_SERVICE ? false : { service: 'mock', storage: 'KeystoreAESGCM_NoAuth' },
    );

    await expect(saveTokens('access-1', 'refresh-1')).rejects.toThrow(
      'Failed to persist tokens to secure storage',
    );
  });

  it('propagates a native rejection of the access-token write', async () => {
    mockSet.mockRejectedValue(new Error('keystore unavailable'));

    await expect(saveTokens('access-1', undefined)).rejects.toThrow('keystore unavailable');
  });
});
