/**
 * Home dashboard (DES-MEETUP-ADDENDUM-dashboard.md v1.4, AD-1 to AD-9,
 * AD-11 to AD-14; supersedes the §4.3 home layout in DES-MEETUP-MOBILE.md).
 *
 * Order, top to bottom: banner; next-game card (overlapping the banner);
 * sports row; My games (2, View all); My groups (2, View all); Recommended
 * for you (2, View all); two shortcut tiles; bottom bar (the tab navigator).
 *
 * Data (existing calls only, AD-4): `getEvents()` feeds the next-game card,
 * My games, Recommended and the My games tile count (partitioned client-side
 * by `utils/gameLists`, the one module shared with the Games screen);
 * `getMyGroups()` feeds My groups and its count; `getSports()`
 * (`GET /admin/sports/public`) feeds the chips; `getProfile()` feeds the
 * banner photo and the skill sports behind the chip default. Each source is
 * its own `useResource`, so each section shows its own loading / empty /
 * error state and one failing call never blanks the screen (P7). Every load
 * of one logical action (open, pull-to-refresh) shares one correlation ID.
 *
 * Next game, My games and Recommended all come from the single `GET /events`
 * response (as before), so they fail and retry together, each showing its
 * own copy.
 *
 * The sport filter applies to the next-game card, My games and Recommended;
 * My groups and both tile counts are never filtered (AD-9).
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { useScrollToTop } from '@react-navigation/native';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { getEvents } from '../api/events';
import { withCorrelationId } from '../api/correlationId';
import { getMyGroups } from '../api/groups';
import { getProfile } from '../api/profile';
import { getSports } from '../api/sports';
import { useAuth } from '../auth/AuthContext';
import DashboardBanner from '../components/home/DashboardBanner';
import GameRow from '../components/home/GameRow';
import GroupRow from '../components/home/GroupRow';
import NextGameCard from '../components/home/NextGameCard';
import {
  COPY,
  EmptyText,
  InlineError,
  SectionHeader,
  SkeletonRows,
} from '../components/home/SectionParts';
import ShortcutTiles from '../components/home/ShortcutTiles';
import SportChipsRow from '../components/home/SportChipsRow';
import { refreshUnreadCount, useUnreadBadgeCount } from '../hooks/useUnreadCount';
import { useResource } from '../hooks/useResource';
import { useSportFilter } from '../hooks/useSportFilter';
import type { AppTabParamList, GamesScope, HomeStackParamList } from '../navigation/types';
import { dash, dashRadius, dashSize } from '../theme/dashboardTheme';
import { spacing } from '../theme/tokens';
import type { Event } from '../types/event';
import { getDisplayName } from '../utils/displayName';
import {
  HOME_SECTION_ROWS,
  countMyGames,
  filteredEmptyMessage,
  selectMyGames,
  selectNextGame,
  selectOpenGames,
} from '../utils/gameLists';

type Props = CompositeScreenProps<
  NativeStackScreenProps<HomeStackParamList, 'EventsList'>,
  BottomTabScreenProps<AppTabParamList, 'Home'>
>;

export default function HomeScreen({ navigation, route }: Props): React.JSX.Element {
  const { user } = useAuth();
  const userId = user?.id;

  const events = useResource(options => getEvents(undefined, options));
  const groups = useResource(options => getMyGroups(options));
  const sports = useResource(options => getSports(options));
  const profile = useResource(options => getProfile(options));
  const { load: loadEvents } = events;
  const { load: loadGroups } = groups;
  const { load: loadSports } = sports;
  const { load: loadProfile } = profile;

  const [isRefreshing, setIsRefreshing] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  useScrollToTop(scrollRef);
  const unreadCount = useUnreadBadgeCount();

  const loadAll = useCallback(
    () =>
      withCorrelationId(correlationId =>
        Promise.all([
          loadEvents(correlationId),
          loadGroups(correlationId),
          loadSports(correlationId),
          loadProfile(correlationId),
        ]).then(() => undefined),
      ),
    [loadEvents, loadGroups, loadSports, loadProfile],
  );

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // Create Game pops back here with a fresh `refreshKey` on success; refetch
  // once per new key (the initial load is above).
  const refreshKey = route.params?.refreshKey;
  const lastRefreshKey = useRef(refreshKey);
  useEffect(() => {
    if (refreshKey !== undefined && refreshKey !== lastRefreshKey.current) {
      lastRefreshKey.current = refreshKey;
      loadAll();
    }
  }, [refreshKey, loadAll]);

  // The bell count is synced on mount and whenever this screen regains focus
  // (including coming back from Notification History).
  useEffect(() => {
    refreshUnreadCount();
    return navigation.addListener('focus', () => {
      refreshUnreadCount();
    });
  }, [navigation]);

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await loadAll();
    } finally {
      setIsRefreshing(false);
    }
  }, [loadAll]);

  const filter = useSportFilter(sports, profile.data?.skill_levels, profile.status !== 'loading');
  const isFiltered = filter.selected.length > 0;
  const filteredEmpty = isFiltered ? filteredEmptyMessage(filter.selected, filter.options) : null;

  const lists = useMemo(() => {
    const feed: Event[] | undefined = events.data?.items;
    if (!feed) {
      return null;
    }
    const now = Date.now();
    const filtered = { userId, now, sportKeys: filter.selected };
    return {
      next: selectNextGame(feed, filtered),
      myGames: selectMyGames(feed, filtered).slice(0, HOME_SECTION_ROWS),
      recommended: selectOpenGames(feed, filtered).slice(0, HOME_SECTION_ROWS),
      // Counts are never filtered (AD-9).
      count: countMyGames(feed, userId, now),
    };
  }, [events.data, userId, filter.selected]);

  const openEvent = useCallback(
    (event: Event) => navigation.navigate('EventDetail', { eventId: event.id }),
    [navigation],
  );
  const openGames = useCallback(
    (scope: GamesScope) =>
      navigation.navigate('Tournaments', {
        screen: 'TournamentsList',
        params: { scope, entryKey: Date.now() },
      }),
    [navigation],
  );
  const openGroups = useCallback(
    () => navigation.navigate('Groups', { screen: 'GroupsList' }),
    [navigation],
  );

  const retryEvents = useCallback(() => {
    withCorrelationId(correlationId => loadEvents(correlationId));
  }, [loadEvents]);
  const retryGroups = useCallback(() => {
    withCorrelationId(correlationId => loadGroups(correlationId));
  }, [loadGroups]);

  /** One games section body: skeleton / error / filtered-empty / empty / rows. */
  function gamesBody(
    list: Event[] | undefined,
    errorCopy: string,
    emptyCopy: string,
  ): React.JSX.Element {
    if (events.status === 'error') {
      return <InlineError message={errorCopy} onRetry={retryEvents} />;
    }
    if (!list) {
      return <SkeletonRows count={HOME_SECTION_ROWS} />;
    }
    if (list.length === 0) {
      return <EmptyText>{filteredEmpty ?? emptyCopy}</EmptyText>;
    }
    return (
      <>
        {list.map(event => (
          <GameRow key={event.id} event={event} onPress={() => openEvent(event)} />
        ))}
      </>
    );
  }

  const groupItems = groups.data?.items.slice(0, HOME_SECTION_ROWS);

  return (
    <ScrollView
      ref={scrollRef}
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={onRefresh}
          colors={[dash.brand]}
          progressBackgroundColor={dash.card}
        />
      }
    >
      <DashboardBanner
        name={getDisplayName(user)}
        photoUrl={profile.data?.avatar_url}
        unreadCount={unreadCount}
        onBellPress={() => navigation.navigate('NotificationHistory')}
        onAvatarPress={() => navigation.navigate('Profile', { screen: 'ProfileHome' })}
      />

      <View style={styles.nextCard} testID="next-game-section">
        {events.status === 'error' ? (
          <InlineError message={COPY.gamesError} onRetry={retryEvents} />
        ) : !lists ? (
          <SkeletonRows count={1} testID="next-game-skeleton" />
        ) : lists.next ? (
          <NextGameCard event={lists.next} onPress={() => openEvent(lists.next as Event)} />
        ) : (
          <View style={styles.nextEmpty}>
            <EmptyText>{filteredEmpty ?? COPY.gamesEmpty}</EmptyText>
          </View>
        )}
      </View>

      <View style={styles.section} testID="sports-section">
        <SportChipsRow
          options={filter.options}
          selected={filter.selected}
          onToggle={filter.toggle}
          isLoading={filter.isLoading}
        />
      </View>

      <View style={styles.section} testID="my-games-section">
        <SectionHeader title="My games" onViewAll={() => openGames('mine')} />
        {gamesBody(lists?.myGames, COPY.gamesError, COPY.gamesEmpty)}
      </View>

      <View style={styles.section} testID="my-groups-section">
        <SectionHeader title="My groups" onViewAll={openGroups} />
        {groups.status === 'error' ? (
          <InlineError message={COPY.groupsError} onRetry={retryGroups} />
        ) : !groupItems ? (
          <SkeletonRows count={HOME_SECTION_ROWS} />
        ) : groupItems.length === 0 ? (
          <EmptyText>{COPY.groupsEmpty}</EmptyText>
        ) : (
          groupItems.map(group => (
            <GroupRow
              key={group.id}
              group={group}
              onPress={() =>
                navigation.navigate('Groups', {
                  screen: 'GroupDetail',
                  params: { groupId: group.id },
                  initial: false,
                })
              }
            />
          ))
        )}
      </View>

      <View style={styles.section} testID="recommended-section">
        <SectionHeader title="Recommended for you" onViewAll={() => openGames('open')} />
        {gamesBody(lists?.recommended, COPY.recommendedError, COPY.recommendedEmpty)}
      </View>

      <View style={styles.section} testID="shortcut-tiles">
        <ShortcutTiles
          gamesCount={lists ? lists.count : null}
          groupsCount={groups.data ? groups.data.items.length : null}
          onPressGames={() => openGames('all')}
          onPressGroups={openGroups}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: dash.page },
  content: { paddingBottom: spacing.lg },
  nextCard: { marginTop: -dashSize.nextGameOverlap, paddingHorizontal: spacing.md },
  nextEmpty: {
    backgroundColor: dash.card,
    borderRadius: dashRadius.nextGameCard,
    borderWidth: 1,
    borderColor: dash.cardBorder,
    paddingHorizontal: spacing.md,
  },
  section: { marginTop: spacing.lg, paddingHorizontal: spacing.md },
});
