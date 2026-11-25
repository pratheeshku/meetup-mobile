/**
 * App update gate (DES-MEETUP-ADDENDUM-app-update-prompt 4.3). Wraps the whole app, so when the installed build is
 * below the minimum the blocking screen REPLACES everything under it — navigation and the login screen included —
 * rather than sitting on top of live screens that could still receive focus, touches or the back button. When the
 * build is only below the latest, the dismissible prompt shows over the app.
 *
 * The app renders immediately at launch; the policy check runs alongside it and takes over the screen only if it
 * finds the build is too old.
 */
import React from 'react';

import { useAppUpdate } from '../hooks/useAppUpdate';
import ForceUpdateScreen from '../screens/ForceUpdateScreen';
import AppUpdatePrompt from './AppUpdatePrompt';

export default function ForceUpdateGate({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  const { decision, platform, dismissPrompt } = useAppUpdate();

  if (decision.kind === 'block') {
    return <ForceUpdateScreen storeUrl={decision.storeUrl} platform={platform} />;
  }
  return (
    <>
      {children}
      {decision.kind === 'prompt' ? (
        <AppUpdatePrompt visible platform={platform} storeUrl={decision.storeUrl} onLater={dismissPrompt} />
      ) : null}
    </>
  );
}
