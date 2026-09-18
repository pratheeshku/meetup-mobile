/**
 * React Navigation theme built from the design tokens.
 *
 * Screen backgrounds, the header and the tab bar all read from the
 * navigation theme, so passing this to `NavigationContainer` is what makes
 * every screen sit on `colors.background` rather than React Navigation's
 * default grey. The app is deliberately light-only (matches the web
 * palette), so this is a fixed light theme, not one derived from the
 * system colour scheme.
 */
import { DefaultTheme } from '@react-navigation/native';
import type { Theme } from '@react-navigation/native';

import { colors } from './tokens';

export const navigationTheme: Theme = {
  ...DefaultTheme,
  dark: false,
  colors: {
    ...DefaultTheme.colors,
    primary: colors.primary,
    background: colors.background,
    card: colors.surface,
    text: colors.textPrimary,
    border: colors.border,
    notification: colors.error,
  },
};
