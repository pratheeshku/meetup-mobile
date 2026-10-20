/**
 * Push actions (DES-MEETUP-ADDENDUM-push-actions v1.0, AD-1, AD-5, AD-7, AD-10):
 * action buttons on `event_invite`, `tournament_invited` and `group_invite`
 * notifications, answered without opening the app.
 *
 * - Android: the server sends these data-only (when the flag is on and this
 *   install declared `pushActionsVersion` >= 1), `displayPushActionNotification`
 *   renders them with notify-kit. The notify-kit id is the push `tag` (fallback
 *   `notification_id`), so a duplicate FCM delivery replaces the entry.
 * - iOS: the server sends an alert with `aps.category`; the three categories
 *   are registered at every launch (`registerPushActionCategories`).
 * - A press runs in the background (no `launchActivity`, `foreground: false`),
 *   in one `withCorrelationId()` per action: token via
 *   `refreshAccessTokenForAction()`, ONE existing endpoint call with that
 *   token held in memory, then one result notification replacing the original.
 *   Ignore clears the tray entry first, then marks the delivery read best effort.
 *
 * No pre-flight offline check (deviation D-4): the call is attempted and a
 * failure becomes the generic message. One attempt, no retry.
 *
 * Never logs tokens, titles, bodies, entity ids or delivery ids (R-111). The
 * switchable diagnostics layer (`perfLog`, off by default) records only event
 * shape: event type, press action id, which fields are present, data key names.
 * Push title and body are displayed exactly as received.
 */
import { Platform } from 'react-native';
import notifee, { AndroidStyle, EventType } from 'react-native-notify-kit';
import type { Event, IOSNotificationCategory, Notification } from 'react-native-notify-kit';

import { apiClient, refreshAccessTokenForAction } from '../api/client';
import { withCorrelationId } from '../api/correlationId';
import { perfLog } from '../diagnostics/perfLog';
import { currentT } from '../labels/LabelsContext';
import type { LabelKey } from '../labels/LabelsContext';
import type { NotificationType, PushNotificationPayload } from '../types/notification';
import { PLAN_CHANNEL_ID } from './channels';
import { navigateToNotificationTarget, resolveNotificationTarget } from './notificationRouting';
import { platformNotificationOptions } from './platformOptions';

/**
 * When true, Accept and Leave group require device authentication (Face ID /
 * passcode) before they run on iOS. The spike showed Keychain is unreadable
 * while locked; the owner can flip this once the on-device matrix is known.
 */
export const IOS_ACTIONS_REQUIRE_AUTH = true;

export const PUSH_ACTION_TYPES = [
  'event_invite',
  'tournament_invited',
  'group_invite',
] as const satisfies readonly NotificationType[];

export type PushActionType = (typeof PUSH_ACTION_TYPES)[number];

export const ACCEPT_ACTION_ID = 'accept';
export const LEAVE_ACTION_ID = 'leave';
export const IGNORE_ACTION_ID = 'ignore';
export const DECLINE_ACTION_ID = 'decline';
const DEFAULT_PRESS_ID = 'default';

type PrimaryActionId = typeof ACCEPT_ACTION_ID | typeof LEAVE_ACTION_ID;
type SecondaryActionId = typeof DECLINE_ACTION_ID | typeof IGNORE_ACTION_ID;

interface ActionScope {
  /** The primary action button (Accept or Leave group). */
  primary: PrimaryActionId;
  primaryLabel: LabelKey;
  /** Second button: Decline (invitations) or Ignore (group additions). */
  secondary: SecondaryActionId;
  secondaryLabel: LabelKey;
  /** `aps.category` the server sends for this type (AD-3). */
  iosCategory: string;
}

/** AD-1 scope table. Keep identical to the backend's `ACTION_TYPE_IOS_CATEGORY`. */
export const PUSH_ACTION_SCOPE: Record<PushActionType, ActionScope> = {
  event_invite: {
    primary: ACCEPT_ACTION_ID,
    primaryLabel: 'mob.notification_action.accept',
    secondary: DECLINE_ACTION_ID,
    secondaryLabel: 'mob.respond.decline',
    iosCategory: 'invite_game',
  },
  tournament_invited: {
    primary: ACCEPT_ACTION_ID,
    primaryLabel: 'mob.notification_action.accept',
    secondary: DECLINE_ACTION_ID,
    secondaryLabel: 'mob.respond.decline',
    iosCategory: 'invite_tournament',
  },
  group_invite: {
    primary: LEAVE_ACTION_ID,
    primaryLabel: 'mob.notification_action.leave_group',
    secondary: IGNORE_ACTION_ID,
    secondaryLabel: 'mob.notification_action.ignore',
    iosCategory: 'group_added',
  },
};

export function isPushActionType(value: unknown): value is PushActionType {
  return typeof value === 'string' && (PUSH_ACTION_TYPES as readonly string[]).includes(value);
}

const KNOWN_PRESS_IDS: readonly string[] = [
  ACCEPT_ACTION_ID,
  LEAVE_ACTION_ID,
  IGNORE_ACTION_ID,
  DECLINE_ACTION_ID,
  DEFAULT_PRESS_ID,
];
const MAX_LOGGED_DATA_KEYS = 20;

/**
 * Shape-only description of a notify-kit event for diagnostics: event type,
 * press action id (known ids only, anything else is "other"), whether the
 * notification, its id, `notification_type` and `delivery_id` are present, and
 * the NAMES of the data keys. Never values, so no tokens, ids, titles or PII.
 */
export function describeNotificationEvent(event: Event): Record<string, unknown> {
  const notification = event.detail?.notification;
  const data = notification?.data ?? {};
  const pressId = event.detail?.pressAction?.id;
  return {
    platform: Platform.OS,
    eventType: event.type,
    pressAction:
      typeof pressId === 'string' ? (KNOWN_PRESS_IDS.includes(pressId) ? pressId : 'other') : 'none',
    hasNotification: Boolean(notification),
    hasId: Boolean(notification?.id),
    hasType: typeof data.notification_type === 'string' && data.notification_type !== '',
    hasDeliveryId: typeof data.delivery_id === 'string' && data.delivery_id !== '',
    dataKeys: Object.keys(data).slice(0, MAX_LOGGED_DATA_KEYS),
  };
}

/** Notifications with an action in flight, keyed by notification id. */
const inFlight = new Set<string>();

// ── Display ─────────────────────────────────────────────────────────────────

/**
 * Android: renders a data-only push locally with the action buttons. `title`
 * and `body` are shown exactly as received. The whole `data` map is attached so
 * the press handler can read `notification_type`, `entity_id` and `delivery_id`.
 */
export async function displayPushActionNotification(data: Record<string, string>): Promise<void> {
  const scope = isPushActionType(data.notification_type)
    ? PUSH_ACTION_SCOPE[data.notification_type]
    : null;
  if (!scope) {
    return;
  }
  const id = data.tag || data.notification_id || undefined;

  await notifee.displayNotification({
    ...(id ? { id } : {}),
    title: data.title,
    body: data.body,
    data,
    ...platformNotificationOptions(),
    android: {
      channelId: PLAN_CHANNEL_ID,
      // notify-kit's validator throws on empty/undefined `text`.
      ...(data.body ? { style: { type: AndroidStyle.BIGTEXT, text: data.body } } : {}),
      pressAction: { id: DEFAULT_PRESS_ID },
      // No launchActivity on the buttons: they must not open the app.
      actions: [
        { title: currentT(scope.primaryLabel), pressAction: { id: scope.primary } },
        { title: currentT(scope.secondaryLabel), pressAction: { id: scope.secondary } },
      ],
    },
  });
}

/**
 * iOS: registers the three categories (`invite_game`, `invite_tournament`,
 * `group_added`). Must run at every app launch. The actions run in the
 * background; Accept and Leave group require authentication while
 * `IOS_ACTIONS_REQUIRE_AUTH` is true. No-op on Android.
 */
export async function registerPushActionCategories(): Promise<void> {
  if (Platform.OS !== 'ios') {
    return;
  }
  const categories: IOSNotificationCategory[] = PUSH_ACTION_TYPES.map(type => {
    const scope = PUSH_ACTION_SCOPE[type];
    return {
      id: scope.iosCategory,
      actions: [
        {
          id: scope.primary,
          title: currentT(scope.primaryLabel),
          foreground: false,
          authenticationRequired: IOS_ACTIONS_REQUIRE_AUTH,
        },
        {
          id: scope.secondary,
          title: currentT(scope.secondaryLabel),
          foreground: false,
        },
      ],
    };
  });
  await notifee.setNotificationCategories(categories);
}

// ── API calls (existing endpoints only) ─────────────────────────────────────

interface CallContext {
  correlationId: string;
  /** The in-memory access token from this action's own refresh. */
  headers: { Authorization: string };
}

interface HttpErrorLike {
  response?: { status?: number; data?: { detail?: unknown } };
}

function statusOf(error: unknown): number | null {
  const status = (error as HttpErrorLike | null)?.response?.status;
  return typeof status === 'number' ? status : null;
}

function detailOf(error: unknown): string {
  const detail = (error as HttpErrorLike | null)?.response?.data?.detail;
  return typeof detail === 'string' ? detail.trim() : '';
}

/** `POST /events/{id}/invitations/respond` `{accept: true}` → result text. */
async function acceptGame(eventId: string, ctx: CallContext): Promise<string> {
  try {
    const { data } = await apiClient.post<{ participation_status?: string | null }>(
      `/events/${eventId}/invitations/respond`,
      { accept: true },
      ctx,
    );
    if (data?.participation_status === 'going') {
      return currentT('mob.push_action_result.going');
    }
    if (data?.participation_status === 'waitlisted') {
      return currentT('mob.push_action_result.waitlisted');
    }
    return currentT('mob.push_action_result.accepted');
  } catch (error) {
    const status = statusOf(error);
    if (status === 404) {
      return currentT('mob.push_action_result.game_unavailable');
    }
    if (status === 400) {
      const reason = detailOf(error);
      if (!reason) {
        return currentT('mob.push_action_result.generic');
      }
      // The server answers "Invitation is already <status>" for a repeat.
      return /already/i.test(reason)
        ? currentT('mob.push_action_result.already_accepted')
        : currentT('mob.push_action_result.refused', { reason });
    }
    return currentT('mob.push_action_result.generic');
  }
}

/** `POST /tournaments/{id}/invitations/respond` `{accept: true}` → result text. */
async function acceptTournament(tournamentId: string, ctx: CallContext): Promise<string> {
  try {
    await apiClient.post(`/tournaments/${tournamentId}/invitations/respond`, { accept: true }, ctx);
    return currentT('mob.push_action_result.tournament_accepted');
  } catch (error) {
    const status = statusOf(error);
    if (status === 409) {
      return currentT('mob.push_action_result.tournament_closed');
    }
    if (status === 400) {
      return currentT('mob.push_action_result.already_answered');
    }
    if (status === 404) {
      return currentT('mob.push_action_result.tournament_unavailable');
    }
    return currentT('mob.push_action_result.generic');
  }
}

/**
 * `DELETE /groups/{group_id}/members/{user_id}` with the caller's own id
 * (`GET /users/me`). The group name for the result text is read first
 * (`GET /groups/{id}`, best effort: after leaving it would answer 404).
 */
async function leaveGroup(groupId: string, ctx: CallContext): Promise<string> {
  let userId: string;
  let groupName = '';
  try {
    const [me, group] = await Promise.all([
      apiClient.get<{ id?: string }>('/users/me', ctx),
      apiClient.get<{ name?: string }>(`/groups/${groupId}`, ctx).catch(() => null),
    ]);
    if (typeof me.data?.id !== 'string' || !me.data.id) {
      return currentT('mob.push_action_result.generic');
    }
    userId = me.data.id;
    groupName = typeof group?.data?.name === 'string' ? group.data.name : '';
  } catch {
    return currentT('mob.push_action_result.generic');
  }

  try {
    await apiClient.delete(`/groups/${groupId}/members/${userId}`, ctx);
    return groupName
      ? currentT('mob.push_action_result.left_group', { group: groupName })
      : currentT('mob.push_action_result.left_group_unnamed');
  } catch (error) {
    const status = statusOf(error);
    if (status === 400) {
      return currentT('mob.push_action_result.owner_cannot_leave');
    }
    if (status === 404) {
      return currentT('mob.push_action_result.group_unavailable');
    }
    return currentT('mob.push_action_result.generic');
  }
}

/** `POST /events/{id}/invitations/respond` `{accept: false}` → result text (DR-08). */
async function declineGame(eventId: string, ctx: CallContext): Promise<string> {
  try {
    await apiClient.post(`/events/${eventId}/invitations/respond`, { accept: false }, ctx);
    return currentT('mob.respond.you_declined');
  } catch (error) {
    const status = statusOf(error);
    if (status === 404) {
      return currentT('mob.respond.unavailable');
    }
    if (status === 400) {
      return currentT('mob.respond.already_answered');
    }
    return currentT('mob.push_action_result.generic');
  }
}

/** `POST /tournaments/{id}/invitations/respond` `{accept: false}` → result text (DR-08). */
async function declineTournamentInvite(tournamentId: string, ctx: CallContext): Promise<string> {
  try {
    await apiClient.post(`/tournaments/${tournamentId}/invitations/respond`, { accept: false }, ctx);
    return currentT('mob.respond.you_declined');
  } catch (error) {
    const status = statusOf(error);
    if (status === 404) {
      return currentT('mob.respond.unavailable');
    }
    if (status === 400) {
      return currentT('mob.respond.already_answered');
    }
    return currentT('mob.push_action_result.generic');
  }
}

// ── Press handling ──────────────────────────────────────────────────────────

function dataOf(notification: Notification | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(notification?.data ?? {})) {
    if (typeof value === 'string') {
      out[key] = value;
    }
  }
  return out;
}

async function showResult(
  notificationId: string,
  type: PushActionType,
  entityId: string,
  text: string,
): Promise<void> {
  await notifee.displayNotification({
    // Same id: replaces the original entry (and the duplicate-delivery entry).
    id: notificationId,
    title: text,
    data: { notification_type: type, entity_id: entityId, push_action_result: '1' },
    ...platformNotificationOptions(),
    android: { channelId: PLAN_CHANNEL_ID, pressAction: { id: DEFAULT_PRESS_ID } },
  });
}

async function runDeclineAction(
  type: PushActionType,
  notificationId: string,
  entityId: string,
): Promise<void> {
  const text = await withCorrelationId(async correlationId => {
    try {
      const token = await refreshAccessTokenForAction();
      const ctx: CallContext = { correlationId, headers: { Authorization: `Bearer ${token}` } };
      if (type === 'event_invite') {
        return await declineGame(entityId, ctx);
      }
      if (type === 'tournament_invited') {
        return await declineTournamentInvite(entityId, ctx);
      }
      return currentT('mob.push_action_result.generic');
    } catch {
      return currentT('mob.push_action_result.generic');
    }
  });
  try {
    await showResult(notificationId, type, entityId, text);
  } catch {
    // Nothing useful to do in a headless task if display fails.
  }
}

async function runPrimaryAction(
  type: PushActionType,
  notificationId: string,
  entityId: string,
): Promise<void> {
  const text = await withCorrelationId(async correlationId => {
    try {
      const token = await refreshAccessTokenForAction();
      const ctx: CallContext = { correlationId, headers: { Authorization: `Bearer ${token}` } };
      if (type === 'event_invite') {
        return await acceptGame(entityId, ctx);
      }
      if (type === 'tournament_invited') {
        return await acceptTournament(entityId, ctx);
      }
      return await leaveGroup(entityId, ctx);
    } catch {
      // Session ended, network, timeout or 5xx while refreshing.
      return currentT('mob.push_action_result.generic');
    }
  });
  try {
    await showResult(notificationId, type, entityId, text);
  } catch {
    // Nothing useful to do in a headless task if display fails.
  }
}

/** Clears the tray entry first, then marks the delivery read, best effort. */
async function runIgnore(notificationId: string, deliveryId: string): Promise<void> {
  await notifee.cancelNotification(notificationId);
  if (!deliveryId) {
    return;
  }
  try {
    await withCorrelationId(async correlationId => {
      const token = await refreshAccessTokenForAction();
      await apiClient.post(`/notifications/${encodeURIComponent(deliveryId)}/read`, undefined, {
        correlationId,
        headers: { Authorization: `Bearer ${token}` },
      });
    });
  } catch {
    // Best effort: the item simply stays unread in the list.
  }
}

/**
 * Press handling for the three action types and their result notifications.
 *
 * - Body tap (`PRESS`) on the notification or on a result: open the entity.
 * - Accept / Leave group (`ACTION_PRESS`): the call and result described above.
 * - Ignore (`ACTION_PRESS`): see `runIgnore`.
 * A second press on the same notification while one runs is ignored.
 */
export async function handlePushActionEvent(event: Event): Promise<void> {
  const { type, detail } = event;
  perfLog('push_action_event', describeNotificationEvent(event));
  const data = dataOf(detail.notification);
  if (!isPushActionType(data.notification_type)) {
    perfLog('push_action_skip', { reason: 'no_push_action_type' });
    return;
  }
  const actionType = data.notification_type;
  const scope = PUSH_ACTION_SCOPE[actionType];

  if (type === EventType.PRESS) {
    navigateToNotificationTarget(resolveNotificationTarget(actionType, data.entity_id ?? ''));
    return;
  }
  if (type !== EventType.ACTION_PRESS) {
    return;
  }

  // A remote push on iOS may arrive without a usable notification id; the server's
  // `delivery_id` is the same per-delivery key, so use it for in-flight tracking and for
  // the result notification.
  const notificationId = detail.notification?.id || data.delivery_id;
  const actionId = detail.pressAction?.id;
  if (!notificationId) {
    perfLog('push_action_skip', { reason: 'no_id_and_no_delivery_id' });
    return;
  }
  if (data.push_action_result === '1') {
    perfLog('push_action_skip', { reason: 'result_notification' });
    return;
  }
  if (actionId !== scope.primary && actionId !== scope.secondary) {
    perfLog('push_action_skip', { reason: 'unknown_action' });
    return;
  }
  if (inFlight.has(notificationId)) {
    perfLog('push_action_skip', { reason: 'in_flight' });
    return;
  }

  inFlight.add(notificationId);
  try {
    if (actionId === IGNORE_ACTION_ID) {
      await runIgnore(notificationId, data.delivery_id ?? '');
    } else if (actionId === DECLINE_ACTION_ID && data.entity_id) {
      await runDeclineAction(actionType, notificationId, data.entity_id);
    } else if (data.entity_id) {
      await runPrimaryAction(actionType, notificationId, data.entity_id);
    } else {
      await showResult(notificationId, actionType, '', currentT('mob.push_action_result.generic'));
    }
  } finally {
    inFlight.delete(notificationId);
  }
}

/** Foreground presses (app active). Returns the unsubscribe function. */
export function registerPushActionForegroundHandler(): () => void {
  return notifee.onForegroundEvent(handlePushActionEvent);
}

/**
 * Quit-state launch from a body tap on one of these notifications (or on a
 * result). Same role as the participant/event `getInitial…Notification`.
 */
export async function getInitialPushActionNotification(): Promise<PushNotificationPayload | null> {
  const initial = await notifee.getInitialNotification();
  if (!initial || initial.pressAction?.id !== DEFAULT_PRESS_ID) {
    return null;
  }
  const data = dataOf(initial.notification);
  if (!isPushActionType(data.notification_type)) {
    return null;
  }
  return {
    notification_type: data.notification_type,
    entity_id: data.entity_id ?? '',
    title: '',
    body: '',
  };
}
