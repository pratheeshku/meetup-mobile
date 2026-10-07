/**
 * Sign In screen: shows the session-expired notice when `AuthContext` reports
 * one, and nothing when it does not. The Google failure message is unchanged.
 * Tests 403 Verify routing, 401 message, 429 rate limit, 5xx server error,
 * forgot password link, success message, and touch targets.
 */
import React from 'react';
import { Platform, StyleSheet, TextInput } from 'react-native';
import { GoogleSigninButton } from '@react-native-google-signin/google-signin';

import { GoogleSignInCancelledError } from '../../auth/googleAuth';
import { AppleSignInCancelledError } from '../../auth/appleAuth';
import { act, pressables, pressableWithText, renderAsync, texts } from '../../test-utils/render';
import type { Instance } from '../../test-utils/render';
import LoginScreen from '../LoginScreen';

type Props = React.ComponentProps<typeof LoginScreen>;

const mockAuth = {
  sessionExpired: false,
  signInWithGoogle: jest.fn(),
  signInWithApple: jest.fn(),
  signInWithEmail: jest.fn(),
};
jest.mock('../../auth/AuthContext', () => ({ useAuth: () => mockAuth }));
jest.mock('../../auth/googleAuth', () => ({
  GoogleSignInCancelledError: class CancelledStub extends Error {},
}));
jest.mock('../../auth/appleAuth', () => ({
  AppleSignInCancelledError: class AppleCancelledStub extends Error {},
}));

const mockNavigate = jest.fn();
const mockNavigation = {
  navigate: mockNavigate,
  goBack: jest.fn(),
  canGoBack: jest.fn(() => true),
};

const mount = (routeParams: { successMessage?: string; email?: string } = {}): Promise<Instance> =>
  renderAsync(
    <LoginScreen
      {...({
        navigation: mockNavigation,
        route: { params: routeParams },
      } as unknown as Props)}
    />,
  );

const fillEmailPassword = (root: Instance, email = 'user@example.com', password = 'password123') => {
  act(() => {
    const inputs = root.findAllByType(TextInput);
    const emailInput = inputs.find(i => i.props.placeholder === 'Email');
    const passwordInput = inputs.find(i => i.props.placeholder === 'Password');
    if (emailInput) emailInput.props.onChangeText(email);
    if (passwordInput) passwordInput.props.onChangeText(password);
  });
};

const resolveStyle = (node: Instance): Record<string, any> => {
  const styleProp = node.props.style;
  const evaluated = typeof styleProp === 'function' ? styleProp({ pressed: false }) : styleProp;
  return StyleSheet.flatten(evaluated) || {};
};

// Jest's default platform is iOS; these suites exercise the Android-only
// Google sign-in path (not offered on iOS, DES-MEETUP-ADDENDUM-IOS-App.md §3).
beforeEach(() => {
  jest.replaceProperty(Platform, 'OS', 'android');
});

beforeEach(() => {
  jest.clearAllMocks();
  mockAuth.sessionExpired = false;
  mockAuth.signInWithGoogle.mockReset();
  mockAuth.signInWithApple.mockReset();
  mockAuth.signInWithEmail.mockReset();
});

describe('LoginScreen session-expired notice', () => {
  it('[Execute] shows "Session expired. Please sign in again." when the session expired', async () => {
    mockAuth.sessionExpired = true;

    expect(texts(await mount())).toContain('Session expired. Please sign in again.');
  });

  it('[Execute] shows no notice on a normal visit', async () => {
    const t = texts(await mount());

    expect(t).not.toContain('Session expired. Please sign in again.');
    expect(t).toContain('Sign In');
  });
});

describe('LoginScreen Google sign-in errors (unchanged)', () => {
  const pressGoogle = async (root: Instance): Promise<void> => {
    await act(async () => {
      await root.findByType(GoogleSigninButton).props.onPress();
    });
  };

  it('[Execute] shows the failure message for a real failure', async () => {
    mockAuth.signInWithGoogle.mockRejectedValue(new Error('boom'));
    const root = await mount();

    await pressGoogle(root);

    expect(texts(root)).toContain('Google sign-in failed. Please try again.');
  });

  it('[Execute] stays silent when the user cancels the account picker', async () => {
    mockAuth.signInWithGoogle.mockRejectedValue(new GoogleSignInCancelledError());
    const root = await mount();

    await pressGoogle(root);

    expect(texts(root)).not.toContain('Google sign-in failed. Please try again.');
  });

  it('[Execute] shows no failure message when sign-in succeeds', async () => {
    mockAuth.signInWithGoogle.mockResolvedValue(undefined);
    const root = await mount();

    await pressGoogle(root);

    expect(texts(root)).not.toContain('Google sign-in failed. Please try again.');
  });
});

describe('LoginScreen email auth and routing (AD-5)', () => {
  it('[Execute] login 403 {"detail": "Email not verified"} routes to Verify with the email filled in and explanation', async () => {
    const error: { isAxiosError: boolean; response: { status: number; data: { detail: string } } } = {
      isAxiosError: true,
      response: {
        status: 403,
        data: { detail: 'Email not verified' },
      },
    };
    mockAuth.signInWithEmail.mockRejectedValueOnce(error);

    const root = await mount();
    fillEmailPassword(root, 'unverified@example.com', 'mypassword');

    await act(async () => {
      pressableWithText(root, 'Sign In').props.onPress();
    });

    expect(mockNavigate).toHaveBeenCalledWith('Verify', {
      email: 'unverified@example.com',
      explanation: 'Please verify your email before signing in.',
    });
  });

  it('[Execute] login 401 shows "Invalid email or password."', async () => {
    const error: { isAxiosError: boolean; response: { status: number; data: { detail: string } } } = {
      isAxiosError: true,
      response: {
        status: 401,
        data: { detail: 'Incorrect credentials' },
      },
    };
    mockAuth.signInWithEmail.mockRejectedValueOnce(error);

    const root = await mount();
    fillEmailPassword(root, 'user@example.com', 'wrongpassword');

    await act(async () => {
      pressableWithText(root, 'Sign In').props.onPress();
    });

    expect(texts(root)).toContain('Invalid email or password.');
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('[Execute] login 429 shows "Too many attempts. Try again in a minute."', async () => {
    const error: { isAxiosError: boolean; response: { status: number; data: { detail: string } } } = {
      isAxiosError: true,
      response: {
        status: 429,
        data: { detail: 'Too many requests' },
      },
    };
    mockAuth.signInWithEmail.mockRejectedValueOnce(error);

    const root = await mount();
    fillEmailPassword(root, 'user@example.com', 'password123');

    await act(async () => {
      pressableWithText(root, 'Sign In').props.onPress();
    });

    expect(texts(root)).toContain('Too many attempts. Try again in a minute.');
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('[Execute] login 5xx shows "Something went wrong. Try again." with Retry button, and retrying succeeds', async () => {
    const error: { isAxiosError: boolean; response: { status: number; data: { detail: string } } } = {
      isAxiosError: true,
      response: {
        status: 500,
        data: { detail: 'Internal Server Error' },
      },
    };
    mockAuth.signInWithEmail.mockRejectedValueOnce(error);

    const root = await mount();
    fillEmailPassword(root, 'user@example.com', 'password123');

    await act(async () => {
      pressableWithText(root, 'Sign In').props.onPress();
    });

    expect(texts(root)).toContain('Something went wrong. Try again.');
    expect(texts(root)).toContain('Retry');

    // Retrying with success
    mockAuth.signInWithEmail.mockResolvedValueOnce(undefined);
    await act(async () => {
      pressableWithText(root, 'Retry').props.onPress();
    });

    expect(mockAuth.signInWithEmail).toHaveBeenCalledTimes(2);
  });

  it('[Execute] shows inline error with Retry when server is unreachable, and retrying succeeds', async () => {
    const networkErr: { isAxiosError: boolean; code: string; message: string } = {
      isAxiosError: true,
      code: 'ERR_NETWORK',
      message: 'Network Error',
    };
    mockAuth.signInWithEmail.mockRejectedValueOnce(networkErr);

    const root = await mount();
    fillEmailPassword(root, 'user@example.com', 'password123');

    await act(async () => {
      pressableWithText(root, 'Sign In').props.onPress();
    });

    expect(texts(root)).toContain('Unable to connect to server.');
    expect(texts(root)).toContain('Retry');

    // Retrying with success
    mockAuth.signInWithEmail.mockResolvedValueOnce(undefined);
    await act(async () => {
      pressableWithText(root, 'Retry').props.onPress();
    });

    expect(mockAuth.signInWithEmail).toHaveBeenCalledTimes(2);
  });

  it('[Execute] "Forgot password?" link navigates to ForgotPassword with pre-filled email', async () => {
    const root = await mount();
    fillEmailPassword(root, 'forgot@example.com', 'pwd');

    await act(async () => {
      pressableWithText(root, 'Forgot password?').props.onPress();
    });

    expect(mockNavigate).toHaveBeenCalledWith('ForgotPassword', {
      email: 'forgot@example.com',
    });
  });

  it('[Execute] shows successMessage when passed in route params (e.g. from Verify screen)', async () => {
    const root = await mount({ successMessage: 'Email verified. Sign in.' });
    expect(texts(root)).toContain('Email verified. Sign in.');
  });

  it('[Execute] pre-fills email when passed in route params', async () => {
    const root = await mount({ email: 'prefilled@example.com' });
    const inputs = root.findAllByType(TextInput);
    const emailInput = inputs.find(i => i.props.placeholder === 'Email');
    expect(emailInput?.props.value).toBe('prefilled@example.com');
  });

  it('[Execute] verifies all interactive pressables have a touch target height of at least 44px', async () => {
    const root = await mount();
    const buttons = pressables(root);
    expect(buttons.length).toBeGreaterThanOrEqual(3);

    for (const b of buttons) {
      const flattened = resolveStyle(b);
      const minHeight = flattened.minHeight;
      const height = flattened.height;
      const effectiveHeight = minHeight ?? height ?? 0;
      expect(effectiveHeight).toBeGreaterThanOrEqual(44);
    }
  });
});

describe('LoginScreen Apple sign-in and iOS elements (AD-6, AD-8, AD-9)', () => {
  beforeEach(() => {
    jest.replaceProperty(Platform, 'OS', 'ios');
  });

  const pressApple = async (root: Instance): Promise<void> => {
    await act(async () => {
      pressableWithText(root, 'Continue with Apple').props.onPress();
    });
  };

  it('[Execute] renders the Apple button and terms notice on iOS', async () => {
    const root = await mount();
    expect(texts(root)).toContain('Continue with Apple');
    expect(texts(root)).toContain('Terms and Conditions');
  });

  it('[Execute] stays silent when the user cancels Apple sign-in', async () => {
    mockAuth.signInWithApple.mockRejectedValueOnce(new AppleSignInCancelledError());
    const root = await mount();

    await pressApple(root);

    expect(texts(root)).not.toContain('Apple sign-in failed. Please try again.');
  });

  it('[Execute] shows generic failure message when Apple sign-in fails', async () => {
    mockAuth.signInWithApple.mockRejectedValueOnce(new Error('Backend 500 error'));
    const root = await mount();

    await pressApple(root);

    expect(texts(root)).toContain('Apple sign-in failed. Please try again.');
  });

  it('[Execute] does not render Apple button on Android, but renders terms notice', async () => {
    jest.replaceProperty(Platform, 'OS', 'android');
    const root = await mount();

    expect(texts(root)).not.toContain('Continue with Apple');
    expect(texts(root)).toContain('Terms and Conditions');
  });
});

