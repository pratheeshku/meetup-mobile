/**
 * "Recommended for You": public games the user hasn't joined and doesn't
 * organise. The selector (`getRecommendedGames`) does the filtering; this
 * section supplies the copy and shows the first three.
 */
import React from 'react';

import EventListSection from './EventListSection';
import type { EventListSectionProps } from './EventListSection';

export default function RecommendedSection(props: EventListSectionProps): React.JSX.Element {
  return (
    <EventListSection
      {...props}
      title="Recommended for You"
      subtitle="Public games you haven't joined yet"
      emptyMessage="No public games to recommend right now."
    />
  );
}
