/**
 * Email/password auth (DES-MEETUP-MOBILE.md §3.5, §4.2; R-012).
 *
 * Passwords are passed directly through to the API call and never
 * stored, logged, or held anywhere beyond the call itself (R-111, P10).
 * Callers (`AuthContext`) hold the password only in a screen's local
 * input state for the duration of the active input session.
 */
import { apiClient } from '../api/client';
import { saveTokens } from '../storage/tokens';
import type { AuthResponse } from './types';
import type { UserProfile } from '../types/user';

/** Signs in with email/password (R-012) and stores the returned tokens. */
export async function login(email: string, password: string): Promise<UserProfile> {
  const { data } = await apiClient.post<AuthResponse>('/auth/login', { email, password });
  await saveTokens(data.access_token, data.refresh_token);
  return data.user;
}

/** Registers a new account (R-012) and stores the returned tokens. */
export async function register(
  email: string,
  password: string,
  nickname: string,
): Promise<UserProfile> {
  const { data } = await apiClient.post<AuthResponse>('/auth/register', {
    email,
    password,
    nickname,
  });
  await saveTokens(data.access_token, data.refresh_token);
  return data.user;
}
