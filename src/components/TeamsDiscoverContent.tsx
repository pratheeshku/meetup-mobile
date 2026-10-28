/**
 * Discover list of Groups > Tournament teams (DES-MEETUP-ADDENDUM-team-screens-remarks AD-2, TS-03; amendment A1). Reads `GET /teams` (the
 * server's visibility rule: public teams, plus a private team the caller is invited to), removes the teams already in Mine
 * (`GET /teams/mine`) and lists the rest in the tournament-list card layout, with a client-side sport filter and name search. `player_count`
 * is returned only by `/teams/mine`, so the cards show no count (null hides the line). A private team shows "Invite only". Unbounded list: OI-2.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';

import { withCorrelationId } from '../api/correlationId';
import { getMyTeams, getTeams } from '../api/teams';
import { useT } from '../labels/LabelsContext';
import { loadSportsCatalog, sportLookupKey } from '../sports/catalog';
import { colors, spacing } from '../theme/tokens';
import type { Sport } from '../types/sport';
import type { Team } from '../types/team';
import EmptyState from './EmptyState';
import ErrorView from './ErrorView';
import { UnifiedTeamCard } from './home/UnifiedCard';
import LoadingView from './LoadingView';
import OptionChips from './OptionChips';
import type { ChipOption } from './OptionChips';
import TextField from './TextField';

interface Props {
  onOpenTeam: (teamId: string) => void;
  /** Every new value reads again with the loading state in place of the old rows. */
  reloadKey?: number;
}

const ALL = '__all__';

export default function TeamsDiscoverContent({ onOpenTeam, reloadKey }: Props): React.JSX.Element {
  const t = useT();
  const tRef = useRef(t);
  tRef.current = t;
  const [teams, setTeams] = useState<Team[]>([]);
  const [sports, setSports] = useState<Sport[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [sport, setSport] = useState<string>(ALL);

  const load = useCallback(async (isRefresh: boolean) => {
    if (isRefresh) {
      setIsRefreshing(true);
    } else {
      setTeams([]);
      setIsLoading(true);
    }
    setError(null);
    try {
      // One correlation id for the one user action (opening or refreshing Discover).
      const [visible, mine] = await withCorrelationId(correlationId =>
        Promise.all([getTeams({ correlationId }), getMyTeams({ correlationId })]),
      );
      const mineIds = new Set(mine.map(team => team.id));
      setTeams(visible.filter(team => !mineIds.has(team.id)));
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

  // Display names for the sport chips; a failed catalog read falls back to the raw sport key.
  useEffect(() => {
    let cancelled = false;
    loadSportsCatalog().then(
      list => !cancelled && setSports(list),
      () => undefined,
    );
    return () => {
      cancelled = true;
    };
  }, []);

  const sportOptions = useMemo<ChipOption<string>[]>(() => {
    const seen = new Map<string, string>();
    for (const team of teams) {
      const key = sportLookupKey(team.sport);
      if (!seen.has(key)) {
        const record = sports.find(s => sportLookupKey(s.name) === key || (s.slug ? sportLookupKey(s.slug) === key : false));
        seen.set(key, record?.display_name ?? team.sport);
      }
    }
    return [
      { value: ALL, label: t('mob.dashboard.sports_all') },
      ...Array.from(seen, ([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label)),
    ];
  }, [teams, sports, t]);

  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return teams.filter(
      team =>
        (sport === ALL || sportLookupKey(team.sport) === sport) && (needle === '' || team.name.toLowerCase().includes(needle)),
    );
  }, [teams, sport, query]);

  if (isLoading) {
    return <LoadingView />;
  }
  if (error) {
    return <ErrorView message={error} onRetry={() => load(false)} />;
  }
  return (
    <FlatList
      data={shown}
      keyExtractor={item => item.id}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={shown.length === 0 ? styles.emptyContainer : styles.listContainer}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={() => load(true)}
          colors={[colors.primary]}
          progressBackgroundColor={colors.surface}
        />
      }
      ListHeaderComponent={
        teams.length > 0 ? (
          <View style={styles.filters}>
            <TextField
              value={query}
              onChangeText={setQuery}
              placeholder={t('mob.teams.discover_search')}
              accessibilityLabel={t('mob.teams.discover_search')}
              autoCorrect={false}
              testID="discover-search"
            />
            {sportOptions.length > 2 ? (
              <View style={styles.chips}>
                <OptionChips options={sportOptions} value={sport} onChange={setSport} />
              </View>
            ) : null}
          </View>
        ) : null
      }
      ListEmptyComponent={<EmptyState title={t('mob.teams.discover_empty')} />}
      renderItem={({ item }) => <UnifiedTeamCard team={item} onPress={() => onOpenTeam(item.id)} />}
    />
  );
}

const styles = StyleSheet.create({
  listContainer: { padding: spacing.md, backgroundColor: colors.background },
  emptyContainer: { flexGrow: 1, justifyContent: 'center', padding: spacing.md, backgroundColor: colors.background },
  filters: { marginBottom: spacing.md },
  chips: { marginTop: spacing.sm },
});
