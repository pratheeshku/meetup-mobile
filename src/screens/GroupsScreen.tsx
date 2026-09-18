/**
 * Groups list (DES-MEETUP-MOBILE.md §4.4, §7.5; R-030).
 *
 * Fetches the groups the signed-in user belongs to (owned or member) on
 * mount, via `getMyGroups()` — see `src/api/groups.ts` for the
 * `/settings/groups-owned` + `/settings/groups-member` sourcing note.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { getMyGroups } from '../api/groups';
import Badge from '../components/Badge';
import type { BadgeVariant } from '../components/Badge';
import Card from '../components/Card';
import EmptyState from '../components/EmptyState';
import ErrorView from '../components/ErrorView';
import LoadingView from '../components/LoadingView';
import { colors, spacing, typography } from '../theme/tokens';
import type { Group, GroupRole } from '../types/group';
import type { GroupsStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<GroupsStackParamList, 'GroupsList'>;

const ROLE_BADGE_LABEL: Record<GroupRole, string> = {
  owner: 'Owner',
  admin: 'Admin',
  member: 'Member',
  none: 'None',
};

const ROLE_BADGE_VARIANT: Record<GroupRole, BadgeVariant> = {
  owner: 'primary',
  admin: 'primary',
  member: 'neutral',
  none: 'neutral',
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
    return <LoadingView />;
  }

  if (error) {
    return <ErrorView message={error} onRetry={() => loadGroups(false)} />;
  }

  return (
    <FlatList
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
        <Card
          style={styles.card}
          onPress={() => navigation.navigate('GroupDetail', { groupId: item.id })}
        >
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle} numberOfLines={1}>
              {item.name}
            </Text>
            <Badge
              label={ROLE_BADGE_LABEL[item.current_user_role]}
              variant={ROLE_BADGE_VARIANT[item.current_user_role]}
              style={styles.badge}
            />
          </View>
          {item.member_count !== undefined ? (
            <Text style={styles.cardMeta}>
              {item.member_count} {item.member_count === 1 ? 'member' : 'members'}
            </Text>
          ) : null}
        </Card>
      )}
    />
  );
}

const styles = StyleSheet.create({
  listContainer: { padding: spacing.md },
  emptyContainer: { flexGrow: 1, justifyContent: 'center' },
  card: { marginBottom: spacing.md },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  cardTitle: { ...typography.h3, color: colors.textPrimary, flexShrink: 1 },
  cardMeta: { ...typography.body, color: colors.textSecondary, marginTop: spacing.xs },
  badge: { marginLeft: spacing.sm },
});
