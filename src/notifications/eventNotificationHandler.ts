/**
 * Locally-displayed notifications for `group_event_created` and
 * `event_changed` (DES-MEETUP-MOBILE.md §4.8; mobile notify-kit task Part 3).
 *
 * Both types are delivered data-only (no FCM `notification` block) and built
 * locally with `react-native-notify-kit`, for the same reason
 * `event_participant_added`/`event_participant_removed` are
 * (`participantHandler.ts`, built earlier): a native FCM `notification`
 * block cannot carry custom-labelled action buttons, and both these types
 * need one.
 *
 * Proposed Assumption: `event_changed` was previously one of the 12
 * §4.8-confirmed types delivered *with* a `notification` block — shown by
 * the OS automatically in background/killed state, and by the in-app
 * `NotificationBanner` in the foreground (`fcm.ts`'s `onMessage`), with a
 * plain tap-to-navigate and no action buttons. Giving it a "View" action
 * button, as this task requires, is only possible if the backend also
 * flips it to data-only — assumed here to mirror the same flip the two
 * participant types already went through, for the same reason (custom
 * action buttons require a data-only payload). If the backend does *not*
 * make this change, a live push will show both the OS's auto-rendered
 * notification block and this locally-built one — a duplicate tray entry.
 * Flagged for conformance-review to verify against a live payload once the
 * corresponding backend change ships.
 *
 * Shapes (per task brief; each differs from the other and from
 * `participantHandler.ts`'s two participant types, which both use the
 * View+OK shape unchanged):
 * - `group_event_created`: a single "Join" action. Pressing it, or tapping
 *   the notification body, both navigate to Event Detail — the same target
 *   `event_invite` already uses via `resolveNotificationTarget` — and are
 *   NOT a direct RSVP API call. The existing Event Detail RSVP button is
 *   untouched; joining still happens there. There is no OK/dismiss action
 *   for this type (explicit instruction — Android's own swipe-to-dismiss
 *   still works regardless).
 * - `event_changed`: View + OK, the identical shape `participantHandler.ts`
 *   already uses for the two participant types — View (or a body tap)
 *   navigates to Event Detail and clears the tray entry; OK dismisses only.
 *   Neither performs an API call. The body text (what changed — e.g. old →
 *   new venue/time) is pre-built by the backend, same as every other
 *   locally-displayed type; this file only ever displays `data.title`/
 *   `data.body` verbatim.
 *
 * Library behaviour notes (see `participantHandler.ts` for the same,
 * verified against react-native-notify-kit 10.7.1 source):
 * - Action *buttons* emit `EventType.ACTION_PRESS`; `EventType.PRESS` is
 *   only the notification *body* tap.
 * - `pressAction.launchActivity` only defaults to `'default'` when the
 *   press action's id is `'default'` — both Join and View set it
 *   explicitly, since both must bring the app to the foreground to
 *   navigate; OK deliberately does not, so it never opens the app.
 * - Presses arrive via `onBackgroundEvent` when the app is backgrounded or
 *   killed and via `onForegroundEvent` when it is active — both wired to
 *   the same handler. A quit-state launch is read once via
 *   `getInitialNotification()` (see `RootNavigator`).
 *
 * Routing reuses `resolveNotificationTarget`/`navigateToNotificationTarget`
 * (`notificationRouting.ts`) — the same path every other notification tap
 * uses. No new routing is invented here.
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

/** The two notification types delivered data-only and rendered locally by this file. */
export const EVENT_NOTIFICATION_TYPES = [
  'group_event_created',
  'event_changed',
] as const satisfies readonly NotificationType[];

export type EventHandlerNotificationType = (typeof EVENT_NOTIFICATION_TYPES)[number];

export function isEventNotificationType(value: unknown): value is EventHandlerNotificationType {
  return (
    typeof value === 'string' &&
    (EVENT_NOTIFICATION_TYPES as readonly string[]).includes(value)
  );
}

const JOIN_ACTION_ID = 'join';
const VIEW_ACTION_ID = 'view';
const OK_ACTION_ID = 'ok';
const DEFAULT_PRESS_ID = 'default';

/**
 * Builds and shows the notification from an FCM `data` payload.
 * `title`/`body` are pre-built by the server (`body` may contain `\n`).
 *
 * `group_event_created` gets a single "Join" action; every other type
 * handled by this file (`event_changed`) gets the View+OK pair, identical
 * to `participantHandler.ts`'s `displayParticipantNotification`.
 *
 * The whole `data` map is attached to the notification so the press
 * handlers can recover `notification_type` and `entity_id` from
 * `detail.notification.data`.
 */
export async function displayEventNotification(data: Record<string, string>): Promise<void> {
  const isJoinShape = data.notification_type === 'group_event_created';

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
      actions: isJoinShape
        ? [{ title: 'Join', pressAction: { id: JOIN_ACTION_ID, launchActivity: 'default' } }]
        : [
            // launchActivity: see file header — required for View to open the app.
            { title: 'View', pressAction: { id: VIEW_ACTION_ID, launchActivity: 'default' } },
            { title: 'OK', pressAction: { id: OK_ACTION_ID } },
          ],
    },
  });
}

/**
 * Extracts a `PushNotificationPayload` from a notify-kit notification's
 * `data`, or `null` when it is not one of the two types this file handles
 * (or carries no data).
 */
function toEventPayload(notification: Notification | undefined): PushNotificationPayload | null {
  const data = notification?.data;
  const notificationType = data?.notification_type;
  if (!isEventNotificationType(notificationType)) {
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
 * - Join or View button (`ACTION_PRESS`, id `join`/`view`) or a body tap
 *   (`PRESS`): route to the event. If the navigation container is not
 *   ready (headless/quit state) `navigateToNotificationTarget` drops the
 *   call by design; the quit-state launch is picked up by
 *   `getInitialEventNotification`. Join/View additionally cancel the
 *   notification (after routing) — a body tap is left to the
 *   notification's own auto-cancel.
 * - OK button (`ACTION_PRESS`, id `ok`) or `DISMISSED`: cancel the
 *   notification. No API call. (`group_event_created` has no OK action, so
 *   this branch only ever fires for `event_changed` presses or a swipe
 *   -dismiss of either type.)
 */
export async function handleEventNotificationEvent({ type, detail }: Event): Promise<void> {
  const pressActionId = detail.pressAction?.id;
  const isPrimaryPress =
    (type === EventType.ACTION_PRESS &&
      (pressActionId === VIEW_ACTION_ID || pressActionId === JOIN_ACTION_ID)) ||
    type === EventType.PRESS;

  if (isPrimaryPress) {
    const payload = toEventPayload(detail.notification);
    if (payload) {
      navigateToNotificationTarget(
        resolveNotificationTarget(payload.notification_type, payload.entity_id),
      );
    }
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
 * called once at top level in `index.js`, outside any React lifecycle, so
 * it exists when a press wakes the JS runtime before any component mounts.
 */
export function registerEventBackgroundHandler(): void {
  notifee.onBackgroundEvent(handleEventNotificationEvent);
}

/**
 * Registers the foreground event handler (app active when a button or the
 * body is pressed). Returns the unsubscribe function; called from
 * `RootNavigator` alongside the other listeners.
 */
export function registerEventForegroundHandler(): () => void {
  return notifee.onForegroundEvent(handleEventNotificationEvent);
}

/**
 * Quit-state launch: when the app was started by pressing Join/View or the
 * body of one of these two notification types, returns its payload
 * (one-shot read, like `fcm.getInitialNotification`). `null` for a normal
 * launch, a launch from any other notification, or when the OK button was
 * pressed (OK never launches the app).
 */
export async function getInitialEventNotification(): Promise<PushNotificationPayload | null> {
  const initial = await notifee.getInitialNotification();
  if (!initial) {
    return null;
  }
  const pressId = initial.pressAction?.id;
  if (pressId !== DEFAULT_PRESS_ID && pressId !== VIEW_ACTION_ID && pressId !== JOIN_ACTION_ID) {
    return null;
  }
  return toEventPayload(initial.notification);
}
