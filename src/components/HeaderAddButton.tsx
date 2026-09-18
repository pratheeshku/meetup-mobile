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

/**
 * Builds a `headerRight` render function. React Navigation calls
 * `headerRight` as a plain function inside its own header hook, so what it
 * returns must be a ready element with no hooks of its own — callers close
 * over `navigation` in `onPress` instead of calling `useNavigation()`.
 * Module-level (not an inline arrow in a screen) so it isn't a component
 * defined during render.
 */
export function headerAddButton(label: string, onPress: () => void): () => React.JSX.Element {
  return () => <HeaderAddButton label={label} onPress={onPress} />;
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
