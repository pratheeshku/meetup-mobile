/**
 * Design-system text input — a thin wrapper over `TextInput` that accepts
 * every `TextInputProps` unchanged, so a caller's value/handlers/keyboard
 * props behave exactly as before.
 *
 * Not one of the six components in the task brief. It exists because the
 * Android app theme is `Theme.AppCompat.DayNight`: in system dark mode a
 * `TextInput` with no explicit colour renders light text, which would be
 * invisible on this app's light surfaces. Centralising the explicit
 * text/placeholder colours here means no screen can forget them.
 */
import React, { useState } from 'react';
import { StyleSheet, TextInput } from 'react-native';
import type { TextInputProps } from 'react-native';

import { borderWidth, colors, radius, sizes, spacing, typography } from '../theme/tokens';

// Derived from `TextInputProps` so the handler signatures track whatever the
// installed React Native version declares (they changed in 0.86).
type FocusHandler = NonNullable<TextInputProps['onFocus']>;
type BlurHandler = NonNullable<TextInputProps['onBlur']>;

export default function TextField({
  style,
  onFocus,
  onBlur,
  ...rest
}: TextInputProps): React.JSX.Element {
  const [isFocused, setIsFocused] = useState(false);

  const handleFocus: FocusHandler = event => {
    setIsFocused(true);
    onFocus?.(event);
  };
  const handleBlur: BlurHandler = event => {
    setIsFocused(false);
    onBlur?.(event);
  };

  return (
    <TextInput
      placeholderTextColor={colors.textSecondary}
      selectionColor={colors.primary}
      {...rest}
      onFocus={handleFocus}
      onBlur={handleBlur}
      style={[styles.input, isFocused ? styles.focused : null, style]}
    />
  );
}

const styles = StyleSheet.create({
  input: {
    ...typography.body,
    color: colors.textPrimary,
    backgroundColor: colors.surface,
    borderWidth: borderWidth.thin,
    borderColor: colors.border,
    borderRadius: radius.md,
    minHeight: sizes.touchTarget,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  focused: { borderColor: colors.primary },
});
