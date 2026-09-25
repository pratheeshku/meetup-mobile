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
}

interface OptionChipsProps<T extends string> {
  options: ChipOption<T>[];
  value: T | readonly T[] | null;
  onChange: (value: T) => void;
  disabled?: boolean;
}

export default function OptionChips<T extends string>({
  options,
  value,
  onChange,
  disabled = false,
}: OptionChipsProps<T>): React.JSX.Element {
  return (
    <View style={styles.row}>
      {options.map(option => {
        const selected = Array.isArray(value)
          ? value.includes(option.value)
          : option.value === value;
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
              selected ? styles.chipSelected : styles.chipIdle,
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
  chipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  pressed: { opacity: opacity.pressed },
  disabled: { opacity: opacity.disabled },
  textIdle: { color: colors.textPrimary },
  textSelected: { color: colors.white },
});
