/**
 * Notification History Screen (DES-MEETUP-MOBILE §4.8, §7.6; revamping per images 01-13).
 *
 * Requirements:
 * - A. Labels: all text through ui_labels / useT, per-type templates formatted.
 * - B. Screen:
 *   - Header: back, title, right-hand "Mark all as read" (blue with check icon; muted/disabled when unread count is 0).
 *   - Tabs: All | Unread | Read (pills, min height 44; Unread shows count chip when > 0: white on active blue pill, blue on inactive).
 *   - One list, newest first, cursor-paged, grouped Today / Yesterday / Earlier by device local date. Empty groups hidden.
 *   - Card styles:
 *     - Unread: bg #EAF1FF, border #C6D9FF, title weight 800, body #52617E, blue time + 10px blue dot, full-colour icon tile.
 *     - Read: white, border #E3EAF7, title weight 600, body #62718F, grey time, no dot, icon tile at 60% opacity no shadow.
 *   - Footer: "Notifications are kept for {days} days", days from API (defaults to 90).
 *   - Empty states: Unread empty = "You're all caught up" with "View all notifications" button (image 06); All/Read matching style.
 * - C. Actions:
 *   - Tap card: mark read if unread, then open related target.
 *   - Swipe left: reveals 96px action button (Unread: "Mark read" blue; Read: "Mark unread" grey). Accessible alternative via long-press/accessibility actions.
 *   - Mark all as read: bulk call, flips all to read styling, chip and badge drop to 0.
 *   - Optimistic updates with rollback on failure.
 *   - Undo toast: dark bar #0F2347, 16px side margin, message + "Undo" (#9CC0FF, 44px target), 5-second timer.
 * - D. Icons: RegistryIcon / NotificationIcon mapping matching image 09.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  ActivityIndicator,
  Linking,
  Pressable,
  SectionList,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  getNotificationHistory,
  getUnreadCount,
  markAllNotificationsRead,
  markNotificationRead,
  markNotificationUnread,
} from '../api/notifications';
import NotificationCard from '../components/NotificationCard';
import ErrorView from '../components/ErrorView';
import LoadingView from '../components/LoadingView';
import { RegistryIcon } from '../components/icons/RegistryIcons';
import { BackArrowIcon, CheckIcon } from '../components/icons/ActionIcons';
import { useT, currentT } from '../labels/LabelsContext';
import type { LabelKey } from '../labels/LabelsContext';
import {
  navigateToNotificationTarget,
  resolveNotificationTarget,
} from '../notifications/notificationRouting';
import {
  getUnreadBadgeCount,
  setUnreadBadgeCount,
} from '../notifications/unreadCountStore';
import { NOTIFICATION_TYPES } from '../types/notification';
import type {
  NotificationHistoryItem,
  NotificationType,
} from '../types/notification';
import { getNotificationGroup } from '../utils/notificationDateUtils';

export type TabType = 'all' | 'unread' | 'read';

interface UndoState {
  type: 'single_read' | 'single_unread' | 'mark_all';
  message: string;
  itemIds: string[];
  previousReadAtMap: Record<string, string | null>;
  previousUnreadCount: number;
}

function isKnownType(value: string): value is NotificationType {
  return (NOTIFICATION_TYPES as string[]).includes(value);
}

function openNotification(item: NotificationHistoryItem): void {
  const url = item.payload?.display?.url;
  if (url) {
    try {
      const parsedUrl = new URL(url);
      const isApiOrWebHost = parsedUrl.protocol === 'https:' && parsedUrl.hostname === 'meetups.duckdns.org';
      const isAppScheme = parsedUrl.protocol === 'shuttlr:' || parsedUrl.protocol === 'meetup:';
      
      if (isApiOrWebHost || isAppScheme) {
        Linking.openURL(url).catch(() => {
          Alert.alert(currentT('mob.errors.open_link_failed'), currentT('mob.errors.try_later'));
        });
      } else {
        Alert.alert(currentT('mob.errors.open_link_failed'), currentT('mob.errors.try_later'));
      }
    } catch {
      Alert.alert(currentT('mob.errors.open_link_failed'), currentT('mob.errors.try_later'));
    }
    return;
  }


  if (!isKnownType(item.notification_type)) {
    return;
  }
  const entityId = item.entity_id?.trim() ?? '';
  if (entityId === '' && item.notification_type !== 'global') {
    return;
  }
  navigateToNotificationTarget(resolveNotificationTarget(item.notification_type, entityId));
}

interface Props {
  navigation?: {
    goBack?: () => void;
    navigate?: (name: string, params?: any) => void;
  };
}

export default function NotificationHistoryScreen({ navigation }: Props = {}): React.JSX.Element {
  const t = useT();

  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [items, setItems] = useState<NotificationHistoryItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [retentionDays, setRetentionDays] = useState<number>(90);
  const [unreadCount, setUnreadCountState] = useState<number>(0);

  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [moreError, setMoreError] = useState(false);

  // Undo toast state
  const [undoState, setUndoState] = useState<UndoState | null>(null);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Synchronous guard for onEndReached
  const loadingMoreRef = useRef(false);

  // Synchronize unread badge with local state
  const updateUnreadCount = useCallback((count: number) => {
    const validCount = Math.max(0, count);
    setUnreadCountState(validCount);
    setUnreadBadgeCount(validCount);
  }, []);

  const loadFirstPage = useCallback(async () => {
    setIsLoading(true);
    setLoadError(false);
    try {
      const countPromise =
        typeof getUnreadCount === 'function'
          ? getUnreadCount().catch(() => ({ count: 0 }))
          : Promise.resolve({ count: 0 });
      const [page, countRes] = await Promise.all([
        getNotificationHistory(),
        countPromise,
      ]);
      setItems(page.items);
      setNextCursor(page.next_cursor ?? null);
      if (page.retention_days || page.days) {
        setRetentionDays(page.retention_days ?? page.days ?? 90);
      }
      // Reconcile count: use server count or unread items in page
      const pageUnreads = page.items.filter(it => it.read_at === null).length;
      const initialCount = countRes.count > 0 ? countRes.count : pageUnreads;
      updateUnreadCount(initialCount);
    } catch {
      setLoadError(true);
    } finally {
      setIsLoading(false);
    }
  }, [updateUnreadCount]);

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

  // Toast timer management
  const showToast = useCallback((state: UndoState) => {
    if (undoTimerRef.current) {
      clearTimeout(undoTimerRef.current);
    }
    setUndoState(state);
    undoTimerRef.current = setTimeout(() => {
      setUndoState(null);
    }, 5000);
  }, []);

  const dismissToast = useCallback(() => {
    if (undoTimerRef.current) {
      clearTimeout(undoTimerRef.current);
    }
    setUndoState(null);
  }, []);

  // 1. Card tap: mark read if unread, then navigate
  const handlePress = useCallback(
    (item: NotificationHistoryItem) => {
      if (item.read_at === null) {
        const optimisticReadAt = new Date().toISOString();
        const prevCount = unreadCount;
        setItems(current =>
          current.map(it => (it.id === item.id ? { ...it, read_at: optimisticReadAt } : it)),
        );
        updateUnreadCount(prevCount - 1);

        markNotificationRead(item.id).catch(() => {
          // Rollback on failure
          setItems(current =>
            current.map(it =>
              it.id === item.id && it.read_at === optimisticReadAt
                ? { ...it, read_at: null }
                : it,
            ),
          );
          updateUnreadCount(prevCount);
        });
      }
      openNotification(item);
    },
    [unreadCount, updateUnreadCount],
  );

  // 2. Toggle read via swipe action or accessible long-press
  const handleToggleRead = useCallback(
    (item: NotificationHistoryItem) => {
      const isCurrentlyUnread = item.read_at === null;
      const prevCount = unreadCount;
      const prevReadAt = item.read_at;

      if (isCurrentlyUnread) {
        // Mark read
        const optimisticReadAt = new Date().toISOString();
        setItems(current =>
          current.map(it => (it.id === item.id ? { ...it, read_at: optimisticReadAt } : it)),
        );
        updateUnreadCount(prevCount - 1);

        showToast({
          type: 'single_read',
          message: t('mob.notif_history.toast_marked_read'),
          itemIds: [item.id],
          previousReadAtMap: { [item.id]: null },
          previousUnreadCount: prevCount,
        });

        markNotificationRead(item.id).catch(() => {
          // Rollback
          setItems(current =>
            current.map(it =>
              it.id === item.id && it.read_at === optimisticReadAt
                ? { ...it, read_at: null }
                : it,
            ),
          );
          updateUnreadCount(prevCount);
          dismissToast();
        });
      } else {
        // Mark unread
        setItems(current =>
          current.map(it => (it.id === item.id ? { ...it, read_at: null } : it)),
        );
        updateUnreadCount(prevCount + 1);

        showToast({
          type: 'single_unread',
          message: t('mob.notif_history.toast_marked_unread'),
          itemIds: [item.id],
          previousReadAtMap: { [item.id]: prevReadAt },
          previousUnreadCount: prevCount,
        });

        markNotificationUnread(item.id).catch(() => {
          // Rollback
          setItems(current =>
            current.map(it =>
              it.id === item.id && it.read_at === null
                ? { ...it, read_at: prevReadAt }
                : it,
            ),
          );
          updateUnreadCount(prevCount);
          dismissToast();
        });
      }
    },
    [dismissToast, showToast, t, unreadCount, updateUnreadCount],
  );

  // 3. Mark all as read
  const handleMarkAllAsRead = useCallback(() => {
    const unreadItems = items.filter(it => it.read_at === null);
    if (unreadItems.length === 0) {
      return;
    }

    const prevCount = unreadCount;
    const previousMap: Record<string, string | null> = {};
    unreadItems.forEach(it => {
      previousMap[it.id] = it.read_at;
    });

    const optimisticReadAt = new Date().toISOString();
    setItems(current => current.map(it => ({ ...it, read_at: it.read_at ?? optimisticReadAt })));
    updateUnreadCount(0);

    showToast({
      type: 'mark_all',
      message: t('mob.notif_history.toast_all_marked_read'),
      itemIds: unreadItems.map(it => it.id),
      previousReadAtMap: previousMap,
      previousUnreadCount: prevCount,
    });

    markAllNotificationsRead().catch(() => {
      // Rollback
      setItems(current =>
        current.map(it =>
          previousMap[it.id] !== undefined ? { ...it, read_at: previousMap[it.id] } : it,
        ),
      );
      updateUnreadCount(prevCount);
      dismissToast();
    });
  }, [dismissToast, items, showToast, t, unreadCount, updateUnreadCount]);

  // 4. Undo action
  const handleUndo = useCallback(() => {
    if (!undoState) return;

    const { type, itemIds, previousReadAtMap, previousUnreadCount } = undoState;
    dismissToast();

    if (type === 'single_read') {
      const id = itemIds[0];
      setItems(current =>
        current.map(it => (it.id === id ? { ...it, read_at: null } : it)),
      );
      updateUnreadCount(previousUnreadCount);
      markNotificationUnread(id).catch(() => {
        // Rollback undo if opposite fails
        setItems(current =>
          current.map(it => (it.id === id ? { ...it, read_at: new Date().toISOString() } : it)),
        );
        updateUnreadCount(previousUnreadCount - 1);
      });
    } else if (type === 'single_unread') {
      const id = itemIds[0];
      const prevReadAt = previousReadAtMap[id] ?? new Date().toISOString();
      setItems(current =>
        current.map(it => (it.id === id ? { ...it, read_at: prevReadAt } : it)),
      );
      updateUnreadCount(previousUnreadCount);
      markNotificationRead(id).catch(() => {
        setItems(current =>
          current.map(it => (it.id === id ? { ...it, read_at: null } : it)),
        );
        updateUnreadCount(previousUnreadCount + 1);
      });
    } else if (type === 'mark_all') {
      setItems(current =>
        current.map(it =>
          previousReadAtMap[it.id] !== undefined
            ? { ...it, read_at: previousReadAtMap[it.id] }
            : it,
        ),
      );
      updateUnreadCount(previousUnreadCount);
      // Call unread for restored items
      itemIds.forEach(id => {
        markNotificationUnread(id).catch(() => {});
      });
    }
  }, [dismissToast, undoState, updateUnreadCount]);

  // Filter items by active tab
  const filteredItems = useMemo(() => {
    if (activeTab === 'unread') {
      return items.filter(it => it.read_at === null);
    }
    if (activeTab === 'read') {
      return items.filter(it => it.read_at !== null);
    }
    return items;
  }, [activeTab, items]);

  // Group filtered items into sections: Today, Yesterday, Earlier
  const sections = useMemo(() => {
    const todayItems: NotificationHistoryItem[] = [];
    const yesterdayItems: NotificationHistoryItem[] = [];
    const earlierItems: NotificationHistoryItem[] = [];

    filteredItems.forEach(item => {
      const group = getNotificationGroup(item.created_at);
      if (group === 'today') {
        todayItems.push(item);
      } else if (group === 'yesterday') {
        yesterdayItems.push(item);
      } else {
        earlierItems.push(item);
      }
    });

    const result: { titleKey: LabelKey; defaultTitle: string; data: NotificationHistoryItem[] }[] =
      [];

    if (todayItems.length > 0) {
      result.push({
        titleKey: 'mob.time.today',
        defaultTitle: 'TODAY',
        data: todayItems,
      });
    }
    if (yesterdayItems.length > 0) {
      result.push({
        titleKey: 'mob.time.yesterday',
        defaultTitle: 'YESTERDAY',
        data: yesterdayItems,
      });
    }
    if (earlierItems.length > 0) {
      result.push({
        titleKey: 'mob.time.earlier',
        defaultTitle: 'EARLIER',
        data: earlierItems,
      });
    }

    return result;
  }, [filteredItems]);

  if (isLoading) {
    return <LoadingView />;
  }

  if (loadError) {
    return (
      <ErrorView
        message={t('mob.notif_history.load_error')}
        onRetry={loadFirstPage}
      />
    );
  }

  const isMarkAllDisabled = unreadCount === 0;

  return (
    <View style={styles.screen}>
      {/* 1. Header (image 01-06) */}
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('mob.common.back')}
          onPress={() => navigation?.goBack?.()}
          style={styles.headerBackBtn}
        >
          <BackArrowIcon size={22} color="#0F2347" />
        </Pressable>

        <Text style={styles.headerTitle}>{t('mob.nav.title_notifications')}</Text>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('mob.notif_history.mark_all_read_a11y')}
          accessibilityState={{ disabled: isMarkAllDisabled }}
          disabled={isMarkAllDisabled}
          onPress={handleMarkAllAsRead}
          style={({ pressed }) => [
            styles.headerRightBtn,
            pressed && !isMarkAllDisabled && styles.pressed,
          ]}
        >
          <CheckIcon
            size={18}
            color={isMarkAllDisabled ? '#9AA8C4' : '#1961F7'}
          />
          <Text
            style={[
              styles.markAllText,
              isMarkAllDisabled ? styles.markAllDisabledText : styles.markAllActiveText,
            ]}
          >
            {t('mob.notif_history.mark_all_read')}
          </Text>
        </Pressable>
      </View>

      {/* 2. Tabs: All | Unread | Read (image 01-03) */}
      <View style={styles.tabContainer}>
        {/* All Tab */}
        <Pressable
          accessibilityRole="tab"
          accessibilityState={{ selected: activeTab === 'all' }}
          onPress={() => setActiveTab('all')}
          style={[styles.tabPill, activeTab === 'all' ? styles.tabPillActive : styles.tabPillInactive]}
        >
          <Text
            style={[
              styles.tabPillText,
              activeTab === 'all' ? styles.tabTextActive : styles.tabTextInactive,
            ]}
          >
            {t('mob.notif_history.tab_all')}
          </Text>
        </Pressable>

        {/* Unread Tab with count chip */}
        <Pressable
          accessibilityRole="tab"
          accessibilityState={{ selected: activeTab === 'unread' }}
          accessibilityLabel={
            unreadCount > 0
              ? t('mob.notif_history.tab_unread_a11y', { count: unreadCount })
              : t('mob.notif_history.tab_unread')
          }
          onPress={() => setActiveTab('unread')}
          style={[
            styles.tabPill,
            activeTab === 'unread' ? styles.tabPillActive : styles.tabPillInactive,
          ]}
        >
          <Text
            style={[
              styles.tabPillText,
              activeTab === 'unread' ? styles.tabTextActive : styles.tabTextInactive,
            ]}
          >
            {t('mob.notif_history.tab_unread')}
          </Text>
          {unreadCount > 0 ? (
            <View
              style={[
                styles.chip,
                activeTab === 'unread' ? styles.chipActivePill : styles.chipInactivePill,
              ]}
            >
              <Text
                style={[
                  styles.chipText,
                  activeTab === 'unread' ? styles.chipTextActivePill : styles.chipTextInactivePill,
                ]}
              >
                {unreadCount}
              </Text>
            </View>
          ) : null}
        </Pressable>

        {/* Read Tab */}
        <Pressable
          accessibilityRole="tab"
          accessibilityState={{ selected: activeTab === 'read' }}
          onPress={() => setActiveTab('read')}
          style={[styles.tabPill, activeTab === 'read' ? styles.tabPillActive : styles.tabPillInactive]}
        >
          <Text
            style={[
              styles.tabPillText,
              activeTab === 'read' ? styles.tabTextActive : styles.tabTextInactive,
            ]}
          >
            {t('mob.notif_history.tab_read')}
          </Text>
        </Pressable>
      </View>

      {/* 3. Notification List or Empty State */}
      {filteredItems.length === 0 ? (
        <View style={styles.emptyContainer}>
          <RegistryIcon
            name="notifications"
            size={76}
            borderRadius={22}
            hasShadow
          />
          <Text style={styles.emptyTitle}>
            {activeTab === 'unread'
              ? t('mob.notif_history.empty_unread_title')
              : activeTab === 'read'
              ? t('mob.notif_history.empty_read_title')
              : t('mob.notif_history.empty_all_title')}
          </Text>
          <Text style={styles.emptySubtitle}>
            {activeTab === 'unread'
              ? t('mob.notif_history.empty_unread_subtitle')
              : activeTab === 'read'
              ? t('mob.notif_history.empty_read_subtitle')
              : t('mob.notif_history.empty_all_subtitle')}
          </Text>
          {activeTab === 'unread' ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('mob.notif_history.empty_unread_button')}
              onPress={() => setActiveTab('all')}
              style={styles.emptyButton}
            >
              <Text style={styles.emptyButtonText}>
                {t('mob.notif_history.empty_unread_button')}
              </Text>
            </Pressable>
          ) : null}

          {/* Retention Footer on Empty State */}
          <Text style={styles.retentionTextEmpty}>
            {t('mob.notif_history.footer_retention', { days: retentionDays })}
          </Text>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <NotificationCard
              item={item}
              onPress={handlePress}
              onToggleRead={handleToggleRead}
            />
          )}
          renderSectionHeader={({ section: { titleKey, defaultTitle } }) => (
            <Text style={styles.sectionHeader}>
              {(t(titleKey) || defaultTitle).toUpperCase()}
            </Text>
          )}
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          contentContainerStyle={styles.listContent}
          ListFooterComponent={
            <View style={styles.footerContainer}>
              {isLoadingMore ? (
                <ActivityIndicator style={styles.loader} color="#1961F7" />
              ) : moreError ? (
                <Pressable accessibilityRole="button" onPress={loadMore} style={styles.retryButton}>
                  <Text style={styles.retryText}>{t('mob.notif_history.more_error')}</Text>
                </Pressable>
              ) : null}

              {/* Swipe Hint (image 07, 08) */}
              <Text style={styles.swipeHintText}>
                {t('mob.notif_history.swipe_hint')}
              </Text>

              {/* Retention Footer (Requirement B.5) */}
              <Text style={styles.retentionText}>
                {t('mob.notif_history.footer_retention', { days: retentionDays })}
              </Text>
            </View>
          }
        />
      )}

      {/* 4. Undo Toast (Requirement C.5; image 11, 13) */}
      {undoState ? (
        <View style={styles.undoToast}>
          <Text style={styles.undoMessage}>{undoState.message}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('mob.common.undo')}
            onPress={handleUndo}
            style={styles.undoButton}
          >
            <Text style={styles.undoButtonText}>{t('mob.common.undo')}</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F7FAFC',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    backgroundColor: '#F7FAFC',
    minHeight: 56,
  },
  headerBackBtn: {
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  headerTitle: {
    fontFamily: 'Plus Jakarta Sans',
    fontSize: 20,
    fontWeight: '800',
    color: '#0F2347',
    flex: 1,
    marginLeft: 8,
  },
  headerRightBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
    paddingHorizontal: 8,
    gap: 4,
  },
  markAllText: {
    fontFamily: 'Plus Jakarta Sans',
    fontSize: 14,
    fontWeight: '600',
  },
  markAllActiveText: {
    color: '#1961F7',
  },
  markAllDisabledText: {
    color: '#9AA8C4',
  },
  pressed: {
    opacity: 0.7,
  },
  tabContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 16,
    gap: 10,
  },
  tabPill: {
    minHeight: 44,
    borderRadius: 22,
    paddingHorizontal: 22,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabPillActive: {
    backgroundColor: '#1961F7',
    borderWidth: 1,
    borderColor: '#1961F7',
  },
  tabPillInactive: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E3EAF7',
  },
  tabPillText: {
    fontFamily: 'Plus Jakarta Sans',
    fontSize: 15,
    fontWeight: '700',
  },
  tabTextActive: {
    color: '#FFFFFF',
  },
  tabTextInactive: {
    color: '#0F2347',
  },
  chip: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  chipActivePill: {
    backgroundColor: '#FFFFFF',
  },
  chipInactivePill: {
    backgroundColor: '#1961F7',
  },
  chipText: {
    fontFamily: 'Plus Jakarta Sans',
    fontSize: 13,
    fontWeight: '700',
  },
  chipTextActivePill: {
    color: '#1961F7',
  },
  chipTextInactivePill: {
    color: '#FFFFFF',
  },
  listContent: {
    paddingBottom: 32,
  },
  sectionHeader: {
    fontFamily: 'Plus Jakarta Sans',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.5,
    color: '#62718F',
    marginTop: 14,
    marginBottom: 8,
    paddingHorizontal: 16,
  },
  footerContainer: {
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 16,
  },
  loader: {
    marginBottom: 12,
  },
  retryButton: {
    padding: 10,
    minHeight: 44,
    justifyContent: 'center',
  },
  retryText: {
    fontFamily: 'Plus Jakarta Sans',
    fontSize: 14,
    color: '#1961F7',
    fontWeight: '600',
  },
  swipeHintText: {
    fontFamily: 'Plus Jakarta Sans',
    fontSize: 13,
    color: '#62718F',
    textAlign: 'center',
    marginTop: 10,
    marginBottom: 14,
  },
  retentionText: {
    fontFamily: 'Plus Jakarta Sans',
    fontSize: 13,
    color: '#62718F',
    textAlign: 'center',
  },
  retentionTextEmpty: {
    fontFamily: 'Plus Jakarta Sans',
    fontSize: 13,
    color: '#62718F',
    textAlign: 'center',
    marginTop: 'auto',
    marginBottom: 24,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingTop: 60,
  },
  emptyTitle: {
    fontFamily: 'Plus Jakarta Sans',
    fontSize: 22,
    fontWeight: '800',
    color: '#0F2347',
    marginTop: 20,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontFamily: 'Plus Jakarta Sans',
    fontSize: 15,
    lineHeight: 22,
    color: '#52617E',
    marginTop: 10,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  emptyButton: {
    marginTop: 24,
    minHeight: 44,
    paddingHorizontal: 24,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: '#C6D9FF',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyButtonText: {
    fontFamily: 'Plus Jakarta Sans',
    fontSize: 15,
    fontWeight: '700',
    color: '#1961F7',
  },
  undoToast: {
    position: 'absolute',
    bottom: 24,
    left: 16,
    right: 16,
    minHeight: 52,
    borderRadius: 26,
    backgroundColor: '#0F2347',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: 20,
    paddingRight: 8,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 6,
  },
  undoMessage: {
    fontFamily: 'Plus Jakarta Sans',
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
  },
  undoButton: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  undoButtonText: {
    fontFamily: 'Plus Jakarta Sans',
    color: '#9CC0FF',
    fontSize: 15,
    fontWeight: '700',
  },
});
