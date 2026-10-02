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

export function SectionHeader({
  title,
  onViewAll,
}: {
  title: string;
  onViewAll?: () => void;
}): React.JSX.Element {
  return (
    <View style={styles.header}>
      <Text style={styles.title} accessibilityRole="header">
        {title}
      </Text>
      {onViewAll ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`View all ${title}`}
          onPress={onViewAll}
          hitSlop={spacing.sm}
          style={({ pressed }) => [styles.viewAll, pressed ? styles.pressed : null]}
        >
          <Text style={styles.viewAllText}>View all</Text>
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
  return (
    <View testID={testID} accessibilityLabel="Loading" accessibilityRole="progressbar">
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
  return (
    <View style={styles.errorBox}>
      <Text style={styles.errorText} accessibilityRole="alert">
        {message}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Retry"
        onPress={onRetry}
        style={({ pressed }) => [styles.retry, pressed ? styles.pressed : null]}
      >
        <Text style={styles.retryText}>Retry</Text>
      </Pressable>
    </View>
  );
}

export function EmptyText({ children }: { children: string }): React.JSX.Element {
  return <Text style={styles.empty}>{children}</Text>;
}

/** Section copy (§5 "States"). */
export const COPY = {
  gamesEmpty: 'No upcoming games yet — join one below or create your own.',
  gamesError: "Couldn't load your games",
  groupsEmpty: "You haven't joined any groups yet.",
  groupsError: "Couldn't load your groups",
  recommendedEmpty: 'No public games to recommend right now.',
  recommendedError: "Couldn't load recommendations",
} as const;

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
