/**
 * Google Sign-In (DES-MEETUP-MOBILE.md §3.5, §5.1, §5.2; R-010, R-013,
 * R-030).
 *
 * DEVIATION FROM §3.5 — see the Implementation Report's Deviations
 * section for the full write-up and required architect ratification.
 * Summary: §3.5 specifies Android Credential Manager
 * (`androidx.credentials`) "through the Universal Sign-In API of
 * `@react-native-google-signin/google-signin`", describing that as the
 * non-deprecated replacement for the package's classic `GoogleSignin`
 * module. Verified empirically against the actual installed package
 * (v16.1.5, the exact package the task brief names):
 *   - Its own README states: "This is the free (public) version...
 *     It uses the legacy Google Sign-In SDK on Android."
 *   - Its Android native source
 *     (`RNGoogleSigninModule.java`) imports
 *     `com.google.android.gms.auth.api.signin.GoogleSignInClient` /
 *     `GoogleSignInOptions` — not `androidx.credentials.CredentialManager`.
 *   - The Credential-Manager-backed flow the design describes is only
 *     available via "Universal Sign In" (universal-sign-in.com), a
 *     separate commercial product from the same author — not a mode of
 *     the free `@react-native-google-signin/google-signin` package, and
 *     not the package this task installed.
 * This module therefore uses the free package's classic
 * `GoogleSignin.configure()/signIn()/signOut()` API. It still fully
 * satisfies R-010's actual behavioural requirement (native
 * account-picker completion, no browser redirect, no WebView) at zero
 * added cost. User-confirmed 2026-09-13: proceed on this basis, deviation
 * recorded for the architect to formally ratify against §3.5's wording.
 *
 * Security (R-111, P10): the ID token and access/refresh tokens are
 * never logged here.
 */
import {
  GoogleSignin,
  isSuccessResponse,
  isCancelledResponse,
} from '@react-native-google-signin/google-signin';

import { ENV } from '../../config/env';
import { apiClient } from '../api/client';
import { saveTokens, clearTokens } from '../storage/tokens';
import { withCorrelationId } from '../api/correlationId';
import { deregisterDeviceToken } from '../notifications/fcm';
import type { AuthResponse } from './types';
import type { UserProfile } from '../types/user';

let isConfigured = false;

/**
 * Configures the native Google Sign-In module. Idempotent — safe to call
 * on every app start (`AuthContext`'s session-restore effect) as well as
 * lazily before the first sign-in attempt.
 */
export function configureGoogleSignIn(): void {
  if (isConfigured) {
    return;
  }
  GoogleSignin.configure({
    webClientId: ENV.GOOGLE_WEB_CLIENT_ID,
  });
  isConfigured = true;
}

/**
 * Thrown when the user dismisses the native account picker. Distinct
 * from a real failure so callers (`AuthContext`, `LoginScreen`) can treat
 * it as a silent no-op instead of surfacing an inline error.
 */
export class GoogleSignInCancelledError extends Error {
  constructor() {
    super('Google sign-in was cancelled');
    this.name = 'GoogleSignInCancelledError';
  }
}

/**
 * Signs the user in with Google (R-010) and converges onto the same
 * session-establishment sequence as email/password (§3.5): exchange the
 * Google ID token for platform tokens, store them, return the profile.
 */
export async function signIn(): Promise<UserProfile> {
  configureGoogleSignIn();

  // Recommended precondition for the classic GoogleSignInClient flow on
  // Android — without Google Play Services, `signIn()` fails opaquely.
  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

  const response = await GoogleSignin.signIn();

  if (isCancelledResponse(response)) {
    throw new GoogleSignInCancelledError();
  }
  if (!isSuccessResponse(response) || !response.data.idToken) {
    // Fail-closed per §3.5: no usable credential means sign-in cannot
    // complete — never partially proceed.
    throw new Error('Google sign-in did not return a usable credential');
  }

  const { data } = await apiClient.post<AuthResponse>('/auth/oauth/google/callback', {
    id_token: response.data.idToken,
  });

  await saveTokens(data.access_token, data.refresh_token);
  return data.user;
}

/**
 * Signs the user out (R-013), regardless of which method they originally
 * signed in with. Order matches §3.5/§5.2 exactly: de-register the FCM
 * device token first (best-effort, R-030/OI-2), then revoke the session
 * server-side, then clear the local Google session, then clear Keystore.
 */
export async function signOut(): Promise<void> {
  await withCorrelationId(async correlationId => {
    try {
      await deregisterDeviceToken({ correlationId });
    } catch {
      // Best-effort only — accepted T1 residual risk (§5.2, OI-2). A
      // failed de-registration must never block the rest of sign-out.
    }
    await apiClient.post('/auth/logout', undefined, { correlationId });
  });

  try {
    await GoogleSignin.signOut();
  } catch {
    // Harmless no-op if the current session never used Google sign-in.
  }

  await clearTokens();
}
