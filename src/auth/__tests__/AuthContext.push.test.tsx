/**
 * `AuthContext` <-> push registration wiring (DES §3.6): registration starts
 * exactly when a session exists (restored on cold start, or any sign-in
 * method) and stops when it ends — so it can never run while signed out.
 */
import React from 'react';

import { apiClient, refreshAccessToken, SessionEndedError } from '../../api/client';
import { authEvents } from '../../api/authEvents';
import { getAccessToken } from '../../storage/tokens';
import { startPushRegistration } from '../../notifications/pushRegistration';
import { renderAsync, act } from '../../test-utils/render';
import { AuthProvider, useAuth } from '../AuthContext';
import { signOut as sharedSignOut } from '../googleAuth';
import { login as emailLogin } from '../emailAuth';

jest.mock('../../api/client', () => {
  class SessionEndedStub extends Error {
    reason: 'no-session' | 'rejected';
    constructor(reason: 'no-session' | 'rejected') {
      super(reason);
      this.reason = reason;
    }
  }
  return {
    apiClient: { get: jest.fn() },
    refreshAccessToken: jest.fn(),
    endSession: jest.fn(),
    SessionEndedError: SessionEndedStub,
  };
});
jest.mock('../../storage/tokens', () => ({ getAccessToken: jest.fn() }));
jest.mock('../googleAuth', () => ({
  configureGoogleSignIn: jest.fn(),
  signIn: jest.fn(),
  signOut: jest.fn(),
}));
jest.mock('../emailAuth', () => ({ login: jest.fn(), register: jest.fn() }));
jest.mock('../../notifications/pushRegistration', () => ({ startPushRegistration: jest.fn() }));

const mockGet = apiClient.get as jest.Mock;
const mockRefresh = refreshAccessToken as jest.Mock;
const mockGetAccessToken = getAccessToken as jest.Mock;
const mockStart = startPushRegistration as jest.Mock;
const mockSharedSignOut = sharedSignOut as jest.Mock;
const mockEmailLogin = emailLogin as jest.Mock;

const USER = { id: 'u1', email: 'a@b.c', nickname: 'ann', display_name: 'Ann' };

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

let stop: jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  stop = jest.fn();
  mockStart.mockReturnValue(stop);
  mockGetAccessToken.mockResolvedValue(null);
  // Signed out: the app-start silent refresh finds no session (no cookie).
  mockRefresh.mockRejectedValue(new SessionEndedError('no-session'));
  mockSharedSignOut.mockResolvedValue(undefined);
});

describe('start', () => {
  it('starts on a restored session (cold start)', async () => {
    mockGetAccessToken.mockResolvedValue('stored-token');
    mockGet.mockResolvedValue({ data: USER });

    await mount();

    expect(auth.user).toEqual(USER);
    expect(mockStart).toHaveBeenCalledTimes(1);
  });

  it('does not start while signed out (no stored session)', async () => {
    await mount();

    expect(auth.user).toBeNull();
    expect(mockStart).not.toHaveBeenCalled();
  });

  it('does not start when the stored session cannot be restored', async () => {
    mockGetAccessToken.mockResolvedValue('stale-token');
    mockGet.mockRejectedValue(new Error('offline'));

    await mount();

    expect(auth.user).toBeNull();
    expect(mockStart).not.toHaveBeenCalled();
  });

  it('starts after a fresh sign-in', async () => {
    mockEmailLogin.mockResolvedValue(USER);
    await mount();
    expect(mockStart).not.toHaveBeenCalled();

    await act(async () => {
      await auth.signInWithEmail('a@b.c', 'pw');
    });

    expect(mockStart).toHaveBeenCalledTimes(1);
  });

  it('is not restarted by a profile patch (only a new user id restarts it)', async () => {
    mockGetAccessToken.mockResolvedValue('stored-token');
    mockGet.mockResolvedValue({ data: USER });
    await mount();

    await act(async () => {
      auth.updateUser({ display_name: 'Annie' });
    });

    expect(auth.user?.display_name).toBe('Annie');
    expect(mockStart).toHaveBeenCalledTimes(1);
    expect(stop).not.toHaveBeenCalled();
  });
});

describe('stop', () => {
  beforeEach(() => {
    mockGetAccessToken.mockResolvedValue('stored-token');
    mockGet.mockResolvedValue({ data: USER });
  });

  it('stops on sign-out — before the network sign-out begins — and clears the user', async () => {
    await mount();

    await act(async () => {
      await auth.signOut();
    });

    expect(stop).toHaveBeenCalled();
    expect(stop.mock.invocationCallOrder[0]).toBeLessThan(
      mockSharedSignOut.mock.invocationCallOrder[0],
    );
    expect(auth.user).toBeNull();
  });

  it('still clears the user, and surfaces the error, if sign-out throws', async () => {
    await mount();
    mockSharedSignOut.mockRejectedValue(new Error('keystore unavailable'));

    await act(async () => {
      await expect(auth.signOut()).rejects.toThrow('keystore unavailable');
    });

    expect(auth.user).toBeNull();
  });

  it('stops when the session expires (auth-expired)', async () => {
    await mount();

    await act(async () => {
      authEvents.emit('auth-expired');
    });

    expect(auth.user).toBeNull();
    expect(stop).toHaveBeenCalledTimes(1);
  });

  it('stops on unmount', async () => {
    let renderer!: import('react-test-renderer').ReactTestRenderer;
    const ReactTestRenderer = jest.requireActual('react-test-renderer');
    await ReactTestRenderer.act(async () => {
      renderer = ReactTestRenderer.create(
        <AuthProvider>
          <Probe />
        </AuthProvider>,
      );
    });
    expect(stop).not.toHaveBeenCalled();

    await ReactTestRenderer.act(async () => {
      renderer.unmount();
    });

    expect(stop).toHaveBeenCalledTimes(1);
  });
});
