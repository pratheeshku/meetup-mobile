/**
 * Tournaments list (DES-MEETUP-MOBILE.md §4.5, §7.7; R-041) — content
 * unchanged; as of DES-MEETUP-ADDENDUM-dashboard.md AD-15 it is the
 * "Tournaments" segment of the Games screen instead of a screen of its own.
 * It loads, empties and fails on its own (`getTournaments()`).
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';

import { getTournaments } from '../api/tournaments';
import EmptyState from './EmptyState';
import ErrorView from './ErrorView';
import LoadingView from './LoadingView';
import SegmentedSwitch from './SegmentedSwitch';
import { useAuth } from '../auth/AuthContext';
import { UnifiedTournamentCard } from './home/UnifiedCard';
import { colors, spacing } from '../theme/tokens';
import type { Tournament } from '../types/tournament';
import { useT } from '../labels/LabelsContext';

interface Props {
  onOpenTournament: (tournamentId: string) => void;
  /** Set by a successful tournament create; each new value refetches once. */
  refreshKey?: number;
  /** Reports whether the list is still on its first-load spinner. */
  onLoadingChange?: (loading: boolean) => void;
  /**
   * Access-consistency AC-10: every new value (screen focus, app foreground,
   * the segment being opened) fetches again with the loading state in place of
   * the old rows. Loads once on mount whatever its value.
   */
  reloadKey?: number;
}

export default function TournamentsListContent({
  onOpenTournament,
  refreshKey,
  onLoadingChange,
  reloadKey,
}: Props): React.JSX.Element {
  const t = useT();
  const { user } = useAuth();
  const userIdRef = useRef(user?.id);
  userIdRef.current = user?.id;
  const tRef = useRef(t);
  tRef.current = t;
  const [viewFilter, setViewFilter] = useState<'active' | 'all'>('active');
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadTournaments = useCallback(async (isRefresh: boolean) => {
    if (isRefresh) {
      setIsRefreshing(true);
    } else {
      // A fresh load never shows the previous rows (AC-10).
      setTournaments([]);
      setIsLoading(true);
    }
    setError(null);
    try {
      const response = await getTournaments({
        currentUserId: userIdRef.current,
        view: viewFilter,
      });
      setTournaments(response.items);
    } catch {
      setError(tRef.current('mob.tournament.list_error'));
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [viewFilter]);

  useEffect(() => {
    loadTournaments(false);
  }, [loadTournaments, reloadKey]);

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

  let body: React.JSX.Element;
  if (isLoading) {
    body = <LoadingView />;
  } else if (error) {
    body = <ErrorView message={error} onRetry={() => loadTournaments(false)} />;
  } else {
    body = (
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
          <UnifiedTournamentCard
            tournament={item}
            onPress={() => onOpenTournament(item.id)}
          />
        )}
      />
    );
  }

  return (
    <View style={styles.root}>
      <View style={styles.viewToggleWrap}>
        <SegmentedSwitch
          options={[
            { value: 'active', label: t('mob.closure.filter.active_tournaments') },
            { value: 'all', label: t('mob.closure.filter.all_tournaments') },
          ]}
          value={viewFilter}
          onChange={setViewFilter}
        />
      </View>
      {body}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  viewToggleWrap: { paddingHorizontal: spacing.md, paddingTop: spacing.sm },
  listContainer: { padding: spacing.md },
  emptyContainer: { flexGrow: 1, justifyContent: 'center' },
});

