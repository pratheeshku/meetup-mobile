/**
 * Google sign-in is Android-only (DES-MEETUP-ADDENDUM-IOS-App.md §3,
 * AD-iOS-M2): not rendered on Login, not initialised by `AuthContext`, and
 * never reaches the native module on iOS. Unchanged on Android. The Register
 * screen has no Google element on either platform.
 */
import React from 'react';
import { Platform } from 'react-native';
import { GoogleSignin, GoogleSigninButton } from '@react-native-google-signin/google-signin';

import { renderAsync } from '../../test-utils/render';
import LoginScreen from '../../screens/LoginScreen';
import RegisterScreen from '../../screens/RegisterScreen';
import { AuthProvider } from '../AuthContext';
import { signIn } from '../googleAuth';

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
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('iOS', () => {
  beforeEach(() => jest.replaceProperty(Platform, 'OS', 'ios'));

  it('does not render the Google button and does not configure the native module', async () => {
    const root = await mountLogin();

    expect(root.findAllByType(GoogleSigninButton)).toHaveLength(0);
    expect(mockConfigure).not.toHaveBeenCalled();
  });

  it('signIn() refuses before touching configure, hasPlayServices or the native sign-in', async () => {
    await expect(signIn()).rejects.toThrow();

    expect(mockConfigure).not.toHaveBeenCalled();
    expect(mockHasPlayServices).not.toHaveBeenCalled();
    expect(mockSignIn).not.toHaveBeenCalled();
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
