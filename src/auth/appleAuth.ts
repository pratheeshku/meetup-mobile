/**
 * Sign in with Apple (iOS native) per DES-MEETUP-ADDENDUM-social-login AD-6, §5.2.
 *
 * Security:
 * - Only authorizationCode is sent to POST /auth/oauth/apple/callback.
 * - identityToken or any other Apple token is NEVER sent or stored (AD-5, AD-6).
 * - Generic user-facing failure message ("Apple sign-in failed. Please try again.");
 *   cancellations are silent.
 */
import { Platform } from 'react-native';
import { appleAuth } from '@invertase/react-native-apple-authentication';

import { getTermsVersion } from './terms';
import { apiClient } from '../api/client';
import { saveTokens } from '../storage/tokens';
import type { AuthResponse } from './types';
import type { UserProfile } from '../types/user';

export class AppleSignInCancelledError extends Error {
  constructor() {
    super('Apple sign-in was cancelled');
    this.name = 'AppleSignInCancelledError';
  }
}

export function isAppleSignInAvailable(): boolean {
  return Platform.OS === 'ios' && Boolean(appleAuth?.isSupported);
}

export async function signIn(): Promise<UserProfile> {
  if (Platform.OS !== 'ios') {
    throw new Error('Apple sign-in is only available on iOS');
  }

  let appleAuthResponse;
  try {
    appleAuthResponse = await appleAuth.performRequest({
      requestedOperation: appleAuth.Operation.LOGIN,
      requestedScopes: [appleAuth.Scope.EMAIL, appleAuth.Scope.FULL_NAME],
    });
  } catch (err: unknown) {
    const error = err as { code?: string | number; message?: string };
    if (
      error?.code === appleAuth.Error?.CANCELED ||
      error?.code === '1001' ||
      error?.code === 1001 ||
      error?.code === 'ERR_REQUEST_CANCELED' ||
      error?.message?.includes('ERR_REQUEST_CANCELED') ||
      error?.message?.includes('canceled') ||
      error?.message?.includes('cancelled')
    ) {
      throw new AppleSignInCancelledError();
    }
    throw new Error('Apple sign-in failed. Please try again.');
  }

  const { authorizationCode, fullName } = appleAuthResponse;
  if (!authorizationCode) {
    throw new Error('Apple sign-in failed. Please try again.');
  }

  let fullNameString: string | undefined;
  if (fullName) {
    const given = fullName.givenName?.trim();
    const family = fullName.familyName?.trim();
    if (given || family) {
      fullNameString = [given, family].filter(Boolean).join(' ');
    }
  }

  const termsVersion = await getTermsVersion();

  const payload: {
    code: string;
    client_kind: 'native';
    full_name?: string;
    terms_version: string;
  } = {
    code: authorizationCode,
    client_kind: 'native',
    terms_version: termsVersion,
  };

  if (fullNameString) {
    payload.full_name = fullNameString;
  }

  try {
    const { data } = await apiClient.post<AuthResponse>(
      '/auth/oauth/apple/callback',
      payload,
    );
    await saveTokens(data.access_token, data.refresh_token);
    return data.user;
  } catch {
    // Never expose server detail
    throw new Error('Apple sign-in failed. Please try again.');
  }
}
