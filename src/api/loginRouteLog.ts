/**
 * One non-sensitive line per decision that sends the user to the login
 * screen. Cause kind and HTTP status only — never a token, cookie, or email.
 */
export type LoginRouteCause =
  | 'refresh-rejected'
  | 'refresh-no-session'
  | 'retried-request-401';

export function logRouteToLogin(cause: LoginRouteCause, status?: number): void {
  const statusText = typeof status === 'number' ? ` status=${status}` : '';
  console.log(`[auth] routing to login cause=${cause}${statusText}`);
}
