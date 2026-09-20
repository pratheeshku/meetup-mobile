/**
 * Sign In screen: shows the session-expired notice when `AuthContext` reports
 * one, and nothing when it does not. The Google failure message is unchanged.
 */
import React from 'react';
import { GoogleSigninButton } from '@react-native-google-signin/google-signin';

import { GoogleSignInCancelledError } from '../../auth/googleAuth';
import { act, renderAsync, texts } from '../../test-utils/render';
import type { Instance } from '../../test-utils/render';
import LoginScreen from '../LoginScreen';

type Props = React.ComponentProps<typeof LoginScreen>;

const mockAuth = {
  sessionExpired: false,
  signInWithGoogle: jest.fn(),
  signInWithEmail: jest.fn(),
};
jest.mock('../../auth/AuthContext', () => ({ useAuth: () => mockAuth }));
jest.mock('../../auth/googleAuth', () => ({
  GoogleSignInCancelledError: class CancelledStub extends Error {},
}));

const mount = (): Promise<Instance> =>
  renderAsync(<LoginScreen {...({ navigation: { navigate: jest.fn() }, route: {} } as unknown as Props)} />);

beforeEach(() => {
  mockAuth.sessionExpired = false;
  mockAuth.signInWithGoogle.mockReset();
  mockAuth.signInWithEmail.mockReset();
});

describe('LoginScreen session-expired notice', () => {
  it('shows "Session expired. Please sign in again." when the session expired', async () => {
    mockAuth.sessionExpired = true;

    expect(texts(await mount())).toContain('Session expired. Please sign in again.');
  });

  it('shows no notice on a normal visit', async () => {
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

  it('shows the failure message for a real failure', async () => {
    mockAuth.signInWithGoogle.mockRejectedValue(new Error('boom'));
    const root = await mount();

    await pressGoogle(root);

    expect(texts(root)).toContain('Google sign-in failed. Please try again.');
  });

  it('stays silent when the user cancels the account picker', async () => {
    mockAuth.signInWithGoogle.mockRejectedValue(new GoogleSignInCancelledError());
    const root = await mount();

    await pressGoogle(root);

    expect(texts(root)).not.toContain('Google sign-in failed. Please try again.');
  });

  it('shows no failure message when sign-in succeeds', async () => {
    mockAuth.signInWithGoogle.mockResolvedValue(undefined);
    const root = await mount();

    await pressGoogle(root);

    expect(texts(root)).not.toContain('Google sign-in failed. Please try again.');
  });
});
