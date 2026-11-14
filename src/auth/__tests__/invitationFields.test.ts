/**
 * Deep-links AD-8: invitation_token, ref, event_id and invite go out on account creation only
 * (sign-up and the social callback), only when a link supplied them, and never at ordinary sign-in.
 */
import { Platform } from 'react-native';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { appleAuth } from '@invertase/react-native-apple-authentication';

import { apiClient } from '../../api/client';
import { getInvitationFields, peekPendingTarget, setPendingTarget, _resetLinkStoreForTesting } from '../../links/linkStore';
import { signIn as appleSignIn } from '../appleAuth';
import { completeSignup, login, signup } from '../emailAuth';
import { signIn as googleSignIn, _resetGoogleSignInConfiguredForTesting } from '../googleAuth';

jest.mock('../../api/client', () => ({ apiClient: { post: jest.fn() } }));
jest.mock('../../storage/tokens', () => ({ saveTokens: jest.fn() }));

const post = apiClient.post as jest.Mock;
const ID = '3f2b8c1e-5a4d-4e6f-9b7a-1c2d3e4f5a6b';
const REF = '9a8b7c6d-1e2f-4a3b-8c4d-5e6f7a8b9c0d';
const GROUP = '11111111-2222-4333-8444-555555555555';

const SIGNUP = { email: 'a@b.co', password: 'password1', display_name: 'A', nickname: 'a', terms_version: 'v1' };

beforeEach(() => {
  jest.clearAllMocks();
  _resetLinkStoreForTesting();
  _resetGoogleSignInConfiguredForTesting();
  post.mockResolvedValue({ data: {} });
});

describe('sign-up (POST /auth/signup)', () => {
  it('game link: event_id, ref and invite are sent', async () => {
    setPendingTarget({ kind: 'game', eventId: ID, ref: REF, invite: GROUP });
    await signup(SIGNUP);
    expect(post).toHaveBeenCalledWith('/auth/signup', expect.objectContaining({ event_id: ID, ref: REF, invite: GROUP }));
  });

  it('tournament link: invite only', async () => {
    setPendingTarget({ kind: 'tournament', tournamentId: ID, invite: GROUP });
    await signup(SIGNUP);
    const body = post.mock.calls[0][1];
    expect(body.invite).toBe(GROUP);
    expect(body).not.toHaveProperty('event_id');
    expect(body).not.toHaveProperty('invitation_token');
  });

  it('group link: invitation_token; joined_group_id in the reply is remembered so the group opens after sign-in', async () => {
    setPendingTarget({ kind: 'group_invite', token: ID });
    post.mockResolvedValue({ data: { joined_group_id: GROUP } });
    await signup(SIGNUP);
    expect(post.mock.calls[0][1].invitation_token).toBe(ID);
    expect(peekPendingTarget()).toEqual({ kind: 'group', groupId: GROUP });
  });

  it('no link: the body is exactly the existing fields', async () => {
    await signup(SIGNUP);
    expect(Object.keys(post.mock.calls[0][1]).sort()).toEqual(['display_name', 'email', 'nickname', 'password', 'terms_version']);
  });
});

describe('ordinary sign-in sends none of them', () => {
  it('POST /auth/login', async () => {
    setPendingTarget({ kind: 'game', eventId: ID, ref: REF, invite: GROUP });
    post.mockResolvedValue({ data: { access_token: 'a', user: { id: 'u' } } });
    await login('a@b.co', 'password1');
    expect(post).toHaveBeenCalledWith('/auth/login', { email: 'a@b.co', password: 'password1' });
  });
});

describe('social callback (POST /auth/oauth/{provider}/callback)', () => {
  it('Google: fields sent on the callback; joined_group_id remembered', async () => {
    setPendingTarget({ kind: 'group_invite', token: ID });
    (GoogleSignin.signIn as jest.Mock).mockResolvedValueOnce({ type: 'success', data: { idToken: 'tok' } });
    post.mockResolvedValue({ data: { access_token: 'a', user: { id: 'u' }, joined_group_id: GROUP } });
    await googleSignIn();
    expect(post).toHaveBeenCalledWith(
      '/auth/oauth/google/callback',
      expect.objectContaining({ id_token: 'tok', invitation_token: ID }),
    );
    expect(peekPendingTarget()).toEqual({ kind: 'group', groupId: GROUP });
  });

  it('Google without a link: body unchanged', async () => {
    (GoogleSignin.signIn as jest.Mock).mockResolvedValueOnce({ type: 'success', data: { idToken: 'tok' } });
    post.mockResolvedValue({ data: { access_token: 'a', user: { id: 'u' } } });
    await googleSignIn();
    expect(Object.keys(post.mock.calls[0][1]).sort()).toEqual(['id_token', 'terms_version']);
  });

  it('Apple: fields sent on the callback', async () => {
    jest.replaceProperty(Platform, 'OS', 'ios');
    setPendingTarget({ kind: 'game', eventId: ID, ref: REF });
    (appleAuth.performRequest as jest.Mock).mockResolvedValueOnce({ authorizationCode: 'code', fullName: null });
    post.mockResolvedValue({ data: { access_token: 'a', user: { id: 'u' } } });
    await appleSignIn();
    expect(post).toHaveBeenCalledWith(
      '/auth/oauth/apple/callback',
      expect.objectContaining({ code: 'code', event_id: ID, ref: REF }),
    );
  });
});

describe('complete-signup', () => {
  it('sends only ticket and number (the ticket carries the fields); a joined group is remembered', async () => {
    post.mockResolvedValue({ data: { access_token: 'a', user: { id: 'u' }, joined_group_id: GROUP } });
    await completeSignup({ ticket: 't', mobile_number: '+6591234567', mobile_consent_version: 'v1' });
    expect(post).toHaveBeenCalledWith('/auth/complete-signup', {
      ticket: 't',
      mobile_number: '+6591234567',
      mobile_consent_version: 'v1',
    });
    expect(peekPendingTarget()).toEqual({ kind: 'group', groupId: GROUP });
    expect(getInvitationFields()).toEqual({});
  });
});
