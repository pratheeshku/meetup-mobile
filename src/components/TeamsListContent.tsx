/**
 * "Tournament teams" section of the Groups screen (DES-MEETUP-ADDENDUM-teams-payments AD-4, TP-05): the teams the caller is an active player
 * of, from `GET /teams/mine`, in the tournament-list card layout. A card opens the team detail (team-screens-remarks AD-1). Loads, empties and
 * fails on its own; the list is read again on every new `reloadKey` (focus, return to the section).
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet } from 'react-native';

import { withCorrelationId } from '../api/correlationId';
import { getMyTeams } from '../api/teams';
import { useT } from '../labels/LabelsContext';
import { colors, spacing } from '../theme/tokens';
import type { Team } from '../types/team';
import EmptyState from './EmptyState';
import ErrorView from './ErrorView';
import { UnifiedTeamCard } from './home/UnifiedCard';
import LoadingView from './LoadingView';

interface Props {
  /** Opens the Create team form (empty state action). */
  onCreateTeam: () => void;
  /** Opens the tournament team detail (team-screens-remarks AD-1, TS-01). */
  onOpenTeam: (teamId: string) => void;
  /** Every new value fetches again with the loading state in place of the old rows. */
  reloadKey?: number;
}

export default function TeamsListContent({ onCreateTeam, onOpenTeam, reloadKey }: Props): React.JSX.Element {
  const t = useT();
  const tRef = useRef(t);
  tRef.current = t;
  const [teams, setTeams] = useState<Team[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (isRefresh: boolean) => {
    if (isRefresh) {
      setIsRefreshing(true);
    } else {
      setTeams([]);
      setIsLoading(true);
    }
    setError(null);
    try {
      setTeams(await withCorrelationId(correlationId => getMyTeams({ correlationId })));
    } catch {
      if (!isRefresh) {
        setError(tRef.current('mob.teams.load_error'));
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load(false);
  }, [load, reloadKey]);

  if (isLoading) {
    return <LoadingView />;
  }
  if (error) {
    return <ErrorView message={error} onRetry={() => load(false)} />;
  }
  return (
    <FlatList
      data={teams}
      keyExtractor={item => item.id}
      contentContainerStyle={teams.length === 0 ? styles.emptyContainer : styles.listContainer}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={() => load(true)}
          colors={[colors.primary]}
          progressBackgroundColor={colors.surface}
        />
      }
      ListEmptyComponent={
        <EmptyState
          title={t('mob.teams.empty_title')}
          subtitle={t('mob.teams.empty_subtitle')}
          actionLabel={t('mob.teams.create')}
          onAction={onCreateTeam}
        />
      }
      renderItem={({ item }) => <UnifiedTeamCard team={item} onPress={() => onOpenTeam(item.id)} />}
    />
  );
}

const styles = StyleSheet.create({
  listContainer: { padding: spacing.md, backgroundColor: colors.background },
  emptyContainer: { flexGrow: 1, justifyContent: 'center', padding: spacing.md, backgroundColor: colors.background },
});
