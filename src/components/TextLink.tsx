/**
 * Text-only inline action ("Edit", "Invite", "Remove", "Register" link).
 *
 * Not one of the six components in the task brief — added because these
 * text actions repeat across several screens and each needs the same
 * button semantics, colour contrast, and an enlarged hit area (the bare
 * text is far smaller than the 48dp touch target). `loading` swaps the
 * label for a spinner, like `Button`.
 */
import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';

import { colors, opacity, spacing, typography } from '../theme/tokens';

export type TextLinkTone = 'primary' | 'destructive';

interface TextLinkProps {
  label: string;
  onPress: () => void;
  tone?: TextLinkTone;
  loading?: boolean;
  disabled?: boolean;
  /** Layout only (margins, alignment). */
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}

const TONE_COLOR: Record<TextLinkTone, string> = {
  primary: colors.primary,
  destructive: colors.error,
};

export default function TextLink({
  label,
  onPress,
  tone = 'primary',
  loading = false,
  disabled = false,
  style,
  accessibilityLabel,
}: TextLinkProps): React.JSX.Element {
  const isInactive = disabled || loading;
  const color = TONE_COLOR[tone];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: isInactive, busy: loading }}
      disabled={isInactive}
      onPress={onPress}
      hitSlop={spacing.sm}
      style={({ pressed }) => [
        styles.base,
        pressed && !isInactive ? styles.pressed : null,
        disabled ? styles.disabled : null,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={color} />
      ) : (
        <Text style={[typography.bodyBold, { color }]}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { paddingVertical: spacing.xs, justifyContent: 'center' },
  pressed: { opacity: opacity.pressed },
  disabled: { opacity: opacity.disabled },
});
