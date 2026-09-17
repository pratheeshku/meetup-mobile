/**
 * Notification type → screen routing (DES-MEETUP-MOBILE.md §3.6, §4.8;
 * R-073).
 *
 * A single source of truth for "which screen does this notification type
 * open", shared by the foreground banner's tap handler
 * (`NotificationBanner.tsx`) and the background/quit-state tap handler
 * (`fcm.ts`'s `onNotificationOpenedApp`/`getInitialNotification` wiring in
 * `RootNavigator.tsx`) — kept in one place so the 12-type mapping is never
 * duplicated (and never silently drifts) between the two call sites, per
 * the task brief's "All 12 notification types must be handled in
 * routing — no unhandled types" rule.
 *
 * Deviation (recorded for the Implementation Report, needs architect
 * ratification): DES-MEETUP-MOBILE.md §4.8's own mapping table routes
 * `team_invite` to a **Team Detail** screen, backed by the design's
 * separate `/teams/*` API family (§4.4, §7.3). No Team module (screen,
 * API client, or route) has been built anywhere in this codebase — only
 * Groups exists (`GroupDetailScreen`, `src/api/groups.ts`, `GET
 * /groups/{id}`). Building a full Team Detail screen is outside this
 * task's stated scope (its own step list only adds
 * `NotificationPreferencesScreen`). Per the task brief's explicit,
 * literal instruction, `team_invite` routes to `GroupDetailScreen`
 * below, passing `entity_id` as `groupId`. This is a real functional
 * risk, not a cosmetic one: if a `team_invite`'s `entity_id` is actually
 * a team id (not a group id), `GroupDetailScreen`'s `GET /groups/{id}`
 * fetch will fail against a real backend. Flagged here, in the
 * Implementation Report, and in `GroupDetailScreen`'s own load-error
 * path (already shows a generic "could not load" retry state, so this
 * fails safely rather than crashing) — needs architect resolution: either
 * confirm `team_invite`'s `entity_id` is in fact a group id in the
 * ratified backend contract, or approve building a Team Detail screen in
 * a follow-up task.
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
  | { tab: 'Groups'; screen: 'GroupDetail'; params: { groupId: string } }
  | {
      tab: 'Tournaments';
      screen: 'TournamentDetail';
      params: { tournamentId: string };
    };

/**
 * Resolves a notification type + entity id to a concrete navigation
 * target. Exhaustive over `NotificationType` (§4.8's "all 12 confirmed
 * types") — the `never` fallthrough in `default` makes an unhandled type
 * a compile error, not a silent no-op, satisfying the task brief's "no
 * unhandled types" rule at the type-checker level.
 */
export function resolveNotificationTarget(
  notificationType: NotificationType,
  entityId: string,
): NotificationTarget {
  switch (notificationType) {
    case 'global':
      return { tab: 'Home', screen: 'EventsList' };

    case 'event_invite':
    case 'event_changed':
    case 'event_cancelled':
    case 'waitlist_promoted':
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

    case 'tournament_match_scheduled':
    case 'tournament_result_posted':
    case 'tournament_cancelled':
    case 'tournament_schedule_published':
    case 'tournament_standings_published':
      return {
        tab: 'Tournaments',
        screen: 'TournamentDetail',
        params: { tournamentId: entityId },
      };

    // Deviation — see file header: routed to Group Detail per the task
    // brief's literal instruction; design §4.8 names a Team Detail screen
    // that does not exist in this codebase.
    case 'team_invite':
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
  } else if (target.tab === 'Groups') {
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
