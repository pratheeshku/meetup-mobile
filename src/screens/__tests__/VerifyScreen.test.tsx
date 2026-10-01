import React from 'react';
import { StyleSheet, TextInput } from 'react-native';

import { apiClient } from '../../api/client';
import { act, pressables, pressableWithText, renderAsync, texts } from '../../test-utils/render';
import type { Instance } from '../../test-utils/render';
import VerifyScreen from '../VerifyScreen';

jest.mock('../../api/client', () => ({
  apiClient: {
    post: jest.fn(),
  },
}));

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
const mockNavigation = {
  navigate: mockNavigate,
  goBack: mockGoBack,
  canGoBack: jest.fn(() => true),
};

const mount = (params: { email?: string; explanation?: string } = {}): Promise<Instance> =>
  renderAsync(
    <VerifyScreen
      {...({
        navigation: mockNavigation,
        route: {
          params: {
            email: params.email ?? 'verify@example.com',
            explanation: params.explanation,
          },
        },
      } as unknown as React.ComponentProps<typeof VerifyScreen>)}
    />,
  );

const setInputCode = (root: Instance, code: string): void => {
  act(() => {
    const input = root.findByType(TextInput);
    input.props.onChangeText(code);
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
});

afterEach(() => {
  jest.useRealTimers();
});

describe('VerifyScreen', () => {
  it('[Execute] shows the email, a 6-digit input, Verify, Resend, and Back buttons', async () => {
    const root = await mount({ email: 'target@example.com' });

    expect(texts(root)).toContain('target@example.com');
    expect(texts(root)).toContain('Verify Email');

    const inputs = root.findAllByType(TextInput);
    expect(inputs.length).toBe(1);
    expect(inputs[0].props.placeholder).toBe('6-digit code');
    expect(inputs[0].props.maxLength).toBe(6);

    expect(pressableWithText(root, 'Verify')).toBeDefined();
    expect(pressableWithText(root, 'Resend')).toBeDefined();
    expect(pressableWithText(root, 'Back')).toBeDefined();
  });

  it('[Execute] displays explanation text when routed with an explanation', async () => {
    const root = await mount({
      email: 'target@example.com',
      explanation: 'Please verify your email before signing in.',
    });

    expect(texts(root)).toContain('Please verify your email before signing in.');
  });

  it('[Execute] the Verify flow ends on the login screen with success message and without auto-login', async () => {
    (apiClient.post as jest.Mock).mockResolvedValueOnce({ data: {} });
    const root = await mount({ email: 'target@example.com' });

    setInputCode(root, '123456');

    await act(async () => {
      pressableWithText(root, 'Verify').props.onPress();
    });

    expect(apiClient.post).toHaveBeenCalledWith('/auth/verify-email', {
      email: 'target@example.com',
      code: '123456',
    });
    expect(mockNavigate).toHaveBeenCalledWith('Login', {
      successMessage: 'Email verified. Sign in.',
    });
  });

  it('[Execute] failed code shows "That code didn\'t work. Check it or request a new one."', async () => {
    (apiClient.post as jest.Mock).mockRejectedValueOnce({
      isAxiosError: true,
      response: {
        status: 400,
        data: { detail: 'Verification failed' },
      },
    });
    const root = await mount({ email: 'target@example.com' });

    setInputCode(root, '999999');

    await act(async () => {
      pressableWithText(root, 'Verify').props.onPress();
    });

    expect(texts(root)).toContain("That code didn't work. Check it or request a new one.");
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('[Execute] 429 on verify shows "Too many attempts. Try again in a minute."', async () => {
    (apiClient.post as jest.Mock).mockRejectedValueOnce({
      isAxiosError: true,
      response: {
        status: 429,
        data: { detail: 'Rate limit exceeded' },
      },
    });
    const root = await mount({ email: 'target@example.com' });

    setInputCode(root, '123456');

    await act(async () => {
      pressableWithText(root, 'Verify').props.onPress();
    });

    expect(texts(root)).toContain('Too many attempts. Try again in a minute.');
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('[Execute] 5xx on verify shows "Something went wrong. Try again." with Retry button, and retrying succeeds', async () => {
    (apiClient.post as jest.Mock).mockRejectedValueOnce({
      isAxiosError: true,
      response: {
        status: 500,
        data: { detail: 'Internal Server Error' },
      },
    });
    const root = await mount({ email: 'target@example.com' });

    setInputCode(root, '123456');

    await act(async () => {
      pressableWithText(root, 'Verify').props.onPress();
    });

    expect(texts(root)).toContain('Something went wrong. Try again.');
    expect(texts(root)).toContain('Retry');

    // Retry should succeed
    (apiClient.post as jest.Mock).mockResolvedValueOnce({ data: {} });
    await act(async () => {
      pressableWithText(root, 'Retry').props.onPress();
    });

    expect(mockNavigate).toHaveBeenCalledWith('Login', {
      successMessage: 'Email verified. Sign in.',
    });
  });

  it('[Execute] Resend is always enabled and calls the resend endpoint', async () => {
    (apiClient.post as jest.Mock).mockResolvedValueOnce({
      data: { detail: 'If the email needs verification, a new code has been sent.' },
    });
    const root = await mount({ email: 'target@example.com' });

    const resendBtn = pressableWithText(root, 'Resend');
    expect(resendBtn.props.accessibilityState.disabled).toBe(false);

    await act(async () => {
      resendBtn.props.onPress();
    });

    expect(apiClient.post).toHaveBeenCalledWith('/auth/resend-verification', {
      email: 'target@example.com',
    });
  });

  it('[Execute] Resend calls POST /auth/resend-verification and starts 60-second cooldown on success', async () => {
    jest.useFakeTimers();
    (apiClient.post as jest.Mock).mockResolvedValueOnce({
      data: { detail: 'If the email needs verification, a new code has been sent.' },
    });
    const root = await mount({ email: 'target@example.com' });

    await act(async () => {
      pressableWithText(root, 'Resend').props.onPress();
    });

    expect(apiClient.post).toHaveBeenCalledWith('/auth/resend-verification', {
      email: 'target@example.com',
    });

    // Cooldown is 60s
    expect(texts(root)).toContain('Resend (60s)');

    act(() => {
      jest.advanceTimersByTime(1000);
    });
    expect(texts(root)).toContain('Resend (59s)');

    act(() => {
      jest.advanceTimersByTime(59000);
    });
    expect(texts(root)).toContain('Resend');
  });

  it('[Execute] Resend cooldown does NOT start on failure', async () => {
    (apiClient.post as jest.Mock).mockRejectedValueOnce({
      isAxiosError: true,
      response: {
        status: 400,
        data: { detail: 'Something failed' },
      },
    });
    const root = await mount({ email: 'target@example.com' });

    await act(async () => {
      pressableWithText(root, 'Resend').props.onPress();
    });

    expect(apiClient.post).toHaveBeenCalledWith('/auth/resend-verification', {
      email: 'target@example.com',
    });

    // Cooldown must not start on failure
    expect(texts(root)).not.toContain('Resend (60s)');
    expect(texts(root)).toContain('Resend');
    expect(texts(root)).toContain('Failed to resend verification code. Please try again.');
  });

  it('[Execute] 429 on resend shows "Too many attempts. Try again in a minute." and cooldown does not start', async () => {
    (apiClient.post as jest.Mock).mockRejectedValueOnce({
      isAxiosError: true,
      response: {
        status: 429,
        data: { detail: 'Too many attempts' },
      },
    });
    const root = await mount({ email: 'target@example.com' });

    await act(async () => {
      pressableWithText(root, 'Resend').props.onPress();
    });

    expect(texts(root)).toContain('Too many attempts. Try again in a minute.');
    expect(texts(root)).not.toContain('Resend (60s)');
  });

  it('[Execute] 5xx on resend shows "Something went wrong. Try again." with Retry button, and cooldown does not start', async () => {
    (apiClient.post as jest.Mock).mockRejectedValueOnce({
      isAxiosError: true,
      response: {
        status: 502,
        data: { detail: 'Bad Gateway' },
      },
    });
    const root = await mount({ email: 'target@example.com' });

    await act(async () => {
      pressableWithText(root, 'Resend').props.onPress();
    });

    expect(texts(root)).toContain('Something went wrong. Try again.');
    expect(texts(root)).toContain('Retry');
    expect(texts(root)).not.toContain('Resend (60s)');

    // Retrying resend successfully starts cooldown
    jest.useFakeTimers();
    (apiClient.post as jest.Mock).mockResolvedValueOnce({ data: {} });
    await act(async () => {
      pressableWithText(root, 'Retry').props.onPress();
    });

    expect(texts(root)).toContain('Resend (60s)');
  });

  it('[Execute] unreachable server during verification shows inline error with Retry, and retrying succeeds', async () => {
    (apiClient.post as jest.Mock).mockRejectedValueOnce({
      isAxiosError: true,
      code: 'ERR_NETWORK',
      message: 'Network Error',
    });
    const root = await mount({ email: 'target@example.com' });

    setInputCode(root, '123456');

    await act(async () => {
      pressableWithText(root, 'Verify').props.onPress();
    });

    expect(texts(root)).toContain('Unable to connect to server.');
    expect(texts(root)).toContain('Retry');

    // Retrying with success
    (apiClient.post as jest.Mock).mockResolvedValueOnce({ data: {} });
    await act(async () => {
      pressableWithText(root, 'Retry').props.onPress();
    });

    expect(mockNavigate).toHaveBeenCalledWith('Login', {
      successMessage: 'Email verified. Sign in.',
    });
  });

  it('[Execute] unreachable server during resend shows inline error with Retry and does not start cooldown', async () => {
    (apiClient.post as jest.Mock).mockRejectedValueOnce({
      isAxiosError: true,
      code: 'ERR_NETWORK',
      message: 'Network Error',
    });
    const root = await mount({ email: 'target@example.com' });

    await act(async () => {
      pressableWithText(root, 'Resend').props.onPress();
    });

    expect(texts(root)).toContain('Unable to connect to server.');
    expect(texts(root)).toContain('Retry');
    expect(texts(root)).not.toContain('Resend (60s)');
  });

  it('[Execute] Back button navigates back', async () => {
    const root = await mount();

    await act(async () => {
      pressableWithText(root, 'Back').props.onPress();
    });

    expect(mockGoBack).toHaveBeenCalledTimes(1);
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
