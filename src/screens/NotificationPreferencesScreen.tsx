/**
 * Notification Preferences screen (DES-MEETUP-MOBILE.md §4.8, §7.6; R-076).
 * The list itself lives in `NotificationPreferencesList` so the first-run
 * onboarding step renders the same component (profile-onboarding addendum
 * D11); this screen is that list under the Profile stack's header.
 */
import React from 'react';

import NotificationPreferencesList from '../components/NotificationPreferencesList';

export default function NotificationPreferencesScreen(): React.JSX.Element {
  return <NotificationPreferencesList />;
}
