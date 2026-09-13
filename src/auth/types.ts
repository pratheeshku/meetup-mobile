/**
 * Shared auth-domain types (DES-MEETUP-MOBILE.md §3.10, §4.2, §7.1, §7.2).
 *
 * Proposed Assumption: the exact response body of `GET /users/me`,
 * `POST /auth/login`, `POST /auth/register`, and
 * `POST /auth/oauth/google/callback` is not specified in the local
 * design excerpt — §7.1/§7.2 list method/path/auth-required/notes only,
 * no body schemas, and the parent backend design (DES-MEETUP.md) is not
 * available in this repo (same gap already recorded against
 * `POST /auth/refresh` in `src/api/client.ts`).
 *
 * `UserProfile.role` is the one field §3.10 explicitly requires
 * ("`useRole()` hook backed by `GET /users/me`'s `role` field", gating
 * organiser/admin screens per R-017/R-082). The rest of the shape is a
 * conservative, minimal read of what the login/register/profile screens
 * in this task need. Correct against the actual backend contract on
 * conformance review.
 */
export interface UserProfile {
  id: string;
  email: string;
  nickname: string;
  role: 'participant' | 'organiser' | 'admin';
}

/**
 * Shared response shape for the three endpoints that establish a session:
 * `POST /auth/oauth/google/callback`, `POST /auth/login`, and
 * `POST /auth/register` (§7.1) all return fresh tokens plus the
 * signed-in user's profile in one response.
 */
export interface AuthResponse {
  access_token: string;
  refresh_token: string;
  user: UserProfile;
}
