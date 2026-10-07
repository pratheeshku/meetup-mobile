import type { NavigatorScreenParams } from '@react-navigation/native';

import type { GamesScope } from '../utils/gameLists';

export type { GamesScope };

/** Auth Stack route params (§4.2 — Sign In, Register, Verify, Forgot Password). */
export type AuthStackParamList = {
  Login: { successMessage?: string; email?: string } | undefined;
  Register: undefined;
  Verify: { email: string; explanation?: string };
  ForgotPassword: { email?: string } | undefined;
};

/**
 * Home tab's nested stack route params (§4.3 — Events feed, Event Detail,
 * Create Game, Notification History — the bell's destination).
 *
 * `CreateGame` (Create Flow Amendment, §4.3, architect-approved
 * 2026-09-22): a single merged screen with a Casual Game/Tournament
 * toggle — replaces the former placeholder and, for the Tournament side,
 * `CreateTournamentScreen`/`TournamentsStackParamList.CreateTournament`
 * (retired). `EventsList`'s `refreshKey` works as on Groups/Tournaments:
 * set by a successful Casual Game create (via `popTo`) so the list
 * re-fetches.
 *
 * (The former `EventsList.filter: 'mine'` view was replaced by the Games
 * screen's "Mine" scope — DES-MEETUP-ADDENDUM-dashboard.md AD-15.)
 */
export type HomeStackParamList = {
  EventsList: { refreshKey?: number; successMessage?: string } | undefined;
  EventDetail: { eventId: string };
  CreateGame: undefined;
  NotificationHistory: undefined;
};

/**
 * Groups tab's nested stack route params (§4.4 — Groups list, Group Detail,
 * Create Group). `refreshKey` is set by Create Group on success (via
 * `popTo`) so the list re-fetches; any new value triggers one refresh.
 */
export type GroupsStackParamList = {
  GroupsList: { refreshKey?: number } | undefined;
  GroupDetail: { groupId: string };
  CreateGroup: undefined;
  /** Group creation step 2 (DES-MEETUP-FEEDBACK-001 C4). */
  InviteMembers: { groupId: string };
  TournamentTeams: undefined;
};

/**
 * Games tab's nested stack route params (§4.5 — Tournaments list,
 * Tournament Detail; DES-MEETUP-ADDENDUM-dashboard.md AD-15). The tab's
 * route name stays `Tournaments` (notification deep links and the create
 * flow navigate to it) but it is labelled "Games" and its first screen,
 * `TournamentsList`, is the Games screen: a "Games | Tournaments" switch.
 *
 * `scope` + `entryKey`: Home's View all / tile entry points open the Games
 * segment with that scope; `entryKey` makes a repeat entry with the same
 * scope still register as a new navigation. `refreshKey` works as on
 * Groups: it selects the Tournaments segment and refetches it.
 *
 * `CreateTournament` removed (Create Flow Amendment, §4.3/§4.5,
 * architect-approved 2026-09-22): tournament creation moved into the
 * Home tab's merged `CreateGame` screen (Tournament toggle). A
 * successful Tournament create still lands here via `refreshKey`
 * (navigated cross-tab, since creation no longer happens inside this
 * stack).
 */
export type TournamentsStackParamList = {
  TournamentsList: { refreshKey?: number; scope?: GamesScope; entryKey?: number; segment?: 'games' | 'tournaments' } | undefined;
  TournamentDetail: { tournamentId: string };
};

/**
 * Profile tab's nested stack route params (§4.8 — Profile,
 * Notification Preferences). Added by the push-notifications task: Profile
 * was previously a flat tab screen with no nested stack of its own (see
 * `RootNavigator`'s file header for the "why" of this change) — mirrors
 * the `HomeStack`/`GroupsStack`/`TournamentsStack` pattern above so
 * Notification Preferences can be pushed from Profile with correct back
 * navigation.
 */
export type ProfileStackParamList = {
  ProfileHome: undefined;
  NotificationPreferences: undefined;
};

/**
 * Top-level authenticated tab param list (§3.1, §4.8). Each tab wraps a
 * nested stack, so its own param list is threaded through via
 * `NavigatorScreenParams` — this is what makes it possible to
 * type-safely navigate to a screen nested two levels deep (tab -> stack
 * -> screen) from a single root ref, which is exactly what routing a
 * notification tap to e.g. Tournaments -> TournamentDetail requires
 * (§3.6, §4.8, R-073).
 *
 * `Create` is not a destination: it is the raised center action button
 * (`CreateTabButton`). Pressing it opens the Create menu (Game / Group /
 * Tournament) and never selects this route, so it never becomes the
 * focused tab.
 */
export type AppTabParamList = {
  Home: NavigatorScreenParams<HomeStackParamList>;
  Groups: NavigatorScreenParams<GroupsStackParamList>;
  Create: undefined;
  Tournaments: NavigatorScreenParams<TournamentsStackParamList>;
  Profile: NavigatorScreenParams<ProfileStackParamList>;
};
