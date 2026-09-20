/**
 * User-facing auth messages shared between `AuthContext` (decides when) and
 * `LoginScreen` (renders it).
 */

/**
 * Shown on the Sign In screen after a signed-in session ended because the
 * API client could not keep it alive (`auth-expired`) — e.g. the access token
 * expired and there is no refresh token to renew it with.
 */
export const SESSION_EXPIRED_MESSAGE = 'Session expired. Please sign in again.';
