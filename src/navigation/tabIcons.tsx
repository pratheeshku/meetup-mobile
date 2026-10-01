/**
 * Bottom-bar tab icons and labels (DES-MEETUP-ADDENDUM-dashboard.md AD-5,
 * §4 "Bottom bar"): the colourful Appendix A SVG icons at 30px, labels 11px,
 * the active label in the brand colour and bold.
 *
 * The tab whose route is `Tournaments` is labelled "Games" and uses the
 * gamepad icon (its screen is the Games | Tournaments switch, AD-15); the
 * route name itself is unchanged because notification deep links and the
 * create flow navigate to it.
 *
 * Icons are decorative and hidden from screen readers; the label carries the
 * meaning.
 */
import React from 'react';
import { StyleSheet, Text } from 'react-native';

import { GamesIcon, GroupsIcon, HomeIcon, ProfileIcon } from '../components/icons/DashboardIcons';
import type { IconProps } from '../components/icons/DashboardIcons';
import { dash, dashSize } from '../theme/dashboardTheme';
import type { AppTabParamList } from './types';

/** `Create` is excluded: the center action button draws its own "+" glyph. */
export type IconTabName = Exclude<keyof AppTabParamList, 'Create'>;

export const TAB_ICONS: Record<IconTabName, (props: IconProps) => React.JSX.Element> = {
  Home: HomeIcon,
  Groups: GroupsIcon,
  Tournaments: GamesIcon,
  Profile: ProfileIcon,
};

/** Visible label per tab ("Tournaments" route is the "Games" tab). */
export const TAB_LABELS: Record<IconTabName, string> = {
  Home: 'Home',
  Groups: 'Groups',
  Tournaments: 'Games',
  Profile: 'Profile',
};

export function TabIcon({ name }: { name: IconTabName }): React.JSX.Element {
  const Icon = TAB_ICONS[name];
  return <Icon size={dashSize.navIcon} />;
}

export function TabLabel({
  name,
  focused,
}: {
  name: IconTabName;
  focused: boolean;
}): React.JSX.Element {
  return (
    <Text style={[styles.label, focused ? styles.labelActive : styles.labelIdle]}>
      {TAB_LABELS[name]}
    </Text>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: dashSize.navLabel },
  labelIdle: { color: dash.navInactive, fontWeight: '400' },
  labelActive: { color: dash.brand, fontWeight: '700' },
});
