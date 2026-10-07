/**
 * Google sign-in is enabled on both iOS and Android (AD-8).
 * Configured on mount, rendered on Login, unchanged on Android.
 * The Register screen has no Google element on either platform.
 */
import React from 'react';
import { Platform } from 'react-native';
import { GoogleSignin, GoogleSigninButton } from '@react-native-google-signin/google-signin';

import { apiClient } from '../../api/client';
import { renderAsync } from '../../test-utils/render';
import LoginScreen from '../../screens/LoginScreen';
import RegisterScreen from '../../screens/RegisterScreen';
import { AuthProvider } from '../AuthContext';
import { signIn, _resetGoogleSignInConfiguredForTesting } from '../googleAuth';

jest.mock('../../api/client', () => ({
  apiClient: { get: jest.fn(), post: jest.fn() },
  refreshAccessToken: jest.fn(),
  endSession: jest.fn(),
  SessionEndedError: class extends Error {},
}));
jest.mock('../../storage/tokens', () => ({
  getAccessToken: jest.fn(async () => null),
  saveTokens: jest.fn(),
  clearTokens: jest.fn(),
}));

const mockConfigure = GoogleSignin.configure as jest.Mock;
const mockHasPlayServices = GoogleSignin.hasPlayServices as jest.Mock;
const mockSignIn = GoogleSignin.signIn as jest.Mock;

const nav = { navigate: jest.fn(), goBack: jest.fn(), canGoBack: jest.fn(() => true) };
const mountLogin = () =>
  renderAsync(
    <AuthProvider>
      <LoginScreen
        {...({ navigation: nav, route: { params: {} } } as unknown as React.ComponentProps<
          typeof LoginScreen
        >)}
      />
    </AuthProvider>,
  );

beforeEach(() => {
  jest.clearAllMocks();
  _resetGoogleSignInConfiguredForTesting();
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('iOS', () => {
  beforeEach(() => jest.replaceProperty(Platform, 'OS', 'ios'));

  it('renders the Google button and configures the native module on start-up (AD-8)', async () => {
    const root = await mountLogin();

    expect(root.findAllByType(GoogleSigninButton)).toHaveLength(1);
    expect(mockConfigure).toHaveBeenCalledTimes(1);
  });

  it('signIn() on iOS proceeds without calling hasPlayServices', async () => {
    mockSignIn.mockResolvedValueOnce({
      type: 'success',
      data: { idToken: 'mock-id-token' },
    });
    (apiClient.post as jest.Mock).mockResolvedValueOnce({
      data: { access_token: 'mock-access', token_type: 'bearer' },
    });

    await signIn();

    expect(mockConfigure).toHaveBeenCalled();
    expect(mockHasPlayServices).not.toHaveBeenCalled();
    expect(mockSignIn).toHaveBeenCalledTimes(1);
  });

  it('Register has no Google element', async () => {
    const root = await renderAsync(
      <RegisterScreen
        {...({ navigation: nav, route: {} } as unknown as React.ComponentProps<
          typeof RegisterScreen
        >)}
      />,
    );

    expect(root.findAllByType(GoogleSigninButton)).toHaveLength(0);
  });
});

describe('Android (unchanged)', () => {
  beforeEach(() => jest.replaceProperty(Platform, 'OS', 'android'));

  it('renders the Google button and configures the native module on start-up', async () => {
    const root = await mountLogin();

    expect(root.findAllByType(GoogleSigninButton)).toHaveLength(1);
    expect(mockConfigure).toHaveBeenCalledTimes(1);
  });
});
