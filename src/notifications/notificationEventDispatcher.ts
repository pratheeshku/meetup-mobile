/**
 * The single notify-kit background/quit-state event handler.
 *
 * `notifee.onBackgroundEvent` keeps ONE handler: each call replaces the last.
 * Registering the participant and event handlers separately therefore left
 * only the last one alive. This dispatcher is registered once (top level in
 * `index.js`) and routes by the `notification_type` carried in the
 * notification's `data`:
 * - `event_invite` / `tournament_invited` / `group_invite` (and their result
 *   notifications) → `pushActions.ts`
 * - participant types → `participantHandler.ts`
 * - `group_event_created` / `event_changed` / `event_reminder` →
 *   `eventNotificationHandler.ts`
 * Anything else is ignored. Foreground presses stay on each handler's own
 * `onForegroundEvent` registration (multiple foreground listeners are allowed).
 */
import notifee from 'react-native-notify-kit';
import type { Event } from 'react-native-notify-kit';

import { handleEventNotificationEvent, isEventNotificationType } from './eventNotificationHandler';
import {
  handleParticipantNotificationEvent,
  isParticipantNotificationType,
} from './participantHandler';
import { handlePushActionEvent, isPushActionType } from './pushActions';

export async function dispatchNotificationEvent(event: Event): Promise<void> {
  const type = event.detail.notification?.data?.notification_type;
  if (isPushActionType(type)) {
    await handlePushActionEvent(event);
  } else if (isParticipantNotificationType(type)) {
    await handleParticipantNotificationEvent(event);
  } else if (isEventNotificationType(type)) {
    await handleEventNotificationEvent(event);
  }
}

/** Call once, at top level in `index.js`. */
export function registerNotificationBackgroundDispatcher(): void {
  notifee.onBackgroundEvent(dispatchNotificationEvent);
}
