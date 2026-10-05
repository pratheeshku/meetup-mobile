/**
 * Post-action navigation (DES-MEETUP-FEEDBACK-001 C3, AD-3, R-04).
 *
 * After a successful create, edit, cancel or group change, go to the
 * dashboard (Home tab's `EventsList`) and show a short success message. The
 * dashboard refetches when it receives the new `refreshKey`. `pop: true`
 * unwinds the Home stack to the existing dashboard route rather than pushing
 * a second copy. Call only on success; on failure the screen stays on its
 * form and shows the error.
 *
 * Uses the root `navigationRef` so it works from any tab's stack.
 */
import { navigationRef } from '../notifications/notificationRouting';

export function goToDashboard(successMessage: string): void {
  if (!navigationRef.isReady()) {
    return;
  }
  navigationRef.navigate('Home', {
    screen: 'EventsList',
    params: { refreshKey: Date.now(), successMessage },
    pop: true,
  });
}
