/**
 * Tab Tiles (Shuttlr Home v2).
 *
 * Requirements:
 * - Two tab tiles: "Upcoming games" (default selected) and "Your groups".
 * - On the two Home tab tiles show a coloured icon, 40px inside a 56px tinted rounded square
 *   (blue tint for Upcoming games, green tint for Your groups).
 * - Reuse the existing bottom-bar Groups icon asset for Your groups.
 * - For Upcoming games, add a coloured calendar icon in the same flat filled style
 *   as the bottom-bar icons (CalendarIcon).
 * - Selected has a border plus tint, accessibilityRole tab with selected state, no chevrons.
 * - Upcoming tile count = games in the next 7 days.
 * - Groups tile count = active groups.
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { GroupsIcon } from '../icons/DashboardIcons';
import { CalendarIcon } from '../icons/HomeV2Icons';
import { useT } from '../../labels/LabelsContext';
import { dashRadius } from '../../theme/dashboardTheme';
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
        <View style={styles.tileHeader}>
          <View style={[styles.iconBox, styles.iconBoxBlue]}>
            <CalendarIcon size={40} />
          </View>
          <Text style={[styles.count, isUpcoming ? styles.countSelected : null]}>
            {upcomingCount !== null ? upcomingCount : '—'}
          </Text>
        </View>
        <View style={styles.textContainer}>
          <Text style={[styles.title, isUpcoming ? styles.titleSelected : null]}>
            {t('mob.home.tab_upcoming')}
          </Text>
          <Text style={styles.subtitle}>{t('mob.home.tile_upcoming_sub')}</Text>
        </View>
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
        <View style={styles.tileHeader}>
          <View style={[styles.iconBox, styles.iconBoxGreen]}>
            <GroupsIcon size={40} />
          </View>
          <Text style={[styles.count, isGroups ? styles.countSelected : null]}>
            {groupsCount !== null ? groupsCount : '—'}
          </Text>
        </View>
        <View style={styles.textContainer}>
          <Text style={[styles.title, isGroups ? styles.titleSelected : null]}>
            {t('mob.home.tab_groups')}
          </Text>
          <Text style={styles.subtitle}>{t('mob.home.tile_groups_sub')}</Text>
        </View>
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
    minHeight: 116,
    borderRadius: dashRadius.tile,
    padding: spacing.sm + 2,
    justifyContent: 'space-between',
  },
  tileIdle: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#DCE3F0',
  },
  tileSelected: {
    backgroundColor: '#EEF3FF',
    borderWidth: 2,
    borderColor: '#1D4ED8',
  },
  tileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  iconBox: {
    width: 56,
    height: 56,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBoxBlue: {
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#dbeafe',
  },
  iconBoxGreen: {
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#d1fae5',
  },
  count: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  countSelected: {
    color: '#0B1B3F',
  },
  textContainer: {
    marginTop: spacing.xs + 2,
  },
  title: {
    ...typography.bodyBold,
    color: colors.textPrimary,
    fontSize: 14,
  },
  titleSelected: {
    color: '#0B1B3F',
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
