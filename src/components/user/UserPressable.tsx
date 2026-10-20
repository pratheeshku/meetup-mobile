/**
 * Wraps a person's avatar and/or name (DES-MEETUP-ADDENDUM-user-details-menu.md AD-4, UM-06).
 * A tap opens View Details; a long-press (350 ms, as the old group view) opens the menu. Call
 * sites use this and never build their own press handling for a person.
 *
 * - Default: tap = View Details, long-press = menu. Because this is the innermost pressable, a tap
 *   on the avatar does not trigger an enclosing row or card action; the rest of the row keeps its
 *   behaviour.
 * - `tap="none"`: long-press only. For selectable rows (invite and search lists) whose own
 *   control selects the person.
 * - `longPress={false}`: tap only. For the 22 px home-card avatars.
 */
import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';

import type { UserMenuApi } from '../../hooks/useUserMenu';
import { useT } from '../../labels/LabelsContext';
import type { UserIdentity } from '../../types/userMenu';

export const USER_LONG_PRESS_MS = 350;

interface UserPressableProps {
  person: UserIdentity;
  menu: UserMenuApi;
  children: React.ReactNode;
  tap?: 'details' | 'none';
  longPress?: boolean;
  style?: StyleProp<ViewStyle>;
  /** Replaces the default accessible name ("Options for {name}"). Label-system text. */
  accessibilityLabel?: string;
  testID?: string;
}

export default function UserPressable({
  person,
  menu,
  children,
  tap = 'details',
  longPress = true,
  style,
  accessibilityLabel,
  testID,
}: UserPressableProps): React.JSX.Element {
  const t = useT();
  return (
    <Pressable
      onPress={tap === 'details' ? () => menu.openDetails(person) : undefined}
      onLongPress={longPress ? () => menu.openMenu(person) : undefined}
      delayLongPress={USER_LONG_PRESS_MS}
      style={({ pressed }) => [styles.base, style, pressed ? styles.pressed : null]}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? t('mob.user_menu.menu_a11y', { name: person.displayName })}
      testID={testID ?? 'user-pressable'}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {},
  pressed: { opacity: 0.85 },
});
