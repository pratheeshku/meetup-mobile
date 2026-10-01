/**
 * Email/password auth (DES-MEETUP-MOBILE.md §3.5, §4.2; R-012;
 * DES-MEETUP-ADDENDUM-email-auth AD-1, AD-2, AD-3, AD-5).
 *
 * Passwords, codes, and tokens are passed directly through to the API call
 * and are never stored, logged, or held anywhere beyond the call itself (R-111, P10).
 */
import { apiClient } from '../api/client';
import { saveTokens } from '../storage/tokens';
import type { AuthResponse } from './types';
import type { UserProfile } from '../types/user';

export interface SignupParams {
  email: string;
  password: string;
  display_name: string;
  nickname: string;
}

/** Signs in with email/password (R-012) and stores the returned tokens. */
export async function login(email: string, password: string): Promise<UserProfile> {
  const { data } = await apiClient.post<AuthResponse>('/auth/login', { email, password });
  await saveTokens(data.access_token, data.refresh_token);
  return data.user;
}

/**
 * Signs up a new account (DES-MEETUP-ADDENDUM-email-auth AD-5, D1).
 * Exactly four fields sent. Returns no tokens; user must verify email.
 */
export async function signup(params: SignupParams): Promise<void> {
  await apiClient.post('/auth/signup', {
    email: params.email,
    password: params.password,
    display_name: params.display_name,
    nickname: params.nickname,
  });
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

/**
 * Requests a password reset link sent to the user's email.
 * (DES-MEETUP-ADDENDUM-email-auth AD-2, AD-5).
 */
export async function requestPasswordReset(email: string): Promise<void> {
  await apiClient.post('/auth/reset-password-request', { email });
}

let resendEndpointAvailable = true;

/** Returns whether the resend verification endpoint is available. */
export function isResendAvailable(): boolean {
  return resendEndpointAvailable;
}

/** Toggles the resend verification availability flag (for tests/environment checks). */
export function setResendAvailable(available: boolean): void {
  resendEndpointAvailable = available;
}

/**
 * Legacy wrapper: signs up and returns void (does not auto-login).
 * @deprecated Use `signup` directly.
 */
export async function register(
  email: string,
  password: string,
  nickname: string,
): Promise<void> {
  await signup({
    email,
    password,
    display_name: nickname,
    nickname,
  });
}
