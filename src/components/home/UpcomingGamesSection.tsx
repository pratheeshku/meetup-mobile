/**
 * "Your Upcoming Games": events the user is going to / waitlisted for,
 * soonest first. The selector (`getUpcomingGames`) does the filtering and
 * ordering; this section supplies the copy and shows the first three.
 */
import React from 'react';

import EventListSection from './EventListSection';
import type { EventListSectionProps } from './EventListSection';

export default function UpcomingGamesSection(props: EventListSectionProps): React.JSX.Element {
  return (
    <EventListSection
      {...props}
      title="Your Upcoming Games"
      subtitle="Games you've already registered for"
      emptyMessage="No upcoming games yet — join one below or create your own."
    />
  );
}
