/**
 * Notification history (the bell's destination): the user's recent stored
 * notifications, newest first, from `GET /notifications/history` (live
 * OpenAPI; the backend keeps ~5 days). Cursor-paginated on scroll.
 *
 * Tapping a row marks it read (optimistic — reverted if the call fails) and
 * opens the same screen a push tap would, via the shared
 * `resolveNotificationTarget`/`navigateToNotificationTarget`. A row is NOT
 * navigated when its type is unknown to this build or it has no entity id
 * (except `global`, which has no entity): `resolveNotificationTarget` throws on
 * an unknown type and would open a detail screen with an empty id otherwise.
 * The read call is skipped for an already-read row.
 *
 * Nothing here logs notification content (R-111).
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { getNotificationHistory, markNotificationRead } from '../api/notifications';
import EmptyState from '../components/EmptyState';
import ErrorView from '../components/ErrorView';
import LoadingView from '../components/LoadingView';
import {
  navigateToNotificationTarget,
  resolveNotificationTarget,
} from '../notifications/notificationRouting';
import { borderWidth, colors, opacity, spacing, typography } from '../theme/tokens';
import { NOTIFICATION_TYPES } from '../types/notification';
import type { NotificationHistoryItem, NotificationType } from '../types/notification';
import { formatRelativeTime } from '../utils/formatRelativeTime';

const UNREAD_BORDER_WIDTH = 4;

function isKnownType(value: string): value is NotificationType {
  return (NOTIFICATION_TYPES as string[]).includes(value);
}

function openNotification(item: NotificationHistoryItem): void {
  if (!isKnownType(item.notification_type)) {
    return;
  }
  const entityId = item.entity_id?.trim() ?? '';
  if (entityId === '' && item.notification_type !== 'global') {
    return;
  }
  navigateToNotificationTarget(resolveNotificationTarget(item.notification_type, entityId));
}

interface RowProps {
  item: NotificationHistoryItem;
  onPress: (item: NotificationHistoryItem) => void;
}

function NotificationRow({ item, onPress }: RowProps): React.JSX.Element {
  const unread = item.read_at === null;
  const title = item.title?.trim() ? item.title : 'Notification';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${unread ? 'Unread. ' : ''}${title}${item.body ? `. ${item.body}` : ''}`}
      onPress={() => onPress(item)}
      style={({ pressed }) => [
        styles.row,
        unread ? styles.rowUnread : styles.rowRead,
        pressed ? styles.pressed : null,
      ]}
    >
      <Text style={[styles.title, unread ? styles.titleUnread : styles.titleRead]} numberOfLines={2}>
        {title}
      </Text>
      {item.body ? (
        <Text style={styles.body} numberOfLines={2}>
          {item.body}
        </Text>
      ) : null}
      <Text style={styles.time}>{formatRelativeTime(item.created_at)}</Text>
    </Pressable>
  );
}

export default function NotificationHistoryScreen(): React.JSX.Element {
  const [items, setItems] = useState<NotificationHistoryItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [moreError, setMoreError] = useState(false);
  // Synchronous guard: `onEndReached` can fire twice before state updates land.
  const loadingMoreRef = useRef(false);

  const loadFirstPage = useCallback(async () => {
    setIsLoading(true);
    setLoadError(false);
    setMoreError(false);
    try {
      const page = await getNotificationHistory();
      setItems(page.items);
      setNextCursor(page.next_cursor ?? null);
    } catch {
      setLoadError(true);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFirstPage();
  }, [loadFirstPage]);

  const loadMore = useCallback(async () => {
    if (!nextCursor || loadingMoreRef.current) {
      return;
    }
    loadingMoreRef.current = true;
    setIsLoadingMore(true);
    setMoreError(false);
    try {
      const page = await getNotificationHistory(nextCursor);
      setItems(current => {
        const seen = new Set(current.map(existing => existing.id));
        return [...current, ...page.items.filter(incoming => !seen.has(incoming.id))];
      });
      setNextCursor(page.next_cursor ?? null);
    } catch {
      setMoreError(true);
    } finally {
      loadingMoreRef.current = false;
      setIsLoadingMore(false);
    }
  }, [nextCursor]);

  const handlePress = useCallback((item: NotificationHistoryItem) => {
    if (item.read_at === null) {
      const optimisticReadAt = new Date().toISOString();
      const setReadAt = (id: string, readAt: string | null, onlyIf: string | null): void =>
        setItems(current =>
          current.map(existing =>
            existing.id === id && existing.read_at === onlyIf
              ? { ...existing, read_at: readAt }
              : existing,
          ),
        );
      setReadAt(item.id, optimisticReadAt, null);
      markNotificationRead(item.id).catch(() => {
        // Server did not record it: put the row back to unread.
        setReadAt(item.id, null, optimisticReadAt);
      });
    }
    openNotification(item);
  }, []);

  if (isLoading) {
    return <LoadingView />;
  }

  if (loadError) {
    return (
      <ErrorView
        message="Could not load your notifications. Please try again."
        onRetry={loadFirstPage}
      />
    );
  }

  if (items.length === 0) {
    return <EmptyState title="No notifications in the last 5 days" />;
  }

  return (
    <FlatList
      data={items}
      keyExtractor={item => item.id}
      renderItem={({ item }) => <NotificationRow item={item} onPress={handlePress} />}
      onEndReached={loadMore}
      onEndReachedThreshold={0.5}
      ListFooterComponent={
        isLoadingMore ? (
          <ActivityIndicator style={styles.footer} color={colors.primary} />
        ) : moreError ? (
          <Pressable accessibilityRole="button" onPress={loadMore} style={styles.footer}>
            <Text style={styles.footerError}>Could not load more. Tap to retry.</Text>
          </Pressable>
        ) : (
          <View />
        )
      }
      style={styles.list}
    />
  );
}

const styles = StyleSheet.create({
  list: { backgroundColor: colors.background },
  row: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: borderWidth.thin,
    borderBottomColor: colors.border,
    borderLeftWidth: UNREAD_BORDER_WIDTH,
  },
  rowUnread: { borderLeftColor: colors.primary },
  rowRead: { borderLeftColor: 'transparent' },
  pressed: { opacity: opacity.pressed },
  title: { ...typography.body, color: colors.textPrimary },
  titleUnread: { fontWeight: '700' },
  titleRead: { fontWeight: '400' },
  body: { ...typography.body, color: colors.textSecondary, marginTop: spacing.xs },
  time: { ...typography.caption, color: colors.textMuted, marginTop: spacing.xs },
  footer: { padding: spacing.md, alignItems: 'center' },
  footerError: { ...typography.body, color: colors.error },
});
