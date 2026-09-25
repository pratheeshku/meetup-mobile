/**
 * Design-system button. Visual layer only — callers own the handler and
 * the loading/disabled state.
 *
 * - `loading`: a spinner replaces the label visually. The label stays in
 *   the layout (hidden, not removed) so the button's width doesn't jump
 *   when it toggles — this matters for inline rows like "Save | Cancel",
 *   where a width change would shift the neighbouring button under the
 *   user's finger. A loading button is not pressable.
 * - `disabled`: dimmed and not pressable.
 * - Minimum height is the 48dp Android touch target (`size="md"`).
 */
import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';

import {
  borderWidth,
  colors,
  opacity,
  radius,
  sizes,
  spacing,
  typography,
} from '../theme/tokens';

export type ButtonVariant = 'primary' | 'secondary' | 'destructive' | 'cta';
export type ButtonSize = 'md' | 'sm';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  disabled?: boolean;
  /** Layout only (margins, alignment) — colours come from `variant`. */
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}

interface VariantStyle {
  background: string;
  border: string;
  text: string;
  /** Omitted → pressed feedback falls back to `opacity.pressed`. */
  pressedBackground?: string;
}

const VARIANTS: Record<ButtonVariant, VariantStyle> = {
  primary: {
    background: colors.primary,
    border: colors.primary,
    text: colors.white,
    pressedBackground: colors.primaryDark,
  },
  secondary: {
    background: colors.surface,
    border: colors.primary,
    text: colors.primary,
    pressedBackground: colors.primaryLight,
  },
  destructive: {
    background: colors.error,
    border: colors.error,
    text: colors.white,
  },
  /**
   * Additive: the standing-rule primary-action blue (`colors.ctaBlue`,
   * #1D5FA3 — matches web exactly), distinct from `primary`'s existing
   * `colors.primary` (#1565C0). Scoped to the specific CTAs this task
   * named rather than repointing `primary` app-wide — see `theme/tokens.ts`.
   * No `pressedBackground` (falls back to `opacity.pressed`), same as
   * `destructive` above.
   */
  cta: {
    background: colors.ctaBlue,
    border: colors.ctaBlue,
    text: colors.white,
  },
};

export default function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  style,
  accessibilityLabel,
}: ButtonProps): React.JSX.Element {
  const variantStyle = VARIANTS[variant];
  const isInactive = disabled || loading;
  const labelTypography = size === 'sm' ? typography.bodyBold : typography.button;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: isInactive, busy: loading }}
      disabled={isInactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        size === 'sm' ? styles.small : styles.medium,
        { backgroundColor: variantStyle.background, borderColor: variantStyle.border },
        pressed && !isInactive
          ? variantStyle.pressedBackground
            ? { backgroundColor: variantStyle.pressedBackground }
            : styles.pressedFallback
          : null,
        disabled ? styles.disabled : null,
        style,
      ]}
    >
      <View style={styles.content}>
        <Text
          style={[labelTypography, { color: variantStyle.text }, loading ? styles.hidden : null]}
          numberOfLines={1}
        >
          {label}
        </Text>
        {loading ? (
          <View style={styles.spinnerOverlay}>
            <ActivityIndicator size="small" color={variantStyle.text} />
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: borderWidth.thin,
  },
  medium: {
    minHeight: sizes.touchTarget,
    paddingHorizontal: spacing.lg,
  },
  small: {
    minHeight: sizes.controlSmall,
    paddingHorizontal: spacing.md,
  },
  pressedFallback: { opacity: opacity.pressed },
  disabled: { opacity: opacity.disabled },
  content: { alignItems: 'center', justifyContent: 'center' },
  hidden: { opacity: 0 },
  spinnerOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
