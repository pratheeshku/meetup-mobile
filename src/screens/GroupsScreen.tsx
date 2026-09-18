/**
 * Groups list (DES-MEETUP-MOBILE.md §4.4, §7.5; R-030).
 *
 * Fetches the groups the signed-in user belongs to (owned or member) on
 * mount, via `getMyGroups()` — see `src/api/groups.ts` for the
 * `/settings/groups-owned` + `/settings/groups-member` sourcing note.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { getMyGroups } from '../api/groups';
import type { Group, GroupRole } from '../types/group';
import type { GroupsStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<GroupsStackParamList, 'GroupsList'>;

const ROLE_BADGE_LABEL: Record<GroupRole, string> = {
  owner: 'Owner',
  admin: 'Admin',
  member: 'Member',
  none: 'None',
};

export default function GroupsScreen({ navigation }: Props): React.JSX.Element {
  const [groups, setGroups] = useState<Group[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error}</Text>
        <Pressable style={styles.retryButton} onPress={() => loadGroups(false)}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <FlatList
      data={groups}
      keyExtractor={item => item.id}
      contentContainerStyle={groups.length === 0 ? styles.emptyContainer : styles.listContainer}
      refreshControl={
        <RefreshControl refreshing={isRefreshing} onRefresh={() => loadGroups(true)} />
      }
      ListEmptyComponent={
        <View style={styles.centered}>
          <Text style={styles.emptyText}>You&apos;re not in any groups yet.</Text>
        </View>
      }
      renderItem={({ item }) => (
        <Pressable
          style={styles.card}
          onPress={() => navigation.navigate('GroupDetail', { groupId: item.id })}
        >
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle} numberOfLines={1}>
              {item.name}
            </Text>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{ROLE_BADGE_LABEL[item.current_user_role]}</Text>
            </View>
          </View>
          {item.member_count !== undefined ? (
            <Text style={styles.cardMeta}>
              {item.member_count} {item.member_count === 1 ? 'member' : 'members'}
            </Text>
          ) : null}
        </Pressable>
      )}
    />
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  listContainer: { padding: 16 },
  emptyContainer: { flexGrow: 1, justifyContent: 'center' },
  emptyText: { fontSize: 16, color: '#666', textAlign: 'center' },
  errorText: { fontSize: 16, color: '#c0392b', textAlign: 'center', marginBottom: 16 },
  retryButton: {
    backgroundColor: '#2563eb',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  retryButtonText: { color: '#fff', fontWeight: '600' },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#eee',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  cardTitle: { fontSize: 17, fontWeight: '700', flexShrink: 1 },
  cardMeta: { fontSize: 14, color: '#555', marginTop: 2 },
  badge: {
    backgroundColor: '#2563eb',
    borderRadius: 6,
    paddingVertical: 3,
    paddingHorizontal: 8,
    marginLeft: 8,
  },
  badgeText: { color: '#fff', fontSize: 12, fontWeight: '600' },
});
