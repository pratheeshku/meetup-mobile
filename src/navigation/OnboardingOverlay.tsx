/**
 * Shows the first-run interstitial over the app when the server says it is
 * required (DES-MEETUP-ADDENDUM-profile-onboarding.md AD-4). Rendered as an
 * opaque full-screen overlay (so the app's navigation state, including
 * notification deep links, stays intact underneath). Never shown while the
 * check is pending, on error, or on timeout (fail-open). Once finished or
 * dismissed it does not reappear for the same user in this session.
 */
import React, { useState } from 'react';

import { useOnboardingRequired } from '../hooks/useOnboardingRequired';
import OnboardingScreen from '../screens/OnboardingScreen';

export default function OnboardingOverlay({ userId }: { userId: string }): React.JSX.Element | null {
  const check = useOnboardingRequired(userId);
  const [doneFor, setDoneFor] = useState<string | null>(null);

  if (!check || !check.required || doneFor === userId) {
    return null;
  }
  return (
    <OnboardingScreen hasMobileNumber={check.hasMobileNumber} onDone={() => setDoneFor(userId)} />
  );
}
