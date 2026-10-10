/**
 * Tournaments list (DES-MEETUP-MOBILE.md §4.5, §7.7; R-041) — content
 * unchanged; as of DES-MEETUP-ADDENDUM-dashboard.md AD-15 it is the
 * "Tournaments" segment of the Games screen instead of a screen of its own.
 * It loads, empties and fails on its own (`getTournaments()`).
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { getTournaments } from '../api/tournaments';
import Badge from './Badge';
import type { BadgeVariant } from './Badge';
import Card from './Card';
import EmptyState from './EmptyState';
import ErrorView from './ErrorView';
import LoadingView from './LoadingView';
import { colors, spacing, typography } from '../theme/tokens';
import type { Tournament, TournamentRegistrationStatus } from '../types/tournament';
import { useSportDisplayName } from '../utils/labels';
import { useT } from '../labels/LabelsContext';
import type { LabelKey } from '../labels/fallbackLabels';

interface Props {
  onOpenTournament: (tournamentId: string) => void;
  /** Set by a successful tournament create; each new value refetches once. */
  refreshKey?: number;
  /** Reports whether the list is still on its first-load spinner. */
  onLoadingChange?: (loading: boolean) => void;
}

const REGISTRATION_BADGE_LABEL_KEY: Record<TournamentRegistrationStatus, LabelKey> = {
  none: 'mob.tournament.reg_none',
  registered: 'mob.tournament.reg_registered',
  withdrawn: 'mob.tournament.reg_withdrawn',
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
  const t = useT();
  return (
    <Card style={styles.card} onPress={onPress}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle} numberOfLines={1}>
          {tournament.name}
        </Text>
        <Badge
          label={t(REGISTRATION_BADGE_LABEL_KEY[tournament.current_user_registration_status])}
          variant={REGISTRATION_BADGE_VARIANT[tournament.current_user_registration_status]}
          style={styles.badge}
        />
      </View>
      <Text style={styles.cardMeta}>
        {sportLabel} · {tournament.format}
      </Text>
      <Text style={styles.cardMeta}>
        {t('mob.tournament.status_line', { status: tournament.status })}
      </Text>
      <Text style={styles.cardMeta}>
        {t('mob.tournament.registered_line', {
          count: tournament.participant_count,
          max: tournament.max_participants,
        })}
      </Text>
    </Card>
  );
}

export default function TournamentsListContent({
  onOpenTournament,
  refreshKey,
  onLoadingChange,
}: Props): React.JSX.Element {
  const t = useT();
  const tRef = useRef(t);
  tRef.current = t;
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
      setError(tRef.current('mob.tournament.list_error'));
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadTournaments(false);
  }, [loadTournaments]);

  useEffect(() => {
    onLoadingChange?.(isLoading);
  }, [isLoading, onLoadingChange]);

  // Create Group/Tournament pops back here with a fresh `refreshKey` on
  // success; re-fetch once per new key (the initial mount load is above).
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
        <EmptyState
          title={t('mob.tournament.list_empty_title')}
          subtitle={t('mob.tournament.list_empty_subtitle')}
        />
      }
      renderItem={({ item }) => (
        <TournamentRow
          tournament={item}
          onPress={() => onOpenTournament(item.id)}
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
