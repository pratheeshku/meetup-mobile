/**
 * Groups list (DES-MEETUP-MOBILE.md §4.4, §7.5; R-030).
 *
 * Enhanced My Groups landing page with:
 * - Header with title and descriptive subtitle
 * - Filter pills ('All', 'Organised', 'Member') matching My Games design
 * - Enriched group cards with owner info ("Owner: Self" / "Owner: <name>"),
 *   member count, and multi-line descriptions
 * - Contextual empty states with direct Create Group action
 */
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useScrollToTop } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { getGroups } from '../api/groups';
import { useAuth } from '../auth/AuthContext';
import EmptyState from '../components/EmptyState';
import ErrorView from '../components/ErrorView';
import { headerAddButton } from '../components/HeaderAddButton';
import { UnifiedGroupCard } from '../components/home/UnifiedCard';
import LoadingView from '../components/LoadingView';
import SegmentedSwitch from '../components/SegmentedSwitch';
import TeamsSection from '../components/TeamsSection';
import { borderWidth, colors, radius, spacing, typography } from '../theme/tokens';
import type { Group } from '../types/group';
import type { GroupsStackParamList } from '../navigation/types';
import { useRefetchOnFocus } from '../hooks/useRefetchOnFocus';
import { useT } from '../labels/LabelsContext';
import type { LabelKey } from '../labels/fallbackLabels';

type Props = NativeStackScreenProps<GroupsStackParamList, 'GroupsList'>;

export type GroupFilter = 'All' | 'Organised' | 'Member';

const FILTER_LABEL_KEYS: Record<GroupFilter, LabelKey> = {
  All: 'mob.groups.filter_all',
  Organised: 'mob.groups.filter_organised',
  Member: 'mob.groups.filter_joined',
};

function GroupsListBody({ navigation, route }: Props): React.JSX.Element {
  const t = useT();
  const tRef = useRef(t);
  tRef.current = t;
  const { user } = useAuth();
  const [groups, setGroups] = useState<Group[]>([]);
  const [activeFilter, setActiveFilter] = useState<GroupFilter>('All');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scrollRef = useRef<FlatList<Group>>(null);
  useScrollToTop(scrollRef);

  useFocusEffect(
    useCallback(() => {
      scrollRef.current?.scrollToOffset({ offset: 0, animated: false });
    }, []),
  );

  // A fresh load (focus / foreground) never shows the previous rows (AC-10): the loading state
  // takes their place, and a failure shows the error state. Pull-to-refresh and the
  // post-create refresh (`isRefresh`) keep the rows loaded in this open.
  const loadGroups = useCallback(async (isRefresh: boolean) => {
    if (isRefresh) {
      setIsRefreshing(true);
    } else {
      setGroups([]);
      setIsLoading(true);
    }
    setError(null);
    try {
      const response = await getGroups({ mine: true });
      setGroups(response.items);
    } catch {
      if (!isRefresh) {
        setError(tRef.current('mob.groups.load_error'));
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  // Fetch on every focus and when the app returns to the foreground.
  useRefetchOnFocus(
    navigation,
    useCallback(() => {
      loadGroups(false);
    }, [loadGroups]),
  );

  // Create Group/Tournament pops back here with a fresh `refreshKey` on
  // success; re-fetch once per new key (the initial mount load is above).
  const refreshKey = route.params?.refreshKey;
  useEffect(() => {
    if (refreshKey !== undefined) {
      loadGroups(true);
    }
  }, [refreshKey, loadGroups]);

  const filteredGroups = useMemo(() => {
    if (activeFilter === 'Organised') {
      return groups.filter(
        g => g.current_user_role === 'owner' || (Boolean(user?.id) && Boolean(g.owner_id) && g.owner_id === user?.id),
      );
    }
    if (activeFilter === 'Member') {
      return groups.filter(
        g => g.current_user_role !== 'owner' && (!user?.id || g.owner_id !== user?.id),
      );
    }
    return groups;
  }, [groups, activeFilter, user?.id]);

  if (isLoading && groups.length === 0) {
    return <LoadingView />;
  }

  if (error && groups.length === 0) {
    return <ErrorView message={error} onRetry={() => loadGroups(false)} />;
  }

  const renderHeader = () => (
    <View style={styles.headerContainer}>
      <View style={styles.headerBlock}>
        <Text style={styles.screenTitle} accessibilityRole="header">
          {t('mob.groups.title')}
        </Text>
        <Text style={styles.screenSubtitle}>
          {t('mob.groups.subtitle')}
        </Text>
      </View>
      {groups.length > 0 ? (
        <View style={styles.filterPillsRow}>
          {(['All', 'Organised', 'Member'] as const).map(tab => {
            const isSelected = activeFilter === tab;
            return (
              <Pressable
                key={tab}
                accessibilityRole="button"
                accessibilityLabel={t(FILTER_LABEL_KEYS[tab])}
                accessibilityState={{ selected: isSelected }}
                onPress={() => setActiveFilter(tab)}
                style={[
                  styles.filterPill,
                  isSelected ? styles.filterPillSelected : styles.filterPillIdle,
                ]}
              >
                <Text
                  style={[
                    styles.filterPillText,
                    isSelected ? styles.filterTextSelected : styles.filterTextIdle,
                  ]}
                >
                  {t(FILTER_LABEL_KEYS[tab])}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );

  return (
    <FlatList
      ref={scrollRef}
      data={filteredGroups}
      keyExtractor={item => item.id}
      contentContainerStyle={filteredGroups.length === 0 ? styles.emptyContainer : styles.listContainer}
      ListHeaderComponent={renderHeader}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={() => loadGroups(true)}
          colors={[colors.primary]}
          progressBackgroundColor={colors.surface}
        />
      }
      ListEmptyComponent={
        groups.length === 0 ? (
          <EmptyState
            title={t('mob.groups.empty_title')}
            subtitle={t('mob.groups.empty_subtitle')}
          />
        ) : (
          <EmptyState
            title={t(
              activeFilter === 'Organised' ? 'mob.groups.empty_organised' : 'mob.groups.empty_joined',
            )}
            subtitle={
              t(
                activeFilter === 'Organised'
                  ? 'mob.groups.empty_organised_hint'
                  : 'mob.groups.empty_joined_hint',
              )
            }
          />
        )
      }
      renderItem={({ item }) => (
        <UnifiedGroupCard
          group={item}
          currentUserId={user?.id}
          showRolePill
          onPress={() => navigation.navigate('GroupDetail', { groupId: item.id })}
        />
      )}
    />
  );
}

type Section = 'groups' | 'teams';

/**
 * Groups screen: a "Groups | Tournament teams" switch (the Games | Tournaments switch component) over the groups list and the caller's
 * tournament teams (teams-payments AD-4). Both stay mounted once visited, so switching never reloads what was already read. The header "+" creates
 * what the selected section lists. `route.params.section` (a team push, AD-15) opens with Tournament teams selected.
 */
export default function GroupsScreen(props: Props): React.JSX.Element {
  const { navigation, route } = props;
  const t = useT();
  const requested = route.params?.section;
  const [section, setSection] = useState<Section>(requested === 'teams' ? 'teams' : 'groups');
  const [teamsVisited, setTeamsVisited] = useState(section === 'teams');
  const [teamsReload, setTeamsReload] = useState(0);

  const changeSection = useCallback((next: Section) => {
    setSection(next);
    if (next === 'teams') {
      setTeamsVisited(true);
      setTeamsReload(value => value + 1);
    }
  }, []);

  // A push (or any navigation) that asks for the teams section while the screen is already open.
  // The request is consumed (param cleared) so a later tap on Groups is not undone by the same param.
  useEffect(() => {
    if (requested === 'teams') {
      if (section !== 'teams') {
        changeSection('teams');
      }
      navigation.setParams?.({ section: undefined });
    }
  }, [requested, route.params, section, changeSection, navigation]);

  // Coming back from a team detail (join, accept, leave, ...) reads the lists again; the first focus is the mount load.
  useEffect(() => {
    if (!teamsVisited) {
      return undefined;
    }
    return navigation.addListener?.('focus', () => setTeamsReload(value => value + 1));
  }, [navigation, teamsVisited]);

  const openCreateTeam = useCallback(() => navigation.navigate('CreateGroup', { kind: 'team' }), [navigation]);
  const openTeam = useCallback((teamId: string) => navigation.navigate('TeamDetail', { teamId }), [navigation]);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight:
        section === 'teams'
          ? headerAddButton(t('mob.teams.create_a11y'), openCreateTeam)
          : headerAddButton(t('mob.groups.create_a11y'), () => navigation.navigate('CreateGroup')),
    });
  }, [navigation, t, section, openCreateTeam]);

  return (
    <View style={styles.screen}>
      <View style={styles.switchWrap}>
        <SegmentedSwitch<Section>
          options={[
            { value: 'groups', label: t('mob.groups.switch_groups') },
            { value: 'teams', label: t('mob.groups.switch_teams') },
          ]}
          value={section}
          onChange={changeSection}
        />
      </View>
      <View style={[styles.flex, section === 'groups' ? null : styles.hidden]}>
        <GroupsListBody {...props} />
      </View>
      {teamsVisited ? (
        <View style={[styles.flex, section === 'teams' ? null : styles.hidden]}>
          <TeamsSection onCreateTeam={openCreateTeam} onOpenTeam={openTeam} reloadKey={teamsReload} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  hidden: { display: 'none' },
  switchWrap: { padding: spacing.md, paddingBottom: spacing.sm },
  listContainer: {
    padding: spacing.md,
    backgroundColor: colors.background,
  },
  emptyContainer: {
    flexGrow: 1,
    padding: spacing.md,
    backgroundColor: colors.background,
  },
  headerContainer: {
    marginBottom: spacing.md,
  },
  headerBlock: {
    marginBottom: spacing.sm,
  },
  screenTitle: {
    ...typography.h1,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  screenSubtitle: {
    ...typography.body,
    fontSize: 14,
    color: colors.textSecondary,
  },
  filterPillsRow: {
    flexDirection: 'row',
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  filterPill: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    borderWidth: borderWidth.thin,
    marginRight: spacing.sm,
  },
  filterPillSelected: {
    backgroundColor: colors.ctaBlue,
    borderColor: colors.ctaBlue,
  },
  filterPillIdle: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
  },
  filterPillText: {
    ...typography.body,
    fontSize: 13,
    fontWeight: '600',
  },
  filterTextSelected: {
    color: colors.white,
  },
  filterTextIdle: {
    color: colors.textSecondary,
  },
});
