/**
 * Events feed (DES-MEETUP-MOBILE.md §4.3; R-021).
 *
 * Fetches the public events feed on mount. Pagination beyond page 1 is
 * not built — the brief's Step 3 asks for a fetch-on-mount feed with
 * pull-to-refresh only, not infinite scroll/"load more" (see
 * Implementation Report Known Gaps).
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { getEvents } from '../api/events';
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
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error}</Text>
        <Pressable style={styles.retryButton} onPress={() => loadEvents(false)}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <FlatList
      data={events}
      keyExtractor={item => item.id}
      contentContainerStyle={events.length === 0 ? styles.emptyContainer : styles.listContainer}
      refreshControl={
        <RefreshControl refreshing={isRefreshing} onRefresh={() => loadEvents(true)} />
      }
      ListEmptyComponent={
        <View style={styles.centered}>
          <Text style={styles.emptyText}>No events yet. Check back soon.</Text>
        </View>
      }
      renderItem={({ item }) => (
        <Pressable
          style={styles.card}
          onPress={() => navigation.navigate('EventDetail', { eventId: item.id })}
        >
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle} numberOfLines={1}>
              {item.title}
            </Text>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{RSVP_BADGE_LABEL[item.current_user_rsvp_status]}</Text>
            </View>
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
        </Pressable>
      )}
    />
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  listContainer: { padding: 16 },
  emptyContainer: { flexGrow: 1, justifyContent: 'center' },
  emptyText: { fontSize: 16, color: '#666', textAlign: 'center' },
  errorText: { fontSize: 16, color: '#c0392b', textAlign: 'center', marginBottom: 16 },
  retryButton: {
    backgroundColor: '#2563eb',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  retryButtonText: { color: '#fff', fontWeight: '600' },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#eee',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  cardTitle: { fontSize: 17, fontWeight: '700', flexShrink: 1 },
  cardMeta: { fontSize: 14, color: '#555', marginTop: 2 },
  badge: {
    backgroundColor: '#2563eb',
    borderRadius: 6,
    paddingVertical: 3,
    paddingHorizontal: 8,
    marginLeft: 8,
  },
  badgeText: { color: '#fff', fontSize: 12, fontWeight: '600' },
});
