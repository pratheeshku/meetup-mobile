/**
 * Force-update gate (approved deviation). Wraps the whole app, so when the
 * installed build is below the backend's minimum the blocking screen REPLACES
 * everything under it — navigation and the login screen included — rather
 * than sitting on top of live screens that could still receive focus, touches
 * or the back button.
 *
 * The app renders immediately at launch; the policy check runs alongside it
 * and takes over the screen only if it finds the build is too old.
 */
import React from 'react';

import { useForceUpdate } from '../hooks/useForceUpdate';
import ForceUpdateScreen from '../screens/ForceUpdateScreen';

export default function ForceUpdateGate({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  const { blocked, storeUrl } = useForceUpdate();

  if (blocked) {
    return <ForceUpdateScreen storeUrl={storeUrl} />;
  }
  return <>{children}</>;
}
