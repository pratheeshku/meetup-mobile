/**
 * Unread-notification badge count (bell in the Home header).
 *
 * A minimal dependency-free external store, the same shape as
 * `notificationBannerStore.ts`: `fcm.ts`'s foreground `onMessage` handler
 * increments it (it runs outside the React tree), and the header reads it via
 * `useSyncExternalStore` (`hooks/useUnreadCount.ts`). The server is the source
 * of truth — `useUnreadCount`'s `refreshUnreadCount` overwrites this with
 * `GET /notifications/unread-count`. Holds a number only; no notification
 * content passes through here (R-111).
 */
type Listener = () => void;

let count = 0;
const listeners = new Set<Listener>();

function emit(): void {
  listeners.forEach(listener => listener());
}

export function getUnreadBadgeCount(): number {
  return count;
}

export function setUnreadBadgeCount(next: number): void {
  if (!Number.isFinite(next) || next < 0 || next === count) {
    return;
  }
  count = next;
  emit();
}

export function incrementUnreadBadgeCount(): void {
  count += 1;
  emit();
}

export function subscribeToUnreadBadgeCount(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
