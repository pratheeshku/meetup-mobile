/**
 * Email/password auth (DES-MEETUP-MOBILE.md §3.5, §4.2; R-012;
 * DES-MEETUP-ADDENDUM-email-auth AD-1, AD-2, AD-3, AD-5).
 *
 * Passwords, codes, and tokens are passed directly through to the API call
 * and are never stored, logged, or held anywhere beyond the call itself (R-111, P10).
 */
import { apiClient } from '../api/client';
import { saveTokens } from '../storage/tokens';
import { getTermsVersion } from './terms';
import type { AuthResponse } from './types';
import type { UserProfile } from '../types/user';

export interface SignupParams {
  email: string;
  password: string;
  display_name: string;
  nickname: string;
  terms_version?: string;
  /**
   * NE-01: E.164 number and the consent version it was given under. Sent only when both are given; with the admin flag off the screen gives
   * neither and the body is exactly as before. PII: never logged.
   */
  mobile_number?: string;
  mobile_consent_version?: string;
}

/** Signs in with email/password (R-012) and stores the returned tokens. */
export async function login(email: string, password: string): Promise<UserProfile> {
  const { data } = await apiClient.post<AuthResponse>('/auth/login', { email, password });
  await saveTokens(data.access_token, data.refresh_token);
  return data.user;
}

/**
 * Signs up a new account (DES-MEETUP-ADDENDUM-email-auth AD-5, D1).
 * Returns no tokens; user must verify email.
 */
export async function signup(params: SignupParams): Promise<void> {
  const termsVersion = params.terms_version ?? (await getTermsVersion());
  await apiClient.post('/auth/signup', {
    email: params.email,
    password: params.password,
    display_name: params.display_name,
    nickname: params.nickname,
    terms_version: termsVersion,
    ...(params.mobile_number && params.mobile_consent_version
      ? { mobile_number: params.mobile_number, mobile_consent_version: params.mobile_consent_version }
      : {}),
  });
}

/**
 * `POST /auth/complete-signup` (NE-01, AD-3): turns a social `signup_ticket` and the person's number into an account and a session, and stores
 * the tokens. The ticket and the number go only into the request body: never logged, never kept. A 400 means the ticket is invalid, expired
 * or used (sign in again); a 422 or 409 does not use the ticket up.
 */
export async function completeSignup(params: {
  ticket: string;
  mobile_number: string;
  mobile_consent_version: string;
}): Promise<UserProfile> {
  const { data } = await apiClient.post<AuthResponse>('/auth/complete-signup', {
    ticket: params.ticket,
    mobile_number: params.mobile_number,
    mobile_consent_version: params.mobile_consent_version,
  });
  await saveTokens(data.access_token, data.refresh_token);
  return data.user;
}

/**
 * Completes email verification with the 6-digit code.
 * (DES-MEETUP-ADDENDUM-email-auth AD-5).
 */
export async function verifyEmail(email: string, code: string): Promise<void> {
  await apiClient.post('/auth/verify-email', { email, code });
}

/**
 * Resends a verification code for an unverified account.
 * (DES-MEETUP-ADDENDUM-email-auth AD-1, AD-5).
 */
export async function resendVerification(email: string): Promise<void> {
  await apiClient.post('/auth/resend-verification', { email });
}

export interface PasswordResetRequestResponse {
  detail?: string;
  code?: string;
}

/**
 * Requests a password reset link sent to the user's email.
 * (DES-MEETUP-ADDENDUM-email-auth AD-2, AD-5, AD-7).
 * For Google-only accounts, returns { detail, code: 'oauth_only' }.
 */
export async function requestPasswordReset(
  email: string,
): Promise<PasswordResetRequestResponse | undefined> {
  const { data } = await apiClient.post<PasswordResetRequestResponse>(
    '/auth/reset-password-request',
    { email },
  );
  return data;
}
