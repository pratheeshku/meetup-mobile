/**
 * Groups list (DES-MEETUP-MOBILE.md §4.4, §7.5; R-030).
 *
 * Fetches the groups the signed-in user belongs to (owned or member) on
 * mount, via `getMyGroups()` — see `src/api/groups.ts` for the
 * `/settings/groups-owned` + `/settings/groups-member` sourcing note.
 */
import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet } from 'react-native';
import { useFocusEffect, useScrollToTop } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { getMyGroups } from '../api/groups';
import EmptyState from '../components/EmptyState';
import ErrorView from '../components/ErrorView';
import GroupCard from '../components/GroupCard';
import { headerAddButton } from '../components/HeaderAddButton';
import LoadingView from '../components/LoadingView';
import { colors, spacing } from '../theme/tokens';
import type { Group } from '../types/group';
import type { GroupsStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<GroupsStackParamList, 'GroupsList'>;

export default function GroupsScreen({ navigation, route }: Props): React.JSX.Element {
  const [groups, setGroups] = useState<Group[]>([]);
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
      const response = await getMyGroups();
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

  // Direct create entry point in this tab's own header. Set here (not in
  // the navigator) so it shows in the loading and error states too.
  //
  // `headerRight` must NOT call hooks: React Navigation invokes it as a plain
  // function inside its own header-config hook (not as a component), and it
  // only appears after this layout effect runs — so a hook here (e.g.
  // `useNavigation`) is an extra hook on the second render and triggers
  // "change in the order of Hooks called by SceneView". It closes over the
  // `navigation` prop instead.
  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: headerAddButton('Create Group', () => navigation.navigate('CreateGroup')),
    });
  }, [navigation]);

  if (isLoading) {
    return <LoadingView />;
  }

  if (error) {
    return <ErrorView message={error} onRetry={() => loadGroups(false)} />;
  }

  return (
    <FlatList
      ref={scrollRef}
      data={groups}
      keyExtractor={item => item.id}
      contentContainerStyle={groups.length === 0 ? styles.emptyContainer : styles.listContainer}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={() => loadGroups(true)}
          colors={[colors.primary]}
          progressBackgroundColor={colors.surface}
        />
      }
      ListEmptyComponent={<EmptyState title="You're not in any groups yet." />}
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
  listContainer: { padding: spacing.md },
  emptyContainer: { flexGrow: 1, justifyContent: 'center' },
});
