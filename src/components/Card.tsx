/**
 * Design-system card: white surface, `radius.md`, `shadows.card`,
 * consistent padding. Becomes a pressable (with press feedback and button
 * semantics) when `onPress` is supplied — used for tappable list rows.
 * Spacing between cards is the caller's concern (`style`).
 */
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';

import { colors, opacity, radius, shadows, spacing } from '../theme/tokens';

interface CardProps {
  children: React.ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}

export default function Card({
  children,
  onPress,
  style,
  accessibilityLabel,
}: CardProps): React.JSX.Element {
  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        onPress={onPress}
        style={({ pressed }) => [styles.card, pressed ? styles.pressed : null, style]}
      >
        {children}
      </Pressable>
    );
  }

  return <View style={[styles.card, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    ...shadows.card,
  },
  pressed: { opacity: opacity.pressed },
});
