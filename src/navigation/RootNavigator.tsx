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
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { NativeStackNavigationOptions } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import type { BottomTabNavigationOptions } from '@react-navigation/bottom-tabs';

import { useAuth } from '../auth/AuthContext';
import LoadingView from '../components/LoadingView';
import SessionCheckRetry from '../components/SessionCheckRetry';
import { navigationTheme } from '../theme/navigationTheme';
import { colors, typography } from '../theme/tokens';
import { dash } from '../theme/dashboardTheme';
import type {
  AuthStackParamList,
  AppTabParamList,
  GroupsStackParamList,
  HomeStackParamList,
  ProfileStackParamList,
  TournamentsStackParamList,
} from './types';
import { CreateTabButton, CreateTabScreen } from './CreateTabButton';
import { TabIcon, TabLabel } from './tabIcons';
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
import {
  getInitialPushActionNotification,
  registerPushActionCategories,
  registerPushActionForegroundHandler,
} from '../notifications/pushActions';

import { claimAuthHandoff } from './showCompletion';
import CompletionScreen from '../screens/CompletionScreen';
import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import VerifyScreen from '../screens/VerifyScreen';
import ForgotPasswordScreen from '../screens/ForgotPasswordScreen';
import HomeScreen from '../screens/HomeScreen';
import CreateGameScreen from '../screens/CreateGameScreen';
import TournamentWizardScreen from '../screens/TournamentWizardScreen';
import EventDetailScreen from '../screens/EventDetailScreen';
import GroupsScreen from '../screens/GroupsScreen';
import GroupDetailScreen from '../screens/GroupDetailScreen';
import CreateGroupScreen from '../screens/CreateGroupScreen';
import InviteMembersScreen from '../screens/InviteMembersScreen';
import TournamentTeamsScreen from '../screens/TournamentTeamsScreen';
import GamesScreen from '../screens/GamesScreen';
import TournamentDetailScreen from '../screens/TournamentDetailScreen';
import TournamentScoringScreen from '../screens/TournamentScoringScreen';
import ProfileScreen from '../screens/ProfileScreen';
import EditProfileScreen from '../screens/EditProfileScreen';
import EditSkillLevelsScreen from '../screens/EditSkillLevelsScreen';
import SettingsScreen from '../screens/SettingsScreen';
import NotificationPreferencesScreen from '../screens/NotificationPreferencesScreen';
import NotificationHistoryScreen from '../screens/NotificationHistoryScreen';
import EditGroupScreen from '../screens/EditGroupScreen';
import AccountDeletionBlockedScreen from '../screens/AccountDeletionBlockedScreen';
import TransferGroupOwnershipScreen from '../screens/TransferGroupOwnershipScreen';
import AccountDeletionCodeScreen from '../screens/AccountDeletionCodeScreen';
import AccessNoticeToast from '../components/AccessNoticeToast';
import NotificationBanner from '../components/NotificationBanner';
import OnboardingOverlay from './OnboardingOverlay';
import { useT } from '../labels/LabelsContext';
import ScreenContainer from '../components/ScreenContainer';
import { perfLog, isPerfCapturing } from '../diagnostics/perfLog';
import { recordNavChange } from '../hooks/usePerfScreen';

type AppRootParamList = {
  Tabs: undefined;
  Completion: undefined;
};

const AuthStackNav = createNativeStackNavigator<AuthStackParamList>();
const AppRootNav = createNativeStackNavigator<AppRootParamList>();
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
  const tabName = route.name === 'Create' ? undefined : route.name;
  return {
    tabBarIcon: tabName ? () => <TabIcon name={tabName} /> : undefined,
    tabBarLabel: tabName ? ({ focused }) => <TabLabel name={tabName} focused={focused} /> : undefined,
    headerStyle: { backgroundColor: colors.surface },
    headerTitleStyle: { color: colors.textPrimary, ...typography.h3 },
    tabBarActiveTintColor: dash.brand,
    tabBarInactiveTintColor: dash.navInactive,
    tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
  };
};

function AuthStack(): React.JSX.Element {
  // Claimed once per mount. Account deletion sets this before sign-out so
  // the summary is still here after the app stack is replaced.
  const [initialRouteName] = useState<'Login' | 'Completion'>(() =>
    claimAuthHandoff() ? 'Completion' : 'Login',
  );
  return (
    <AuthStackNav.Navigator initialRouteName={initialRouteName} screenOptions={stackScreenOptions}>
      <AuthStackNav.Screen name="Login" component={LoginScreen} />
      <AuthStackNav.Screen name="Register" component={RegisterScreen} />
      <AuthStackNav.Screen name="Verify" component={VerifyScreen} />
      <AuthStackNav.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
      <AuthStackNav.Screen
        name="Completion"
        component={CompletionScreen}
        options={{ headerShown: false, gestureEnabled: false, fullScreenGestureEnabled: false }}
      />
    </AuthStackNav.Navigator>
  );
}

function HomeStack(): React.JSX.Element {
  const t = useT();
  return (
    <HomeStackNav.Navigator screenOptions={stackScreenOptions}>
      {/*
        The dashboard draws its own banner (app icon, bell, profile picture;
        see DashboardBanner), which applies the top safe-area inset itself,
        so the stack header is hidden and the status bar is light over the
        brand-blue banner.
      */}
      <HomeStackNav.Screen
        name="EventsList"
        component={HomeScreen}
        options={{ headerShown: false, statusBarStyle: 'light' }}
      />
      <HomeStackNav.Screen
        name="EventDetail"
        component={EventDetailScreen}
        options={{ title: t('mob.nav.title_game') }}
      />
      <HomeStackNav.Screen
        name="CreateGame"
        component={CreateGameScreen}
        options={{ title: t('mob.nav.title_create_game') }}
      />
      <HomeStackNav.Screen
        name="TournamentWizard"
        component={TournamentWizardScreen}
        options={{ headerShown: false, statusBarStyle: 'light' }}
      />
      <HomeStackNav.Screen
        name="NotificationHistory"
        component={NotificationHistoryScreen}
        options={{ title: t('mob.nav.title_notifications') }}
      />
    </HomeStackNav.Navigator>
  );
}

function GroupsStack(): React.JSX.Element {
  const t = useT();
  return (
    <GroupsStackNav.Navigator screenOptions={stackScreenOptions}>
      <GroupsStackNav.Screen name="GroupsList" component={GroupsScreen} options={{ title: t('mob.nav.title_groups') }} />
      <GroupsStackNav.Screen
        name="GroupDetail"
        component={GroupDetailScreen}
        options={{ title: t('mob.nav.title_group'), headerShown: false, statusBarStyle: 'light' }}
      />
      <GroupsStackNav.Screen
        name="EditGroup"
        component={EditGroupScreen}
        options={{ title: t('mob.edit_group.title') }}
      />
      <GroupsStackNav.Screen
        name="InviteMembers"
        component={InviteMembersScreen}
        options={{ title: t('mob.nav.title_invite_members') }}
      />
      <GroupsStackNav.Screen
        name="CreateGroup"
        component={CreateGroupScreen}
        options={{ title: t('mob.nav.title_create_group') }}
      />
      <GroupsStackNav.Screen
        name="TournamentTeams"
        component={TournamentTeamsScreen}
        options={{ title: t('mob.menu.tournament_teams') }}
      />
    </GroupsStackNav.Navigator>
  );
}

function TournamentsStack(): React.JSX.Element {
  const t = useT();
  return (
    <TournamentsStackNav.Navigator screenOptions={stackScreenOptions}>
      <TournamentsStackNav.Screen
        name="TournamentsList"
        component={GamesScreen}
        options={{ title: t('mob.nav.title_games') }}
      />
      <TournamentsStackNav.Screen
        name="TournamentDetail"
        component={TournamentDetailScreen}
        options={{ title: t('mob.nav.title_tournament') }}
      />
      <TournamentsStackNav.Screen
        name="TournamentScoring"
        component={TournamentScoringScreen}
        options={{ title: t('mob.scoring.title_groups') }}
      />
    </TournamentsStackNav.Navigator>
  );
}

function ProfileStack(): React.JSX.Element {
  const t = useT();
  return (
    <ProfileStackNav.Navigator screenOptions={stackScreenOptions}>
      <ProfileStackNav.Screen
        name="ProfileHome"
        component={ProfileScreen}
        options={{ headerShown: false }}
      />
      <ProfileStackNav.Screen
        name="EditProfile"
        component={EditProfileScreen}
        options={{ headerShown: false }}
      />
      <ProfileStackNav.Screen
        name="EditSkillLevels"
        component={EditSkillLevelsScreen}
        options={{ headerShown: false }}
      />
      <ProfileStackNav.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ headerShown: false }}
      />
      <ProfileStackNav.Screen
        name="NotificationPreferences"
        component={NotificationPreferencesScreen}
        options={{ title: t('mob.nav.title_notification_prefs') }}
      />
      <ProfileStackNav.Screen
        name="AccountDeletionBlocked"
        component={AccountDeletionBlockedScreen}
        options={{ title: t('mob.account_delete.title') }}
      />
      <ProfileStackNav.Screen
        name="TransferGroupOwnership"
        component={TransferGroupOwnershipScreen}
        options={{ title: t('mob.group_transfer.title') }}
      />
      <ProfileStackNav.Screen
        name="AccountDeletionCode"
        component={AccountDeletionCodeScreen}
        options={{ title: t('mob.account_delete.confirm_title') }}
      />
    </ProfileStackNav.Navigator>
  );
}

export const homeTabListeners = ({
  navigation,
}: {
  navigation: { navigate: (route: string, params?: unknown) => void };
}) => ({
  tabPress: () => {
    navigation.navigate('Home', { screen: 'EventsList' });
  },
});

function AppStack(): React.JSX.Element {
  return (
    <AppTabsNav.Navigator screenOptions={tabScreenOptions}>
      <AppTabsNav.Screen
        name="Home"
        component={HomeStack}
        options={{ headerShown: false }}
        listeners={homeTabListeners}
      />
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
      <AppTabsNav.Screen
        name="Profile"
        component={ProfileStack}
        options={{ headerShown: false }}
      />
    </AppTabsNav.Navigator>
  );
}

function AppRoot(): React.JSX.Element {
  return (
    <AppRootNav.Navigator screenOptions={{ headerShown: false }}>
      <AppRootNav.Screen name="Tabs" component={AppStack} />
      <AppRootNav.Screen
        name="Completion"
        component={CompletionScreen}
        options={{ headerShown: false, gestureEnabled: false, fullScreenGestureEnabled: false }}
      />
    </AppRootNav.Navigator>
  );
}

export default function RootNavigator(): React.JSX.Element {
  const { user, isLoading, sessionCheckPendingRetry, sessionCheckFailure, retrySessionCheck } =
    useAuth();

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
      (await getInitialEventNotification()) ??
      (await getInitialPushActionNotification());
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

    // Invite / group-added action presses while the app is active, and a
    // second iOS category registration once labels are loaded (index.js
    // registers at launch, possibly before the label cache is read).
    const unsubscribePushActionEvents = registerPushActionForegroundHandler();
    registerPushActionCategories().catch(() => {});

    return () => {
      unsubscribeMessage();
      unsubscribeOpenedApp();
      unsubscribeParticipantEvents();
      unsubscribeEventEvents();
      unsubscribePushActionEvents();
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

  // `isLoading` covers the automatic restore attempts. `sessionCheckPendingRetry`
  // is the splash retry state after those attempts fail transiently: the
  // session is still held, so this must not fall through to the Auth Stack.
  if (isLoading) {
    return (
      <ScreenContainer edges="both">
        <LoadingView showLogo />
      </ScreenContainer>
    );
  }

  if (sessionCheckPendingRetry) {
    return <SessionCheckRetry failure={sessionCheckFailure} onRetry={retrySessionCheck} />;
  }

  return (
    <View style={styles.root}>
      <NavigationContainer
        ref={navigationRef}
        theme={navigationTheme}
        navigationInChildEnabled
        onReady={() => {
          perfLog('boot_nav_ready');
          handleInitialNotification();
        }}
        onStateChange={state => {
          if (!isPerfCapturing() || !state) {
            return;
          }
          // Find the active route name from navigation state tree.
          const getActiveRouteName = (navState: typeof state): string => {
            if (!navState) {
              return 'unknown';
            }
            const route = navState.routes[navState.index ?? 0];
            if (route?.state) {
              return getActiveRouteName(route.state as typeof state);
            }
            return route?.name ?? 'unknown';
          };
          const routeName = getActiveRouteName(state);
          recordNavChange(routeName);
        }}
      >
        {user ? <AppRoot /> : <AuthStack />}
      </NavigationContainer>
      {user ? <OnboardingOverlay userId={user.id} /> : null}
      <NotificationBanner />
      <AccessNoticeToast />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
});
