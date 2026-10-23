/**
 * Small shared pieces of the creation wizard (boards TournBasics to TournReview): the white section card, the
 * error / info banners, the compact count stepper and the locked-value row. Theme tokens only; every icon-plus-text
 * row sits in a fixed-size box so the glyph never shifts the text.
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';

import { InfoIcon } from '../../icons/HomeV2Icons';
import { LockIcon, WarningIcon } from '../../icons/ActionIcons';
import { useT } from '../../../labels/LabelsContext';
import { borderWidth, colors, opacity, radius, spacing, typography } from '../../../theme/tokens';

const ICON_BOX = 24;
const STEPPER_BOX = 36;

export function SectionCard({
  title,
  children,
  style,
}: {
  title?: string;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}): React.JSX.Element {
  return (
    <View style={[styles.card, style]}>
      {title ? <Text style={styles.sectionTitle}>{title}</Text> : null}
      {children}
    </View>
  );
}

export function StepHeading({ children }: { children: string }): React.JSX.Element {
  return (
    <Text style={styles.heading} accessibilityRole="header">
      {children}
    </Text>
  );
}

export function FieldLabel({ children }: { children: string }): React.JSX.Element {
  return <Text style={styles.fieldLabel}>{children}</Text>;
}

export function FieldError({ message, testID }: { message?: string | null; testID?: string }): React.JSX.Element | null {
  return message ? (
    <Text style={styles.fieldError} accessibilityRole="alert" testID={testID}>
      {message}
    </Text>
  ) : null;
}

type Tone = 'error' | 'info' | 'warning';

export function Banner({
  tone,
  message,
  testID,
  style,
}: {
  tone: Tone;
  message: string;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}): React.JSX.Element {
  const toneStyle = tone === 'error' ? styles.bannerError : tone === 'warning' ? styles.bannerWarning : styles.bannerInfo;
  const textStyle = tone === 'error' ? styles.bannerTextError : tone === 'warning' ? styles.bannerTextWarning : styles.bannerTextInfo;
  const iconColor = tone === 'error' ? colors.error : tone === 'warning' ? colors.warningDark : colors.primaryDark;
  return (
    <View style={[styles.banner, toneStyle, style]} accessibilityRole={tone === 'info' ? undefined : 'alert'} testID={testID}>
      <View style={styles.iconBox}>
        {tone === 'info' ? <InfoIcon size={18} color={iconColor} /> : <WarningIcon size={18} color={iconColor} />}
      </View>
      <Text style={[styles.bannerText, textStyle]}>{message}</Text>
    </View>
  );
}

/**
 * Number stepper of the board (label and hint on the left, "−" value "+" on the right). Not an invite control: the
 * shared AddRemoveControl (AD-19) is for people and groups.
 */
export function CountStepper({
  label,
  hint,
  value,
  min,
  max,
  onChange,
  decreaseLabel,
  increaseLabel,
  testID,
}: {
  label: string;
  hint?: string;
  value: number | null;
  min?: number;
  max?: number;
  onChange: (next: number) => void;
  decreaseLabel: string;
  increaseLabel: string;
  testID?: string;
}): React.JSX.Element {
  const current = value ?? min ?? 0;
  const canDecrease = min === undefined || current > min;
  const canIncrease = max === undefined || current < max;
  return (
    <View style={styles.counterRow} testID={testID}>
      <View style={styles.counterText}>
        <Text style={styles.counterLabel}>{label}</Text>
        {hint ? <Text style={styles.counterHint}>{hint}</Text> : null}
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={decreaseLabel}
        disabled={!canDecrease}
        onPress={() => onChange(current - 1)}
        style={[styles.stepperBox, !canDecrease ? styles.stepperDisabled : null]}
        testID={testID ? `${testID}-minus` : undefined}
      >
        <Text style={styles.stepperGlyph}>−</Text>
      </Pressable>
      <Text style={styles.counterValue} testID={testID ? `${testID}-value` : undefined}>
        {value ?? '–'}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={increaseLabel}
        disabled={!canIncrease}
        onPress={() => onChange(current + 1)}
        style={[styles.stepperBox, !canIncrease ? styles.stepperDisabled : null]}
        testID={testID ? `${testID}-plus` : undefined}
      >
        <Text style={styles.stepperGlyph}>+</Text>
      </Pressable>
    </View>
  );
}

/** A value the template fixes: shown, not editable, with a lock. */
export function LockedRow({ label, hint, value }: { label: string; hint?: string; value: string }): React.JSX.Element {
  const t = useT();
  return (
    <View style={styles.counterRow}>
      <View style={styles.counterText}>
        <Text style={styles.counterLabel}>{label}</Text>
        <Text style={styles.counterHint}>{hint ?? t('mob.tw.part_set_by_format')}</Text>
      </View>
      <Text style={styles.counterValue}>{value}</Text>
      <View style={styles.iconBox}>
        <LockIcon size={16} color={colors.textMuted} />
      </View>
    </View>
  );
}

export const wizardStyles = StyleSheet.create({
  content: { padding: spacing.md, paddingBottom: spacing.xl },
  gap: { marginTop: spacing.md },
});

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: borderWidth.thin,
    borderColor: colors.border,
    padding: spacing.md,
  },
  sectionTitle: {
    ...typography.label,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: spacing.sm,
  },
  heading: { ...typography.h2, color: colors.textPrimary, marginBottom: spacing.md },
  fieldLabel: { ...typography.caption, fontWeight: '600', color: colors.textSecondary, marginTop: spacing.md, marginBottom: spacing.xs },
  fieldError: { ...typography.caption, fontWeight: '600', color: colors.error, marginTop: spacing.xs },
  banner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  bannerError: { backgroundColor: colors.errorLight },
  bannerWarning: { backgroundColor: colors.warningLight },
  bannerInfo: { backgroundColor: colors.primaryLight },
  bannerText: { ...typography.caption, fontWeight: '600', flex: 1, marginLeft: spacing.sm },
  bannerTextError: { color: colors.error },
  bannerTextWarning: { color: colors.warningDark },
  bannerTextInfo: { color: colors.primaryDark },
  iconBox: { width: ICON_BOX, height: ICON_BOX, alignItems: 'center', justifyContent: 'center' },
  counterRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm },
  counterText: { flex: 1, paddingRight: spacing.sm },
  counterLabel: { ...typography.bodyBold, color: colors.textPrimary },
  counterHint: { ...typography.caption, color: colors.textSecondary },
  counterValue: { ...typography.h3, color: colors.textPrimary, minWidth: 44, textAlign: 'center' },
  stepperBox: {
    width: STEPPER_BOX,
    height: STEPPER_BOX,
    borderRadius: radius.md,
    borderWidth: borderWidth.thin,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperDisabled: { opacity: opacity.disabled },
  stepperGlyph: { ...typography.h3, color: colors.primary },
});
