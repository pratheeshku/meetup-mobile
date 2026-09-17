/**
 * Foreground notification banner state (DES-MEETUP-MOBILE.md §3.6, §4.8).
 *
 * The task brief requires "a simple state-based banner component, not a
 * third-party toast library" (Step 3/Step 5) for foreground message
 * display — a deliberate deviation from DES-MEETUP-MOBILE.md §3.6, which
 * names `notifee` as a fixed technology decision for foreground rendering
 * ("Trade-offs accepted: notifee is a third-party dependency ... accepted
 * over hand-rolling a native notification-channel wrapper (BP-12)").
 * `notifee` is not installed in this repo (`package.json` has no
 * dependency on it). Recorded as a Deviation in the Implementation Report,
 * needs architect ratification — the task brief's explicit, repeated
 * prohibition ("Do not use third-party toast/notification libraries",
 * stated in both Step 3 and the Rules section) was followed as the more
 * specific, more recent instruction for this task.
 *
 * This module is the "simple state" itself: a minimal external store
 * (same dependency-free pub/sub shape as `src/api/authEvents.ts`, kept
 * consistent with that established convention rather than reaching for a
 * state-management library) that `fcm.ts`'s foreground `onMessage`
 * handler writes to and `NotificationBanner.tsx` reads via
 * `useSyncExternalStore`. Holds at most one banner at a time — a second
 * foreground message while one is showing replaces it, it does not queue
 * (no design requirement for a queue, and a stacked-banner UI is out of
 * scope for "a simple state-based banner").
 *
 * Never stores anything beyond what the banner displays (title/body/type/
 * entity id) — no token or auth data ever passes through here (R-111).
 */
import type { PushNotificationPayload } from '../types/notification';

type Listener = () => void;

let currentBanner: PushNotificationPayload | null = null;
const listeners = new Set<Listener>();

function emit(): void {
  listeners.forEach(listener => listener());
}

export function showBanner(payload: PushNotificationPayload): void {
  currentBanner = payload;
  emit();
}

export function dismissBanner(): void {
  if (currentBanner === null) {
    return;
  }
  currentBanner = null;
  emit();
}

export function getBannerState(): PushNotificationPayload | null {
  return currentBanner;
}

export function subscribeToBanner(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
