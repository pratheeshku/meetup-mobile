import React from 'react';
import { StyleSheet, TextInput } from 'react-native';
declare const require: (id: string) => any;
declare const __dirname: string;

const fs = require('fs');
const path = require('path');

import { apiClient } from '../../api/client';
import { act, pressables, pressableWithText, renderAsync, texts } from '../../test-utils/render';
import type { Instance } from '../../test-utils/render';
import RegisterScreen from '../RegisterScreen';

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

const mount = (): Promise<Instance> =>
  renderAsync(
    <RegisterScreen
      {...({
        navigation: mockNavigation,
        route: {},
      } as unknown as React.ComponentProps<typeof RegisterScreen>)}
    />,
  );

const fillForm = (
  root: Instance,
  {
    nickname = 'testuser',
    displayName = 'Test User',
    email = 'user@example.com',
    password = 'password123',
  }: {
    nickname?: string;
    displayName?: string;
    email?: string;
    password?: string;
  } = {},
): void => {
  act(() => {
    const inputs = root.findAllByType(TextInput);
    const nicknameInput = inputs.find(i => i.props.placeholder === 'Nickname');
    const displayNameInput = inputs.find(i => i.props.placeholder === 'Display Name');
    const emailInput = inputs.find(i => i.props.placeholder === 'Email');
    const passwordInput = inputs.find(i => i.props.placeholder === 'Password');

    if (nicknameInput) nicknameInput.props.onChangeText(nickname);
    if (displayNameInput) displayNameInput.props.onChangeText(displayName);
    if (emailInput) emailInput.props.onChangeText(email);
    if (passwordInput) passwordInput.props.onChangeText(password);
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

describe('RegisterScreen', () => {
  it('[Execute] posts exactly the four fields to /auth/signup (email, password, display_name, nickname) and no other fields', async () => {
    (apiClient.post as jest.Mock).mockResolvedValueOnce({ data: {} });
    const root = await mount();

    fillForm(root, {
      nickname: 'johndoe',
      displayName: 'John Doe',
      email: 'john@example.com',
      password: 'password123',
    });

    await act(async () => {
      pressableWithText(root, 'Register').props.onPress();
    });

    expect(apiClient.post).toHaveBeenCalledTimes(1);
    expect(apiClient.post).toHaveBeenCalledWith('/auth/signup', {
      email: 'john@example.com',
      password: 'password123',
      display_name: 'John Doe',
      nickname: 'johndoe',
    });

    const sentBody = (apiClient.post as jest.Mock).mock.calls[0][1];
    expect(Object.keys(sentBody).sort()).toEqual([
      'display_name',
      'email',
      'nickname',
      'password',
    ]);
    expect(sentBody).not.toHaveProperty('mobile_number');
    expect(sentBody).not.toHaveProperty('mobile_consent_version');
    expect(sentBody).not.toHaveProperty('invitation_token');
    expect(sentBody).not.toHaveProperty('ref');
    expect(sentBody).not.toHaveProperty('event_id');
    expect(sentBody).not.toHaveProperty('invite');
  });

  it('[Source check] confirms a mobile number field does not exist in the screen source or rendered tree', async () => {
    const root = await mount();
    const inputs = root.findAllByType(TextInput);
    for (const input of inputs) {
      const placeholder = (input.props.placeholder ?? '').toLowerCase();
      expect(placeholder).not.toContain('mobile');
      expect(placeholder).not.toContain('phone');
    }

    const sourcePath = path.resolve(__dirname, '../RegisterScreen.tsx');
    const sourceContent = fs.readFileSync(sourcePath, 'utf8');
    expect(sourceContent).not.toContain('mobile_number');
    expect(sourceContent).not.toContain('mobile_consent');
  });

  it('[Execute] toggles password visibility with show/hide button', async () => {
    const root = await mount();
    const inputs = root.findAllByType(TextInput);
    const passwordInput = inputs.find(i => i.props.placeholder === 'Password')!;

    expect(passwordInput.props.secureTextEntry).toBe(true);

    await act(async () => {
      pressableWithText(root, 'Show').props.onPress();
    });

    expect(passwordInput.props.secureTextEntry).toBe(false);
    expect(texts(root)).toContain('Hide');

    await act(async () => {
      pressableWithText(root, 'Hide').props.onPress();
    });

    expect(passwordInput.props.secureTextEntry).toBe(true);
    expect(texts(root)).toContain('Show');
  });

  it('[Execute] navigates to Verify screen with email on successful sign-up (200)', async () => {
    (apiClient.post as jest.Mock).mockResolvedValueOnce({ data: {} });
    const root = await mount();

    fillForm(root, { email: 'newuser@example.com' });

    await act(async () => {
      pressableWithText(root, 'Register').props.onPress();
    });

    expect(mockNavigate).toHaveBeenCalledWith('Verify', { email: 'newuser@example.com' });
  });

  it('[Execute] shows inline error for 400 "Email already registered" and offers "Sign in" and "Verify your email" links', async () => {
    (apiClient.post as jest.Mock).mockRejectedValueOnce({
      isAxiosError: true,
      response: {
        status: 400,
        data: { detail: 'Email already registered' },
      },
    });
    const root = await mount();

    fillForm(root, { email: 'existing@example.com' });

    await act(async () => {
      pressableWithText(root, 'Register').props.onPress();
    });

    const renderedTexts = texts(root);
    expect(renderedTexts).toContain('Email already registered');
    expect(renderedTexts).toContain('Sign in');
    expect(renderedTexts).toContain('Verify your email');

    // Test "Sign in" link
    await act(async () => {
      pressableWithText(root, 'Sign in').props.onPress();
    });
    expect(mockNavigate).toHaveBeenCalledWith('Login');

    // Test "Verify your email" link
    await act(async () => {
      pressableWithText(root, 'Verify your email').props.onPress();
    });
    expect(mockNavigate).toHaveBeenCalledWith('Verify', { email: 'existing@example.com' });
  });

  it('[Execute] shows inline error for 400 "Nickname already taken"', async () => {
    (apiClient.post as jest.Mock).mockRejectedValueOnce({
      isAxiosError: true,
      response: {
        status: 400,
        data: { detail: 'Nickname already taken' },
      },
    });
    const root = await mount();

    fillForm(root);

    await act(async () => {
      pressableWithText(root, 'Register').props.onPress();
    });

    expect(texts(root)).toContain('Nickname already taken');
  });

  it('[Execute] shows inline error for 400 "Password must be at least 8 characters long"', async () => {
    (apiClient.post as jest.Mock).mockRejectedValueOnce({
      isAxiosError: true,
      response: {
        status: 400,
        data: { detail: 'Password must be at least 8 characters long' },
      },
    });
    const root = await mount();

    fillForm(root, { password: 'validPassword123' });

    await act(async () => {
      pressableWithText(root, 'Register').props.onPress();
    });

    expect(texts(root)).toContain('Password must be at least 8 characters long');
  });

  it('[Execute] shows "Too many attempts. Try again in a minute." on 429 rate limit', async () => {
    (apiClient.post as jest.Mock).mockRejectedValueOnce({
      isAxiosError: true,
      response: {
        status: 429,
        data: { detail: 'Rate limit exceeded' },
      },
    });
    const root = await mount();

    fillForm(root, { email: 'ratelimit@example.com' });

    await act(async () => {
      pressableWithText(root, 'Register').props.onPress();
    });

    expect(texts(root)).toContain('Too many attempts. Try again in a minute.');
  });

  it('[Execute] shows "Something went wrong. Try again." with Retry button on server error (500), and retrying succeeds', async () => {
    (apiClient.post as jest.Mock).mockRejectedValueOnce({
      isAxiosError: true,
      response: {
        status: 500,
        data: { detail: 'Internal Server Error' },
      },
    });
    const root = await mount();

    fillForm(root, { email: 'servererr@example.com' });

    await act(async () => {
      pressableWithText(root, 'Register').props.onPress();
    });

    expect(texts(root)).toContain('Something went wrong. Try again.');
    expect(texts(root)).toContain('Retry');

    // Retrying succeeds
    (apiClient.post as jest.Mock).mockResolvedValueOnce({ data: {} });
    await act(async () => {
      pressableWithText(root, 'Retry').props.onPress();
    });

    expect(mockNavigate).toHaveBeenCalledWith('Verify', { email: 'servererr@example.com' });
  });

  it('[Execute] shows inline error with Retry when server is unreachable, and retrying succeeds', async () => {
    (apiClient.post as jest.Mock).mockRejectedValueOnce({
      isAxiosError: true,
      code: 'ERR_NETWORK',
      message: 'Network Error',
    });
    const root = await mount();

    fillForm(root, { email: 'network@example.com' });

    await act(async () => {
      pressableWithText(root, 'Register').props.onPress();
    });

    expect(texts(root)).toContain('Unable to connect to server.');
    expect(texts(root)).toContain('Retry');

    // Retry should succeed
    (apiClient.post as jest.Mock).mockResolvedValueOnce({ data: {} });
    await act(async () => {
      pressableWithText(root, 'Retry').props.onPress();
    });

    expect(mockNavigate).toHaveBeenCalledWith('Verify', { email: 'network@example.com' });
  });

  it('[Execute] verifies all interactive pressables have a touch target height of at least 44px', async () => {
    (apiClient.post as jest.Mock).mockRejectedValueOnce({
      isAxiosError: true,
      response: {
        status: 400,
        data: { detail: 'Email already registered' },
      },
    });
    const root = await mount();

    fillForm(root);
    await act(async () => {
      pressableWithText(root, 'Register').props.onPress();
    });

    const buttons = pressables(root);
    expect(buttons.length).toBeGreaterThanOrEqual(4);

    for (const b of buttons) {
      const flattened = resolveStyle(b);
      const minHeight = flattened.minHeight;
      const height = flattened.height;
      const effectiveHeight = minHeight ?? height ?? 0;
      expect(effectiveHeight).toBeGreaterThanOrEqual(44);
    }
  });
});
