/**
 * FCM setup (DES-MEETUP-MOBILE.md §3.6, R-070–R-076).
 *
 * Token registration/rotation/de-registration (`registerDeviceToken`,
 * `deregisterDeviceToken`, `onTokenRefresh`) are the building blocks the
 * §3.6 lifecycle is wired from: `pushRegistration.ts` drives permission +
 * registration (started by `AuthContext` on sign-in / restored session),
 * and `googleAuth.signOut` calls `deregisterDeviceToken`.
 *
 * `onMessage` (foreground), `onNotificationOpenedApp` (background tap),
 * `getInitialNotification` (quit-state tap) and
 * `registerBackgroundMessageHandler` below are new for the
 * push-notifications task (§3.6 "Notification handling", §4.8) — routing
 * wiring lives in `RootNavigator.tsx`.
 *
 * Never logs the FCM token itself, per R-111 (§5.4 requires it excluded
 * "beyond a truncated reference"), and never logs notification title/body
 * content (R-111, task brief Rules).
 */
import { Platform, PermissionsAndroid } from 'react-native';
import { getApp } from '@react-native-firebase/app';
import {
  getMessaging,
  requestPermission as requestFirebasePermission,
  hasPermission as hasFirebasePermission,
  AuthorizationStatus,
  getToken as getFcmToken,
  onTokenRefresh as onFcmTokenRefresh,
  onMessage as onFcmMessage,
  onNotificationOpenedApp as onFcmNotificationOpenedApp,
  getInitialNotification as getFcmInitialNotification,
  setBackgroundMessageHandler as setFcmBackgroundMessageHandler,
  type RemoteMessage,
} from '@react-native-firebase/messaging';

import { apiClient } from '../api/client';
import { getDeviceId } from './deviceId';
import { showBanner } from './notificationBannerStore';
import { refreshUnreadCount } from '../hooks/useUnreadCount';
import {
  displayParticipantNotification,
  isParticipantNotificationType,
} from './participantHandler';
import {
  displayEventNotification,
  isEventNotificationType,
} from './eventNotificationHandler';
import { displayPushActionNotification, isPushActionType } from './pushActions';
import { NOTIFICATION_TYPES } from '../types/notification';
import type { NotificationType, PushNotificationPayload } from '../types/notification';

const messaging = getMessaging(getApp());

/**
 * Whether notifications may be shown, without prompting. API 26–32 have no
 * runtime permission, so they always report `true`.
 */
export async function hasNotificationPermission(): Promise<boolean> {
  if (Platform.OS === 'ios') {
    // iOS has no implicit grant: only an explicit authorization counts.
    const status = await hasFirebasePermission(messaging);
    return status === AuthorizationStatus.AUTHORIZED || status === AuthorizationStatus.PROVISIONAL;
  }
  if (Platform.OS === 'android' && Platform.Version >= 33) {
    return PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
  }
  return true;
}

/**
 * Requests notification permission.
 *
 * Android 13+ (API 33+) requires the runtime `POST_NOTIFICATIONS`
 * permission (R-072); API 26–32 need no runtime prompt at all, per
 * §3.6. The once-only rationale dialog shown before this call lives in
 * `pushRegistration.ts`.
 */
export async function requestPermission(): Promise<boolean> {
  if (Platform.OS === 'android' && Platform.Version >= 33) {
    const result = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
    );
    return result === PermissionsAndroid.RESULTS.GRANTED;
  }

  // iOS: Firebase's `requestPermission` shows the system prompt
  // (DES-MEETUP-ADDENDUM-IOS-App.md §3). Pre-33 Android needs no runtime
  // prompt; there the same call is only a fallback.
  const status = await requestFirebasePermission(messaging);
  return status === AuthorizationStatus.AUTHORIZED || status === AuthorizationStatus.PROVISIONAL;
}

const USER_AGENT_PLATFORM_NAMES: Partial<Record<typeof Platform.OS, string>> = {
  android: 'Android',
  ios: 'iOS',
};

/**
 * Proposed Assumption (Implementation Report #2): the exact `userAgent`
 * string format expected by `POST /notifications/mobile-subscriptions` is
 * not specified in the local design excerpt. A minimal, non-PII
 * platform/version string is used below; correct against the actual
 * backend contract on conformance review.
 */
function buildUserAgent(): string {
  return `MeetupMobile-${USER_AGENT_PLATFORM_NAMES[Platform.OS] ?? Platform.OS}/${Platform.Version}`;
}

/**
 * Push actions capability (DES-MEETUP-ADDENDUM-push-actions AD-3): this build
 * can render and handle action buttons, so the server may send the action
 * types data-only (Android) or with a category (iOS) once its flag is on.
 *
 * Version 2 (DES-MEETUP-ADDENDUM-tournament-registration AD-3): this build also knows the tournament Register buttons and the
 * `register_mode` data key. Without it the server keeps Accept and Decline and the Register categories never apply.
 */
export const PUSH_ACTIONS_VERSION = 2;

/**
 * `POST /notifications/mobile-subscriptions` — body verified against the
 * live OpenAPI `MobilePushTokenRegisterRequest` (`deviceToken` and
 * `platform` required, `userAgent` optional).
 *
 * `deviceId` (bug fix, device-scoped token registration): re-checked
 * against the live OpenAPI as of this change — `MobilePushTokenRegisterRequest`
 * does not yet declare a `deviceId` property server-side (the paired
 * backend change gating `fn_register_mobile_push_token` on it had not
 * deployed at the time of this check). Sent anyway: FastAPI/Pydantic
 * ignores unrecognized request fields by default (no
 * `additionalProperties: false` on the live schema), so this is
 * forward-compatible and starts working the moment the backend deploys,
 * with no further mobile change required. See the Implementation Report
 * for the verification evidence.
 */
export async function registerDeviceToken(deviceToken: string): Promise<void> {
  const deviceId = await getDeviceId();
  await apiClient.post('/notifications/mobile-subscriptions', {
    deviceToken,
    platform: Platform.OS,
    userAgent: buildUserAgent(),
    deviceId,
    pushActionsVersion: PUSH_ACTIONS_VERSION,
  });
}

/** Reads the current FCM registration token without registering it. */
export async function fetchFcmToken(): Promise<string> {
  return getFcmToken(messaging);
}

/**
 * Retrieves the current FCM registration token and registers it with the
 * backend (R-070, R-029).
 */
export async function getToken(): Promise<string> {
  const token = await getFcmToken(messaging);
  await registerDeviceToken(token);
  return token;
}

/**
 * De-registers the current device's FCM token (R-030, R-077, §5.2).
 *
 * Called by the auth module's `signOut()` **before** `POST /auth/logout`
 * (§3.5, §5.2). Best-effort by design: §5.2 explicitly accepts this
 * ordering as client-enforced only (OI-2, T1 residual risk) — a failure
 * here must never block the rest of sign-out, so callers should wrap
 * this in their own try/catch rather than let it abort the sequence.
 *
 * Accepts an optional correlation ID so callers can thread this call
 * into the same logical sign-out action as the subsequent
 * `POST /auth/logout` call (§3.12, R-113).
 */
export async function deregisterDeviceToken(config?: {
  correlationId?: string;
  /** Per-request axios timeout in ms (sign-out passes a short one). */
  timeout?: number;
}): Promise<void> {
  const token = await getFcmToken(messaging);
  // `device_token` is a free-form path string in the live OpenAPI; FCM tokens
  // contain `:`, so it must be percent-encoded to stay a single path segment.
  await apiClient.delete(`/notifications/mobile-subscriptions/${encodeURIComponent(token)}`, config);
}

/**
 * Silently re-registers the device token whenever FCM rotates it (R-075).
 * Returns the unsubscribe function. `onRegistered` (optional) is told about
 * each rotated token that registered successfully, so a caller tracking
 * "already registered this session" stays accurate.
 */
export function onTokenRefresh(onRegistered?: (token: string) => void): () => void {
  return onFcmTokenRefresh(messaging, async newToken => {
    try {
      await registerDeviceToken(newToken);
      onRegistered?.(newToken);
    } catch {
      // Best-effort re-registration; a failure here is not fatal to the
      // current session and will be retried on the next rotation or
      // cold start.
    }
  });
}

function isKnownNotificationType(value: unknown): value is NotificationType {
  return typeof value === 'string' && (NOTIFICATION_TYPES as string[]).includes(value);
}

/**
 * Extracts a typed `PushNotificationPayload` from a raw FCM
 * `RemoteMessage`, or `null` if the message doesn't carry one of the known
 * notification types (`NOTIFICATION_TYPES`) — e.g. a malformed/unexpected
 * payload, which is dropped rather than crashing the handler.
 *
 * `title`/`body` come from `data` first (the backend-authored payload
 * shape per the task brief's Step 1 `PushNotificationPayload`), falling
 * back to the FCM `notification` block for a message sent with both
 * (standard for a message with a `notification` block the OS also
 * auto-displays in background/killed state, §3.6).
 */
function extractPushPayload(remoteMessage: RemoteMessage): PushNotificationPayload | null {
  const data = remoteMessage.data;
  const notificationType = data?.notification_type;
  if (!isKnownNotificationType(notificationType)) {
    return null;
  }

  const entityId = data?.entity_id;
  const title = data?.title ?? remoteMessage.notification?.title;
  const body = data?.body ?? remoteMessage.notification?.body;

  return {
    notification_type: notificationType,
    entity_id: typeof entityId === 'string' ? entityId : '',
    title: typeof title === 'string' ? title : '',
    body: typeof body === 'string' ? body : '',
  };
}

/**
 * Narrows an FCM `data` map (values typed `string | object`) to the
 * `Record<string, string>` `displayParticipantNotification` takes. FCM data
 * payload values are always strings on the wire; anything else is dropped.
 */
function toStringRecord(data: RemoteMessage['data']): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(data ?? {})) {
    if (typeof value === 'string') {
      out[key] = value;
    }
  }
  return out;
}

/**
 * Foreground message handler (§3.6, §4.8; R-073). Shows the in-app
 * `NotificationBanner` (`notificationBannerStore.ts`) instead of an OS
 * notification, per the task brief's Step 3 ("do not use OS notification
 * for foreground") — this is the deviation from §3.6's `notifee` decision
 * recorded in `notificationBannerStore.ts`'s file header.
 *
 * Exception: `event_participant_added` / `event_participant_removed` are
 * delivered data-only and rendered as a local notification with View/OK
 * action buttons (`participantHandler.ts`); they return early and never
 * reach `showBanner`. `group_event_created` / `event_changed` are the same
 * kind of exception (Join+OK / View+OK — `eventNotificationHandler.ts`,
 * mobile notify-kit task Part 3); see that file's header for the
 * `event_changed` and `group_event_created` payload-shape assumptions this
 * depends on.
 *
 * Logs only the message id and notification type (a fixed backend enum
 * value, not user content) — never title/body/entity id (R-111, task
 * brief Rules: "No notification content logged").
 */
export function onMessage(): () => void {
  return onFcmMessage(messaging, remoteMessage => {
    console.log('[fcm] foreground message received', {
      messageId: remoteMessage.messageId,
      notificationType: remoteMessage.data?.notification_type,
    });

    // Bell badge (Home header): a foreground push carrying a notification type is a new stored
    // notification, so the count is read back from the server. It is never incremented locally
    // (access consistency: the server alone knows what the user can still see).
    if (typeof remoteMessage.data?.notification_type === 'string') {
      refreshUnreadCount();
    }

    if (isParticipantNotificationType(remoteMessage.data?.notification_type)) {
      displayParticipantNotification(toStringRecord(remoteMessage.data)).catch(() => {
        // Display failure (e.g. notification permission revoked) must not
        // surface as an unhandled rejection; nothing user-actionable here.
        console.log('[fcm] participant notification display failed');
      });
      return;
    }

    // Action types arrive data-only on Android (no `notification` block) when
    // the server's push-actions flag is on for this install: render them with
    // buttons. With a `notification` block (flag off, old path, or iOS) the
    // existing banner below is unchanged.
    if (
      Platform.OS === 'android' &&
      !remoteMessage.notification &&
      isPushActionType(remoteMessage.data?.notification_type)
    ) {
      displayPushActionNotification(toStringRecord(remoteMessage.data)).catch(() => {
        console.log('[fcm] push action notification display failed');
      });
      return;
    }

    if (isEventNotificationType(remoteMessage.data?.notification_type)) {
      displayEventNotification(toStringRecord(remoteMessage.data)).catch(() => {
        // Display failure (e.g. notification permission revoked) must not
        // surface as an unhandled rejection; nothing user-actionable here.
        console.log('[fcm] event notification display failed');
      });
      return;
    }

    const payload = extractPushPayload(remoteMessage);
    if (payload) {
      showBanner(payload);
    }
  });
}

/**
 * Registers the FCM background message handler (§3.6 "Background/killed
 * -state messages via FCM's native background handler").
 *
 * Most of this app's push messages carry a `notification` block
 * (server-controlled), which Android's FCM SDK displays in the system tray
 * automatically while the app is backgrounded or killed — no client code is
 * needed to *display* those, so the handler does nothing for them.
 * Registering the handler is still required by the Firebase Android SDK
 * (an unregistered handler logs a native warning and, on some OEM
 * skins, can prevent the message from being delivered at all while the
 * app process is not running); routing on tap is handled separately by
 * `onNotificationOpenedApp`/`getInitialNotification` below, not by this
 * handler.
 *
 * Exception: `event_participant_added` / `event_participant_removed` are
 * data-only (the server suppresses their `notification` block), so nothing
 * displays them unless this handler does — it builds the local notification
 * with View/OK actions via `participantHandler.ts`. `group_event_created` /
 * `event_changed` are the same kind of exception
 * (`eventNotificationHandler.ts`, mobile notify-kit task Part 3).
 *
 * Must be called once at module/app init time — it is called at top level in
 * `index.js`, outside any React lifecycle, before any message can arrive.
 *
 * Never logs message content (R-111) — intentionally logs nothing at all,
 * since a background-process log has no dev-visible console to read
 * anyway.
 */
export function registerBackgroundMessageHandler(): void {
  setFcmBackgroundMessageHandler(messaging, async remoteMessage => {
    // iOS: the backend sends a visible alert (`notification` block) for every
    // type (DES-MEETUP-ADDENDUM-IOS-App.md §4), which the system already
    // displayed. Rendering it again here would duplicate it.
    if (Platform.OS === 'ios' && remoteMessage.notification) {
      return;
    }

    if (isParticipantNotificationType(remoteMessage.data?.notification_type)) {
      try {
        await displayParticipantNotification(toStringRecord(remoteMessage.data));
      } catch {
        // Best-effort: a display failure in a headless task has nowhere
        // useful to surface, and must not reject the FCM handler.
      }
      return;
    }

    if (isPushActionType(remoteMessage.data?.notification_type)) {
      try {
        // Reaches this handler only when the message is data-only (Android).
        await displayPushActionNotification(toStringRecord(remoteMessage.data));
      } catch {
        // Best-effort, as above.
      }
      return;
    }

    if (isEventNotificationType(remoteMessage.data?.notification_type)) {
      try {
        await displayEventNotification(toStringRecord(remoteMessage.data));
      } catch {
        // Best-effort: a display failure in a headless task has nowhere
        // useful to surface, and must not reject the FCM handler.
      }
    }
  });
}

/**
 * Background-state notification tap handler (§3.6, §4.8; R-073): fires
 * when the app was backgrounded (not killed) and the user taps the
 * system-tray notification, bringing the app to the foreground.
 * `RootNavigator` wires this to `navigateToNotificationTarget`. Returns
 * the unsubscribe function, matching this file's other listener
 * functions' shape.
 */
export function onNotificationOpenedApp(
  handler: (payload: PushNotificationPayload) => void,
): () => void {
  return onFcmNotificationOpenedApp(messaging, remoteMessage => {
    const payload = extractPushPayload(remoteMessage);
    if (payload) {
      handler(payload);
    }
  });
}

/**
 * Quit-state notification tap handler (§3.6, §4.8; R-073): the app was
 * not running at all and was launched by the user tapping the system
 * -tray notification. Must be called once, at cold start, after the
 * navigation container is ready (`RootNavigator`) — unlike the listener
 * functions above, `getInitialNotification` is a one-shot read, not a
 * subscription.
 */
export async function getInitialNotification(): Promise<PushNotificationPayload | null> {
  const remoteMessage = await getFcmInitialNotification(messaging);
  if (!remoteMessage) {
    return null;
  }
  return extractPushPayload(remoteMessage);
}
