/**
 * Sign-in when the backend returns no `refresh_token` (internal-testing
 * stopgap, Option A). The live `TokenResponse` is `{ access_token, user }`
 * only. A successful exchange must complete login — `setUser` reached, home
 * screen shown — instead of failing after the access token was stored.
 *
 * Runs the real `googleAuth`, `emailAuth`, `saveTokens` and `AuthProvider`;
 * only the network (`apiClient`) and native modules are mocked. The Keychain
 * mock mirrors the native module's rejection of an empty password, so these
 * tests fail against the pre-fix code.
 */
import React from 'react';
import * as Keychain from 'react-native-keychain';
import { GoogleSignin } from '@react-native-google-signin/google-signin';

import { apiClient } from '../../api/client';
import { renderAsync, act } from '../../test-utils/render';
import { AuthProvider, useAuth } from '../AuthContext';

jest.mock('../../api/client', () => {
  class SessionEndedStub extends Error {
    reason: 'no-session' | 'rejected';
    constructor(reason: 'no-session' | 'rejected') {
      super(reason);
      this.reason = reason;
    }
  }
  return {
    apiClient: { get: jest.fn(), post: jest.fn() },
    // App-start silent refresh: no cookie, so no session to restore.
    refreshAccessToken: jest.fn(async () => {
      throw new SessionEndedStub('no-session');
    }),
    endSession: jest.fn(),
    SessionEndedError: SessionEndedStub,
  };
});
jest.mock('../../notifications/fcm', () => ({ deregisterDeviceToken: jest.fn() }));
jest.mock('../../notifications/pushRegistration', () => ({
  startPushRegistration: jest.fn(() => jest.fn()),
}));

const mockPost = apiClient.post as jest.Mock;
const mockSetPassword = Keychain.setGenericPassword as jest.Mock;
const mockGetPassword = Keychain.getGenericPassword as jest.Mock;
const mockGoogleSignIn = GoogleSignin.signIn as jest.Mock;

const USER = { id: 'u1', email: 'a@b.c', nickname: 'ann', display_name: 'Ann' };
const ACCESS_SERVICE = 'com.meetupmobile.auth.accessToken';
const REFRESH_SERVICE = 'com.meetupmobile.auth.refreshToken';

let auth: ReturnType<typeof useAuth>;
function Probe(): null {
  auth = useAuth();
  return null;
}
const mount = () =>
  renderAsync(
    <AuthProvider>
      <Probe />
    </AuthProvider>,
  );

const writtenServices = (): string[] => mockSetPassword.mock.calls.map(call => call[2].service);

beforeEach(() => {
  jest.clearAllMocks();
  mockGetPassword.mockResolvedValue(false); // no stored session on start
  mockSetPassword.mockReset();
  mockSetPassword.mockImplementation(async (_username: string, password: string) => {
    if (!password) {
      throw new Error('you passed empty or null username/password');
    }
    return { service: 'mock', storage: 'KeystoreAESGCM_NoAuth' };
  });
  mockGoogleSignIn.mockResolvedValue({ type: 'success', data: { idToken: 'google-id-token' } });
});

describe('Google sign-in without a refresh token', () => {
  it('completes login: user set, access token stored, no refresh write, no failure', async () => {
    mockPost.mockResolvedValue({ data: { access_token: 'acc-1', user: USER } });
    await mount();
    expect(auth.user).toBeNull();

    await act(async () => {
      await auth.signInWithGoogle();
    });

    expect(mockPost).toHaveBeenCalledWith('/auth/oauth/google/callback', { id_token: 'google-id-token' });
    expect(auth.user).toEqual(USER);
    expect(auth.sessionExpired).toBe(false);
    expect(writtenServices()).toEqual([ACCESS_SERVICE]);
    expect(mockSetPassword.mock.calls[0][1]).toBe('acc-1');
  });

  it('still stores both tokens when the backend does send a refresh token', async () => {
    mockPost.mockResolvedValue({
      data: { access_token: 'acc-1', refresh_token: 'ref-1', user: USER },
    });
    await mount();

    await act(async () => {
      await auth.signInWithGoogle();
    });

    expect(auth.user).toEqual(USER);
    expect(writtenServices().sort()).toEqual([ACCESS_SERVICE, REFRESH_SERVICE].sort());
  });

  it('fails closed when the access token cannot be stored: rejects, no user', async () => {
    mockPost.mockResolvedValue({ data: { access_token: 'acc-1', user: USER } });
    mockSetPassword.mockRejectedValue(new Error('keystore unavailable'));
    await mount();

    await act(async () => {
      await expect(auth.signInWithGoogle()).rejects.toThrow('keystore unavailable');
    });

    expect(auth.user).toBeNull();
  });
});

describe('Email sign-in without a refresh token', () => {
  it('completes login: user set, access token stored, no refresh write, no failure', async () => {
    mockPost.mockResolvedValue({ data: { access_token: 'acc-2', user: USER } });
    await mount();

    await act(async () => {
      await auth.signInWithEmail('a@b.c', 'pw');
    });

    expect(mockPost).toHaveBeenCalledWith('/auth/login', { email: 'a@b.c', password: 'pw' });
    expect(auth.user).toEqual(USER);
    expect(auth.sessionExpired).toBe(false);
    expect(writtenServices()).toEqual([ACCESS_SERVICE]);
    expect(mockSetPassword.mock.calls[0][1]).toBe('acc-2');
  });

  it('still stores both tokens when the backend does send a refresh token', async () => {
    mockPost.mockResolvedValue({
      data: { access_token: 'acc-2', refresh_token: 'ref-2', user: USER },
    });
    await mount();

    await act(async () => {
      await auth.signInWithEmail('a@b.c', 'pw');
    });

    expect(auth.user).toEqual(USER);
    expect(writtenServices().sort()).toEqual([ACCESS_SERVICE, REFRESH_SERVICE].sort());
  });

  it('a rejected login (wrong password) still rejects and leaves no user or tokens', async () => {
    mockPost.mockRejectedValue(Object.assign(new Error('401'), { response: { status: 401 } }));
    await mount();

    await act(async () => {
      await expect(auth.signInWithEmail('a@b.c', 'bad')).rejects.toThrow('401');
    });

    expect(auth.user).toBeNull();
    expect(mockSetPassword).not.toHaveBeenCalled();
  });
});
