import React from 'react';
import { StyleSheet, TextInput } from 'react-native';

import { apiClient } from '../../api/client';
import { GoogleSignInCancelledError } from '../../auth/googleAuth';
import { act, pressables, pressableWithText, renderAsync, texts } from '../../test-utils/render';
import type { Instance } from '../../test-utils/render';
import ForgotPasswordScreen from '../ForgotPasswordScreen';

const mockAuth = {
  signInWithGoogle: jest.fn(),
};

jest.mock('../../auth/AuthContext', () => ({
  useAuth: () => mockAuth,
}));

jest.mock('../../auth/googleAuth', () => ({
  GoogleSignInCancelledError: class CancelledStub extends Error {},
}));

jest.mock('../../api/client', () => ({
  apiClient: {
    post: jest.fn(),
  },
}));

const mockNavigate = jest.fn();
const mockNavigation = {
  navigate: mockNavigate,
  goBack: jest.fn(),
  canGoBack: jest.fn(() => true),
};

const mount = (params: { email?: string } = {}): Promise<Instance> =>
  renderAsync(
    <ForgotPasswordScreen
      {...({
        navigation: mockNavigation,
        route: { params },
      } as unknown as React.ComponentProps<typeof ForgotPasswordScreen>)}
    />,
  );

const setInputEmail = (root: Instance, email: string): void => {
  act(() => {
    const input = root.findByType(TextInput);
    input.props.onChangeText(email);
  });
};

const resolveStyle = (node: Instance): Record<string, any> => {
  const styleProp = node.props.style;
  const evaluated = typeof styleProp === 'function' ? styleProp({ pressed: false }) : styleProp;
  return StyleSheet.flatten(evaluated) || {};
};

beforeEach(() => {
  jest.clearAllMocks();
  (apiClient.post as jest.Mock).mockReset();
  mockAuth.signInWithGoogle.mockReset();
});

const EXPECTED_GENERIC_MESSAGE =
  "If an account exists for that email, we've sent a reset link. Open it on this phone.";

const EXPECTED_OAUTH_ONLY_MESSAGE =
  'This account signs in with Google, so it has no password. Use Continue with Google to sign in.';

describe('ForgotPasswordScreen', () => {
  it('[Execute] shows the generic message on success (200) with "Back to sign in" button when code is absent', async () => {
    (apiClient.post as jest.Mock).mockResolvedValueOnce({ data: {} });
    const root = await mount();

    setInputEmail(root, 'test@example.com');

    await act(async () => {
      pressableWithText(root, 'Submit').props.onPress();
    });

    expect(apiClient.post).toHaveBeenCalledWith('/auth/reset-password-request', {
      email: 'test@example.com',
    });
    expect(texts(root)).toContain(EXPECTED_GENERIC_MESSAGE);
    expect(pressableWithText(root, 'Back to sign in')).toBeDefined();

    await act(async () => {
      pressableWithText(root, 'Back to sign in').props.onPress();
    });
    expect(mockNavigate).toHaveBeenCalledWith('Login');
  });

  it('[Execute] shows the same generic message on failure (400 client error, protecting against email enumeration)', async () => {
    (apiClient.post as jest.Mock).mockRejectedValueOnce({
      isAxiosError: true,
      response: {
        status: 400,
        data: { detail: 'Invalid request' },
      },
    });
    const root = await mount();

    setInputEmail(root, 'unknown@example.com');

    await act(async () => {
      pressableWithText(root, 'Submit').props.onPress();
    });

    expect(texts(root)).toContain(EXPECTED_GENERIC_MESSAGE);
    expect(pressableWithText(root, 'Back to sign in')).toBeDefined();
  });

  it('[Execute] shows "Something went wrong. Try again." with Retry button on server error (500) and does NOT show the link sent text', async () => {
    (apiClient.post as jest.Mock).mockRejectedValueOnce({
      isAxiosError: true,
      response: {
        status: 500,
        data: { detail: 'Internal Server Error' },
      },
    });
    const root = await mount();

    setInputEmail(root, 'error@example.com');

    await act(async () => {
      pressableWithText(root, 'Submit').props.onPress();
    });

    expect(texts(root)).toContain('Something went wrong. Try again.');
    expect(texts(root)).toContain('Retry');
    expect(texts(root)).not.toContain(EXPECTED_GENERIC_MESSAGE);

    // Retrying with success
    (apiClient.post as jest.Mock).mockResolvedValueOnce({ data: {} });
    await act(async () => {
      pressableWithText(root, 'Retry').props.onPress();
    });

    expect(texts(root)).toContain(EXPECTED_GENERIC_MESSAGE);
  });

  it('[Execute] shows "Too many attempts. Try again in a minute." on 429 rate limit and does NOT show the link sent text', async () => {
    (apiClient.post as jest.Mock).mockRejectedValueOnce({
      isAxiosError: true,
      response: {
        status: 429,
        data: { detail: 'Too many requests' },
      },
    });
    const root = await mount();

    setInputEmail(root, 'ratelimit@example.com');

    await act(async () => {
      pressableWithText(root, 'Submit').props.onPress();
    });

    expect(texts(root)).toContain('Too many attempts. Try again in a minute.');
    expect(texts(root)).not.toContain(EXPECTED_GENERIC_MESSAGE);
    expect(pressables(root).some(p => {
      try {
        return texts(p).includes('Retry');
      } catch {
        return false;
      }
    })).toBe(false);
  });

  it('[Execute] shows inline error with Retry when server is unreachable, and retrying succeeds', async () => {
    (apiClient.post as jest.Mock).mockRejectedValueOnce({
      isAxiosError: true,
      code: 'ERR_NETWORK',
      message: 'Network Error',
    });
    const root = await mount();

    setInputEmail(root, 'retry@example.com');

    await act(async () => {
      pressableWithText(root, 'Submit').props.onPress();
    });

    expect(texts(root)).toContain('Unable to connect to server.');
    expect(texts(root)).toContain('Retry');
    expect(texts(root)).not.toContain(EXPECTED_GENERIC_MESSAGE);

    // Retrying with success
    (apiClient.post as jest.Mock).mockResolvedValueOnce({ data: {} });
    await act(async () => {
      pressableWithText(root, 'Retry').props.onPress();
    });

    expect(texts(root)).toContain(EXPECTED_GENERIC_MESSAGE);
  });

  it('[Execute] an oauth_only reply shows the Google-only message, the Continue with Google button and Back to sign in, and does not show the normal message', async () => {
    (apiClient.post as jest.Mock).mockResolvedValueOnce({
      data: {
        code: 'oauth_only',
        detail: EXPECTED_OAUTH_ONLY_MESSAGE,
      },
    });
    const root = await mount();

    setInputEmail(root, 'googleonly@example.com');

    await act(async () => {
      pressableWithText(root, 'Submit').props.onPress();
    });

    expect(apiClient.post).toHaveBeenCalledWith('/auth/reset-password-request', {
      email: 'googleonly@example.com',
    });

    const rendered = texts(root);
    expect(rendered).toContain(EXPECTED_OAUTH_ONLY_MESSAGE);
    expect(rendered).not.toContain(EXPECTED_GENERIC_MESSAGE);

    expect(pressableWithText(root, 'Continue with Google')).toBeDefined();
    expect(pressableWithText(root, 'Back to sign in')).toBeDefined();
  });

  it('[Execute] pressing Continue with Google calls the existing Google sign-in handler', async () => {
    (apiClient.post as jest.Mock).mockResolvedValueOnce({
      data: {
        code: 'oauth_only',
        detail: EXPECTED_OAUTH_ONLY_MESSAGE,
      },
    });
    mockAuth.signInWithGoogle.mockResolvedValueOnce(undefined);

    const root = await mount();
    setInputEmail(root, 'googleonly@example.com');

    await act(async () => {
      pressableWithText(root, 'Submit').props.onPress();
    });

    await act(async () => {
      pressableWithText(root, 'Continue with Google').props.onPress();
    });

    expect(mockAuth.signInWithGoogle).toHaveBeenCalledTimes(1);
  });

  it('[Execute] handles Google sign-in cancellation silently without error message', async () => {
    (apiClient.post as jest.Mock).mockResolvedValueOnce({
      data: { code: 'oauth_only', detail: EXPECTED_OAUTH_ONLY_MESSAGE },
    });
    mockAuth.signInWithGoogle.mockRejectedValueOnce(new GoogleSignInCancelledError());

    const root = await mount();
    setInputEmail(root, 'googleonly@example.com');

    await act(async () => {
      pressableWithText(root, 'Submit').props.onPress();
    });

    await act(async () => {
      pressableWithText(root, 'Continue with Google').props.onPress();
    });

    expect(texts(root)).not.toContain('Google sign-in failed. Please try again.');
  });

  it('[Execute] handles Google sign-in network error with inline Retry', async () => {
    (apiClient.post as jest.Mock).mockResolvedValueOnce({
      data: { code: 'oauth_only', detail: EXPECTED_OAUTH_ONLY_MESSAGE },
    });
    mockAuth.signInWithGoogle.mockRejectedValueOnce({
      isAxiosError: true,
      code: 'ERR_NETWORK',
      message: 'Network Error',
    });

    const root = await mount();
    setInputEmail(root, 'googleonly@example.com');

    await act(async () => {
      pressableWithText(root, 'Submit').props.onPress();
    });

    await act(async () => {
      pressableWithText(root, 'Continue with Google').props.onPress();
    });

    expect(texts(root)).toContain('Unable to connect to server.');
    expect(texts(root)).toContain('Retry');

    // Retry Google sign-in successfully
    mockAuth.signInWithGoogle.mockResolvedValueOnce(undefined);
    await act(async () => {
      pressableWithText(root, 'Retry').props.onPress();
    });

    expect(mockAuth.signInWithGoogle).toHaveBeenCalledTimes(2);
  });

  it('[Execute] pre-fills email when passed in route params', async () => {
    const root = await mount({ email: 'prefilled@example.com' });
    const input = root.findByType(TextInput);
    expect(input.props.value).toBe('prefilled@example.com');
  });

  it('[Execute] Back to sign in link navigates to Login', async () => {
    const root = await mount();

    await act(async () => {
      pressableWithText(root, 'Back to sign in').props.onPress();
    });

    expect(mockNavigate).toHaveBeenCalledWith('Login');
  });

  it('[Execute] verifies all interactive pressables have a touch target height of at least 44px (including oauth_only buttons)', async () => {
    const root = await mount();

    const buttonsBefore = pressables(root);
    expect(buttonsBefore.length).toBeGreaterThanOrEqual(2);
    for (const b of buttonsBefore) {
      const flattened = resolveStyle(b);
      const minHeight = flattened.minHeight;
      const height = flattened.height;
      const effectiveHeight = minHeight ?? height ?? 0;
      expect(effectiveHeight).toBeGreaterThanOrEqual(44);
    }

    // Submit with oauth_only and check confirmation state buttons
    (apiClient.post as jest.Mock).mockResolvedValueOnce({
      data: { code: 'oauth_only', detail: EXPECTED_OAUTH_ONLY_MESSAGE },
    });
    setInputEmail(root, 'touch@example.com');

    await act(async () => {
      pressableWithText(root, 'Submit').props.onPress();
    });

    const buttonsAfter = pressables(root);
    expect(buttonsAfter.length).toBeGreaterThanOrEqual(2);
    for (const b of buttonsAfter) {
      const flattened = resolveStyle(b);
      const minHeight = flattened.minHeight;
      const height = flattened.height;
      const effectiveHeight = minHeight ?? height ?? 0;
      expect(effectiveHeight).toBeGreaterThanOrEqual(44);
    }
  });
});
