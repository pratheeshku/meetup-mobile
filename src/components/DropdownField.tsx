/**
 * Single-choice dropdown/picker form field — a closed trigger (styled like
 * `TextField`/`DateTimePickerField`'s trigger) that opens a bottom-sheet
 * `Modal` listing the options; tapping a row selects it and closes the
 * sheet. No native dependency: built from RN core (`Modal`, `Pressable`),
 * following `DateTimePickerField`'s existing modal-sheet pattern rather
 * than adding `@react-native-picker/picker` (not installed; a new native
 * module was out of scope for a single conditional field — see Gate 1/2).
 *
 * Used for the Create Game screen's Group picker (shown only when
 * Visibility = Group), distinct in kind from the Sport/Skill/Visibility
 * chip pickers on the same form (DES-MEETUP-MOBILE.md §4.3 Create Flow
 * Amendment; user-directed control-pattern correction, matching web).
 */
import React, { useState } from 'react';
import {
  Modal,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';

import {
  borderWidth,
  colors,
  opacity,
  radius,
  sizes,
  spacing,
  typography,
} from '../theme/tokens';

export interface DropdownOption {
  value: string;
  label: string;
}

interface DropdownFieldProps {
  options: DropdownOption[];
  value: string | null;
  onChange: (value: string) => void;
  placeholder: string;
  accessibilityLabel: string;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

export default function DropdownField({
  options,
  value,
  onChange,
  placeholder,
  accessibilityLabel,
  disabled = false,
  style,
}: DropdownFieldProps): React.JSX.Element {
  const [isOpen, setIsOpen] = useState(false);
  const selected = options.find(option => option.value === value) ?? null;

  const handleOpen = (): void => {
    if (disabled) {
      return;
    }
    setIsOpen(true);
  };

  const handleClose = (): void => setIsOpen(false);

  const handleSelect = (optionValue: string): void => {
    onChange(optionValue);
    setIsOpen(false);
  };

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        disabled={disabled}
        onPress={handleOpen}
        style={({ pressed }) => [
          styles.trigger,
          disabled ? styles.disabled : pressed ? styles.pressed : null,
          style,
        ]}
      >
        <Text style={selected ? styles.valueText : styles.placeholderText}>
          {selected ? selected.label : placeholder}
        </Text>
        <Text style={styles.chevron}>▾</Text>
      </Pressable>

      <Modal
        visible={isOpen}
        transparent
        animationType="fade"
        onRequestClose={handleClose}
      >
        <View style={styles.modalOverlay}>
          <Pressable style={styles.modalBackdrop} onPress={handleClose} />
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{accessibilityLabel}</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Cancel"
                onPress={handleClose}
              >
                <Text style={styles.modalActionCancel}>Cancel</Text>
              </Pressable>
            </View>
            {options.map(option => (
              <Pressable
                key={option.value}
                accessibilityRole="button"
                accessibilityLabel={option.label}
                accessibilityState={{ selected: option.value === value }}
                onPress={() => handleSelect(option.value)}
                style={({ pressed }) => [
                  styles.optionRow,
                  pressed ? styles.pressed : null,
                ]}
              >
                <Text
                  style={
                    option.value === value
                      ? styles.optionTextSelected
                      : styles.optionText
                  }
                >
                  {option.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    minHeight: sizes.touchTarget,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: borderWidth.thin,
    borderColor: colors.border,
    borderRadius: radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  valueText: { ...typography.body, color: colors.textPrimary },
  placeholderText: { ...typography.body, color: colors.textSecondary },
  chevron: { ...typography.body, color: colors.textMuted },
  disabled: { opacity: opacity.disabled },
  pressed: { opacity: opacity.pressed },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: colors.scrim,
  },
  modalBackdrop: { flex: 1 },
  modalContent: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingBottom: spacing.xl,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: borderWidth.thin,
    borderBottomColor: colors.border,
  },
  modalTitle: { ...typography.bodyBold, color: colors.textPrimary },
  modalActionCancel: { ...typography.body, color: colors.textSecondary },
  optionRow: {
    minHeight: sizes.touchTarget,
    paddingHorizontal: spacing.lg,
    justifyContent: 'center',
    borderBottomWidth: borderWidth.thin,
    borderBottomColor: colors.border,
  },
  optionText: { ...typography.body, color: colors.textPrimary },
  optionTextSelected: { ...typography.bodyBold, color: colors.ctaBlue },
});
