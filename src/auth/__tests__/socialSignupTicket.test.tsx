/**
 * Social sign-in for a NEW person while the phone is required (NE-01, AD-3): the callback answers `signup_required` with a ticket and no
 * session; `completeSignup` then signs in like a normal login. Real AuthProvider, googleAuth and token storage; only the network and native
 * modules are mocked. The ticket and the number are never logged and never written to storage.
 */
import React from 'react';
import { Platform } from 'react-native';
import * as Keychain from 'react-native-keychain';
import { GoogleSignin } from '@react-native-google-signin/google-signin';

import { apiClient } from '../../api/client';
import { act, renderAsync } from '../../test-utils/render';
import { AuthProvider, useAuth } from '../AuthContext';

jest.mock('../../api/client', () => {
  class SessionEndedStub extends Error {}
  return {
    apiClient: { get: jest.fn(), post: jest.fn() },
    refreshAccessToken: jest.fn(async () => {
      throw new SessionEndedStub('no-session');
    }),
    endSession: jest.fn(),
    SessionEndedError: SessionEndedStub,
  };
});
jest.mock('../../notifications/fcm', () => ({ deregisterDeviceToken: jest.fn() }));
jest.mock('../../notifications/pushRegistration', () => ({ startPushRegistration: jest.fn(() => jest.fn()) }));

const mockPost = apiClient.post as jest.Mock;
const mockSetPassword = Keychain.setGenericPassword as jest.Mock;
const mockGetPassword = Keychain.getGenericPassword as jest.Mock;

const TICKET = 'TICKET-SECRET-abc123';
const NUMBER = '+6591234567';
const USER = { id: 'u1', email: 'a@b.c', nickname: 'ann', display_name: 'Ann' };
const SIGNUP = { signup_required: true, signup_ticket: TICKET, expires_in: 600, email: 'a@b.c', display_name: 'Ann' };

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

let logs: jest.SpyInstance[];

beforeEach(() => {
  jest.replaceProperty(Platform, 'OS', 'android');
  jest.clearAllMocks();
  mockGetPassword.mockResolvedValue(false);
  mockSetPassword.mockReset().mockResolvedValue({ service: 'mock', storage: 'x' });
  (GoogleSignin.signIn as jest.Mock).mockResolvedValue({ type: 'success', data: { idToken: 'google-id-token' } });
  logs = (['log', 'info', 'warn', 'error', 'debug'] as const).map(level => jest.spyOn(console, level).mockImplementation(() => undefined));
});
afterEach(() => logs.forEach(spy => spy.mockRestore()));

const loggedText = (): string => JSON.stringify(logs.flatMap(spy => spy.mock.calls));

describe('callback with signup_required', () => {
  it('opens no session and writes no token; the screen gets only email and name', async () => {
    mockPost.mockResolvedValueOnce({ data: SIGNUP });
    await mount();
    let outcome: string | undefined;
    await act(async () => {
      outcome = await auth.signInWithGoogle();
    });
    expect(outcome).toBe('signup_required');
    expect(auth.user).toBeNull();
    expect(mockSetPassword).not.toHaveBeenCalled();
    expect(auth.pendingSignup).toEqual({ email: 'a@b.c', display_name: 'Ann' });
    expect(JSON.stringify(auth.pendingSignup)).not.toContain(TICKET);
  });

  it('a normal response (no signup_required) signs in as before', async () => {
    mockPost.mockResolvedValueOnce({ data: { access_token: 'acc', user: USER } });
    await mount();
    let outcome: string | undefined;
    await act(async () => {
      outcome = await auth.signInWithGoogle();
    });
    expect(outcome).toBe('signed_in');
    expect(auth.user).toEqual(USER);
    expect(auth.pendingSignup).toBeNull();
    expect(mockSetPassword.mock.calls[0][1]).toBe('acc');
  });
});

describe('completeSignup', () => {
  const start = async (): Promise<void> => {
    mockPost.mockResolvedValueOnce({ data: SIGNUP });
    await mount();
    await act(async () => {
      await auth.signInWithGoogle();
    });
    mockPost.mockClear();
  };

  it('posts ticket, number and consent version, stores the tokens, signs in and drops the ticket', async () => {
    await start();
    mockPost.mockResolvedValueOnce({ data: { access_token: 'acc-2', user: USER } });
    await act(async () => {
      await auth.completeSignup(NUMBER, 'consent-v1');
    });
    expect(mockPost).toHaveBeenCalledWith('/auth/complete-signup', {
      ticket: TICKET,
      mobile_number: NUMBER,
      mobile_consent_version: 'consent-v1',
    });
    expect(auth.user).toEqual(USER);
    expect(auth.pendingSignup).toBeNull();
    expect(mockSetPassword.mock.calls[0][1]).toBe('acc-2');
    // The ticket is never stored: the only Keychain write is the access token.
    expect(JSON.stringify(mockSetPassword.mock.calls)).not.toContain(TICKET);
    await expect(auth.completeSignup(NUMBER, 'consent-v1')).rejects.toThrow();
  });

  it('a 422 or 409 throws, signs nobody in and keeps the ticket for the retry', async () => {
    await start();
    mockPost.mockRejectedValueOnce({ response: { status: 422, data: { detail: 'Invalid mobile number format' } } });
    await act(async () => {
      await expect(auth.completeSignup(NUMBER, 'consent-v1')).rejects.toMatchObject({ response: { status: 422 } });
    });
    expect(auth.user).toBeNull();
    expect(auth.pendingSignup).not.toBeNull();
    mockPost.mockResolvedValueOnce({ data: { access_token: 'acc-3', user: USER } });
    await act(async () => {
      await auth.completeSignup(NUMBER, 'consent-v2');
    });
    expect(mockPost.mock.calls[1][1].ticket).toBe(TICKET);
    expect(auth.user).toEqual(USER);
  });

  it('cancelPendingSignup drops the ticket: a later complete throws without a request', async () => {
    await start();
    act(() => auth.cancelPendingSignup());
    expect(auth.pendingSignup).toBeNull();
    await expect(auth.completeSignup(NUMBER, 'consent-v1')).rejects.toThrow();
    expect(mockPost).not.toHaveBeenCalled();
  });

  it('neither the ticket nor the number is logged', async () => {
    await start();
    mockPost.mockRejectedValueOnce({ response: { status: 400, data: { detail: 'sign in again' } } });
    await act(async () => {
      await expect(auth.completeSignup(NUMBER, 'consent-v1')).rejects.toBeDefined();
    });
    expect(loggedText()).not.toContain(TICKET);
    expect(loggedText()).not.toContain(NUMBER);
  });
});
