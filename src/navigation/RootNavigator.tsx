/**
 * Root navigation skeleton (DES-MEETUP-MOBILE.md §3.1, §4.2, §4.3).
 *
 * A single root switch gates between the Auth Stack and the App Stack
 * based on `AuthContext`'s `user` state (§7 wiring) — session
 * restore-on-cold-start and `auth-expired` handling both live in
 * `AuthContext`, not here. Deep-link routing (§3.9) is designed but not
 * part of this pass — this component remains the intended extension
 * point.
 *
 * The Home, Groups, and Tournaments tabs each wrap a nested native-stack
 * (`HomeStack`, `GroupsStack`, `TournamentsStack`) rather than rendering
 * their list screen directly, so each can push a detail screen with
 * correct back navigation while the bottom tab bar stays available on
 * the list itself. `headerShown: false` on those tab screens avoids a
 * duplicate header (the tab navigator's own plus the nested stack's).
 *
 * Profile remains a full screen, not nested in a stack — see its own
 * module.
 */
import React from 'react';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import { useAuth } from '../auth/AuthContext';
import type {
  AuthStackParamList,
  GroupsStackParamList,
  HomeStackParamList,
  TournamentsStackParamList,
} from './types';

import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import HomeScreen from '../screens/HomeScreen';
import EventDetailScreen from '../screens/EventDetailScreen';
import GroupsScreen from '../screens/GroupsScreen';
import GroupDetailScreen from '../screens/GroupDetailScreen';
import TournamentsScreen from '../screens/TournamentsScreen';
import TournamentDetailScreen from '../screens/TournamentDetailScreen';
import ProfileScreen from '../screens/ProfileScreen';

const AuthStackNav = createNativeStackNavigator<AuthStackParamList>();
const HomeStackNav = createNativeStackNavigator<HomeStackParamList>();
const GroupsStackNav = createNativeStackNavigator<GroupsStackParamList>();
const TournamentsStackNav = createNativeStackNavigator<TournamentsStackParamList>();
const AppTabsNav = createBottomTabNavigator();

function AuthStack(): React.JSX.Element {
  return (
    <AuthStackNav.Navigator>
      <AuthStackNav.Screen name="Login" component={LoginScreen} />
      <AuthStackNav.Screen name="Register" component={RegisterScreen} />
    </AuthStackNav.Navigator>
  );
}

function HomeStack(): React.JSX.Element {
  return (
    <HomeStackNav.Navigator>
      <HomeStackNav.Screen name="EventsList" component={HomeScreen} options={{ title: 'Events' }} />
      <HomeStackNav.Screen
        name="EventDetail"
        component={EventDetailScreen}
        options={{ title: 'Event' }}
      />
    </HomeStackNav.Navigator>
  );
}

function GroupsStack(): React.JSX.Element {
  return (
    <GroupsStackNav.Navigator>
      <GroupsStackNav.Screen name="GroupsList" component={GroupsScreen} options={{ title: 'Groups' }} />
      <GroupsStackNav.Screen
        name="GroupDetail"
        component={GroupDetailScreen}
        options={{ title: 'Group' }}
      />
    </GroupsStackNav.Navigator>
  );
}

function TournamentsStack(): React.JSX.Element {
  return (
    <TournamentsStackNav.Navigator>
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

function AppStack(): React.JSX.Element {
  return (
    <AppTabsNav.Navigator>
      <AppTabsNav.Screen name="Home" component={HomeStack} options={{ headerShown: false }} />
      <AppTabsNav.Screen name="Groups" component={GroupsStack} options={{ headerShown: false }} />
      <AppTabsNav.Screen
        name="Tournaments"
        component={TournamentsStack}
        options={{ headerShown: false }}
      />
      <AppTabsNav.Screen name="Profile" component={ProfileScreen} />
    </AppTabsNav.Navigator>
  );
}

export default function RootNavigator(): React.JSX.Element {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return <NavigationContainer>{user ? <AppStack /> : <AuthStack />}</NavigationContainer>;
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
