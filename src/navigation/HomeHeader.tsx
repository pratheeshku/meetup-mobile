/**
 * Custom native-stack header for the Home dashboard: the branded
 * `AppHeader`, with its bell wired to Notification Preferences (Profile
 * tab) — the closest existing destination, since no notifications-list
 * screen exists yet.
 *
 * No `unreadCount` is passed: there is no unread-count API/state in this
 * codebase, and a fabricated number is worse than a hidden badge. Wire real
 * data here when it exists.
 *
 * A module-level component (not an inline arrow in the navigator's
 * `options`) so React sees a stable component type across renders.
 */
import React from 'react';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackHeaderProps } from '@react-navigation/native-stack';

import AppHeader from '../components/AppHeader';
import type { AppTabParamList } from './types';

export default function HomeHeader({ navigation }: NativeStackHeaderProps): React.JSX.Element {
  return (
    <AppHeader
      onNotificationsPress={() =>
        navigation
          .getParent<BottomTabNavigationProp<AppTabParamList>>()
          ?.navigate('Profile', { screen: 'NotificationPreferences' })
      }
    />
  );
}
