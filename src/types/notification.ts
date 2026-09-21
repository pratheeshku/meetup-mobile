/**
 * Push notification domain types (DES-MEETUP-MOBILE.md §3.6, §4.8, §7.6;
 * R-070–R-077).
 *
 * Proposed Assumption: `NotificationType` is a string literal union, not a
 * TypeScript `enum`. Every other domain type file in this codebase
 * (`src/types/event.ts`'s `EventStatus`/`RsvpStatus`, `src/types/group.ts`'s
 * `GroupMemberRole`) uses string unions, never the `enum` keyword — kept
 * consistent with that established convention rather than introducing the
 * only runtime `enum` in the codebase. The set of literal values below is
 * the 12 confirmed types from the original task brief (cross-checked against
 * DES-MEETUP-MOBILE.md §4.8's notification-type → deep-link mapping table)
 * plus `event_participant_added` / `event_participant_removed`, which the
 * backend can send but §4.8's table does not list. Those two were added by
 * explicit instruction; the design needs to ratify them (deviation from
 * §4.8's "all 12 confirmed types"). What their `entity_id` holds is
 * unverified — see `notificationRouting.ts`.
 */
export type NotificationType =
  | 'global'
  | 'event_invite'
  | 'event_changed'
  | 'event_cancelled'
  | 'event_participant_added'
  | 'event_participant_removed'
  | 'waitlist_promoted'
  | 'group_invite'
  | 'tournament_match_scheduled'
  | 'tournament_result_posted'
  | 'tournament_cancelled'
  | 'tournament_schedule_published'
  | 'tournament_standings_published'
  | 'team_invite';

/** All 14 known notification types (the 12 from the task brief, plus the two participant types). */
export const NOTIFICATION_TYPES: NotificationType[] = [
  'global',
  'event_invite',
  'event_changed',
  'event_cancelled',
  'event_participant_added',
  'event_participant_removed',
  'waitlist_promoted',
  'group_invite',
  'tournament_match_scheduled',
  'tournament_result_posted',
  'tournament_cancelled',
  'tournament_schedule_published',
  'tournament_standings_published',
  'team_invite',
];

/**
 * A user's preference for one notification type
 * (`GET /notifications/preferences` item shape, §7.6).
 *
 * Proposed Assumption: field shape is not specified beyond the task
 * brief's literal `notification_type, enabled` pair — no response-body
 * schema for this endpoint exists in the local design excerpt (the same
 * class of gap already recorded for every other module's endpoints in
 * this project, e.g. `src/types/group.ts`). Correct against the actual
 * backend contract on conformance review.
 */
export interface NotificationPreference {
  notification_type: NotificationType;
  enabled: boolean;
}

/**
 * The `data` payload of an FCM message this app understands (§3.6, §4.8).
 * `entity_id` is the id of the event/group/tournament/team the
 * notification relates to — absent/ignored for `global`, which has no
 * single related entity.
 */
export interface PushNotificationPayload {
  notification_type: NotificationType;
  entity_id: string;
  title: string;
  body: string;
}

/**
 * One stored notification (`GET /notifications/history` item). Shape taken
 * from the live OpenAPI `NotificationHistoryItem` (verified 2026-09-22), which
 * differs from the original brief in two ways that matter at runtime:
 * `notification_type` is a plain string (the backend may send a type this app
 * build does not know, so callers must guard before routing), and `title`,
 * `body`, `entity_id` and `entity_type` are all nullable.
 */
export interface NotificationHistoryItem {
  id: string;
  notification_type: string;
  title: string | null;
  body: string | null;
  entity_id: string | null;
  entity_type: string | null;
  /** ISO 8601 date-time. */
  created_at: string;
  /** ISO 8601 date-time; `null` while unread. */
  read_at: string | null;
}

/**
 * `GET /notifications/history` response (`NotificationHistoryResponse`).
 * `next_cursor` is the `created_at` of the last item of this page — pass it
 * back as `cursor` for the next page; null/absent means no more pages.
 */
export interface NotificationHistoryPage {
  items: NotificationHistoryItem[];
  next_cursor?: string | null;
}
