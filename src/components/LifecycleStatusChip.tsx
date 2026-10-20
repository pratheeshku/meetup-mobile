/**
 * Server-computed lifecycle status chip (DES-MEETUP-ADDENDUM-closure-report AD-1, AD-10, AD-21).
 * Displays Active, Pending closure, Cancelled, or Closed (+ Did not take place).
 * Theme tokens only, no literal colours.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useT, type TranslateFn } from '../labels/LabelsContext';
import { colors, radius, spacing, typography } from '../theme/tokens';
import type { LifecycleStatus } from '../types/event';

interface Props {
  status?: LifecycleStatus;
  closureOutcome?: string | null;
  outcome?: string | null;
  testID?: string;
}

export function getLifecycleStatusText(
  status: LifecycleStatus = 'active',
  closureOutcome?: string | null,
  t: TranslateFn = ((key: string) => key) as unknown as TranslateFn,
): string {
  if (status === 'past') {
    return t('mob.closure.status.pending');
  }
  if (status === 'cancelled') {
    return t('mob.closure.status.cancelled');
  }
  if (status === 'closed') {
    if (closureOutcome === 'not_held') {
      return `${t('mob.closure.status.closed')} · ${t('mob.closure.status.not_held')}`;
    }
    return t('mob.closure.status.closed');
  }
  return t('mob.closure.status.active');
}

export default function LifecycleStatusChip({
  status = 'active',
  closureOutcome,
  outcome,
  testID,
}: Props): React.JSX.Element {
  const t = useT();
  const effectiveOutcome = closureOutcome ?? outcome;
  const label = getLifecycleStatusText(status, effectiveOutcome, t);

  const styleMap = {
    active: { bg: styles.bgActive, text: styles.textActive },
    past: { bg: styles.bgPast, text: styles.textPast },
    cancelled: { bg: styles.bgCancelled, text: styles.textCancelled },
    closed: { bg: styles.bgClosed, text: styles.textClosed },
  };

  const currentStyle = styleMap[status] ?? styleMap.active;

  return (
    <View
      testID={testID ?? `lifecycle-status-chip-${status}`}
      accessibilityLabel={label}
      style={[styles.chip, currentStyle.bg]}
    >
      <Text style={[styles.text, currentStyle.text]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    alignSelf: 'flex-start',
  },
  text: {
    ...typography.label,
  },
  bgActive: {
    backgroundColor: colors.successLight,
  },
  textActive: {
    color: colors.successDark,
  },
  bgPast: {
    backgroundColor: colors.warningLight,
  },
  textPast: {
    color: colors.warningDark,
  },
  bgCancelled: {
    backgroundColor: colors.errorLight,
  },
  textCancelled: {
    color: colors.error,
  },
  bgClosed: {
    backgroundColor: colors.track,
  },
  textClosed: {
    color: colors.textMuted,
  },
});
