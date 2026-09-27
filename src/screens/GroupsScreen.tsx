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

import { getMyGroups } from '../api/groups';
import EmptyState from '../components/EmptyState';
import ErrorView from '../components/ErrorView';
import GroupCard from '../components/GroupCard';
import { headerAddButton } from '../components/HeaderAddButton';
import LoadingView from '../components/LoadingView';
import { borderWidth, colors, radius, spacing, typography } from '../theme/tokens';
import type { Group } from '../types/group';
import type { GroupsStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<GroupsStackParamList, 'GroupsList'>;

export type GroupFilter = 'All' | 'Organised' | 'Member';

export default function GroupsScreen({ navigation, route }: Props): React.JSX.Element {
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

  const loadGroups = useCallback(async (isRefresh: boolean) => {
    if (isRefresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    setError(null);
    try {
      const response = await getMyGroups({ enrich: true });
      setGroups(response.items);
    } catch {
      setError('Could not load your groups. Please try again.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadGroups(false);
  }, [loadGroups]);

  // Create Group/Tournament pops back here with a fresh `refreshKey` on
  // success; re-fetch once per new key (the initial mount load is above).
  const refreshKey = route.params?.refreshKey;
  useEffect(() => {
    if (refreshKey !== undefined) {
      loadGroups(true);
    }
  }, [refreshKey, loadGroups]);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: headerAddButton('Create Group', () => navigation.navigate('CreateGroup')),
    });
  }, [navigation]);

  const filteredGroups = useMemo(() => {
    if (activeFilter === 'Organised') {
      return groups.filter(g => g.current_user_role === 'owner');
    }
    if (activeFilter === 'Member') {
      return groups.filter(g => g.current_user_role !== 'owner');
    }
    return groups;
  }, [groups, activeFilter]);

  if (isLoading) {
    return <LoadingView />;
  }

  if (error) {
    return <ErrorView message={error} onRetry={() => loadGroups(false)} />;
  }

  const renderHeader = () => (
    <View style={styles.headerContainer}>
      <View style={styles.headerBlock}>
        <Text style={styles.screenTitle} accessibilityRole="header">
          My Groups
        </Text>
        <Text style={styles.screenSubtitle}>
          Communities and clubs you organise and belong to.
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
                accessibilityLabel={tab}
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
                  {tab}
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
            title="You're not in any groups yet."
            subtitle="Tap '+' above to create a group and invite your teammates."
          />
        ) : (
          <EmptyState
            title={`No ${activeFilter.toLowerCase()} groups.`}
            subtitle={
              activeFilter === 'Organised'
                ? "You don't organise any groups yet."
                : "You haven't joined any other groups as a member yet."
            }
          />
        )
      }
      renderItem={({ item }) => (
        <GroupCard
          group={item}
          onPress={() => navigation.navigate('GroupDetail', { groupId: item.id })}
        />
      )}
    />
  );
}

const styles = StyleSheet.create({
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
