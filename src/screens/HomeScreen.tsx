/**
 * Events feed (DES-MEETUP-MOBILE.md §4.3; R-021).
 *
 * Fetches the public events feed on mount. Pagination beyond page 1 is
 * not built — the brief's Step 3 asks for a fetch-on-mount feed with
 * pull-to-refresh only, not infinite scroll/"load more" (see
 * Implementation Report Known Gaps).
 */
import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { getEvents } from '../api/events';
import EmptyState from '../components/EmptyState';
import ErrorView from '../components/ErrorView';
import EventCard from '../components/EventCard';
import LoadingView from '../components/LoadingView';
import { colors, spacing } from '../theme/tokens';
import type { Event } from '../types/event';
import type { HomeStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<HomeStackParamList, 'EventsList'>;

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
        <EventCard
          event={item}
          onPress={() => navigation.navigate('EventDetail', { eventId: item.id })}
        />
      )}
    />
  );
}

const styles = StyleSheet.create({
  listContainer: { padding: spacing.md },
  emptyContainer: { flexGrow: 1, justifyContent: 'center' },
});
