/**
 * "No longer available" notice (access-consistency AD-8 / AC-10).
 *
 * The server answers 404 for anything the caller may not see, so a 404 on a
 * game, tournament or group detail fetch (including one opened from a push
 * notification) closes the screen and shows ONE neutral message. Never a
 * "forbidden" or "you were removed" message.
 *
 * A minimal external store, the same shape as `notifications/notificationBannerStore.ts`;
 * `AccessNoticeToast` (mounted once in `RootNavigator`) renders it with the
 * existing `Toast`. The message text is a label (`mob.access.no_longer_available`).
 */
import type { NavigationProp, ParamListBase } from '@react-navigation/native';

type Listener = () => void;

let pending = false;
const listeners = new Set<Listener>();

function emit(): void {
  listeners.forEach(listener => listener());
}

/** True while the notice is waiting to be shown or on screen. */
export function isAccessNoticeShowing(): boolean {
  return pending;
}

export function subscribeToAccessNotice(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function clearAccessNotice(): void {
  if (pending) {
    pending = false;
    emit();
  }
}

/** Shows the notice once: a second call while it is still showing does nothing. */
export function showAccessNotice(): void {
  if (!pending) {
    pending = true;
    emit();
  }
}

type ClosableNavigation = Pick<NavigationProp<ParamListBase>, 'goBack' | 'canGoBack'>;

/**
 * Closes a detail screen whose target now returns 404 and shows the neutral
 * message once. Falls back to nothing if there is nowhere to go back to (the
 * screen was the stack root); the message still shows.
 */
export function closeUnavailableScreen(navigation: ClosableNavigation | undefined): void {
  showAccessNotice();
  if (navigation && (typeof navigation.canGoBack !== 'function' || navigation.canGoBack())) {
    navigation.goBack();
  }
}
