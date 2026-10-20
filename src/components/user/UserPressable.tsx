/**
 * Wraps a person's avatar and/or name and attaches the user details menu behaviour
 * (DES-MEETUP-ADDENDUM-user-details-menu UM-01, UM-06). Every call site uses this; none builds its
 * own press handling.
 *
 * - Tap: opens View Details from the row identity (no card request). The tap stops here, so a
 *   surrounding row or card does not also fire.
 * - Long-press (350 ms): opens the menu (View Details first, then the server's actions).
 * - `tap={false}`: selectable rows (invite and search lists) keep tap-to-select on the row and use
 *   the long-press only. `longPress={false}`: the 22 px home-card avatars are tap only.
 */
import React from 'react';
import { Pressable } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';

import {
  useUserMenu,
  type UserMenuContext,
  type UserMenuPerson,
} from '../../hooks/useUserMenu';
import { useT } from '../../labels/LabelsContext';

export const USER_LONG_PRESS_DELAY_MS = 350;

interface UserPressableProps {
  userId?: string | null;
  displayName: string;
  nickname?: string | null;
  photoUrl?: string | null;
  /** A person with no linked account: placeholder picture, View Details from this row only. */
  noUser?: boolean;
  context: UserMenuContext;
  /** The host screen's refetch, called after an action or a 404 from the card. */
  onChanged?: () => void;
  tap?: boolean;
  longPress?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  testID?: string;
  children: React.ReactNode;
}

export default function UserPressable({
  userId = null,
  displayName,
  nickname,
  photoUrl = null,
  noUser = false,
  context,
  onChanged,
  tap = true,
  longPress = true,
  style,
  accessibilityLabel,
  testID,
  children,
}: UserPressableProps): React.JSX.Element {
  const t = useT();
  const menu = useUserMenu(context, onChanged);
  const person: UserMenuPerson = { userId, displayName, nickname, photoUrl, noUser };
  return (
    <Pressable
      style={style}
      onPress={tap ? () => menu.openDetails(person) : undefined}
      onLongPress={longPress ? () => menu.openMenu(person) : undefined}
      delayLongPress={USER_LONG_PRESS_DELAY_MS}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? displayName}
      accessibilityHint={longPress ? t('mob.user_menu.menu_a11y', { name: displayName }) : undefined}
      testID={testID}
    >
      {children}
    </Pressable>
  );
}
