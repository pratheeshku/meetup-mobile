/**
 * WIP Strip component for features currently in active development
 * (Shuttlr Home v2: Tournaments & Tournament teams screens).
 *
 * Displays text from an admin label; returns null (hidden) when the label is empty.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useT } from '../labels/LabelsContext';
import type { LabelKey } from '../labels/fallbackLabels';
import { radius, spacing, typography } from '../theme/tokens';

interface WipStripProps {
  labelKey: LabelKey;
}

export default function WipStrip({ labelKey }: WipStripProps): React.JSX.Element | null {
  const t = useT();
  const message = t(labelKey)?.trim();

  if (!message) {
    return null;
  }

  return (
    <View style={styles.container} testID="wip-strip">
      <View style={styles.pill}>
        <Text style={styles.pillText}>{t('mob.wip.pill')}</Text>
      </View>
      <Text style={styles.message} numberOfLines={2}>
        {message}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fffbeb',
    borderColor: '#fde68a',
    borderWidth: 1,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  pill: {
    backgroundColor: '#d97706',
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    marginRight: spacing.sm,
  },
  pillText: {
    ...typography.caption,
    fontWeight: '700',
    color: '#ffffff',
    fontSize: 10,
    letterSpacing: 0.5,
  },
  message: {
    ...typography.caption,
    color: '#92400e',
    flex: 1,
    lineHeight: 16,
  },
});
