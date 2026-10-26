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
 *
 * `group_event_created` (mobile notify-kit task, Part 3) is a third
 * ratified addition beyond §4.8's 12, added by the same explicit-instruction
 * mechanism as the two participant types above — the design still needs to
 * formally ratify it. Its `entity_id` is stated by the task brief to be the
 * event id (not the group id); unverified against a live backend payload,
 * same caveat as the two participant types (see `notificationRouting.ts`).
 */
export type NotificationType =
  | 'global'
  | 'event_invite'
  | 'event_changed'
  | 'event_cancelled'
  | 'event_reminder'
  | 'event_participant_added'
  | 'event_participant_removed'
  | 'group_event_created'
  | 'waitlist_promoted'
  | 'group_invite'
  | 'tournament_invited'
  | 'tournament_match_scheduled'
  | 'tournament_result_posted'
  | 'tournament_cancelled'
  | 'tournament_schedule_published'
  | 'tournament_standings_published'
  | 'tournament_advanced'
  | 'tournament_result_corrected'
  | 'team_invite'
  | 'team_join_request'
  | 'tournament_registration_removed'
  | 'group_deleted'
  | 'group_ownership_transferred';

/** All 23 known notification types (match-scoring v1.2 AD-S8 added `tournament_advanced`, `tournament_result_corrected`; teams-payments AD-12, AD-14 added `tournament_registration_removed`, `team_join_request`). */
export const NOTIFICATION_TYPES: NotificationType[] = [
  'global',
  'event_invite',
  'event_changed',
  'event_cancelled',
  'event_reminder',
  'event_participant_added',
  'event_participant_removed',
  'group_event_created',
  'waitlist_promoted',
  'group_invite',
  'tournament_invited',
  'tournament_match_scheduled',
  'tournament_result_posted',
  'tournament_cancelled',
  'tournament_schedule_published',
  'tournament_standings_published',
  'tournament_advanced',
  'tournament_result_corrected',
  'team_invite',
  'team_join_request',
  'tournament_registration_removed',
  'group_deleted',
  'group_ownership_transferred',
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
  /** Set when a tournament Register button opened the app (`register_mode` "open_app"): the tournament opens on the confirmation sheet. */
  open_registration?: boolean;
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
  /**
   * Derived outcome of the invitation / membership (push actions AD-6), e.g.
   * `going`, `waitlisted`, `accepted`, `declined`, `left`, `unavailable`.
   * Absent or `null` for other types and from servers that predate it.
   */
  action_state?: string | null;
  /** Optional metadata from API, including display.title and display.body. */
  data?: Record<string, any> | null;
  payload?: {
    display?: {
      title?: string | null;
      body?: string | null;
      url?: string | null;
    } | null;
    [key: string]: any;
  } | null;
}

/**
 * `GET /notifications/history` response (`NotificationHistoryResponse`).
 * `next_cursor` is the `created_at` of the last item of this page — pass it
 * back as `cursor` for the next page; null/absent means no more pages.
 */
export interface NotificationHistoryPage {
  items: NotificationHistoryItem[];
  next_cursor?: string | null;
  retention_days?: number;
  days?: number;
}
