/**
 * Locally-displayed notifications for `event_participant_added` /
 * `event_participant_removed` (DES-MEETUP-MOBILE.md §3.6, R-073).
 *
 * The server delivers these two types as data-only FCM messages (no
 * `notification` block), so the OS never shows them itself — the app builds
 * the notification with `react-native-notify-kit` (the maintained drop-in for
 * the archived `@notifee/react-native`) with two action buttons:
 *   - View: opens the event (`EventDetail`, `entity_id` as `eventId`)
 *   - OK:   dismisses the notification; no API call
 *
 * Library behaviour this file depends on (verified against
 * react-native-notify-kit 10.7.1 source, not assumed):
 * - Action *buttons* emit `EventType.ACTION_PRESS`; `EventType.PRESS` is only
 *   the notification *body* tap.
 * - `pressAction.launchActivity` only defaults to `'default'` when the press
 *   action's id is `'default'`. The View button therefore sets it explicitly
 *   (otherwise pressing View would run JS without ever bringing the app to
 *   the foreground); OK deliberately does not, so it never opens the app.
 * - Presses arrive via `onBackgroundEvent` when the app is backgrounded or
 *   killed and via `onForegroundEvent` when it is active — both are wired to
 *   the same handler. A quit-state launch by View or a body tap is read once
 *   via `getInitialNotification()` (see `RootNavigator`), because the
 *   navigation container is not mounted when the event fires.
 *
 * Routing reuses `resolveNotificationTarget`/`navigateToNotificationTarget`
 * (`notificationRouting.ts`) — the same path every other notification tap
 * uses. Like all UI gating, this is UX only; the backend stays the authority
 * (R-017, R-082).
 *
 * Never logs notification title/body/entity id (R-111).
 */
import notifee, { AndroidStyle, EventType } from 'react-native-notify-kit';
import type { Event, Notification } from 'react-native-notify-kit';

import { PLAN_CHANNEL_ID } from './channels';
import {
  navigateToNotificationTarget,
  resolveNotificationTarget,
} from './notificationRouting';
import type { NotificationType, PushNotificationPayload } from '../types/notification';

/** The two notification types delivered data-only and rendered locally. */
export const PARTICIPANT_NOTIFICATION_TYPES = [
  'event_participant_added',
  'event_participant_removed',
] as const satisfies readonly NotificationType[];

export type ParticipantNotificationType = (typeof PARTICIPANT_NOTIFICATION_TYPES)[number];

export function isParticipantNotificationType(
  value: unknown,
): value is ParticipantNotificationType {
  return (
    typeof value === 'string' &&
    (PARTICIPANT_NOTIFICATION_TYPES as readonly string[]).includes(value)
  );
}

const VIEW_ACTION_ID = 'view';
const OK_ACTION_ID = 'ok';
const DEFAULT_PRESS_ID = 'default';

/**
 * Builds and shows the participant notification from an FCM `data` payload.
 * `title`/`body` are pre-built by the server (`body` may contain `\n`).
 *
 * The whole `data` map is attached to the notification so the press handlers
 * can recover `notification_type` and `entity_id` from
 * `detail.notification.data`.
 */
export async function displayParticipantNotification(
  data: Record<string, string>,
): Promise<void> {
  await notifee.displayNotification({
    title: data.title,
    body: data.body,
    data,
    android: {
      channelId: PLAN_CHANNEL_ID,
      // BigText so a multi-line body (`\n`) is shown in full when expanded.
      // notify-kit's validator throws on empty/undefined `text`, which would
      // suppress the whole notification, so the style is only set when the
      // body is a non-empty string.
      ...(data.body ? { style: { type: AndroidStyle.BIGTEXT, text: data.body } } : {}),
      pressAction: { id: DEFAULT_PRESS_ID },
      actions: [
        // launchActivity: see file header — required for View to open the app.
        { title: 'View', pressAction: { id: VIEW_ACTION_ID, launchActivity: 'default' } },
        { title: 'OK', pressAction: { id: OK_ACTION_ID } },
      ],
    },
  });
}

/**
 * Extracts a participant `PushNotificationPayload` from a notify-kit
 * notification's `data`, or `null` when it is not one of the two participant
 * types (or carries no data).
 */
function toParticipantPayload(
  notification: Notification | undefined,
): PushNotificationPayload | null {
  const data = notification?.data;
  const notificationType = data?.notification_type;
  if (!isParticipantNotificationType(notificationType)) {
    return null;
  }
  const entityId = data?.entity_id;
  return {
    notification_type: notificationType,
    entity_id: typeof entityId === 'string' ? entityId : '',
    title: typeof notification?.title === 'string' ? notification.title : '',
    body: typeof notification?.body === 'string' ? notification.body : '',
  };
}

/**
 * Notification events shared by the background and foreground listeners.
 *
 * - View button (`ACTION_PRESS`, id `view`) or a body tap (`PRESS`): route to
 *   the event. If the navigation container is not ready (headless/quit
 *   state) `navigateToNotificationTarget` drops the call by design; the
 *   quit-state launch is picked up by `getInitialParticipantNotification`.
 *   The View button additionally cancels the notification (after routing).
 * - OK button (`ACTION_PRESS`, id `ok`) or `DISMISSED`: cancel the
 *   notification. No API call.
 */
export async function handleParticipantNotificationEvent({ type, detail }: Event): Promise<void> {
  const pressActionId = detail.pressAction?.id;
  const isViewPress =
    (type === EventType.ACTION_PRESS && pressActionId === VIEW_ACTION_ID) ||
    type === EventType.PRESS;

  if (isViewPress) {
    const payload = toParticipantPayload(detail.notification);
    if (payload) {
      navigateToNotificationTarget(
        resolveNotificationTarget(payload.notification_type, payload.entity_id),
      );
    }
    // The View button opens the event AND clears its tray entry (an action
    // button does not auto-cancel). A body tap (`PRESS`) is left to the
    // notification's own auto-cancel.
    if (type === EventType.ACTION_PRESS && detail.notification?.id) {
      await notifee.cancelNotification(detail.notification.id);
    }
    return;
  }

  const isOkPress = type === EventType.ACTION_PRESS && pressActionId === OK_ACTION_ID;
  if ((isOkPress || type === EventType.DISMISSED) && detail.notification?.id) {
    await notifee.cancelNotification(detail.notification.id);
  }
}

/**
 * Registers the background/quit-state notification event handler. Must be
 * called once at top level in `index.js`, outside any React lifecycle, so it
 * exists when a press wakes the JS runtime before any component mounts.
 */
export function registerParticipantBackgroundHandler(): void {
  notifee.onBackgroundEvent(handleParticipantNotificationEvent);
}

/**
 * Registers the foreground event handler (app active when a button or the
 * body is pressed). Returns the unsubscribe function; called from
 * `RootNavigator` alongside the other listeners.
 */
export function registerParticipantForegroundHandler(): () => void {
  return notifee.onForegroundEvent(handleParticipantNotificationEvent);
}

/**
 * Quit-state launch: when the app was started by pressing View or the body of
 * a participant notification, returns its payload (one-shot read, like
 * `fcm.getInitialNotification`). `null` for a normal launch, a launch from
 * any other notification, or when the OK button was pressed (OK never
 * launches the app).
 */
export async function getInitialParticipantNotification(): Promise<PushNotificationPayload | null> {
  const initial = await notifee.getInitialNotification();
  if (!initial) {
    return null;
  }
  const pressId = initial.pressAction?.id;
  if (pressId !== DEFAULT_PRESS_ID && pressId !== VIEW_ACTION_ID) {
    return null;
  }
  return toParticipantPayload(initial.notification);
}
