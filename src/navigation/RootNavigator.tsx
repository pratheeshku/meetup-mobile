/**
 * Root navigation skeleton (DES-MEETUP-MOBILE.md §3.1, §3.6, §4.2, §4.3, §4.8).
 *
 * A single root switch gates between the Auth Stack and the App Stack
 * based on `AuthContext`'s `user` state (§7 wiring) — session
 * restore-on-cold-start and `auth-expired` handling both live in
 * `AuthContext`, not here. Full URL-scheme/App-Links deep linking (§3.9)
 * is designed but still not part of this pass — this component remains
 * the intended extension point. Notification-tap routing (§3.6, §4.8,
 * R-073) *is* wired here now (push-notifications task) — see the
 * dedicated effect block below.
 *
 * The Home, Groups, Tournaments, and (as of this task) Profile tabs each
 * wrap a nested native-stack rather than rendering their top screen
 * directly, so each can push a detail screen with correct back
 * navigation while the bottom tab bar stays available on the list/home
 * screen itself. `headerShown: false` on those tab screens avoids a
 * duplicate header (the tab navigator's own plus the nested stack's).
 *
 * Profile stack change (push-notifications task, §4.8): Profile was
 * previously a flat tab screen with no nested stack. The task's Step 8
 * ("Add NotificationPreferencesScreen to AppStack") needs Profile to be
 * able to push a new screen with back navigation, so it now wraps its own
 * `ProfileStack` (`ProfileHome` + `NotificationPreferences`) — the
 * smallest change that makes the new screen reachable while keeping every
 * other tab's existing pattern untouched.
 *
 * Notification-tap routing (§3.6, §4.8, R-073): a single `navigationRef`
 * (`notificationRouting.ts`) is attached to `NavigationContainer` so code
 * outside the React tree (FCM listeners) can navigate. Three FCM entry
 * points are wired, one per app state at tap time:
 * - Foreground: handled by `NotificationBanner` itself (it calls
 *   `resolveNotificationTarget`/`navigateToNotificationTarget` directly on
 *   tap) — no listener needed here for that case.
 * - Background (app alive, not foregrounded): `onNotificationOpenedApp`.
 * - Quit state (app launched by the tap): `getInitialNotification`, a
 *   one-shot check run once navigation is ready and a session exists.
 * - `event_participant_added`/`_removed` are the exception: they arrive
 *   data-only and are built locally by notify-kit (`participantHandler.ts`),
 *   so FCM never sees their taps. Their View button / body tap is routed by
 *   `registerParticipantForegroundHandler` (app active), the top-level
 *   background handler in `index.js` (app backgrounded), and
 *   `getInitialParticipantNotification` (quit state, folded into the same
 *   one-shot check above).
 * - `group_event_created`/`event_changed` (mobile notify-kit task Part 3)
 *   are the same kind of exception — Join-only / View+OK
 *   (`eventNotificationHandler.ts`) — wired the same way via
 *   `registerEventForegroundHandler` and `getInitialEventNotification`.
 *
 * Deviation (recorded for the Implementation Report, needs architect
 * ratification): the task brief's Step 4 says to implement background/
 * quit-tap routing by editing native Android Java (`MainApplication.java`
 * "or equivalent"). This uses the official `@react-native-firebase/messaging`
 * JS SDK's `onNotificationOpenedApp`/`getInitialNotification` APIs
 * instead of touching native code — the "or equivalent" wording gives
 * latitude, and DES-MEETUP-MOBILE.md §3.6 explicitly names "a custom
 * native module instead of the official Firebase RN SDK" as a **rejected
 * alternative**. Writing routing logic into `MainApplication.java` would
 * be exactly that rejected alternative, so the JS SDK path was followed
 * as the design-compliant reading of "or equivalent". No native Android
 * file was modified by this task.
 */
import React, { useCallback, useEffect, useRef } from 'react';
import { View, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { NativeStackNavigationOptions } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import type { BottomTabNavigationOptions } from '@react-navigation/bottom-tabs';

import { useAuth } from '../auth/AuthContext';
import LoadingView from '../components/LoadingView';
import { navigationTheme } from '../theme/navigationTheme';
import { colors, typography } from '../theme/tokens';
import type {
  AuthStackParamList,
  AppTabParamList,
  GroupsStackParamList,
  HomeStackParamList,
  ProfileStackParamList,
  TournamentsStackParamList,
} from './types';
import HomeHeader from './HomeHeader';
import { CreateTabButton, CreateTabScreen } from './CreateTabButton';
import { TAB_EMOJI, TabEmoji } from './tabIcons';
import {
  navigationRef,
  navigateToNotificationTarget,
  resolveNotificationTarget,
} from '../notifications/notificationRouting';
import {
  getInitialNotification,
  onMessage,
  onNotificationOpenedApp,
} from '../notifications/fcm';
import {
  getInitialParticipantNotification,
  registerParticipantForegroundHandler,
} from '../notifications/participantHandler';
import {
  getInitialEventNotification,
  registerEventForegroundHandler,
} from '../notifications/eventNotificationHandler';

import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import HomeScreen from '../screens/HomeScreen';
import CreateGameScreen from '../screens/CreateGameScreen';
import EventDetailScreen from '../screens/EventDetailScreen';
import GroupsScreen from '../screens/GroupsScreen';
import GroupDetailScreen from '../screens/GroupDetailScreen';
import CreateGroupScreen from '../screens/CreateGroupScreen';
import TournamentsScreen from '../screens/TournamentsScreen';
import TournamentDetailScreen from '../screens/TournamentDetailScreen';
import ProfileScreen from '../screens/ProfileScreen';
import NotificationPreferencesScreen from '../screens/NotificationPreferencesScreen';
import NotificationHistoryScreen from '../screens/NotificationHistoryScreen';
import NotificationBanner from '../components/NotificationBanner';

const AuthStackNav = createNativeStackNavigator<AuthStackParamList>();
const HomeStackNav = createNativeStackNavigator<HomeStackParamList>();
const GroupsStackNav = createNativeStackNavigator<GroupsStackParamList>();
const TournamentsStackNav = createNativeStackNavigator<TournamentsStackParamList>();
const ProfileStackNav = createNativeStackNavigator<ProfileStackParamList>();
const AppTabsNav = createBottomTabNavigator<AppTabParamList>();

/**
 * Design-system navigation styling (visual layer only). The container-level
 * `navigationTheme` supplies screen background/card/border colours; these
 * options add the header and tab-bar specifics. `statusBarStyle: 'dark'` is
 * explicit because the header is now a light surface — dark icons keep the
 * status bar legible regardless of the system colour scheme.
 */
const stackScreenOptions: NativeStackNavigationOptions = {
  headerStyle: { backgroundColor: colors.surface },
  headerTitleStyle: { color: colors.textPrimary, ...typography.h3 },
  headerTintColor: colors.primary,
  statusBarStyle: 'dark',
  contentStyle: { backgroundColor: colors.background },
};

const tabScreenOptions = ({
  route,
}: {
  route: { name: keyof AppTabParamList };
}): BottomTabNavigationOptions => {
  // `Create` is the raised action button, which draws its own glyph.
  const emoji = route.name === 'Create' ? undefined : TAB_EMOJI[route.name];
  return {
    tabBarIcon: emoji
      ? ({ focused, size }) => <TabEmoji emoji={emoji} focused={focused} size={size} />
      : undefined,
    headerStyle: { backgroundColor: colors.surface },
    headerTitleStyle: { color: colors.textPrimary, ...typography.h3 },
    tabBarActiveTintColor: colors.primary,
    tabBarInactiveTintColor: colors.textMuted,
    tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
  };
};

function AuthStack(): React.JSX.Element {
  return (
    <AuthStackNav.Navigator screenOptions={stackScreenOptions}>
      <AuthStackNav.Screen name="Login" component={LoginScreen} />
      <AuthStackNav.Screen name="Register" component={RegisterScreen} />
    </AuthStackNav.Navigator>
  );
}

function HomeStack(): React.JSX.Element {
  return (
    <HomeStackNav.Navigator screenOptions={stackScreenOptions}>
      {/*
        The dashboard uses the branded AppHeader (logo + notification bell,
        see HomeHeader) instead of the default title header. Only Home uses
        it for now; the other tabs keep their titled headers.
      */}
      <HomeStackNav.Screen
        name="EventsList"
        component={HomeScreen}
        options={{ header: HomeHeader }}
      />
      <HomeStackNav.Screen
        name="EventDetail"
        component={EventDetailScreen}
        options={{ title: 'Event' }}
      />
      <HomeStackNav.Screen
        name="CreateGame"
        component={CreateGameScreen}
        options={{ title: 'Create Game' }}
      />
      <HomeStackNav.Screen
        name="NotificationHistory"
        component={NotificationHistoryScreen}
        options={{ title: 'Notifications' }}
      />
    </HomeStackNav.Navigator>
  );
}

function GroupsStack(): React.JSX.Element {
  return (
    <GroupsStackNav.Navigator screenOptions={stackScreenOptions}>
      <GroupsStackNav.Screen name="GroupsList" component={GroupsScreen} options={{ title: 'Groups' }} />
      <GroupsStackNav.Screen
        name="GroupDetail"
        component={GroupDetailScreen}
        options={{ title: 'Group' }}
      />
      <GroupsStackNav.Screen
        name="CreateGroup"
        component={CreateGroupScreen}
        options={{ title: 'Create Group' }}
      />
    </GroupsStackNav.Navigator>
  );
}

function TournamentsStack(): React.JSX.Element {
  return (
    <TournamentsStackNav.Navigator screenOptions={stackScreenOptions}>
      <TournamentsStackNav.Screen
        name="TournamentsList"
        component={TournamentsScreen}
        options={{ title: 'Tournaments' }}
      />
      <TournamentsStackNav.Screen
        name="TournamentDetail"
        component={TournamentDetailScreen}
        options={{ title: 'Tournament' }}
      />
    </TournamentsStackNav.Navigator>
  );
}

function ProfileStack(): React.JSX.Element {
  return (
    <ProfileStackNav.Navigator screenOptions={stackScreenOptions}>
      <ProfileStackNav.Screen name="ProfileHome" component={ProfileScreen} options={{ title: 'Profile' }} />
      <ProfileStackNav.Screen
        name="NotificationPreferences"
        component={NotificationPreferencesScreen}
        options={{ title: 'Notification Preferences' }}
      />
    </ProfileStackNav.Navigator>
  );
}

function AppStack(): React.JSX.Element {
  return (
    <AppTabsNav.Navigator screenOptions={tabScreenOptions}>
      <AppTabsNav.Screen name="Home" component={HomeStack} options={{ headerShown: false }} />
      <AppTabsNav.Screen name="Groups" component={GroupsStack} options={{ headerShown: false }} />
      {/*
        Center action button, not a destination: it opens the Create menu
        (Game / Group / Tournament) and never selects this route.
      */}
      <AppTabsNav.Screen
        name="Create"
        component={CreateTabScreen}
        options={{ tabBarButton: CreateTabButton }}
      />
      <AppTabsNav.Screen
        name="Tournaments"
        component={TournamentsStack}
        options={{ headerShown: false }}
      />
      <AppTabsNav.Screen name="Profile" component={ProfileStack} options={{ headerShown: false }} />
    </AppTabsNav.Navigator>
  );
}

export default function RootNavigator(): React.JSX.Element {
  const { user, isLoading } = useAuth();

  // A one-shot guard: `getInitialNotification` is only meaningful the
  // very first time this app instance checks it (the tap that launched
  // the quit-state app), so it must never re-run on later renders/re
  // -sign-ins. Set synchronously before the async call starts to avoid a
  // race between the `onReady` and `user`-change triggers below.
  const hasCheckedInitialNotification = useRef(false);

  // `isLoading` above already gates mount until auth state is resolved,
  // so by the time this reads `user` it is the settled value, not a
  // stale one — a plain ref (updated every render, no effect needed) is
  // enough to give the stable `handleInitialNotification` callback a
  // fresh read of it.
  const userRef = useRef(user);
  userRef.current = user;

  const handleInitialNotification = useCallback(async () => {
    if (hasCheckedInitialNotification.current) {
      return;
    }
    hasCheckedInitialNotification.current = true;

    // FCM covers taps on OS-displayed notifications; participant and event
    // notifications (group_event_created/event_changed) are built locally
    // by notify-kit (data-only FCM), so a quit-state launch from one of
    // them is only visible to notify-kit.
    const payload =
      (await getInitialNotification()) ??
      (await getInitialParticipantNotification()) ??
      (await getInitialEventNotification());
    // Known limitation (consistent with §3.9's own "unauthenticated deep
    // links" note, which this codebase hasn't built the
    // `pendingDestination` mechanism for either): a quit-state tap that
    // lands on the Auth Stack (no restored session) is dropped rather
    // than queued — `navigationRef` only ever targets `AppTabParamList`
    // routes, which don't exist while `AuthStack` is mounted.
    if (payload && userRef.current && navigationRef.isReady()) {
      navigateToNotificationTarget(
        resolveNotificationTarget(payload.notification_type, payload.entity_id),
      );
    }
  }, []);

  // Foreground banner display and background-tap routing (§3.6, §4.8):
  // registered once, independent of auth state — harmless to set up
  // before a session exists, and required to be in place before any
  // message can arrive. (The FCM background handler is registered at top
  // level in `index.js`, not here.)
  useEffect(() => {
    const unsubscribeMessage = onMessage();
    const unsubscribeOpenedApp = onNotificationOpenedApp(payload => {
      navigateToNotificationTarget(
        resolveNotificationTarget(payload.notification_type, payload.entity_id),
      );
    });

    // Participant notification View/OK presses while the app is active
    // (background/quit presses are handled by the top-level handler in
    // `index.js`).
    const unsubscribeParticipantEvents = registerParticipantForegroundHandler();

    // group_event_created (Join/OK) / event_changed (View/OK) presses while
    // the app is active — same pattern as the participant listener above.
    const unsubscribeEventEvents = registerEventForegroundHandler();

    return () => {
      unsubscribeMessage();
      unsubscribeOpenedApp();
      unsubscribeParticipantEvents();
      unsubscribeEventEvents();
    };
  }, []);

  // Quit-state tap routing (§3.6, §4.8, Step 8 "initial route on
  // notification tap when app is in quit state"): re-checked whenever
  // `user` becomes available, since `NavigationContainer`'s `onReady`
  // alone only fires once and may fire before a restored session (and
  // therefore the App Stack / tab routes the target needs) exists.
  useEffect(() => {
    if (user) {
      handleInitialNotification();
    }
  }, [user, handleInitialNotification]);

  if (isLoading) {
    return <LoadingView />;
  }

  return (
    <View style={styles.root}>
      <NavigationContainer
        ref={navigationRef}
        theme={navigationTheme}
        onReady={handleInitialNotification}
      >
        {user ? <AppStack /> : <AuthStack />}
      </NavigationContainer>
      <NotificationBanner />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
});
