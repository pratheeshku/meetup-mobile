import type { NavigatorScreenParams } from '@react-navigation/native';

/** Auth Stack route params (§4.2 — Sign In, Register). */
export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
};

/**
 * Home tab's nested stack route params (§4.3 — Events feed, Event Detail,
 * Create Game). `CreateGame` is a placeholder until real event creation
 * (§4.3 "Create/Edit Event") is built.
 */
export type HomeStackParamList = {
  EventsList: undefined;
  EventDetail: { eventId: string };
  CreateGame: undefined;
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
};

/**
 * Tournaments tab's nested stack route params (§4.5 — Tournaments list,
 * Tournament Detail, Create Tournament). `refreshKey` works as on Groups.
 */
export type TournamentsStackParamList = {
  TournamentsList: { refreshKey?: number } | undefined;
  TournamentDetail: { tournamentId: string };
  CreateTournament: undefined;
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
