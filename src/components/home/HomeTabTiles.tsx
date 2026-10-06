/**
 * Tab Tiles (Shuttlr Home v2).
 *
 * Requirements:
 * - Two tab tiles: "Upcoming games" (default selected) and "Your groups".
 * - Selected has a border plus tint, accessibilityRole tab with selected state, no chevrons.
 * - Upcoming tile count = games in the next 7 days.
 * - Groups tile count = active groups.
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useT } from '../../labels/LabelsContext';
import { dash, dashRadius } from '../../theme/dashboardTheme';
import { colors, spacing, typography } from '../../theme/tokens';

export type HomeTab = 'upcoming' | 'groups';

interface HomeTabTilesProps {
  selectedTab: HomeTab;
  onSelectTab: (tab: HomeTab) => void;
  upcomingCount: number | null;
  groupsCount: number | null;
}

export default function HomeTabTiles({
  selectedTab,
  onSelectTab,
  upcomingCount,
  groupsCount,
}: HomeTabTilesProps): React.JSX.Element {
  const t = useT();

  const isUpcoming = selectedTab === 'upcoming';
  const isGroups = selectedTab === 'groups';

  return (
    <View style={styles.row} accessibilityRole="tablist" testID="home-tab-tiles">
      {/* Upcoming games tab tile */}
      <Pressable
        accessibilityRole="tab"
        accessibilityLabel={`${t('mob.home.tab_upcoming')}, ${upcomingCount ?? 0} games, ${t('mob.home.tile_upcoming_sub')}`}
        accessibilityState={{ selected: isUpcoming }}
        onPress={() => onSelectTab('upcoming')}
        style={({ pressed }) => [
          styles.tile,
          isUpcoming ? styles.tileSelected : styles.tileIdle,
          pressed ? styles.pressed : null,
        ]}
        testID="tab-tile-upcoming"
      >
        <View style={styles.topRow}>
          <Text style={[styles.title, isUpcoming ? styles.titleSelected : null]}>
            {t('mob.home.tab_upcoming')}
          </Text>
          <Text style={[styles.count, isUpcoming ? styles.countSelected : null]}>
            {upcomingCount !== null ? upcomingCount : '—'}
          </Text>
        </View>
        <Text style={styles.subtitle}>{t('mob.home.tile_upcoming_sub')}</Text>
      </Pressable>

      {/* Your groups tab tile */}
      <Pressable
        accessibilityRole="tab"
        accessibilityLabel={`${t('mob.home.tab_groups')}, ${groupsCount ?? 0} groups, ${t('mob.home.tile_groups_sub')}`}
        accessibilityState={{ selected: isGroups }}
        onPress={() => onSelectTab('groups')}
        style={({ pressed }) => [
          styles.tile,
          isGroups ? styles.tileSelected : styles.tileIdle,
          pressed ? styles.pressed : null,
        ]}
        testID="tab-tile-groups"
      >
        <View style={styles.topRow}>
          <Text style={[styles.title, isGroups ? styles.titleSelected : null]}>
            {t('mob.home.tab_groups')}
          </Text>
          <Text style={[styles.count, isGroups ? styles.countSelected : null]}>
            {groupsCount !== null ? groupsCount : '—'}
          </Text>
        </View>
        <Text style={styles.subtitle}>{t('mob.home.tile_groups_sub')}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    marginHorizontal: spacing.md,
    gap: spacing.sm + 2,
    marginBottom: spacing.md,
  },
  tile: {
    flex: 1,
    minHeight: 74,
    borderRadius: dashRadius.tile,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    justifyContent: 'center',
  },
  tileIdle: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  tileSelected: {
    backgroundColor: '#eff6ff',
    borderWidth: 2,
    borderColor: dash.brand,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  title: {
    ...typography.bodyBold,
    color: colors.textPrimary,
    fontSize: 14,
  },
  titleSelected: {
    color: dash.brand,
  },
  count: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  countSelected: {
    color: dash.brand,
  },
  subtitle: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  pressed: {
    opacity: 0.8,
  },
});
