import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View, type ViewStyle } from 'react-native';

import { WarningIcon } from './icons/ActionIcons';
import { useT } from '../labels/LabelsContext';
import { borderWidth, colors, opacity, radius, spacing, typography } from '../theme/tokens';

export interface NumberFieldProps {
  label?: string;
  value: number | string | null | undefined;
  onChangeValue: (value: number | null, isValid: boolean) => void;
  min?: number;
  max?: number;
  placeholder?: string;
  error?: string;
  helperText?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  showStepper?: boolean;
  style?: ViewStyle;
  testID?: string;
}

export default function NumberField({
  label,
  value,
  onChangeValue,
  min,
  max,
  placeholder = '0',
  error: customError,
  helperText,
  disabled = false,
  autoFocus = false,
  showStepper = false,
  style,
  testID,
}: NumberFieldProps): React.JSX.Element {
  const t = useT();
  const [isFocused, setIsFocused] = useState(false);

  const stringValue = value !== null && value !== undefined ? String(value) : '';
  const num = stringValue.trim() === '' ? null : Number(stringValue);

  let validationError: string | null = null;
  if (num !== null) {
    if (Number.isNaN(num)) {
      validationError = t('mob.number_field.required_error');
    } else if (min !== undefined && num < min) {
      validationError = t('mob.number_field.min_error', { min });
    } else if (max !== undefined && num > max) {
      validationError = t('mob.number_field.max_error', { max });
    }
  }

  const effectiveError = customError ?? validationError;
  const isInvalid = Boolean(effectiveError);

  const handleChangeText = (text: string): void => {
    const cleaned = text.replace(/[^0-9]/g, '');
    if (cleaned === '') {
      onChangeValue(null, false);
      return;
    }
    const parsed = Number(cleaned);
    let valid = true;
    if (min !== undefined && parsed < min) {
      valid = false;
    }
    if (max !== undefined && parsed > max) {
      valid = false;
    }
    onChangeValue(parsed, valid);
  };

  const handleStep = (delta: number): void => {
    const current = num ?? (min ?? 0);
    const next = current + delta;
    if (min !== undefined && next < min) return;
    if (max !== undefined && next > max) return;
    let valid = true;
    if (min !== undefined && next < min) valid = false;
    if (max !== undefined && next > max) valid = false;
    onChangeValue(next, valid);
  };

  const defaultHelper =
    min !== undefined && max !== undefined
      ? t('mob.number_field.range_helper', { min, max })
      : helperText;

  return (
    <View style={[styles.container, style]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}

      {showStepper ? (
        <View style={styles.stepperRow}>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={t('mob.number_field.decrease')}
            disabled={disabled || (min !== undefined && num !== null && num <= min)}
            onPress={() => handleStep(-1)}
            style={[
              styles.stepperButton,
              styles.stepperButtonMinus,
              (disabled || (min !== undefined && num !== null && num <= min)) && styles.stepperButtonDisabled,
            ]}
          >
            <Text
              style={[
                styles.stepperButtonText,
                styles.stepperButtonMinusText,
                (disabled || (min !== undefined && num !== null && num <= min)) && styles.stepperButtonDisabledText,
              ]}
            >
              −
            </Text>
          </TouchableOpacity>

          <TextInput
            testID={testID}
            style={[
              styles.input,
              styles.stepperInput,
              isFocused && styles.inputFocused,
              isInvalid && styles.inputError,
              disabled && styles.disabled,
            ]}
            value={stringValue}
            onChangeText={handleChangeText}
            keyboardType="number-pad"
            placeholder={placeholder}
            placeholderTextColor={colors.textMuted}
            editable={!disabled}
            autoFocus={autoFocus}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            maxLength={4}
            textAlign="center"
            accessibilityRole="none"
            accessibilityLabel={label}
          />

          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={t('mob.number_field.increase')}
            disabled={disabled || (max !== undefined && num !== null && num >= max)}
            onPress={() => handleStep(1)}
            style={[
              styles.stepperButton,
              styles.stepperButtonPlus,
              (disabled || (max !== undefined && num !== null && num >= max)) && styles.stepperButtonDisabled,
            ]}
          >
            <Text style={[styles.stepperButtonText, styles.stepperButtonPlusText]}>+</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.inputWrapper}>
          <TextInput
            testID={testID}
            style={[
              styles.input,
              isFocused && styles.inputFocused,
              isInvalid && styles.inputError,
              disabled && styles.disabled,
            ]}
            value={stringValue}
            onChangeText={handleChangeText}
            keyboardType="number-pad"
            placeholder={placeholder}
            placeholderTextColor={colors.textMuted}
            editable={!disabled}
            autoFocus={autoFocus}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            maxLength={4}
            textAlign="center"
            accessibilityRole="none"
            accessibilityLabel={label}
          />
        </View>
      )}

      {effectiveError ? (
        <View style={styles.errorRow}>
          <WarningIcon size={16} color={colors.error} />
          <Text style={styles.errorText}>{effectiveError}</Text>
        </View>
      ) : defaultHelper ? (
        <Text style={styles.helperText}>{defaultHelper}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  label: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: '600',
    marginBottom: spacing.md,
    alignSelf: 'flex-start',
  },
  inputWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
    marginBottom: spacing.sm,
  },
  stepperButton: {
    width: 48,
    height: 48,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperButtonMinus: {
    backgroundColor: colors.primaryLight,
  },
  stepperButtonPlus: {
    backgroundColor: colors.primary,
  },
  stepperButtonDisabled: {
    opacity: opacity.disabled,
  },
  stepperButtonText: {
    fontSize: 24,
    fontWeight: '600',
    lineHeight: 28,
  },
  stepperButtonMinusText: {
    color: colors.primary,
  },
  stepperButtonPlusText: {
    color: colors.white,
  },
  stepperButtonDisabledText: {
    color: colors.textMuted,
  },
  input: {
    width: 110,
    height: 70,
    backgroundColor: colors.surface,
    borderWidth: borderWidth.thick,
    borderColor: colors.border,
    borderRadius: radius.lg,
    fontSize: 32,
    fontWeight: '700',
    color: colors.textPrimary,
    textAlign: 'center',
    paddingHorizontal: spacing.sm,
  },
  stepperInput: {
    borderColor: colors.primary,
  },
  inputFocused: {
    borderColor: colors.primary,
  },
  inputError: {
    borderColor: colors.error,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  errorText: {
    ...typography.caption,
    color: colors.error,
    fontWeight: '600',
  },
  helperText: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  disabled: {
    opacity: opacity.disabled,
  },
});
