/**
 * Unread-notification count for the bell badge.
 *
 * `refreshUnreadCount` fetches `GET /notifications/unread-count` into the
 * shared store (`notifications/unreadCountStore.ts`); `useUnreadBadgeCount`
 * subscribes a component to it. A failed refresh keeps the last known count —
 * the badge is a convenience, not worth an error UI. Refreshes requested while
 * one is in flight share it, but a request made AFTER the running one started
 * (for example right after a mark action) triggers exactly one follow-up read, so
 * it can never be answered with a value read before the change.
 * `resetUnreadCount` (sign-out / account switch) clears the count and discards
 * any response still on its way for the previous user.
 */
import { useSyncExternalStore } from 'react';

import { getUnreadCount } from '../api/notifications';
import {
  clearUnreadBadgeCount,
  getUnreadBadgeCount,
  setUnreadBadgeCount,
  subscribeToUnreadBadgeCount,
} from '../notifications/unreadCountStore';

let inFlight: Promise<void> | null = null;
let followUp = false;
let epoch = 0;

async function readOnce(): Promise<void> {
  const startedIn = epoch;
  try {
    const { count } = await getUnreadCount();
    if (startedIn === epoch) {
      setUnreadBadgeCount(count);
    }
  } catch {
    // Keep the previous count; nothing user-actionable.
  }
}

async function run(): Promise<void> {
  try {
    do {
      followUp = false;
      await readOnce();
    } while (followUp);
  } finally {
    inFlight = null;
  }
}

export function refreshUnreadCount(): Promise<void> {
  if (inFlight) {
    followUp = true;
    return inFlight;
  }
  inFlight = run();
  return inFlight;
}

export function resetUnreadCount(): void {
  epoch += 1;
  clearUnreadBadgeCount();
}

export function useUnreadBadgeCount(): number {
  return useSyncExternalStore(subscribeToUnreadBadgeCount, getUnreadBadgeCount);
}
