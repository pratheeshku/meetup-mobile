import { Platform } from 'react-native';
import { appleAuth } from '@invertase/react-native-apple-authentication';

import { apiClient } from '../../api/client';
import { saveTokens } from '../../storage/tokens';
import {
  AppleSignInCancelledError,
  isAppleSignInAvailable,
  signIn,
} from '../appleAuth';

jest.mock('../../api/client', () => ({
  apiClient: {
    post: jest.fn(),
  },
}));

jest.mock('../../storage/tokens', () => ({
  saveTokens: jest.fn(),
}));

const mockPerformRequest = appleAuth.performRequest as jest.Mock;
const mockPost = apiClient.post as jest.Mock;
const mockSaveTokens = saveTokens as jest.Mock;

describe('appleAuth', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.replaceProperty(Platform, 'OS', 'ios');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('isAppleSignInAvailable', () => {
    it('returns true on iOS when supported', () => {
      expect(isAppleSignInAvailable()).toBe(true);
    });

    it('returns false on Android', () => {
      jest.replaceProperty(Platform, 'OS', 'android');
      expect(isAppleSignInAvailable()).toBe(false);
    });
  });

  describe('signIn', () => {
    it('throws error when invoked on non-iOS platform', async () => {
      jest.replaceProperty(Platform, 'OS', 'android');
      await expect(signIn()).rejects.toThrow('Apple sign-in is only available on iOS');
      expect(mockPerformRequest).not.toHaveBeenCalled();
    });

    it('sends only authorizationCode, client_kind: "native", full_name, and terms_version on success', async () => {
      mockPerformRequest.mockResolvedValueOnce({
        authorizationCode: 'valid_auth_code_123',
        identityToken: 'SECRET_IDENTITY_TOKEN_SHOULD_NEVER_BE_SENT',
        fullName: { givenName: 'Ada', familyName: 'Lovelace' },
      });

      const mockUser = { id: 'u1', display_name: 'Ada Lovelace' };
      mockPost.mockResolvedValueOnce({
        data: {
          access_token: 'access_abc',
          refresh_token: 'refresh_xyz',
          user: mockUser,
        },
      });

      const user = await signIn();

      expect(user).toEqual(mockUser);
      expect(mockPerformRequest).toHaveBeenCalledWith({
        requestedOperation: appleAuth.Operation.LOGIN,
        requestedScopes: [appleAuth.Scope.EMAIL, appleAuth.Scope.FULL_NAME],
      });

      // Verify payload sent to /auth/oauth/apple/callback
      expect(mockPost).toHaveBeenCalledTimes(1);
      const [path, payload] = mockPost.mock.calls[0];
      expect(path).toBe('/auth/oauth/apple/callback');
      expect(payload).toEqual({
        code: 'valid_auth_code_123',
        client_kind: 'native',
        full_name: 'Ada Lovelace',
        terms_version: '2026-10-02',
      });

      // Verify identityToken is never sent or present in payload
      expect(payload).not.toHaveProperty('identityToken');
      expect(payload).not.toHaveProperty('identity_token');
      expect(JSON.stringify(payload)).not.toContain('SECRET_IDENTITY_TOKEN_SHOULD_NEVER_BE_SENT');

      expect(mockSaveTokens).toHaveBeenCalledWith('access_abc', 'refresh_xyz');
    });

    it('omits full_name when Apple does not return a name (returning users)', async () => {
      mockPerformRequest.mockResolvedValueOnce({
        authorizationCode: 'returning_auth_code_456',
        fullName: null,
      });

      mockPost.mockResolvedValueOnce({
        data: {
          access_token: 'acc',
          user: { id: 'u2' },
        },
      });

      await signIn();

      const [, payload] = mockPost.mock.calls[0];
      expect(payload).toEqual({
        code: 'returning_auth_code_456',
        client_kind: 'native',
        terms_version: '2026-10-02',
      });
      expect(payload).not.toHaveProperty('full_name');
    });

    it('throws AppleSignInCancelledError when user cancels via CANCELED code or ERR_REQUEST_CANCELED', async () => {
      mockPerformRequest.mockRejectedValueOnce({
        code: appleAuth.Error.CANCELED,
        message: 'The user canceled the authorization attempt.',
      });

      await expect(signIn()).rejects.toThrow(AppleSignInCancelledError);
      expect(mockPost).not.toHaveBeenCalled();
    });

    it('throws AppleSignInCancelledError when error message contains ERR_REQUEST_CANCELED', async () => {
      mockPerformRequest.mockRejectedValueOnce({
        code: '1001',
        message: 'ERR_REQUEST_CANCELED',
      });

      await expect(signIn()).rejects.toThrow(AppleSignInCancelledError);
      expect(mockPost).not.toHaveBeenCalled();
    });

    it('throws generic error without server detail when Apple request fails with non-cancel error', async () => {
      mockPerformRequest.mockRejectedValueOnce(new Error('Native Apple Authentication Failed 0x800'));

      await expect(signIn()).rejects.toThrow('Apple sign-in failed. Please try again.');
      expect(mockPost).not.toHaveBeenCalled();
    });

    it('throws generic error without server detail when backend callback fails', async () => {
      mockPerformRequest.mockResolvedValueOnce({
        authorizationCode: 'code_xyz',
      });

      mockPost.mockRejectedValueOnce({
        response: {
          status: 400,
          data: { detail: 'Internal Apple JWT verification failed: invalid audience' },
        },
      });

      await expect(signIn()).rejects.toThrow('Apple sign-in failed. Please try again.');
    });
  });
});
