/**
 * Home dashboard (DES-MEETUP-MOBILE.md §4.3; R-021 "upcoming / mine"
 * grouping) — greeting header, sport filter pills, "Your Upcoming Games",
 * "Recommended for You", and "My Games & Groups" stat tiles.
 *
 * Design deviation (needs architect ratification): §4.3 names an "Event
 * List" screen and has no dashboard. This restructure is user-directed
 * (task brief, matching the live web app's Home) and replaces the former
 * flat events list; it adds no endpoint and no dependency.
 *
 * Data: one `getEvents()` response feeds the Upcoming and Recommended
 * sections and the "My Games" count (all partitioned client-side by
 * `src/utils/homeDashboard.ts`); `getMyGroups()` feeds the groups tile.
 * Sport pills (BUG-M06) come from `getSports()` (`GET
 * /admin/sports/public`) instead — one pill per admin-defined sport,
 * independent of what's actually in the loaded feed; selecting a pill with
 * zero matching events falls through to the Upcoming/Recommended sections'
 * existing empty-state copy, no new empty state needed. All three are
 * fetched under a single correlation ID (§3.12 — one ID per logical user
 * action, here "load the dashboard"). A failed groups or sports request
 * degrades only that tile/row (sports falls back to an empty list, i.e.
 * "All" only — Proposed Assumption, see Implementation Report); a failed
 * events request is a full error state, as before. Pagination beyond the
 * first page is still not built (unchanged from the previous list).
 *
 * Sport filter default (ADDENDUM-MOBILE-SPORTS-FILTER-PRESELECT-001,
 * R-MOBILE-SPORTS-FILTER-PRESELECT-1): the very first successful load also
 * fetches `getSkillLevels()` (same correlation ID) and uses
 * `getPreselectedSportKey()` to set `selectedSport`'s *initial* value
 * instead of hardcoding `null`. This is a default only — the user may
 * still freely tap any pill, including "All", afterward, and a later
 * refresh never re-runs the pre-select. The existing "pre-selected sport
 * has no matching admin-sport pill -> fall back to All" guard below also
 * covers this for free, since both read the same `selectedSport` state.
 *
 * This screen's stack header is the branded `AppHeader` (see
 * `RootNavigator`), which applies the top safe-area inset itself, so the
 * content here only needs ordinary top spacing.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { getEvents } from '../api/events';
import { withCorrelationId } from '../api/correlationId';
import { getMyGroups } from '../api/groups';
import { getSkillLevels } from '../api/profile';
import { getSports } from '../api/sports';
import { useAuth } from '../auth/AuthContext';
import EventCard from '../components/EventCard';
import ErrorView from '../components/ErrorView';
import GreetingHeader from '../components/home/GreetingHeader';
import MyGamesGroupsSection from '../components/home/MyGamesGroupsSection';
import RecommendedSection from '../components/home/RecommendedSection';
import SportFilterPills from '../components/home/SportFilterPills';
import UpcomingGamesSection from '../components/home/UpcomingGamesSection';
import LoadingView from '../components/LoadingView';
import TextLink from '../components/TextLink';
import { colors, spacing, typography } from '../theme/tokens';
import { getDisplayName } from '../utils/displayName';
import type { Event } from '../types/event';
import type { Sport } from '../types/sport';
import type { AppTabParamList, HomeStackParamList } from '../navigation/types';
import {
  countMyGames,
  getMyGames,
  getPreselectedSportKey,
  getRecommendedGames,
  getSportOptionsFromAdminSports,
  getUpcomingGames,
} from '../utils/homeDashboard';

type Props = CompositeScreenProps<
  NativeStackScreenProps<HomeStackParamList, 'EventsList'>,
  BottomTabScreenProps<AppTabParamList, 'Home'>
>;

export default function HomeScreen({ navigation, route }: Props): React.JSX.Element {
  const { user } = useAuth();

  const [events, setEvents] = useState<Event[]>([]);
  // `null` = the groups request failed; the tile then omits the count.
  const [groupsCount, setGroupsCount] = useState<number | null>(null);
  // BUG-M06: admin sports list backing the pill row. `[]` on a failed fetch
  // (same swallow-to-degrade pattern as groups) — the row then shows only
  // "All", it never blocks the rest of the dashboard.
  const [adminSports, setAdminSports] = useState<Sport[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Sport filter (`null` = "All"), applied client-side to Upcoming and Recommended.
  const [selectedSport, setSelectedSport] = useState<string | null>(null);
  // ADDENDUM-MOBILE-SPORTS-FILTER-PRESELECT-001 §4: the pre-select
  // algorithm only ever sets the *initial* value — once it has run once
  // (successfully or not), later loads (pull-to-refresh, the post-create
  // refetch) must never re-run it and stomp a selection the user made in
  // the meantime.
  const hasAppliedSportPreselectRef = useRef(false);

  const loadDashboard = useCallback(async (isRefresh: boolean) => {
    if (isRefresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    setError(null);
    const shouldPreselectSport = !isRefresh && !hasAppliedSportPreselectRef.current;
    try {
      const [eventsResponse, groupsTotal, skillLevels, sportsList] = await withCorrelationId(
        correlationId =>
          Promise.all([
            getEvents(undefined, { correlationId }),
            // Groups are secondary: swallow its failure into `null` so it
            // cannot take the whole dashboard down.
            getMyGroups({ correlationId }).then(
              response => response.items.length,
              () => null,
            ),
            // Only fetched for the one load that will actually use it — see
            // `shouldPreselectSport` above.
            shouldPreselectSport ? getSkillLevels({ correlationId }) : Promise.resolve(null),
            // BUG-M06: the pill row's source. Refetched on every load
            // (including pull-to-refresh), unlike the one-shot skill-level
            // pre-select, so an admin adding/deactivating a sport reaches
            // the row without an app restart. Secondary like groups: swallow
            // its failure into `[]` (pill row degrades to "All" only) so it
            // cannot take the whole dashboard down.
            getSports({ correlationId }).then(
              list => list,
              () => [],
            ),
          ]),
      );
      setEvents(eventsResponse.items);
      setGroupsCount(groupsTotal);
      setAdminSports(sportsList);
      if (shouldPreselectSport) {
        hasAppliedSportPreselectRef.current = true;
        setSelectedSport(getPreselectedSportKey(skillLevels ?? []));
      }
    } catch {
      setError('Could not load events. Please try again.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard(false);
  }, [loadDashboard]);

  // Create Game pops back here with a fresh `refreshKey` on success (Casual
  // side only — Tournament creates from the same merged screen land on the
  // Tournaments tab instead); re-fetch once per new key, same pattern as
  // Groups/Tournaments (the initial mount load is above).
  const refreshKey = route.params?.refreshKey;
  useEffect(() => {
    if (refreshKey !== undefined) {
      loadDashboard(true);
    }
  }, [refreshKey, loadDashboard]);

  const userId = user?.id;
  // BUG-M06: admin-sourced, independent of the event feed — a sport with
  // zero matching events still gets a pill; selecting it just lets the
  // Upcoming/Recommended sections fall through to their existing empty
  // states below (no new empty state needed).
  const sports = useMemo(() => getSportOptionsFromAdminSports(adminSports), [adminSports]);
  // Guards the pre-select (a skill-level sport absent from the admin list)
  // and an admin sport disappearing between loads; fall back to "All"
  // instead of leaving the screen filtered by a pill that no longer exists.
  const activeSport = sports.some(sport => sport.key === selectedSport) ? selectedSport : null;

  const upcoming = useMemo(() => getUpcomingGames(events, activeSport), [events, activeSport]);
  const recommended = useMemo(
    () => getRecommendedGames(events, userId, activeSport),
    [events, userId, activeSport],
  );
  const myGamesCount = useMemo(() => countMyGames(events, userId), [events, userId]);
  // BUG-M04: the "My Games" tile switches this same screen (there is no
  // separate "Games tab") to a filtered view via `EventsList`'s `filter`
  // param, instead of the usual Upcoming/Recommended/tiles dashboard.
  // Rendered directly with `EventCard` rather than `EventListSection` —
  // that component caps a dashboard preview at `MAX_SECTION_ITEMS`, which
  // would defeat the point of a "see all my games" view.
  const isMyGamesFilterActive = route.params?.filter === 'mine';
  const myGames = useMemo(() => getMyGames(events, userId), [events, userId]);

  const openEvent = useCallback(
    (event: Event) => navigation.navigate('EventDetail', { eventId: event.id }),
    [navigation],
  );

  if (isLoading) {
    return <LoadingView />;
  }

  if (error) {
    return <ErrorView message={error} onRetry={() => loadDashboard(false)} />;
  }

  return (
    <ScrollView
      contentContainerStyle={{
        paddingTop: spacing.md,
        paddingBottom: spacing.lg,
      }}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={() => loadDashboard(true)}
          colors={[colors.primary]}
          progressBackgroundColor={colors.surface}
        />
      }
    >
      <View style={styles.block}>
        <GreetingHeader name={getDisplayName(user)} />
      </View>
      {isMyGamesFilterActive ? (
        <View style={styles.block}>
          <TextLink
            label="← All"
            onPress={() => navigation.navigate('EventsList', { filter: undefined })}
          />
          <View style={styles.myGamesHeader}>
            <Text style={styles.myGamesTitle} accessibilityRole="header">
              My Games
            </Text>
            <Text style={styles.myGamesSubtitle}>Games you organise or are going to</Text>
          </View>
          {myGames.length === 0 ? (
            <Text style={styles.myGamesEmpty}>
              You don&apos;t have any games yet — join one or create your own.
            </Text>
          ) : (
            myGames.map(event => (
              <EventCard key={event.id} event={event} onPress={() => openEvent(event)} />
            ))
          )}
        </View>
      ) : (
        <>
          <View style={styles.pills}>
            <SportFilterPills sports={sports} selectedKey={activeSport} onSelect={setSelectedSport} />
          </View>
          <View style={styles.block}>
            <UpcomingGamesSection events={upcoming} onEventPress={openEvent} />
            <RecommendedSection events={recommended} onEventPress={openEvent} />
            <MyGamesGroupsSection
              myGamesCount={myGamesCount}
              groupsCount={groupsCount}
              onPressMyGames={() => navigation.navigate('EventsList', { filter: 'mine' })}
              onPressMyGroups={() => navigation.navigate('Groups', { screen: 'GroupsList' })}
            />
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  block: { paddingHorizontal: spacing.md },
  pills: { marginTop: spacing.md },
  myGamesHeader: { marginTop: spacing.md, marginBottom: spacing.md },
  myGamesTitle: { ...typography.h3, fontWeight: '700', color: colors.textPrimary },
  myGamesSubtitle: { ...typography.caption, color: colors.textMuted, marginTop: spacing.xs },
  myGamesEmpty: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
    paddingVertical: spacing.lg,
  },
});
