import React from 'react';
import { TextInput } from 'react-native';

import { resetPasswordWithToken } from '../../auth/emailAuth';
import { consumeAuthLanding, getResetToken, setResetToken, _resetLinkStoreForTesting } from '../../links/linkStore';
import { act, pressableWithText, renderAsync, texts } from '../../test-utils/render';
import type { Instance } from '../../test-utils/render';
import ResetPasswordScreen from '../ResetPasswordScreen';

const TOKEN = 'Zk3-_abcdefghijklmnopqrstuvwxyz0123456789ABCDE';
const PASSWORD = 'correct horse battery';

const mockAuth: { user: unknown; signOut: jest.Mock } = { user: null, signOut: jest.fn() };
jest.mock('../../auth/AuthContext', () => ({ useAuth: () => mockAuth }));
jest.mock('../../auth/emailAuth', () => ({ resetPasswordWithToken: jest.fn() }));

const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({ navigate: mockNavigate }),
}));

const mount = (): Promise<Instance> => renderAsync(<ResetPasswordScreen />);

const type = (root: Instance, index: number, value: string): void => {
  act(() => {
    root.findAllByType(TextInput)[index].props.onChangeText(value);
  });
};

const submit = async (root: Instance): Promise<void> => {
  await act(async () => {
    await pressableWithText(root, 'Set new password').props.onPress();
  });
};

beforeEach(() => {
  jest.clearAllMocks();
  _resetLinkStoreForTesting();
  mockAuth.user = null;
  mockAuth.signOut.mockReset().mockResolvedValue(undefined);
  setResetToken(TOKEN);
});

describe('ResetPasswordScreen (AD-7)', () => {
  it('shows the new password and confirmation fields and one submit button', async () => {
    const root = await mount();
    expect(texts(root)).toEqual(expect.arrayContaining(['Set a new password', 'Set new password']));
    const inputs = root.findAllByType(TextInput);
    expect(inputs).toHaveLength(2);
    expect(inputs.map(i => i.props.placeholder)).toEqual(['New password', 'Confirm new password']);
    expect(inputs.every(i => i.props.secureTextEntry === true)).toBe(true);
  });

  it('rejects a short password and a mismatch locally, without calling the server', async () => {
    const root = await mount();
    type(root, 0, 'short');
    type(root, 1, 'short');
    await submit(root);
    expect(texts(root)).toContain('Your password must be at least 8 characters.');

    type(root, 0, PASSWORD);
    type(root, 1, `${PASSWORD}!`);
    await submit(root);
    expect(texts(root)).toContain('The two passwords do not match.');
    expect(resetPasswordWithToken).not.toHaveBeenCalled();
  });

  it('success while signed out: calls the endpoint with the link token, drops it, returns to Login with a confirmation', async () => {
    (resetPasswordWithToken as jest.Mock).mockResolvedValue(undefined);
    const root = await mount();
    type(root, 0, PASSWORD);
    type(root, 1, PASSWORD);
    await submit(root);

    expect(resetPasswordWithToken).toHaveBeenCalledWith(TOKEN, PASSWORD);
    expect(getResetToken()).toBeNull();
    expect(mockNavigate).toHaveBeenCalledWith('Login', {
      successMessage: 'Password updated. Sign in with your new password.',
    });
    expect(mockAuth.signOut).not.toHaveBeenCalled();
  });

  it('success while signed in: the device is signed out and the Sign In stack starts at Login with the confirmation', async () => {
    mockAuth.user = { id: 'u1' };
    (resetPasswordWithToken as jest.Mock).mockResolvedValue(undefined);
    const root = await mount();
    type(root, 0, PASSWORD);
    type(root, 1, PASSWORD);
    await submit(root);

    expect(mockAuth.signOut).toHaveBeenCalledTimes(1);
    expect(consumeAuthLanding()).toBe('reset_done');
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('every failure shows ONE message with a way back to Forgot password', async () => {
    const root = await mount();
    for (const error of [
      Object.assign(new Error('x'), { response: { status: 400, data: { detail: 'This link is invalid or has expired.' } } }),
      Object.assign(new Error('x'), { response: { status: 429 } }),
      new Error('Network Error'),
    ]) {
      (resetPasswordWithToken as jest.Mock).mockRejectedValueOnce(error);
      type(root, 0, PASSWORD);
      type(root, 1, PASSWORD);
      await submit(root);
      expect(texts(root).filter(text => text === 'This link is invalid or has expired.')).toHaveLength(1);
    }
    expect(mockNavigate).not.toHaveBeenCalled();

    await act(async () => {
      await pressableWithText(root, 'Request a new link').props.onPress();
    });
    expect(mockNavigate).toHaveBeenCalledWith('ForgotPassword');
    expect(getResetToken()).toBeNull();
  });

  it('signed in, "Request a new link" signs out and starts the Sign In stack at Forgot password', async () => {
    mockAuth.user = { id: 'u1' };
    (resetPasswordWithToken as jest.Mock).mockRejectedValue(new Error('boom'));
    const root = await mount();
    type(root, 0, PASSWORD);
    type(root, 1, PASSWORD);
    await submit(root);
    await act(async () => {
      await pressableWithText(root, 'Request a new link').props.onPress();
    });
    expect(mockAuth.signOut).toHaveBeenCalledTimes(1);
    expect(consumeAuthLanding()).toBe('forgot');
  });

  it('with no token in memory (app restarted) it is a failure at once and the endpoint is never called', async () => {
    _resetLinkStoreForTesting();
    const root = await mount();
    expect(texts(root)).toContain('This link is invalid or has expired.');
    type(root, 0, PASSWORD);
    type(root, 1, PASSWORD);
    await submit(root);
    expect(resetPasswordWithToken).not.toHaveBeenCalled();
  });

  it('drops the token when the screen is left', async () => {
    const { create } = jest.requireActual('react-test-renderer');
    let renderer!: { unmount: () => void };
    act(() => {
      renderer = create(<ResetPasswordScreen />);
    });
    expect(getResetToken()).toBe(TOKEN);
    act(() => renderer.unmount());
    expect(getResetToken()).toBeNull();
  });

  it('never logs the token or the password', async () => {
    const spies = (['log', 'warn', 'error', 'info'] as const).map(level => jest.spyOn(console, level).mockImplementation(() => {}));
    (resetPasswordWithToken as jest.Mock).mockRejectedValue(new Error('boom'));
    const root = await mount();
    type(root, 0, PASSWORD);
    type(root, 1, PASSWORD);
    await submit(root);
    const logged = JSON.stringify(spies.flatMap(spy => spy.mock.calls));
    expect(logged).not.toContain(TOKEN);
    expect(logged).not.toContain(PASSWORD);
    spies.forEach(spy => spy.mockRestore());
  });
});
