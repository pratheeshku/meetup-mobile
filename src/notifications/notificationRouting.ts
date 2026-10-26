/**
 * Notification type → screen routing (DES-MEETUP-MOBILE.md §3.6, §4.8;
 * R-073).
 *
 * A single source of truth for "which screen does this notification type
 * open", shared by the foreground banner's tap handler
 * (`NotificationBanner.tsx`) and the background/quit-state tap handler
 * (`fcm.ts`'s `onNotificationOpenedApp`/`getInitialNotification` wiring in
 * `RootNavigator.tsx`) — kept in one place so the type mapping is never
 * duplicated (and never silently drifts) between the two call sites, per
 * the task brief's "no unhandled types" rule.
 *
 * `team_invite` and `team_join_request` (teams-payments AD-15) open Groups with the Tournament teams list selected, because the team detail
 * screen does not exist yet (task tp-mobile-teams). They used to open `GroupDetailScreen` with a team id, which could never load.
 */
import { createNavigationContainerRef } from '@react-navigation/native';

import type { NotificationType } from '../types/notification';
import type { AppTabParamList } from '../navigation/types';

/**
 * Where a given notification type navigates to. Expressed as a tab +
 * nested-stack screen + params triple so a single root `navigationRef`
 * (which only sees the top-level tab navigator) can reach any
 * screen nested inside a tab's own stack.
 */
export type NotificationTarget =
  | { tab: 'Home'; screen: 'EventsList' }
  | { tab: 'Home'; screen: 'EventDetail'; params: { eventId: string } }
  | { tab: 'Groups'; screen: 'GroupsList'; params?: { section: 'teams' } }
  | { tab: 'Groups'; screen: 'GroupDetail'; params: { groupId: string } }
  | {
      tab: 'Tournaments';
      screen: 'TournamentDetail';
      params: { tournamentId: string; openRegistration?: boolean };
    };

/**
 * Resolves a notification type + entity id to a concrete navigation
 * target. Exhaustive over `NotificationType` (the 12 from §4.8, the two
 * participant types, `group_event_created`, plus `event_reminder` and `tournament_invited`) —
 * the `never` fallthrough in `default` makes an unhandled type a compile
 * error, not a silent no-op, satisfying the task brief's "no unhandled types"
 * rule at the type-checker level.
 */
export function resolveNotificationTarget(
  notificationType: NotificationType,
  entityId: string,
  /** `openRegistration`: a tournament invitation's Register button opened the app; the tournament opens on the confirmation sheet. */
  options?: { openRegistration?: boolean },
): NotificationTarget {
  switch (notificationType) {
    case 'global':
      return { tab: 'Home', screen: 'EventsList' };

    // `group_event_created` (mobile notify-kit task, Part 3) and `event_reminder`
    // (DES-MEETUP-ADDENDUM-event-reminder.md v1.1) route exactly like `event_invite` —
    // same target, same mechanism, no blank-id guard (unlike
    // event_participant_added/removed below). entity_id assumed = event id,
    // not verified against a live backend payload.
    case 'event_invite':
    case 'event_changed':
    case 'event_cancelled':
    case 'waitlist_promoted':
    case 'group_event_created':
    case 'event_reminder':
      return {
        tab: 'Home',
        screen: 'EventDetail',
        params: { eventId: entityId },
      };

    // Added after the design's 12 (see `types/notification.ts`). ASSUMPTION,
    // UNVERIFIED: `entity_id` is the event id — the server-side payload
    // builders were not reachable when this was written, and the live OpenAPI
    // does not document push payloads. If the server sends something else
    // (e.g. the participant's user id), the event screen's existing load-error
    // state shows rather than crashing. Unlike the older event types, an
    // absent/blank `entity_id` falls back to the events list instead of
    // opening `EventDetail` with an empty id (whose `GET /events/` would hit
    // the list route, not a single event).
    case 'event_participant_added':
    case 'event_participant_removed':
      if (entityId.trim() === '') {
        return { tab: 'Home', screen: 'EventsList' };
      }
      return {
        tab: 'Home',
        screen: 'EventDetail',
        params: { eventId: entityId },
      };

    case 'group_invite':
      return {
        tab: 'Groups',
        screen: 'GroupDetail',
        params: { groupId: entityId },
      };

    // `tournament_invited` (addendum AD-4): entity_id = the tournament id; opens
    // Tournament Detail, where the invitation banner (Accept / Decline) shows.
    case 'tournament_invited':
      return {
        tab: 'Tournaments',
        screen: 'TournamentDetail',
        params: options?.openRegistration
          ? { tournamentId: entityId, openRegistration: true }
          : { tournamentId: entityId },
      };
    case 'tournament_match_scheduled':
    case 'tournament_result_posted':
    case 'tournament_cancelled':
    case 'tournament_schedule_published':
    case 'tournament_standings_published':
    case 'tournament_advanced': // match scoring (v1.2 AD-S8): entity_id = the tournament id
    case 'tournament_result_corrected':
      return {
        tab: 'Tournaments',
        screen: 'TournamentDetail',
        params: { tournamentId: entityId },
      };

    // teams-payments AD-15: there is no team detail screen yet (task tp-mobile-teams), so a team invitation and a join request open Groups with
    // the Tournament teams list selected. `entity_id` (a team id) is not used: it is never read as a group id.
    case 'team_invite':
    case 'team_join_request':
      return {
        tab: 'Groups',
        screen: 'GroupsList',
        params: { section: 'teams' },
      };

    // teams-payments AD-12: the removed entrant is told; the push opens the tournament (entity_id = the tournament id).
    case 'tournament_registration_removed':
      return {
        tab: 'Tournaments',
        screen: 'TournamentDetail',
        params: { tournamentId: entityId },
      };

    case 'group_deleted':
      return {
        tab: 'Groups',
        screen: 'GroupsList',
      };

    case 'group_ownership_transferred':
      return {
        tab: 'Groups',
        screen: 'GroupDetail',
        params: { groupId: entityId },
      };

    default: {
      const exhaustiveCheck: never = notificationType;
      throw new Error(
        `Unhandled notification type: ${String(exhaustiveCheck)}`,
      );
    }
  }
}

/**
 * Root navigation ref (§3.1, §3.9), shared by `RootNavigator` (attached to
 * `NavigationContainer`) and every notification-tap handler below it in
 * the tree and outside the React tree entirely (`fcm.ts`'s
 * `onNotificationOpenedApp`/`getInitialNotification` listeners, wired from
 * `RootNavigator`). A ref (rather than prop-drilling `navigation`) is the
 * standard React Navigation pattern for navigating from code that isn't a
 * screen component — see
 * https://reactnavigation.org/docs/navigating-without-navigation-prop/.
 *
 * Typed against `AppTabParamList` only: the ref is only ever used to route
 * a notification tap, which only makes sense once the user is signed in
 * and the App Stack (tabs) is mounted — see `navigateToNotificationTarget`.
 */
export const navigationRef = createNavigationContainerRef<AppTabParamList>();

/**
 * Navigates to a resolved notification target via the root ref.
 *
 * Best-effort by design (§3.9's own "Offline behaviour" note: "tap-through
 * requires connectivity, falling back to cached data if available" already
 * accepts that a tap doesn't always land cleanly) — if the container isn't
 * mounted/ready yet (e.g. a cold-start tap racing the first render, or the
 * user is signed out and only the Auth Stack exists), the navigation is
 * silently dropped rather than throwing. `getInitialNotification`'s caller
 * in `RootNavigator` re-checks readiness itself before calling this, so in
 * practice this guard is a defence-in-depth backstop, not the primary
 * mechanism.
 */
export function navigateToNotificationTarget(target: NotificationTarget): void {
  if (!navigationRef.isReady()) {
    return;
  }

  // Matched on the full (tab, screen) pair, not just `target.tab`, so each
  // branch's `params` shape narrows correctly — `EventsList` takes no
  // params while `EventDetail` requires `eventId`, and a switch on `tab`
  // alone can't express that distinction to the type checker.
  if (target.tab === 'Home' && target.screen === 'EventsList') {
    navigationRef.navigate('Home', { screen: 'EventsList' });
  } else if (target.tab === 'Home' && target.screen === 'EventDetail') {
    navigationRef.navigate('Home', {
      screen: 'EventDetail',
      params: target.params,
    });
  } else if (target.tab === 'Groups' && target.screen === 'GroupsList') {
    navigationRef.navigate('Groups', target.params ? { screen: 'GroupsList', params: target.params } : { screen: 'GroupsList' });
  } else if (target.tab === 'Groups' && target.screen === 'GroupDetail') {
    navigationRef.navigate('Groups', {
      screen: 'GroupDetail',
      params: target.params,
    });
  } else if (target.tab === 'Tournaments') {
    navigationRef.navigate('Tournaments', {
      screen: 'TournamentDetail',
      params: target.params,
    });
  } else {
    const exhaustiveCheck: never = target;
    throw new Error(
      `Unhandled notification target: ${JSON.stringify(exhaustiveCheck)}`,
    );
  }
}
