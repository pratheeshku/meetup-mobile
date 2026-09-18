/**
 * "+" action for a screen's own navigation header (`headerRight`) — the
 * direct create entry point on the Groups and Tournaments tabs. Keeps the
 * 48dp Android touch target; `label` is the accessible name ("Create Group").
 */
import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import { colors, opacity, sizes, typography } from '../theme/tokens';

interface HeaderAddButtonProps {
  label: string;
  onPress: () => void;
}

export default function HeaderAddButton({ label, onPress }: HeaderAddButtonProps): React.JSX.Element {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.button, pressed ? styles.pressed : null]}
    >
      <Text style={styles.plus} accessibilityElementsHidden importantForAccessibility="no">
        +
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minWidth: sizes.touchTarget,
    minHeight: sizes.touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: opacity.pressed },
  plus: { ...typography.h1, color: colors.primary },
});
