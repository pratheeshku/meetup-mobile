/**
 * Home Screen (Shuttlr Home v2).
 *
 * Requirements:
 * 1. HOME SCREEN:
 *    - Top bar: hamburger, app icon + "Shuttlr", bell with unread dot, profile photo.
 *      Greeting on the left; the sport selector at top right BELOW the profile photo
 *      at reduced size (multi-select, filters content, defaults to user skill sports).
 *    - Order: banner carousel with dots, two tab tiles, tab content, Create Game card, bottom menu.
 *    - Banner: 2+ banners auto-rotate at interval_seconds; swipe supported; pause while touched;
 *      if OS reduce-motion setting is on, no auto-advance. 1 banner static. 0 banners shows fallback.
 *      If API fails, use last good cached response, else bundled static fallback asset.
 *      Set accessibilityLabel from alt_text.
 *      Banner with click_url is pressable and opens system browser (re-check https scheme);
 *      without it not pressable. "Ad" tag only when is_sponsored.
 *    - Tab tiles: "Upcoming games" (default) and "My groups" (folder tabs); the selected tab opens into the panel,
 *      accessibilityRole tab with selected state, no chevrons. Content loads on selection and is cached per tab.
 *      Create Game card stays visible on both tabs.
 *      - Upcoming tile count = games in next 7 days; list = next 2 upcoming games, earliest first,
 *        View all goes to Games tab; sport filter applies.
 *      - Groups tile count = active groups; list = up to 3 groups, View all goes to Groups tab;
 *        sport filter does not apply.
 *      - Empty state for each tab.
 *    - Game cards and group cards share one layout: left tile (date block, or group logo),
 *      title, details, avatars with +N, count on the right, View game / View group button.
 *      Show member and player photos when photo_url exists, otherwise initials.
 *      Group with no logo shows default group icon. Group owner line: "Owner: <display_name>".
 *      Description max 2 lines.
 * 2. MENU (hamburger drawer):
 *    - Drawer with Home, Groups, Tournament teams, Games, Tournaments, About links.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { useScrollToTop } from '@react-navigation/native';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { withCorrelationId } from '../api/correlationId';
import { getEvents } from '../api/events';
import { getCachedHomeGroups, getGroups } from '../api/groups';
import {
  BUNDLED_FALLBACK_BANNER,
  getCachedBanners,
  getCachedMenu,
  getHomeBanners,
  getHomeMenu,
  getHomeSummary,
  type HomeBannersResponse,
  type HomeMenuResponse,
  type HomeSummaryResponse,
} from '../api/home';
import { getProfile, getProfileSummary, type ProfileSummary } from '../api/profile';
import { getSports } from '../api/sports';
import { useAuth } from '../auth/AuthContext';
import BannerCarousel from '../components/home/BannerCarousel';
import CreateGameCard from '../components/home/CreateGameCard';
import DrawerMenu from '../components/home/DrawerMenu';
import ProfileStatsStrip from '../components/ProfileStatsStrip';
import HomeTabTiles, { panelStyle, type HomeTab } from '../components/home/HomeTabTiles';
import HomeTopBar from '../components/home/HomeTopBar';
import {
  EmptyText,
  InlineError,
  SectionHeader,
  SkeletonRows,
} from '../components/home/SectionParts';
import { UnifiedGameCard, UnifiedGroupCard } from '../components/home/UnifiedCard';
import Toast from '../components/Toast';
import { useResource } from '../hooks/useResource';
import { useSportFilter } from '../hooks/useSportFilter';
import { refreshUnreadCount, useUnreadBadgeCount } from '../hooks/useUnreadCount';
import { useT } from '../labels/LabelsContext';
import type { AppTabParamList, HomeStackParamList } from '../navigation/types';
import { colors, spacing } from '../theme/tokens';
import type { Event } from '../types/event';
import type { Group } from '../types/group';
import { getDisplayName } from '../utils/displayName';
import { filteredEmptyMessage } from '../utils/gameLists';
import { usePerfRender, usePerfScreen } from '../hooks/usePerfScreen';

type Props = CompositeScreenProps<
  NativeStackScreenProps<HomeStackParamList, 'EventsList'>,
  BottomTabScreenProps<AppTabParamList, 'Home'>
>;

export default function HomeScreen({ navigation, route }: Props): React.JSX.Element {
  const { user } = useAuth();
  const t = useT();
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedTab, setSelectedTab] = useState<HomeTab>('upcoming');
  const [summaryData, setSummaryData] = useState<HomeSummaryResponse | null>(null);
  const [statsSummary, setStatsSummary] = useState<ProfileSummary | null>(null);
  const [menuData, setMenuData] = useState<HomeMenuResponse | null>(null);
  const [persistedBanners, setPersistedBanners] = useState<HomeBannersResponse | null>(null);

  // Live endpoints state with local calculation fallbacks
  const [liveUpcoming, setLiveUpcoming] = useState<{
    items: Event[] | null;
    status: 'idle' | 'loading' | 'success' | 'error';
  }>({ items: null, status: 'loading' });

  const [liveGroups, setLiveGroups] = useState<{
    items: Group[] | null;
    status: 'idle' | 'loading' | 'success' | 'error';
  }>({ items: null, status: 'loading' });

  const scrollRef = useRef<ScrollView>(null);
  useScrollToTop(scrollRef);
  const unreadCount = useUnreadBadgeCount();

  // ── Perf: screen timing ────────────────────────────────────────────────────
  // First paint shows the active tab's list (skeleton while that list has no items
  // and is not in the error state).
  const homeIsLoading =
    selectedTab === 'upcoming'
      ? liveUpcoming.items === null && liveUpcoming.status !== 'error'
      : liveGroups.items === null && liveGroups.status !== 'error';
  usePerfRender('HomeScreen');
  usePerfScreen('HomeScreen', homeIsLoading);

  // Resources (bootstrap data & banners)
  const sports = useResource(options => getSports(options), 'getSports');
  const profile = useResource(options => getProfile(options), 'getProfile');
  const banners = useResource(options => getHomeBanners(options), 'getHomeBanners');

  const { load: loadSports } = sports;
  const { load: loadProfile } = profile;
  const { load: loadBanners } = banners;

  const [isRefreshing, setIsRefreshing] = useState(false);

  // Load cached menu on mount
  useEffect(() => {
    getCachedMenu().then(cached => {
      if (cached) {
        setMenuData(cached);
      }
    });
  }, []);

  // Load cached banners on mount so banners display immediately if cached
  useEffect(() => {
    getCachedBanners().then(cached => {
      if (cached) {
        setPersistedBanners(prev => (prev ? prev : cached));
      }
    });
  }, []);

  // Load cached groups on mount so groups display immediately if cached
  useEffect(() => {
    getCachedHomeGroups().then(cached => {
      if (cached && cached.length > 0) {
        setLiveGroups(prev => (prev.items !== null ? prev : { items: cached, status: 'success' }));
      }
    });
  }, []);

  // Update persisted banners when banners resource arrives, keeping last real data
  useEffect(() => {
    if (banners.data) {
      setPersistedBanners(prev => {
        const next = banners.data!;
        if (next.banners.length > 0 || next.fallback?.image_url) {
          if (
            prev &&
            prev.banners.length === next.banners.length &&
            prev.banners.every((b, i) => b.id === next.banners[i]?.id) &&
            prev.interval_seconds === next.interval_seconds &&
            prev.fallback?.image_url === next.fallback?.image_url
          ) {
            return prev;
          }
          return next;
        }
        if (prev && prev.banners.length > 0) {
          return prev;
        }
        return next;
      });
    }
  }, [banners.data]);

  // Menu loader: GET /home/menu once per Home load
  const loadMenu = useCallback(async (correlationId?: string) => {
    try {
      const data = await getHomeMenu({ correlationId });
      if (data) {
        setMenuData(data);
      }
    } catch {
      // Handled internally by getHomeMenu falling back to cache
    }
  }, []);

  // Live upcoming games: GET /events?mine=true&upcoming=true&limit=2&sports=...
  const loadLiveUpcoming = useCallback(
    async (selectedSports: string[], correlationId?: string) => {
      setLiveUpcoming(prev => ({ ...prev, status: 'loading' }));
      try {
        const res = await getEvents(
          {
            mine: true,
            upcoming: true,
            limit: 2,
            sports: selectedSports.length > 0 ? selectedSports.join(',') : undefined,
          },
          { correlationId },
        );
        setLiveUpcoming({ items: res.items, status: 'success' });
      } catch {
        setLiveUpcoming(prev => ({
          items: prev.items,
          status: prev.items !== null ? 'success' : 'error',
        }));
      }
    },
    [],
  );

  // Live groups: GET /groups?mine=true&limit=3
  const loadLiveGroups = useCallback(async (correlationId?: string) => {
    setLiveGroups(prev => ({ ...prev, status: 'loading' }));
    try {
      const res = await getGroups({ mine: true, limit: 3 }, { correlationId });
      setLiveGroups({ items: res.items, status: 'success' });
    } catch {
      const cached = await getCachedHomeGroups();
      if (cached && cached.length > 0) {
        setLiveGroups({ items: cached, status: 'success' });
      } else {
        setLiveGroups(prev => ({
          items: prev.items,
          status: prev.items !== null ? 'success' : 'error',
        }));
      }
    }
  }, []);

  // Live summary: GET /home/summary?sports=...
  const loadSummary = useCallback(
    async (selectedSports: string[], correlationId?: string) => {
      try {
        const res = await getHomeSummary(selectedSports, { correlationId });
        setSummaryData(res);
      } catch {
        // Keep old summary data on failure; do not wipe it
      }
    },
    [],
  );

  // Stats strip: GET /users/me/profile-summary. Never blocks Home; on failure the
  // block is hidden silently (no banner).
  const loadStats = useCallback(async (correlationId?: string) => {
    try {
      setStatsSummary(await getProfileSummary({ correlationId }));
    } catch {
      setStatsSummary(null);
    }
  }, []);

  // Sport filter
  const filter = useSportFilter(sports, profile.data?.skill_levels, profile.status !== 'loading');
  const isFiltered = filter.selected.length > 0;
  const filteredEmpty = isFiltered ? filteredEmptyMessage(filter.selected, filter.options, t) : null;

  const isLoadInProgressRef = useRef(false);
  const lastAutoLoadTimeRef = useRef(0);
  const selectedSportsRef = useRef(filter.selected);
  selectedSportsRef.current = filter.selected;

  // Dynamic Home endpoints loader (banners, menu, live upcoming, live groups, summary)
  const loadDynamicHomeData = useCallback(
    (selectedSports: string[], correlationId: string) =>
      Promise.all([
        loadBanners(correlationId),
        loadMenu(correlationId),
        loadLiveUpcoming(selectedSports, correlationId),
        loadLiveGroups(correlationId),
        loadSummary(selectedSports, correlationId),
        loadStats(correlationId),
      ]).then(() => undefined),
    [loadBanners, loadMenu, loadLiveUpcoming, loadLiveGroups, loadSummary, loadStats],
  );

  // Bootstrap shared endpoints loader (sports, profile)
  const loadBootstrapData = useCallback(
    (correlationId: string) =>
      Promise.all([
        loadSports(correlationId),
        loadProfile(correlationId),
      ]).then(() => undefined),
    [loadSports, loadProfile],
  );

  const executeHomeLoad = useCallback(
    async (options?: { isManualRefresh?: boolean; isBootstrap?: boolean }) => {
      const isManual = Boolean(options?.isManualRefresh);
      const isBootstrap = Boolean(options?.isBootstrap);

      // Re-entrancy guard: ignore if a load is already in flight
      if (isLoadInProgressRef.current) {
        return;
      }

      // Minimum gap: automatic reloads run at most once per 30 seconds
      const now = Date.now();
      if (!isManual && now - lastAutoLoadTimeRef.current < 30_000) {
        return;
      }

      isLoadInProgressRef.current = true;
      try {
        await withCorrelationId(async correlationId => {
          const promises: Promise<unknown>[] = [
            loadDynamicHomeData(selectedSportsRef.current, correlationId),
          ];
          if (isBootstrap || isManual) {
            promises.push(loadBootstrapData(correlationId));
          }
          await Promise.all(promises);
        });
        lastAutoLoadTimeRef.current = Date.now();
      } finally {
        isLoadInProgressRef.current = false;
      }
    },
    [loadDynamicHomeData, loadBootstrapData],
  );

  // Initial load on mount (bootstrap + dynamic)
  useEffect(() => {
    executeHomeLoad({ isBootstrap: true });
  }, [executeHomeLoad]);

  // Re-fetch live upcoming and summary only when sport filter selection changes
  const selectedSportsKey = filter.selected.slice().sort().join(',');
  const lastSportsKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (lastSportsKeyRef.current === null) {
      lastSportsKeyRef.current = selectedSportsKey;
      return;
    }
    if (lastSportsKeyRef.current === selectedSportsKey) {
      return;
    }
    lastSportsKeyRef.current = selectedSportsKey;
    withCorrelationId(correlationId =>
      Promise.all([
        loadLiveUpcoming(filter.selected, correlationId),
        loadSummary(filter.selected, correlationId),
      ]),
    );
  }, [selectedSportsKey, filter.selected, loadLiveUpcoming, loadSummary]);

  // Handle route params refreshKey & toast
  const refreshKey = route.params?.refreshKey;
  const successMessage = route.params?.successMessage;
  const lastRefreshKey = useRef(refreshKey);
  useEffect(() => {
    if (refreshKey !== undefined && refreshKey !== lastRefreshKey.current) {
      lastRefreshKey.current = refreshKey;
      executeHomeLoad({ isManualRefresh: true, isBootstrap: false });
    }
  }, [refreshKey, executeHomeLoad]);

  const lastToastKey = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (successMessage && refreshKey !== undefined && refreshKey !== lastToastKey.current) {
      lastToastKey.current = refreshKey;
      setToastMessage(successMessage);
    }
  }, [refreshKey, successMessage]);

  // Sync bell unread count and throttled dynamic reload on focus
  useEffect(() => {
    refreshUnreadCount();
    const unsubscribe = navigation.addListener('focus', () => {
      refreshUnreadCount();
      executeHomeLoad({ isManualRefresh: false, isBootstrap: false });
    });
    return unsubscribe;
  }, [navigation, executeHomeLoad]);

  // Throttled dynamic reload when app returns to foreground
  useEffect(() => {
    let previousState = AppState.currentState;
    const subscription = AppState.addEventListener('change', nextState => {
      if (previousState?.match(/inactive|background/) && nextState === 'active') {
        executeHomeLoad({ isManualRefresh: false, isBootstrap: false });
      }
      previousState = nextState;
    });
    return () => {
      subscription.remove();
    };
  }, [executeHomeLoad]);

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await executeHomeLoad({ isManualRefresh: true, isBootstrap: true });
    } finally {
      setIsRefreshing(false);
    }
  }, [executeHomeLoad]);

  // Resolved counts: live summary data preferred, live items length fallback on failure
  const upcomingCount =
    summaryData?.upcoming_games_this_week ??
    (liveUpcoming.items ? liveUpcoming.items.length : null);
  const groupsCount =
    summaryData?.active_groups ??
    (liveGroups.items ? liveGroups.items.length : null);

  // Resolved list items: live endpoints preferred
  const displayedUpcoming = liveUpcoming.items;

  const isUpcomingLoading =
    liveUpcoming.status === 'loading' && displayedUpcoming === null;

  const upcomingError =
    liveUpcoming.status === 'error' && displayedUpcoming === null;

  // Resolved list items: live endpoints preferred, cached fallback of same shape on failure
  const displayedGroups = liveGroups.items;

  const isGroupsLoading =
    liveGroups.status === 'loading' && displayedGroups === null;

  const groupsError =
    liveGroups.status === 'error' && displayedGroups === null;

  const retryUpcoming = useCallback(() => {
    withCorrelationId(correlationId =>
      loadLiveUpcoming(filter.selected, correlationId),
    );
  }, [loadLiveUpcoming, filter.selected]);

  const retryGroupsAction = useCallback(() => {
    withCorrelationId(correlationId =>
      loadLiveGroups(correlationId),
    );
  }, [loadLiveGroups]);

  const openEvent = useCallback(
    (event: Event) => navigation.navigate('EventDetail', { eventId: event.id }),
    [navigation],
  );

  const openAllGames = useCallback(() => {
    navigation.navigate('Tournaments', {
      screen: 'TournamentsList',
      params: { scope: 'all', entryKey: Date.now(), segment: 'games' },
    });
  }, [navigation]);

  const openAllGroups = useCallback(() => {
    navigation.navigate('Groups', { screen: 'GroupsList' });
  }, [navigation]);

  // Banner data: preferred from persisted/cached, fallback to resource data
  const bannerList = persistedBanners?.banners ?? (banners.data?.banners ?? []);
  const bannerFallback =
    persistedBanners?.fallback ?? (banners.data?.fallback ?? BUNDLED_FALLBACK_BANNER.fallback);
  const intervalSec =
    persistedBanners?.interval_seconds ?? (banners.data?.interval_seconds ?? 5);

  return (
    <View style={styles.root}>
      <ScrollView
        ref={scrollRef}
        style={styles.screen}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            colors={[colors.primary]}
            progressBackgroundColor={colors.surface}
          />
        }
      >
        {/* Top bar & greeting with compact sport selector */}
        <HomeTopBar
          name={getDisplayName(user)}
          photoUrl={profile.data?.avatar_url}
          unreadCount={unreadCount}
          onHamburgerPress={() => setIsDrawerOpen(true)}
          onBellPress={() => navigation.navigate('NotificationHistory')}
          onProfilePress={() => navigation.navigate('Profile', { screen: 'ProfileHome' })}
          sportOptions={filter.options}
          selectedSports={filter.selected}
          onToggleSport={filter.toggle}
          isLoadingSports={filter.isLoading}
        />

        {/* Banner carousel with dots */}
        <BannerCarousel
          banners={bannerList}
          fallback={bannerFallback}
          intervalSeconds={intervalSec}
        />

        {/* Profile stats strip (renders when data arrives; hidden on failure) */}
        {statsSummary ? (
          <View style={styles.statsSection}>
            <ProfileStatsStrip
              gamesPlayed={statsSummary.games_played ?? 0}
              gamesHosted={statsSummary.games_hosted ?? 0}
              groupsCount={statsSummary.groups_count ?? 0}
              gamesWon={statsSummary.games_won}
            />
          </View>
        ) : null}

        {/* Folder tabs: Upcoming games & My groups (the tiles are the tabs) */}
        <HomeTabTiles
          selectedTab={selectedTab}
          onSelectTab={setSelectedTab}
          upcomingCount={upcomingCount}
          groupsCount={groupsCount}
        />

        {/* Tab Content (cached per tab) */}
        {selectedTab === 'upcoming' ? (
          <View style={panelStyle('upcoming')} testID="upcoming-games-tab-content">
            <SectionHeader
              title={t('mob.home.tab_upcoming')}
              onViewAll={openAllGames}
              variant="panel"
            />

            {upcomingError ? (
              <InlineError message={t('mob.dashboard.games_error')} onRetry={retryUpcoming} />
            ) : isUpcomingLoading || !displayedUpcoming ? (
              <SkeletonRows count={2} />
            ) : displayedUpcoming.length === 0 ? (
              <EmptyText>{filteredEmpty ?? t('mob.home.upcoming_empty')}</EmptyText>
            ) : (
              displayedUpcoming.map(event => (
                <UnifiedGameCard
                  key={event.id}
                  event={event}
                  perfScreen="HomeScreen"
                  onPress={() => openEvent(event)}
                />
              ))
            )}
          </View>
        ) : (
          <View style={panelStyle('groups')} testID="your-groups-tab-content">
            <SectionHeader
              title={t('mob.home.tab_groups')}
              onViewAll={openAllGroups}
              variant="panel"
            />

            {groupsError ? (
              <InlineError message={t('mob.dashboard.groups_error')} onRetry={retryGroupsAction} />
            ) : isGroupsLoading || !displayedGroups ? (
              <SkeletonRows count={3} />
            ) : displayedGroups.length === 0 ? (
              <EmptyText>{t('mob.home.groups_empty')}</EmptyText>
            ) : (
              displayedGroups.map(group => (
                <UnifiedGroupCard
                  key={group.id}
                  group={group}
                  perfScreen="HomeScreen"
                  currentUserId={user?.id}
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
        )}

        {/* Create Game card: stays visible on both tabs */}
        <CreateGameCard onPress={() => navigation.navigate('CreateGame')} />
      </ScrollView>

      {/* Hamburger Drawer Menu */}
      <DrawerMenu
        visible={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        user={user}
        avatarUrl={profile.data?.avatar_url}
        menuData={menuData}
        currentScreen="Home"
        onNavigateHome={() => {
          scrollRef.current?.scrollTo({ y: 0, animated: true });
        }}
        onNavigateGroups={() => {
          navigation.navigate('Groups', { screen: 'GroupsList' });
        }}
        onNavigateTournamentTeams={() => {
          navigation.navigate('Groups', { screen: 'TournamentTeams' });
        }}
        onNavigateGames={() => {
          navigation.navigate('Tournaments', {
            screen: 'TournamentsList',
            params: { scope: 'all', entryKey: Date.now(), segment: 'games' },
          });
        }}
        onNavigateTournaments={() => {
          navigation.navigate('Tournaments', {
            screen: 'TournamentsList',
            params: { segment: 'tournaments', entryKey: Date.now() },
          });
        }}
        onNavigateProfile={() => {
          navigation.navigate('Profile', { screen: 'ProfileHome' });
        }}
      />

      <Toast message={toastMessage} onDismiss={() => setToastMessage(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  screen: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  content: {
    paddingBottom: spacing.lg,
  },
  statsSection: {
    paddingHorizontal: spacing.md,
    marginTop: spacing.xs,
  },
});
