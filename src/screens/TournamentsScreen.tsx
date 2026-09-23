/**
 * Tournaments list (DES-MEETUP-MOBILE.md §4.5, §7.7; R-041).
 */
import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { getTournaments } from '../api/tournaments';
import Badge from '../components/Badge';
import type { BadgeVariant } from '../components/Badge';
import Card from '../components/Card';
import EmptyState from '../components/EmptyState';
import ErrorView from '../components/ErrorView';
import LoadingView from '../components/LoadingView';
import { colors, spacing, typography } from '../theme/tokens';
import type { Tournament, TournamentRegistrationStatus } from '../types/tournament';
import { useSportDisplayName } from '../utils/labels';
import type { TournamentsStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<TournamentsStackParamList, 'TournamentsList'>;

const REGISTRATION_BADGE_LABEL: Record<TournamentRegistrationStatus, string> = {
  none: 'Not Registered',
  registered: 'Registered',
  withdrawn: 'Withdrawn',
};

const REGISTRATION_BADGE_VARIANT: Record<TournamentRegistrationStatus, BadgeVariant> = {
  none: 'neutral',
  registered: 'success',
  withdrawn: 'warning',
};

/**
 * A `FlatList` `renderItem` callback isn't itself a component React tracks
 * hook state for, so `useSportDisplayName` (BUG-M02) can't be called
 * directly inside one — extracted into its own component instead, one per
 * row, which `renderItem` just instantiates.
 */
function TournamentRow({
  tournament,
  onPress,
}: {
  tournament: Tournament;
  onPress: () => void;
}): React.JSX.Element {
  const sportLabel = useSportDisplayName(tournament.sport);
  return (
    <Card style={styles.card} onPress={onPress}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle} numberOfLines={1}>
          {tournament.name}
        </Text>
        <Badge
          label={REGISTRATION_BADGE_LABEL[tournament.current_user_registration_status]}
          variant={REGISTRATION_BADGE_VARIANT[tournament.current_user_registration_status]}
          style={styles.badge}
        />
      </View>
      <Text style={styles.cardMeta}>
        {sportLabel} · {tournament.format}
      </Text>
      <Text style={styles.cardMeta}>Status: {tournament.status}</Text>
      <Text style={styles.cardMeta}>
        {tournament.participant_count}/{tournament.max_participants} registered
      </Text>
    </Card>
  );
}

export default function TournamentsScreen({ navigation, route }: Props): React.JSX.Element {
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

  // Create Group/Tournament pops back here with a fresh `refreshKey` on
  // success; re-fetch once per new key (the initial mount load is above).
  const refreshKey = route.params?.refreshKey;
  useEffect(() => {
    if (refreshKey !== undefined) {
      loadTournaments(true);
    }
  }, [refreshKey, loadTournaments]);

  // Direct create entry point removed (Create Flow Amendment, §4.3/§4.5,
  // architect-approved 2026-09-22): tournament creation moved into the
  // Home tab's merged Create Game screen (Tournament toggle) — this
  // tab's own header no longer has a "+" of its own. This screen still
  // re-fetches via `refreshKey` when a tournament is created there (see
  // the effect above).

  if (isLoading) {
    return <LoadingView />;
  }

  if (error) {
    return <ErrorView message={error} onRetry={() => loadTournaments(false)} />;
  }

  return (
    <FlatList
      data={tournaments}
      keyExtractor={item => item.id}
      contentContainerStyle={
        tournaments.length === 0 ? styles.emptyContainer : styles.listContainer
      }
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={() => loadTournaments(true)}
          colors={[colors.primary]}
          progressBackgroundColor={colors.surface}
        />
      }
      ListEmptyComponent={
        <EmptyState title="No tournaments yet" subtitle="Check back soon." />
      }
      renderItem={({ item }) => (
        <TournamentRow
          tournament={item}
          onPress={() => navigation.navigate('TournamentDetail', { tournamentId: item.id })}
        />
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
