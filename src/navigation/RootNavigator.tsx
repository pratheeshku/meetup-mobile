/**
 * Root navigation skeleton (DES-MEETUP-MOBILE.md §3.1, §4.2).
 *
 * A single root switch gates between the Auth Stack and the App Stack
 * based on `AuthContext`'s `user` state (§7 wiring) — session
 * restore-on-cold-start and `auth-expired` handling both live in
 * `AuthContext`, not here. Deep-link routing (§3.9) is designed but not
 * part of this pass — this component remains the intended extension
 * point.
 *
 * No App Stack screen carries feature logic beyond auth — every
 * non-auth screen is still a centred-text placeholder (scaffold pass).
 */
import React from 'react';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import { useAuth } from '../auth/AuthContext';
import type { AuthStackParamList } from './types';

import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import HomeScreen from '../screens/HomeScreen';
import GroupsScreen from '../screens/GroupsScreen';
import TournamentsScreen from '../screens/TournamentsScreen';
import ProfileScreen from '../screens/ProfileScreen';

const AuthStackNav = createNativeStackNavigator<AuthStackParamList>();
const AppTabsNav = createBottomTabNavigator();

function AuthStack(): React.JSX.Element {
  return (
    <AuthStackNav.Navigator>
      <AuthStackNav.Screen name="Login" component={LoginScreen} />
      <AuthStackNav.Screen name="Register" component={RegisterScreen} />
    </AuthStackNav.Navigator>
  );
}

function AppStack(): React.JSX.Element {
  return (
    <AppTabsNav.Navigator>
      <AppTabsNav.Screen name="Home" component={HomeScreen} />
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
