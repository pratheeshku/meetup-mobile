/**
 * Empty-list placeholder: icon/illustration slot, title, optional
 * subtitle, optional action button.
 *
 * No icon library is installed, so when no `icon` is supplied a plain
 * decorative circle stands in for the illustration. It is hidden from
 * accessibility services — the title carries the meaning.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, radius, sizes, spacing, typography } from '../theme/tokens';
import Button from './Button';

interface EmptyStateProps {
  title: string;
  subtitle?: string;
  /** Replaces the default placeholder circle. */
  icon?: React.ReactNode;
  actionLabel?: string;
  onAction?: () => void;
}

export default function EmptyState({
  title,
  subtitle,
  icon,
  actionLabel,
  onAction,
}: EmptyStateProps): React.JSX.Element {
  return (
    <View style={styles.container}>
      <View
        style={styles.iconCircle}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        {icon ?? <View style={styles.iconDot} />}
      </View>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      {actionLabel && onAction ? (
        <Button label={actionLabel} onPress={onAction} style={styles.action} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    backgroundColor: colors.background,
  },
  iconCircle: {
    width: sizes.emptyStateIcon,
    height: sizes.emptyStateIcon,
    borderRadius: radius.full,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  iconDot: {
    width: sizes.emptyStateIconInner,
    height: sizes.emptyStateIconInner,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
  },
  title: {
    ...typography.h3,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  action: { marginTop: spacing.lg },
});
