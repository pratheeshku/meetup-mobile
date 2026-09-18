/**
 * Shared body of the Home "Upcoming" and "Recommended" sections: title,
 * muted subtitle, "View all →" link, up to `MAX_SECTION_ITEMS` `EventCard`s,
 * or a centred muted empty message.
 *
 * "View all →" — Proposed Assumption: the brief names the link but no
 * destination screen exists (and the old flat events list is gone), so it
 * expands the section in place to show every match ("Show less" collapses
 * it). It is only rendered when there is something more to reveal, so it is
 * never a dead control. A dedicated list screen is a follow-up.
 */
import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, spacing, typography } from '../../theme/tokens';
import type { Event } from '../../types/event';
import { MAX_SECTION_ITEMS } from '../../utils/homeDashboard';
import EventCard from '../EventCard';
import TextLink from '../TextLink';

export interface EventListSectionProps {
  /** Already filtered and ordered for this section; unbounded. */
  events: Event[];
  onEventPress: (event: Event) => void;
}

interface EventListSectionBaseProps extends EventListSectionProps {
  title: string;
  subtitle: string;
  emptyMessage: string;
}

export default function EventListSection({
  title,
  subtitle,
  emptyMessage,
  events,
  onEventPress,
}: EventListSectionBaseProps): React.JSX.Element {
  const [expanded, setExpanded] = useState(false);
  const hasMore = events.length > MAX_SECTION_ITEMS;
  const visible = expanded ? events : events.slice(0, MAX_SECTION_ITEMS);

  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.title} accessibilityRole="header">
            {title}
          </Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </View>
        {hasMore ? (
          <TextLink
            label={expanded ? 'Show less' : 'View all →'}
            onPress={() => setExpanded(current => !current)}
          />
        ) : null}
      </View>
      {events.length === 0 ? (
        <Text style={styles.empty}>{emptyMessage}</Text>
      ) : (
        visible.map(event => (
          <EventCard key={event.id} event={event} onPress={() => onEventPress(event)} />
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: spacing.lg },
  header: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: spacing.md },
  headerText: { flex: 1 },
  title: { ...typography.h3, fontWeight: '700', color: colors.textPrimary },
  subtitle: { ...typography.caption, color: colors.textMuted, marginTop: spacing.xs },
  empty: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
    paddingVertical: spacing.lg,
  },
});
