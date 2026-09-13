/**
 * Shared auth-domain types (DES-MEETUP-MOBILE.md §3.10, §4.2, §7.1, §7.2).
 *
 * `UserProfile` used to be defined locally in this file. It's now the
 * canonical type in `src/types/user.ts` (consolidated with the profile
 * module's independently-grown definition of the same `GET /users/me`
 * response — see `docs/reports/IMPL-DES-MEETUP-MOBILE-types-consolidation.md`).
 * Re-exported here only via the `AuthResponse` field below; import
 * `UserProfile` itself from `../types/user`.
 *
 * Proposed Assumption (carried over, unchanged by the consolidation):
 * the exact response body of `GET /users/me`, `POST /auth/login`,
 * `POST /auth/register`, and `POST /auth/oauth/google/callback` is not
 * specified in the local design excerpt — §7.1/§7.2 list method/path/
 * auth-required/notes only, no body schemas, and the parent backend
 * design (DES-MEETUP.md) is not available in this repo (same gap
 * already recorded against `POST /auth/refresh` in `src/api/client.ts`).
 */
import type { UserProfile } from '../types/user';

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
