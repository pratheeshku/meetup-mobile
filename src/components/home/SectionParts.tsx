/**
 * Small shared pieces of the dashboard sections (DES-MEETUP-ADDENDUM-
 * dashboard.md §4, §5): the section header with "View all", skeleton rows,
 * and the inline error with Retry. Every section always renders one of
 * rows / empty text / skeleton / error under its heading, so no heading is
 * ever left without content (AD-11).
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { dash, dashRadius, dashSize } from '../../theme/dashboardTheme';
import { spacing, typography } from '../../theme/tokens';
import { useT } from '../../labels/LabelsContext';
import type { LabelKey } from '../../labels/fallbackLabels';

export function SectionHeader({
  title,
  onViewAll,
  variant = 'default',
}: {
  title: string;
  onViewAll?: () => void;
  /** `panel`: Home folder-panel header (title 16/800, View all 13/700). */
  variant?: 'default' | 'panel';
}): React.JSX.Element {
  const t = useT();
  return (
    <View style={styles.header}>
      <Text style={[styles.title, variant === 'panel' ? styles.titlePanel : null]} accessibilityRole="header">
        {title}
      </Text>
      {onViewAll ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('mob.dashboard.view_all_a11y', { title })}
          onPress={onViewAll}
          hitSlop={spacing.sm}
          style={({ pressed }) => [styles.viewAll, pressed ? styles.pressed : null]}
        >
          <Text style={[styles.viewAllText, variant === 'panel' ? styles.viewAllTextPanel : null]}>
            {t('mob.dashboard.view_all')}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function SkeletonRows({
  count = 2,
  testID,
}: {
  count?: number;
  testID?: string;
}): React.JSX.Element {
  const t = useT();
  return (
    <View testID={testID} accessibilityLabel={t('mob.common.loading')} accessibilityRole="progressbar">
      {Array.from({ length: count }, (_, index) => (
        <View key={index} style={styles.skeletonRow}>
          <View style={styles.skeletonTile} />
          <View style={styles.skeletonLines}>
            <View style={[styles.skeletonLine, styles.skeletonLineLong]} />
            <View style={[styles.skeletonLine, styles.skeletonLineShort]} />
          </View>
        </View>
      ))}
    </View>
  );
}

export function InlineError({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}): React.JSX.Element {
  const t = useT();
  return (
    <View style={styles.errorBox}>
      <Text style={styles.errorText} accessibilityRole="alert">
        {message}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('mob.common.retry')}
        onPress={onRetry}
        style={({ pressed }) => [styles.retry, pressed ? styles.pressed : null]}
      >
        <Text style={styles.retryText}>{t('mob.common.retry')}</Text>
      </Pressable>
    </View>
  );
}

export function EmptyText({ children }: { children: string }): React.JSX.Element {
  return <Text style={styles.empty}>{children}</Text>;
}

/** Section copy label keys (§5 "States"); resolve with `t(COPY.x)`. */
export const COPY = {
  gamesEmpty: 'mob.dashboard.games_empty',
  gamesError: 'mob.dashboard.games_error',
  groupsEmpty: 'mob.dashboard.groups_empty',
  groupsError: 'mob.dashboard.groups_error',
  recommendedEmpty: 'mob.dashboard.recommended_empty',
  recommendedError: 'mob.dashboard.recommended_error',
} as const satisfies Record<string, LabelKey>;

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  title: { ...typography.h3, color: dash.text },
  viewAll: {
    minHeight: dashSize.touchTarget,
    minWidth: dashSize.touchTarget,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  viewAllText: { ...typography.bodyBold, color: dash.brand },
  titlePanel: { fontSize: 16, fontWeight: '800' },
  viewAllTextPanel: { fontSize: 13, fontWeight: '700' },
  pressed: { opacity: 0.7 },
  skeletonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: dash.card,
    borderRadius: dashRadius.card,
    borderWidth: 1,
    borderColor: dash.cardBorder,
    padding: spacing.sm + 2,
    marginBottom: spacing.sm,
  },
  skeletonTile: {
    width: dashSize.rowIconTile,
    height: dashSize.rowIconTile,
    borderRadius: dashRadius.rowTile,
    backgroundColor: dash.skeleton,
  },
  skeletonLines: { flex: 1, marginLeft: spacing.sm + 2 },
  skeletonLine: { height: 10, borderRadius: 5, backgroundColor: dash.skeleton },
  skeletonLineLong: { width: '70%' },
  skeletonLineShort: { width: '45%', marginTop: spacing.sm },
  errorBox: {
    backgroundColor: dash.card,
    borderRadius: dashRadius.card,
    borderWidth: 1,
    borderColor: dash.cardBorder,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  errorText: { ...typography.body, color: dash.text, flexShrink: 1, marginRight: spacing.sm },
  retry: {
    minHeight: dashSize.touchTarget,
    minWidth: dashSize.touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryText: { ...typography.bodyBold, color: dash.brand },
  empty: {
    ...typography.body,
    color: dash.textMuted,
    paddingVertical: spacing.md,
  },
});
