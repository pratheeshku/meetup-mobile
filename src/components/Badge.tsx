/**
 * Small pill label for statuses and roles (RSVP status, group role, ...).
 *
 * Colour pairings are chosen for measured contrast, not just hue:
 * - `warning` uses `textPrimary` on `warningLight` — the warning-on-
 *   warningLight pairing is 2.47:1 (fails AA); this one is 15.4:1.
 * - `neutral` uses `textSecondary` on `background` (4.86:1) with a thin
 *   border so the pill stays visible on both white cards and the tinted
 *   page background.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';

import { borderWidth, colors, radius, spacing, typography } from '../theme/tokens';

export type BadgeVariant = 'primary' | 'success' | 'warning' | 'error' | 'neutral';

interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
  /** Layout only (margins, alignment). */
  style?: StyleProp<ViewStyle>;
}

interface BadgeColors {
  background: string;
  text: string;
  border: string;
}

const VARIANTS: Record<BadgeVariant, BadgeColors> = {
  primary: {
    background: colors.primaryLight,
    text: colors.primary,
    border: colors.primaryLight,
  },
  success: {
    background: colors.successLight,
    text: colors.success,
    border: colors.successLight,
  },
  warning: {
    background: colors.warningLight,
    text: colors.textPrimary,
    border: colors.warningLight,
  },
  error: {
    background: colors.errorLight,
    text: colors.error,
    border: colors.errorLight,
  },
  neutral: {
    background: colors.background,
    text: colors.textSecondary,
    border: colors.border,
  },
};

export default function Badge({
  label,
  variant = 'neutral',
  style,
}: BadgeProps): React.JSX.Element {
  const variantColors = VARIANTS[variant];

  return (
    <View
      style={[
        styles.pill,
        { backgroundColor: variantColors.background, borderColor: variantColors.border },
        style,
      ]}
    >
      <Text style={[typography.label, { color: variantColors.text }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  // No `alignSelf`: it would override a row parent's `alignItems`. Callers
  // control alignment/margins through `style`.
  pill: {
    borderRadius: radius.full,
    borderWidth: borderWidth.thin,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
});
