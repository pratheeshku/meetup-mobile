/**
 * Cross-platform native date/time picker form field.
 *
 * Replaces free-text inputs for date and date-time entry. Wraps
 * `@react-native-community/datetimepicker` with design-system styling
 * matching `TextField` (same height, borders, colors, and typography).
 *
 * Platform mechanics:
 * - iOS: Presents a bottom-sheet modal containing an inline spinner picker
 *   with explicit "Cancel" and "Done" actions, avoiding keyboard overlap.
 * - Android: Launches the native Android Dialog (Material DatePickerDialog
 *   for 'date'; two-step DatePickerDialog followed by TimePickerDialog for
 *   'datetime').
 *
 * Value format:
 * - 'date': local "YYYY-MM-DD"
 * - 'datetime': local "YYYY-MM-DD HH:mm"
 * These match the exact wire-format contracts parsed by `localDateTime.ts`.
 */
import React, { useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';

import { borderWidth, colors, opacity, radius, sizes, spacing, typography } from '../theme/tokens';
import {
  formatDateOnly,
  formatLocalDateTime,
  localDateTimeToDate,
  localDateToDate,
} from '../utils/localDateTime';

export interface DateTimePickerFieldProps {
  value: string;
  onChange: (value: string) => void;
  mode: 'date' | 'datetime';
  placeholder?: string;
  accessibilityLabel: string;
  testID?: string;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

export default function DateTimePickerField({
  value,
  onChange,
  mode,
  placeholder,
  accessibilityLabel,
  testID,
  disabled = false,
  style,
}: DateTimePickerFieldProps): React.JSX.Element {
  // Parsing the initial Date from string value
  const parseCurrentValue = (): Date => {
    if (mode === 'datetime') {
      return localDateTimeToDate(value) ?? new Date();
    }
    return localDateToDate(value) ?? new Date();
  };

  // iOS modal state
  const [iosModalVisible, setIosModalVisible] = useState(false);
  const [iosTempDate, setIosTempDate] = useState<Date>(new Date());

  // Android picker state
  const [androidPickerVisible, setAndroidPickerVisible] = useState(false);
  const [androidStep, setAndroidStep] = useState<'date' | 'time'>('date');
  const [androidTempDate, setAndroidTempDate] = useState<Date>(new Date());

  const handleOpen = (): void => {
    if (disabled) {
      return;
    }
    const current = parseCurrentValue();
    if (Platform.OS === 'ios') {
      setIosTempDate(current);
      setIosModalVisible(true);
    } else {
      setAndroidTempDate(current);
      setAndroidStep('date');
      setAndroidPickerVisible(true);
    }
  };

  // --- iOS Handlers ---
  const handleIosChange = (_event: DateTimePickerEvent, selectedDate?: Date): void => {
    if (selectedDate) {
      setIosTempDate(selectedDate);
    }
  };

  const handleIosDone = (): void => {
    setIosModalVisible(false);
    if (mode === 'datetime') {
      onChange(formatLocalDateTime(iosTempDate));
    } else {
      onChange(formatDateOnly(iosTempDate));
    }
  };

  const handleIosCancel = (): void => {
    setIosModalVisible(false);
  };

  // --- Android Handlers ---
  const handleAndroidChange = (event: DateTimePickerEvent, selectedDate?: Date): void => {
    if (event.type === 'dismissed') {
      setAndroidPickerVisible(false);
      setAndroidStep('date');
      return;
    }

    if (event.type === 'set' && selectedDate) {
      if (mode === 'date') {
        setAndroidPickerVisible(false);
        onChange(formatDateOnly(selectedDate));
      } else {
        // datetime: step 1 (date) -> step 2 (time)
        if (androidStep === 'date') {
          setAndroidTempDate(selectedDate);
          setAndroidStep('time');
          // keep androidPickerVisible = true to trigger time picker
        } else {
          setAndroidPickerVisible(false);
          setAndroidStep('date');
          const combined = new Date(
            androidTempDate.getFullYear(),
            androidTempDate.getMonth(),
            androidTempDate.getDate(),
            selectedDate.getHours(),
            selectedDate.getMinutes(),
          );
          onChange(formatLocalDateTime(combined));
        }
      }
    }
  };

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        testID={testID}
        disabled={disabled}
        onPress={handleOpen}
        style={({ pressed }) => [
          styles.trigger,
          disabled ? styles.disabled : pressed ? styles.pressed : null,
          style,
        ]}
      >
        <Text style={value ? styles.valueText : styles.placeholderText}>
          {value || placeholder || (mode === 'datetime' ? 'YYYY-MM-DD HH:mm' : 'YYYY-MM-DD')}
        </Text>
      </Pressable>

      {/* iOS Modal Picker */}
      {Platform.OS === 'ios' ? (
        <Modal
          visible={iosModalVisible}
          transparent
          animationType="fade"
          onRequestClose={handleIosCancel}
        >
          <View style={styles.modalOverlay}>
            <Pressable style={styles.modalBackdrop} onPress={handleIosCancel} />
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Cancel"
                  onPress={handleIosCancel}
                >
                  <Text style={styles.modalActionCancel}>Cancel</Text>
                </Pressable>
                <Text style={styles.modalTitle}>{accessibilityLabel}</Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Done"
                  onPress={handleIosDone}
                >
                  <Text style={styles.modalActionDone}>Done</Text>
                </Pressable>
              </View>
              <DateTimePicker
                testID={testID ? `${testID}-picker` : 'dateTimePicker'}
                value={iosTempDate}
                mode={mode}
                display="spinner"
                onChange={handleIosChange}
              />
            </View>
          </View>
        </Modal>
      ) : null}

      {/* Android Dialog Picker */}
      {Platform.OS !== 'ios' && androidPickerVisible ? (
        <DateTimePicker
          testID={testID ? `${testID}-picker` : 'dateTimePicker'}
          value={androidStep === 'time' ? androidTempDate : parseCurrentValue()}
          mode={androidStep}
          display="default"
          is24Hour
          onChange={handleAndroidChange}
        />
      ) : null}
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
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  valueText: {
    ...typography.body,
    color: colors.textPrimary,
  },
  placeholderText: {
    ...typography.body,
    color: colors.textSecondary,
  },
  disabled: {
    opacity: opacity.disabled,
  },
  pressed: {
    opacity: opacity.pressed,
  },
  // iOS modal styles
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  modalBackdrop: {
    flex: 1,
  },
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
  modalTitle: {
    ...typography.bodyBold,
    color: colors.textPrimary,
  },
  modalActionCancel: {
    ...typography.body,
    color: colors.textSecondary,
  },
  modalActionDone: {
    ...typography.bodyBold,
    color: colors.primary,
  },
});
