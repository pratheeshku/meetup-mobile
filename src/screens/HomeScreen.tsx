/**
 * Events feed (DES-MEETUP-MOBILE.md §4.3; R-021).
 *
 * Fetches the public events feed on mount. Pagination beyond page 1 is
 * not built — the brief's Step 3 asks for a fetch-on-mount feed with
 * pull-to-refresh only, not infinite scroll/"load more" (see
 * Implementation Report Known Gaps).
 */
import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { getEvents } from '../api/events';
import Badge from '../components/Badge';
import type { BadgeVariant } from '../components/Badge';
import Card from '../components/Card';
import EmptyState from '../components/EmptyState';
import ErrorView from '../components/ErrorView';
import LoadingView from '../components/LoadingView';
import { colors, spacing, typography } from '../theme/tokens';
import type { Event, RsvpStatus } from '../types/event';
import type { HomeStackParamList } from '../navigation/types';
import { formatEventDate, formatEventTimeRange } from '../utils/formatEventDateTime';

type Props = NativeStackScreenProps<HomeStackParamList, 'EventsList'>;

/**
 * Proposed Assumption: the brief names three badge labels
 * ("Going/Waitlisted/None") for a four-value status enum. `withdrawn` is
 * folded into the "None" label on the list card — a withdrawn user has
 * no active RSVP for feed-display purposes; the detail screen still
 * distinguishes it for button state (Join is offered again).
 */
const RSVP_BADGE_LABEL: Record<RsvpStatus, string> = {
  none: 'None',
  going: 'Going',
  waitlisted: 'Waitlisted',
  withdrawn: 'None',
};

const RSVP_BADGE_VARIANT: Record<RsvpStatus, BadgeVariant> = {
  none: 'neutral',
  going: 'success',
  waitlisted: 'warning',
  withdrawn: 'neutral',
};

export default function HomeScreen({ navigation }: Props): React.JSX.Element {
  const [events, setEvents] = useState<Event[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadEvents = useCallback(async (isRefresh: boolean) => {
    if (isRefresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    setError(null);
    try {
      const response = await getEvents();
      setEvents(response.items);
    } catch {
      setError('Could not load events. Please try again.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadEvents(false);
  }, [loadEvents]);

  if (isLoading) {
    return <LoadingView />;
  }

  if (error) {
    return <ErrorView message={error} onRetry={() => loadEvents(false)} />;
  }

  return (
    <FlatList
      data={events}
      keyExtractor={item => item.id}
      contentContainerStyle={events.length === 0 ? styles.emptyContainer : styles.listContainer}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={() => loadEvents(true)}
          colors={[colors.primary]}
          progressBackgroundColor={colors.surface}
        />
      }
      ListEmptyComponent={<EmptyState title="No events yet" subtitle="Check back soon." />}
      renderItem={({ item }) => (
        <Card
          style={styles.card}
          onPress={() => navigation.navigate('EventDetail', { eventId: item.id })}
        >
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle} numberOfLines={1}>
              {item.title}
            </Text>
            <Badge
              label={RSVP_BADGE_LABEL[item.current_user_rsvp_status]}
              variant={RSVP_BADGE_VARIANT[item.current_user_rsvp_status]}
              style={styles.badge}
            />
          </View>
          <Text style={styles.cardMeta}>
            {item.sport} · {item.location}
          </Text>
          <Text style={styles.cardMeta}>
            {formatEventDate(item.starts_at)} · {formatEventTimeRange(item.starts_at, item.ends_at)}
          </Text>
          <Text style={styles.cardMeta}>
            {item.participant_count}/{item.capacity} going
          </Text>
        </Card>
      )}
    />
  );
}

const styles = StyleSheet.create({
  listContainer: { padding: spacing.md },
  emptyContainer: { flexGrow: 1, justifyContent: 'center' },
  card: { marginBottom: spacing.md },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  cardTitle: { ...typography.h3, color: colors.textPrimary, flexShrink: 1 },
  cardMeta: { ...typography.body, color: colors.textSecondary, marginTop: spacing.xs },
  badge: { marginLeft: spacing.sm },
});
