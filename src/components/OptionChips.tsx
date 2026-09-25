/**
 * Single-choice chip group for forms (sport, format, participation mode).
 * Purely presentational: the selected value is owned by the screen.
 * `value === null` means nothing is chosen yet. Each chip is a button with
 * `selected` state; `disabled` freezes the group while a submit is in flight.
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { borderWidth, colors, opacity, radius, sizes, spacing, typography } from '../theme/tokens';

export interface ChipOption<T extends string> {
  value: T;
  label: string;
  /**
   * Optional per-option selected background/border colour (e.g. each
   * sport's own colour on a Sport chip group). Takes precedence over
   * `selectedColor`; both fall back to `colors.primary` when omitted, so
   * every existing call site is unaffected.
   */
  color?: string;
}

interface OptionChipsProps<T extends string> {
  options: ChipOption<T>[];
  value: T | readonly T[] | null;
  onChange: (value: T) => void;
  disabled?: boolean;
  /**
   * Group-wide override for the selected background/border colour, used
   * by chip groups whose selected state is a neutral tone rather than the
   * default `colors.primary` (e.g. Skill Level / Visibility). Ignored for
   * any option that sets its own `color`.
   */
  selectedColor?: string;
}

export default function OptionChips<T extends string>({
  options,
  value,
  onChange,
  disabled = false,
  selectedColor,
}: OptionChipsProps<T>): React.JSX.Element {
  return (
    <View style={styles.row}>
      {options.map(option => {
        const selected = Array.isArray(value)
          ? value.includes(option.value)
          : option.value === value;
        const activeColor = option.color ?? selectedColor ?? colors.primary;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="button"
            accessibilityLabel={option.label}
            accessibilityState={{ selected, disabled }}
            disabled={disabled}
            onPress={() => onChange(option.value)}
            style={({ pressed }) => [
              styles.chip,
              selected
                ? { backgroundColor: activeColor, borderColor: activeColor }
                : styles.chipIdle,
              disabled ? styles.disabled : pressed ? styles.pressed : null,
            ]}
          >
            <Text style={[typography.bodyBold, selected ? styles.textSelected : styles.textIdle]}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    minHeight: sizes.controlSmall,
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
    borderWidth: borderWidth.thin,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipIdle: { backgroundColor: colors.surface, borderColor: colors.border },
  pressed: { opacity: opacity.pressed },
  disabled: { opacity: opacity.disabled },
  textIdle: { color: colors.textPrimary },
  textSelected: { color: colors.white },
});
