/**
 * Root navigation skeleton (DES-MEETUP-MOBILE.md §3.1).
 *
 * A single root switch gates between the Auth Stack and the App Stack
 * based on whether a token is present in secure storage. Deep-link routing
 * (§3.9) and session silent-refresh-on-cold-start (R-016, §4.2) are
 * designed but not part of this scaffold pass — this component is the
 * intended extension point for both, tracked as a follow-up.
 *
 * No screen here carries feature logic — every screen is a centred-text
 * placeholder (Step 8 of the scaffold brief).
 */
import React, { useEffect, useState, useCallback } from 'react';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import { getAccessToken } from '../storage/tokens';
import { authEvents } from '../api/authEvents';

import LoginScreen from '../screens/LoginScreen';
import HomeScreen from '../screens/HomeScreen';
import GroupsScreen from '../screens/GroupsScreen';
import TournamentsScreen from '../screens/TournamentsScreen';
import ProfileScreen from '../screens/ProfileScreen';

const AuthStackNav = createNativeStackNavigator();
const AppTabsNav = createBottomTabNavigator();

function AuthStack(): React.JSX.Element {
  return (
    <AuthStackNav.Navigator>
      <AuthStackNav.Screen name="Login" component={LoginScreen} />
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
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const checkToken = useCallback(async () => {
    const token = await getAccessToken();
    setIsAuthenticated(token != null);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    checkToken();

    const unsubscribe = authEvents.on('auth-expired', () => {
      setIsAuthenticated(false);
    });
    return unsubscribe;
  }, [checkToken]);

  if (isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      {isAuthenticated ? <AppStack /> : <AuthStack />}
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
