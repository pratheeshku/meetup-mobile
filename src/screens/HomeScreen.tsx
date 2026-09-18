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
 * sections, the sport pills and the "My Games" count (all partitioned
 * client-side by `src/utils/homeDashboard.ts`); `getMyGroups()` feeds the
 * groups tile. Both are fetched under a single
 * correlation ID (§3.12 — one ID per logical user action, here "load the
 * dashboard"). A failed groups request degrades only that tile; a failed
 * events request is a full error state, as before. Pagination beyond the
 * first page is still not built (unchanged from the previous list).
 *
 * The native stack header is hidden for this screen (see `RootNavigator`):
 * the greeting is the header, so the top safe-area inset is applied here.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getEvents } from '../api/events';
import { withCorrelationId } from '../api/correlationId';
import { getMyGroups } from '../api/groups';
import { useAuth } from '../auth/AuthContext';
import ErrorView from '../components/ErrorView';
import GreetingHeader from '../components/home/GreetingHeader';
import MyGamesGroupsSection from '../components/home/MyGamesGroupsSection';
import RecommendedSection from '../components/home/RecommendedSection';
import SportFilterPills from '../components/home/SportFilterPills';
import UpcomingGamesSection from '../components/home/UpcomingGamesSection';
import LoadingView from '../components/LoadingView';
import { colors, spacing } from '../theme/tokens';
import type { Event } from '../types/event';
import type { AppTabParamList, HomeStackParamList } from '../navigation/types';
import {
  countMyGames,
  getRecommendedGames,
  getSportOptions,
  getUpcomingGames,
} from '../utils/homeDashboard';

type Props = CompositeScreenProps<
  NativeStackScreenProps<HomeStackParamList, 'EventsList'>,
  BottomTabScreenProps<AppTabParamList, 'Home'>
>;

export default function HomeScreen({ navigation }: Props): React.JSX.Element {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  const [events, setEvents] = useState<Event[]>([]);
  // `null` = the groups request failed; the tile then omits the count.
  const [groupsCount, setGroupsCount] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Sport filter (`null` = "All"), applied client-side to Upcoming and Recommended.
  const [selectedSport, setSelectedSport] = useState<string | null>(null);

  const loadDashboard = useCallback(async (isRefresh: boolean) => {
    if (isRefresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    setError(null);
    try {
      const [eventsResponse, groupsTotal] = await withCorrelationId(correlationId =>
        Promise.all([
          getEvents(undefined, { correlationId }),
          // Groups are secondary: swallow its failure into `null` so it
          // cannot take the whole dashboard down.
          getMyGroups({ correlationId }).then(
            response => response.items.length,
            () => null,
          ),
        ]),
      );
      setEvents(eventsResponse.items);
      setGroupsCount(groupsTotal);
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

  const userId = user?.id;
  const sports = useMemo(() => getSportOptions(events), [events]);
  // A refresh can remove the selected sport's last event; fall back to "All"
  // instead of leaving the screen filtered by a pill that no longer exists.
  const activeSport = sports.some(sport => sport.key === selectedSport) ? selectedSport : null;

  const upcoming = useMemo(() => getUpcomingGames(events, activeSport), [events, activeSport]);
  const recommended = useMemo(
    () => getRecommendedGames(events, userId, activeSport),
    [events, userId, activeSport],
  );
  const myGamesCount = useMemo(() => countMyGames(events, userId), [events, userId]);

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
        paddingTop: insets.top + spacing.md,
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
        {/* No `onCreateGame`: no create-event screen exists yet (button renders disabled). */}
        <GreetingHeader nickname={user?.nickname} />
      </View>
      <View style={styles.pills}>
        <SportFilterPills sports={sports} selectedKey={activeSport} onSelect={setSelectedSport} />
      </View>
      <View style={styles.block}>
        <UpcomingGamesSection events={upcoming} onEventPress={openEvent} />
        <RecommendedSection events={recommended} onEventPress={openEvent} />
        <MyGamesGroupsSection
          myGamesCount={myGamesCount}
          groupsCount={groupsCount}
          onPressMyGroups={() => navigation.navigate('Groups', { screen: 'GroupsList' })}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  block: { paddingHorizontal: spacing.md },
  pills: { marginTop: spacing.md },
});
