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
 * The Home tab wraps a nested native-stack (`HomeStack`) rather than
 * rendering `HomeScreen` directly, so the events feed can push
 * `EventDetailScreen` with correct back navigation while the bottom tab
 * bar stays available on the feed itself. `headerShown: false` on the
 * tab screen avoids a duplicate header (the tab navigator's own plus the
 * nested stack's).
 *
 * No other App Stack screen carries feature logic yet — Groups,
 * Tournaments, and Profile remain centred-text placeholders (scaffold
 * pass).
 */
import React from 'react';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import { useAuth } from '../auth/AuthContext';
import type { AuthStackParamList, HomeStackParamList } from './types';

import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import HomeScreen from '../screens/HomeScreen';
import EventDetailScreen from '../screens/EventDetailScreen';
import GroupsScreen from '../screens/GroupsScreen';
import TournamentsScreen from '../screens/TournamentsScreen';
import ProfileScreen from '../screens/ProfileScreen';

const AuthStackNav = createNativeStackNavigator<AuthStackParamList>();
const HomeStackNav = createNativeStackNavigator<HomeStackParamList>();
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

function AppStack(): React.JSX.Element {
  return (
    <AppTabsNav.Navigator>
      <AppTabsNav.Screen name="Home" component={HomeStack} options={{ headerShown: false }} />
      <AppTabsNav.Screen name="Groups" component={GroupsScreen} />
      <AppTabsNav.Screen name="Tournaments" component={TournamentsScreen} />
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
