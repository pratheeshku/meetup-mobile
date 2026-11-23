/**
 * Games played / hosted / won list (DES-MEETUP-ADDENDUM-priority1-nov23 P1-03). Opened from the Home stats strip.
 *
 * One list from `GET /users/me/stats/{stat}`: the closed games and tournaments behind that count, newest first.
 * A search box filters by name on the server (debounced). A row opens the game or the tournament detail.
 * The server decides what belongs in the list; the app never recomputes it.
 *
 * Row layout follows the dashboard game row (sport tile, title, date and venue) with a Game / Tournament chip in
 * place of the going count. Theme tokens only; fixed-size tile.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { getMyStatItems, type StatItem, type StatKind } from '../api/profile';
import { withCorrelationId } from '../api/correlationId';
import EmptyState from '../components/EmptyState';
import ErrorView from '../components/ErrorView';
import LoadingView from '../components/LoadingView';
import { SportIcon } from '../components/icons/DashboardIcons';
import { useT } from '../labels/LabelsContext';
import type { LabelKey } from '../labels/fallbackLabels';
import type { HomeStackParamList } from '../navigation/types';
import { navigationRef } from '../notifications/notificationRouting';
import { useSportVisual } from '../sports/catalog';
import { sportPalette } from '../sports/style';
import { dash, dashRadius, dashSize } from '../theme/dashboardTheme';
import { borderWidth, colors, radius, spacing, typography } from '../theme/tokens';
import { formatRowDate } from '../utils/formatGameTime';

type Props = NativeStackScreenProps<HomeStackParamList, 'StatGames'>;

export const STAT_TITLE_KEYS: Record<StatKind, LabelKey> = {
  played: 'mob.stats.title_played',
  hosted: 'mob.stats.title_hosted',
  won: 'mob.stats.title_won',
};

const SEARCH_DEBOUNCE_MS = 300;
const PAGE_SIZE = 100;

function StatRow({ item, onPress }: { item: StatItem; onPress: () => void }): React.JSX.Element {
  const t = useT();
  const sport = useSportVisual(item.sport);
  const tileColor = sportPalette(sport.color).chip;
  const kindText = t(item.kind === 'tournament' ? 'mob.stats.kind_tournament' : 'mob.stats.kind_game');
  const dateLine = [formatRowDate(item.starts_at), item.venue_name ?? ''].filter(Boolean).join(' · ');
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${item.title}, ${dateLine}, ${kindText}`}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed ? styles.pressed : null]}
      testID={`stat-row-${item.id}`}
    >
      <View style={[styles.tile, { backgroundColor: tileColor }]}>
        <SportIcon iconKey={sport.iconKey} size={dashSize.rowIcon} />
      </View>
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={1}>
          {item.title}
        </Text>
        {dateLine ? (
          <Text style={styles.meta} numberOfLines={1}>
            {dateLine}
          </Text>
        ) : null}
      </View>
      <View style={styles.kindPill}>
        <Text style={styles.kindText}>{kindText}</Text>
      </View>
    </Pressable>
  );
}

export default function StatGamesScreen({ navigation, route }: Props): React.JSX.Element {
  const t = useT();
  const stat = route.params.stat;
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<StatItem[] | null>(null);
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const seq = useRef(0);

  useEffect(() => {
    navigation.setOptions({ title: t(STAT_TITLE_KEYS[stat]) });
  }, [navigation, stat, t]);

  const load = useCallback(
    async (q: string, isRefresh: boolean) => {
      const mine = ++seq.current;
      if (isRefresh) {
        setRefreshing(true);
      }
      setError(false);
      try {
        const res = await withCorrelationId(correlationId =>
          getMyStatItems(stat, { q, limit: PAGE_SIZE }, { correlationId }),
        );
        if (mine === seq.current) {
          setItems(res.items);
        }
      } catch {
        if (mine === seq.current) {
          setError(true);
        }
      } finally {
        if (mine === seq.current) {
          setRefreshing(false);
        }
      }
    },
    [stat],
  );

  // First load at once; a typed search waits for a pause so each keystroke is not a request.
  const firstLoad = useRef(true);
  useEffect(() => {
    if (firstLoad.current) {
      firstLoad.current = false;
      load(query, false);
      return undefined;
    }
    const timer = setTimeout(() => load(query, false), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query, load]);

  const openItem = useCallback(
    (item: StatItem) => {
      if (item.kind === 'tournament') {
        if (navigationRef.isReady()) {
          navigationRef.navigate('Tournaments', { screen: 'TournamentDetail', params: { tournamentId: item.id } });
        }
        return;
      }
      navigation.navigate('EventDetail', { eventId: item.id });
    },
    [navigation],
  );

  if (items === null && error) {
    return <ErrorView message={t('mob.stats.load_error')} onRetry={() => load(query, false)} />;
  }
  if (items === null) {
    return <LoadingView />;
  }

  const trimmed = query.trim();
  return (
    <FlatList
      testID="stat-games-list"
      data={items}
      keyExtractor={item => `${item.kind}-${item.id}`}
      contentContainerStyle={items.length === 0 ? styles.emptyContainer : styles.listContainer}
      keyboardShouldPersistTaps="handled"
      ListHeaderComponent={
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={t('mob.stats.search_placeholder')}
          placeholderTextColor={colors.textMuted}
          accessibilityLabel={t('mob.stats.search_a11y')}
          autoCorrect={false}
          returnKeyType="search"
          clearButtonMode="while-editing"
          style={styles.search}
          testID="stat-search"
        />
      }
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => load(query, true)}
          colors={[colors.primary]}
          progressBackgroundColor={colors.surface}
        />
      }
      ListEmptyComponent={
        error ? (
          <ErrorView message={t('mob.stats.load_error')} onRetry={() => load(query, false)} />
        ) : trimmed ? (
          <EmptyState title={t('mob.stats.empty_search', { query: trimmed })} />
        ) : (
          <EmptyState title={t('mob.stats.empty')} subtitle={t('mob.stats.empty_hint')} />
        )
      }
      renderItem={({ item }) => <StatRow item={item} onPress={() => openItem(item)} />}
    />
  );
}

const styles = StyleSheet.create({
  listContainer: { padding: spacing.md, backgroundColor: colors.background },
  emptyContainer: { flexGrow: 1, padding: spacing.md, backgroundColor: colors.background },
  search: {
    ...typography.body,
    height: dashSize.touchTarget,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
    borderRadius: radius.full,
    borderWidth: borderWidth.thin,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    color: colors.textPrimary,
  },
  row: {
    minHeight: dashSize.touchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: dash.card,
    borderRadius: dashRadius.card,
    borderWidth: 1,
    borderColor: dash.cardBorder,
    padding: spacing.sm + 2,
    marginBottom: spacing.sm,
  },
  pressed: { opacity: 0.85 },
  tile: {
    width: dashSize.rowIconTile,
    height: dashSize.rowIconTile,
    borderRadius: dashRadius.rowTile,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1, marginLeft: spacing.sm + 2, marginRight: spacing.sm },
  title: { ...typography.bodyBold, color: dash.text },
  meta: { ...typography.caption, color: dash.textMuted, marginTop: 2 },
  kindPill: {
    backgroundColor: dash.goingBg,
    borderRadius: dashRadius.chip,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  kindText: { ...typography.label, color: dash.goingText },
});
