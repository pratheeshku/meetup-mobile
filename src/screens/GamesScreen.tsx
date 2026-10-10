/**
 * Games tab screen (DES-MEETUP-ADDENDUM-dashboard.md AD-5, AD-15): one screen
 * with a segmented switch "Games | Tournaments", default Games.
 *
 * - Tournaments segment: the existing tournaments list, unchanged
 *   (`TournamentsListContent`: `getTournaments()` + registration badges).
 * - Games segment: ONE list of future, non-cancelled games — the My games
 *   set plus the Open (Recommended) set — earliest first, via the same
 *   `utils/gameLists` module Home uses. Scope chips All / Mine / Open sit
 *   under the switch and combine with the same sport chips as Home (AD-9:
 *   multi-select, skill default on first render, never overwritten).
 *   Rows reuse Home's `GameRow` and add one status badge.
 *
 * Each segment keeps its own state when you switch (both stay mounted once
 * visited, the hidden one is just not displayed) and loads, empties and
 * fails independently.
 *
 * Entry points (Home): My games View all -> scope Mine; Recommended View all
 * -> scope Open; My games tile -> scope All. They arrive as the `scope` +
 * `entryKey` route params and always land on the Games segment.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { getEvents } from '../api/events';
import { withCorrelationId } from '../api/correlationId';
import { getProfile } from '../api/profile';
import { getSports } from '../api/sports';
import { useAuth } from '../auth/AuthContext';
import { UnifiedGameCard } from '../components/home/UnifiedCard';
import {
  COPY,
  EmptyText,
  InlineError,
  SkeletonRows,
} from '../components/home/SectionParts';
import SportChipsRow from '../components/home/SportChipsRow';
import SegmentedSwitch from '../components/SegmentedSwitch';
import TournamentsListContent from '../components/TournamentsListContent';
import WipStrip from '../components/WipStrip';
import { useResource } from '../hooks/useResource';
import { useSportFilter } from '../hooks/useSportFilter';
import type { GamesScope, TournamentsStackParamList } from '../navigation/types';
import { dash, dashRadius, dashSize } from '../theme/dashboardTheme';
import { spacing, typography } from '../theme/tokens';
import type { Event } from '../types/event';
import { filteredEmptyMessage, getGameBadge, selectGames } from '../utils/gameLists';
import { useT } from '../labels/LabelsContext';
import type { LabelKey } from '../labels/fallbackLabels';
import { usePerfRender, usePerfScreen } from '../hooks/usePerfScreen';

type Props = NativeStackScreenProps<TournamentsStackParamList, 'TournamentsList'>;

type Segment = 'games' | 'tournaments';

const SEGMENTS: ReadonlyArray<{ value: Segment; labelKey: LabelKey }> = [
  { value: 'games', labelKey: 'mob.games.segment_games' },
  { value: 'tournaments', labelKey: 'mob.games.segment_tournaments' },
];

const SCOPES: ReadonlyArray<{ value: GamesScope; labelKey: LabelKey; a11yKey: LabelKey }> = [
  { value: 'all', labelKey: 'mob.games.scope_all', a11yKey: 'mob.games.scope_all_a11y' },
  { value: 'mine', labelKey: 'mob.games.scope_mine', a11yKey: 'mob.games.scope_mine_a11y' },
  { value: 'open', labelKey: 'mob.games.scope_open', a11yKey: 'mob.games.scope_open_a11y' },
];

const SCOPE_EMPTY: Record<GamesScope, LabelKey> = {
  all: COPY.gamesEmpty,
  mine: COPY.gamesEmpty,
  open: COPY.recommendedEmpty,
};

function ScopeChips({
  value,
  onChange,
}: {
  value: GamesScope;
  onChange: (scope: GamesScope) => void;
}): React.JSX.Element {
  const t = useT();
  return (
    <View style={styles.scopeRow}>
      {SCOPES.map(scope => {
        const selected = scope.value === value;
        return (
          <Pressable
            key={scope.value}
            accessibilityRole="button"
            accessibilityLabel={t(scope.a11yKey)}
            accessibilityState={{ selected }}
            onPress={() => onChange(scope.value)}
            style={({ pressed }) => [
              styles.scopeChip,
              selected ? styles.scopeChipSelected : null,
              pressed ? styles.pressed : null,
            ]}
          >
            <Text style={[styles.scopeText, selected ? styles.scopeTextSelected : null]}>
              {t(scope.labelKey)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function GamesSegment({
  scope,
  onScopeChange,
  onOpenEvent,
}: {
  scope: GamesScope;
  onScopeChange: (scope: GamesScope) => void;
  onOpenEvent: (event: Event) => void;
}): React.JSX.Element {
  const { user } = useAuth();
  const t = useT();
  const userId = user?.id;

  const events = useResource(options => getEvents(undefined, options));
  const sports = useResource(options => getSports(options));
  const profile = useResource(options => getProfile(options));
  const { load: loadEvents } = events;
  const { load: loadSports } = sports;
  const { load: loadProfile } = profile;
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadAll = useCallback(
    () =>
      withCorrelationId(correlationId =>
        Promise.all([
          loadEvents(correlationId),
          loadSports(correlationId),
          loadProfile(correlationId),
        ]).then(() => undefined),
      ),
    [loadEvents, loadSports, loadProfile],
  );

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await loadAll();
    } finally {
      setIsRefreshing(false);
    }
  }, [loadAll]);

  const filter = useSportFilter(sports, profile.data?.skill_levels, profile.status !== 'loading');

  const games = useMemo(() => {
    const feed = events.data?.items;
    if (!feed) {
      return undefined;
    }
    return selectGames(feed, scope, { userId, sportKeys: filter.selected, now: Date.now() });
  }, [events.data, scope, userId, filter.selected]);

  const emptyCopy =
    filter.selected.length > 0
      ? filteredEmptyMessage(filter.selected, filter.options, t)
      : t(SCOPE_EMPTY[scope]);

  const retry = useCallback(() => {
    withCorrelationId(correlationId => loadEvents(correlationId));
  }, [loadEvents]);

  let body: React.JSX.Element;
  if (events.status === 'error') {
    body = (
      <View style={styles.pad}>
        <InlineError message={t(COPY.gamesError)} onRetry={retry} />
      </View>
    );
  } else if (!games) {
    body = (
      <View style={styles.pad}>
        <SkeletonRows count={3} testID="games-skeleton" />
      </View>
    );
  } else {
    body = (
      <FlatList
        testID="games-list"
        data={games}
        keyExtractor={event => event.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            colors={[dash.brand]}
            progressBackgroundColor={dash.card}
          />
        }
        ListEmptyComponent={<EmptyText>{emptyCopy}</EmptyText>}
        renderItem={({ item }) => (
          <UnifiedGameCard
            event={item}
            badge={getGameBadge(item, userId)}
            onPress={() => onOpenEvent(item)}
          />
        )}
      />
    );
  }

  return (
    <View style={styles.flex}>
      <View style={styles.filters}>
        <ScopeChips value={scope} onChange={onScopeChange} />
        <View style={styles.sportsRow}>
          <SportChipsRow
            options={filter.options}
            selected={filter.selected}
            onToggle={filter.toggle}
            isLoading={filter.isLoading}
          />
        </View>
      </View>
      {body}
    </View>
  );
}

export default function GamesScreen({ navigation, route }: Props): React.JSX.Element {
  const t = useT();
  const [segment, setSegment] = useState<Segment>('games');
  const [scope, setScope] = useState<GamesScope>(route.params?.scope ?? 'all');
  // Tournaments mounts the first time it is shown, then stays mounted.
  const [tournamentsVisited, setTournamentsVisited] = useState(false);

  // ── Perf: screen timing ────────────────────────────────────────────────────
  usePerfRender('GamesScreen');
  // GamesScreen is "loaded" when either segment is not loading. Approximate:
  // always false (no top-level loading state) so first_content_ms = time to focus.
  usePerfScreen('GamesScreen', false);

  // Home entry points: land on Games with the requested scope.
  const entryKey = route.params?.entryKey;
  const routeScope = route.params?.scope;
  const routeSegment = route.params?.segment;
  const lastEntryKey = useRef(entryKey);
  useEffect(() => {
    if (entryKey !== undefined && entryKey !== lastEntryKey.current) {
      lastEntryKey.current = entryKey;
      setScope(routeScope ?? 'all');
      if (routeSegment) {
        if (routeSegment === 'tournaments') {
          setTournamentsVisited(true);
        }
        setSegment(routeSegment);
      } else {
        setSegment('games');
      }
    } else if (routeSegment) {
      if (routeSegment === 'tournaments') {
        setTournamentsVisited(true);
      }
      setSegment(routeSegment);
    }
  }, [entryKey, routeScope, routeSegment]);

  // Create Tournament lands here with a fresh `refreshKey`.
  const refreshKey = route.params?.refreshKey;
  useEffect(() => {
    if (refreshKey !== undefined) {
      setTournamentsVisited(true);
      setSegment('tournaments');
    }
  }, [refreshKey]);

  const changeSegment = useCallback((next: Segment) => {
    if (next === 'tournaments') {
      setTournamentsVisited(true);
    }
    setSegment(next);
  }, []);

  const openEvent = useCallback(
    (event: Event) =>
      navigation.getParent()?.navigate('Home', {
        screen: 'EventDetail',
        params: { eventId: event.id },
        initial: false,
      }),
    [navigation],
  );

  return (
    <View style={styles.screen}>
      <View style={styles.switchWrap}>
        <SegmentedSwitch
          options={SEGMENTS.map(option => ({ value: option.value, label: t(option.labelKey) }))}
          value={segment}
          onChange={changeSegment}
        />
      </View>
      <View style={[styles.flex, segment === 'games' ? null : styles.hidden]}>
        <GamesSegment scope={scope} onScopeChange={setScope} onOpenEvent={openEvent} />
      </View>
      {tournamentsVisited ? (
        <View style={[styles.flex, segment === 'tournaments' ? null : styles.hidden]}>
          <WipStrip labelKey="mob.wip.banner_text" />
          <TournamentsListContent
            refreshKey={refreshKey}
            onOpenTournament={tournamentId =>
              navigation.navigate('TournamentDetail', { tournamentId })
            }
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: dash.page },
  flex: { flex: 1 },
  hidden: { display: 'none' },
  switchWrap: { padding: spacing.md, paddingBottom: spacing.sm },
  filters: { paddingHorizontal: spacing.md },
  sportsRow: { marginTop: spacing.sm, marginBottom: spacing.sm },
  pad: { paddingHorizontal: spacing.md },
  listContent: { padding: spacing.md, paddingTop: spacing.sm },
  scopeRow: { flexDirection: 'row', gap: spacing.sm },
  scopeChip: {
    minHeight: dashSize.touchTarget,
    minWidth: dashSize.touchTarget,
    paddingHorizontal: spacing.md,
    borderRadius: dashRadius.chip,
    borderWidth: 1,
    borderColor: dash.cardBorder,
    backgroundColor: dash.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scopeChipSelected: { backgroundColor: dash.brand, borderColor: dash.brand },
  pressed: { opacity: 0.8 },
  scopeText: { ...typography.bodyBold, color: dash.text },
  scopeTextSelected: { color: dash.white },
});
