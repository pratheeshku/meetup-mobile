/**
 * Android install attribution (group-invite-existing-accounts AD-9): attribution_code goes out at account
 * creation only, and only when the Play referrer supplied one. iOS and every failure mean no code.
 */
import { NativeModules, Platform } from 'react-native';
import { GoogleSignin } from '@react-native-google-signin/google-signin';

import { apiClient } from '../../api/client';
import { _resetLinkStoreForTesting } from '../../links/linkStore';
import { completeSignup, login, signup } from '../../auth/emailAuth';
import { signIn as googleSignIn, _resetGoogleSignInConfiguredForTesting } from '../../auth/googleAuth';
import { _resetAttributionForTesting, getAttributionFields, readInstallReferrerOnce } from '../installReferrer';

jest.mock('../../api/client', () => ({ apiClient: { post: jest.fn() } }));
jest.mock('../../storage/tokens', () => ({ saveTokens: jest.fn() }));

const post = apiClient.post as jest.Mock;
const getAttributionCode = jest.fn();
const SIGNUP = { email: 'a@b.co', password: 'password1', display_name: 'A', nickname: 'a', terms_version: 'v1' };

beforeEach(() => {
  jest.clearAllMocks();
  jest.useRealTimers();
  _resetLinkStoreForTesting();
  _resetAttributionForTesting();
  _resetGoogleSignInConfiguredForTesting();
  jest.replaceProperty(Platform, 'OS', 'android');
  (NativeModules as Record<string, unknown>).InstallReferrer = { getAttributionCode };
  post.mockResolvedValue({ data: {} });
});

afterEach(() => {
  delete (NativeModules as Record<string, unknown>).InstallReferrer;
});

describe('reading the referrer', () => {
  it('keeps a valid code in memory and reads only once', async () => {
    getAttributionCode.mockResolvedValue('Ab3_-xyz');
    await readInstallReferrerOnce();
    await readInstallReferrerOnce();
    expect(getAttributionCode).toHaveBeenCalledTimes(1);
    expect(getAttributionFields()).toEqual({ attribution_code: 'Ab3_-xyz' });
  });

  it.each([null, '', 'has space', 'a'.repeat(129), 'x&y=z'])('drops %p', async value => {
    getAttributionCode.mockResolvedValue(value);
    await readInstallReferrerOnce();
    expect(getAttributionFields()).toEqual({});
  });

  it('an error continues silently with no code', async () => {
    getAttributionCode.mockRejectedValue(new Error('SERVICE_UNAVAILABLE'));
    await expect(readInstallReferrerOnce()).resolves.toBeUndefined();
    expect(getAttributionFields()).toEqual({});
  });

  it('a timeout continues with no code', async () => {
    jest.useFakeTimers();
    getAttributionCode.mockReturnValue(new Promise(() => undefined));
    const read = readInstallReferrerOnce();
    await jest.advanceTimersByTimeAsync(5000);
    await read;
    expect(getAttributionFields()).toEqual({});
  });

  it('a missing native module means no code', async () => {
    delete (NativeModules as Record<string, unknown>).InstallReferrer;
    await readInstallReferrerOnce();
    expect(getAttributionFields()).toEqual({});
  });

  it('iOS has no code path: the module is never called', async () => {
    jest.replaceProperty(Platform, 'OS', 'ios');
    getAttributionCode.mockResolvedValue('abc');
    await readInstallReferrerOnce();
    expect(getAttributionCode).not.toHaveBeenCalled();
    expect(getAttributionFields()).toEqual({});
  });
});

describe('attribution_code on the wire', () => {
  beforeEach(async () => {
    getAttributionCode.mockResolvedValue('Ab3_-xyz');
    await readInstallReferrerOnce();
  });

  it('is sent at email sign-up, then forgotten', async () => {
    await signup(SIGNUP);
    expect(post.mock.calls[0][1]).toMatchObject({ attribution_code: 'Ab3_-xyz' });
    await signup(SIGNUP);
    expect(post.mock.calls[1][1]).not.toHaveProperty('attribution_code');
  });

  it('is sent on the social callback', async () => {
    (GoogleSignin.signIn as jest.Mock).mockResolvedValueOnce({ type: 'success', data: { idToken: 'tok' } });
    post.mockResolvedValue({ data: { access_token: 'a', user: { id: 'u' } } });
    await googleSignIn();
    expect(post).toHaveBeenCalledWith('/auth/oauth/google/callback', expect.objectContaining({ attribution_code: 'Ab3_-xyz' }));
  });

  it('is never sent at ordinary sign-in or complete-signup', async () => {
    post.mockResolvedValue({ data: { access_token: 'a', user: { id: 'u' } } });
    await login('a@b.co', 'password1');
    expect(post).toHaveBeenCalledWith('/auth/login', { email: 'a@b.co', password: 'password1' });
    await completeSignup({ ticket: 't', mobile_number: '+6591234567', mobile_consent_version: 'v1' });
    expect(post.mock.calls[1][1]).not.toHaveProperty('attribution_code');
  });
});

describe('without a code', () => {
  it('the sign-up body is exactly as before', async () => {
    await signup(SIGNUP);
    expect(Object.keys(post.mock.calls[0][1]).sort()).toEqual(['display_name', 'email', 'nickname', 'password', 'terms_version']);
  });
});
