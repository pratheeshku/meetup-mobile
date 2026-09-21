/**
 * Unread-notification count for the bell badge.
 *
 * `refreshUnreadCount` fetches `GET /notifications/unread-count` into the
 * shared store (`notifications/unreadCountStore.ts`); `useUnreadBadgeCount`
 * subscribes a component to it. A failed refresh keeps the last known count —
 * the badge is a convenience, not worth an error UI. Concurrent refreshes
 * (mount + focus firing together) share one request.
 */
import { useSyncExternalStore } from 'react';

import { getUnreadCount } from '../api/notifications';
import {
  getUnreadBadgeCount,
  setUnreadBadgeCount,
  subscribeToUnreadBadgeCount,
} from '../notifications/unreadCountStore';

let inFlight: Promise<void> | null = null;

export function refreshUnreadCount(): Promise<void> {
  if (!inFlight) {
    inFlight = getUnreadCount()
      .then(({ count }) => setUnreadBadgeCount(count))
      .catch(() => {
        // Keep the previous count; nothing user-actionable.
      })
      .finally(() => {
        inFlight = null;
      });
  }
  return inFlight;
}

export function useUnreadBadgeCount(): number {
  return useSyncExternalStore(subscribeToUnreadBadgeCount, getUnreadBadgeCount);
}
