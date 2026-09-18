/**
 * Placeholder for "Create Event" (DES-MEETUP-MOBILE.md §4.3 lists a
 * Create/Edit Event screen; it is not built yet). Exists so the Home
 * "+ Create Game" button leads somewhere honest instead of being a
 * disabled dead control. Replace this screen's body when real event
 * creation is implemented — the route (`CreateGame`) stays.
 */
import React from 'react';

import EmptyState from '../components/EmptyState';

export default function CreateGameScreen(): React.JSX.Element {
  return (
    <EmptyState
      title="Create Game — Coming Soon"
      subtitle="Creating games from the app is still being built. For now, you can create one on the web."
    />
  );
}
