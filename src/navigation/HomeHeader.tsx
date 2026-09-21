/**
 * Custom native-stack header for the Home dashboard: the branded
 * `AppHeader`, with its bell opening Notification History and showing the
 * unread badge.
 *
 * The count is synced with `GET /notifications/unread-count` on mount and
 * every time this screen regains focus (which includes coming back from
 * Notification History); foreground pushes bump it in between
 * (`fcm.ts` → `unreadCountStore.ts`).
 *
 * A module-level component (not an inline arrow in the navigator's
 * `options`) so React sees a stable component type across renders.
 */
import React, { useEffect } from 'react';
import type { NativeStackHeaderProps } from '@react-navigation/native-stack';

import AppHeader from '../components/AppHeader';
import { refreshUnreadCount, useUnreadBadgeCount } from '../hooks/useUnreadCount';

export default function HomeHeader({ navigation }: NativeStackHeaderProps): React.JSX.Element {
  const unreadCount = useUnreadBadgeCount();

  useEffect(() => {
    refreshUnreadCount();
    // Concurrent refreshes share one request, so the initial focus event
    // firing alongside the call above costs nothing.
    return navigation.addListener('focus', () => {
      refreshUnreadCount();
    });
  }, [navigation]);

  return (
    <AppHeader
      unreadCount={unreadCount}
      onNotificationsPress={() => navigation.navigate('NotificationHistory')}
    />
  );
}
