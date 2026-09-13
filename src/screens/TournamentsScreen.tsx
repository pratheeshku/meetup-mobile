/**
 * Tournaments list (DES-MEETUP-MOBILE.md §4.5, §7.7; R-041).
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

import { getTournaments } from '../api/tournaments';
import type { Tournament, TournamentRegistrationStatus } from '../types/tournament';
import type { TournamentsStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<TournamentsStackParamList, 'TournamentsList'>;

const REGISTRATION_BADGE_LABEL: Record<TournamentRegistrationStatus, string> = {
  none: 'Not Registered',
  registered: 'Registered',
  withdrawn: 'Withdrawn',
};

export default function TournamentsScreen({ navigation }: Props): React.JSX.Element {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadTournaments = useCallback(async (isRefresh: boolean) => {
    if (isRefresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    setError(null);
    try {
      const response = await getTournaments();
      setTournaments(response.items);
    } catch {
      setError('Could not load tournaments. Please try again.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadTournaments(false);
  }, [loadTournaments]);

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
        <Pressable style={styles.retryButton} onPress={() => loadTournaments(false)}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <FlatList
      data={tournaments}
      keyExtractor={item => item.id}
      contentContainerStyle={
        tournaments.length === 0 ? styles.emptyContainer : styles.listContainer
      }
      refreshControl={
        <RefreshControl refreshing={isRefreshing} onRefresh={() => loadTournaments(true)} />
      }
      ListEmptyComponent={
        <View style={styles.centered}>
          <Text style={styles.emptyText}>No tournaments yet. Check back soon.</Text>
        </View>
      }
      renderItem={({ item }) => (
        <Pressable
          style={styles.card}
          onPress={() => navigation.navigate('TournamentDetail', { tournamentId: item.id })}
        >
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle} numberOfLines={1}>
              {item.name}
            </Text>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>
                {REGISTRATION_BADGE_LABEL[item.current_user_registration_status]}
              </Text>
            </View>
          </View>
          <Text style={styles.cardMeta}>
            {item.sport} · {item.format}
          </Text>
          <Text style={styles.cardMeta}>Status: {item.status}</Text>
          <Text style={styles.cardMeta}>
            {item.participant_count}/{item.max_participants} registered
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
