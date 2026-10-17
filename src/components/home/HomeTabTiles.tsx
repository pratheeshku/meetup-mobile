/**
 * Home folder-style tabs (Shuttlr Home v2): "Upcoming games" and "My groups".
 * The two icon tiles ARE the tabs. Tapping one switches the list below in
 * place (state only; no navigation, no refetch). The active tab is taller,
 * takes the panel's tint and border, has no bottom border and overlaps the
 * panel's top border by one border width so it opens into the panel
 * (`HomePanel`, same file group). Sizes are fixed: no content-driven sizing.
 * Android: the overlap is a negative margin plus zIndex with elevation 0.
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { GroupsIcon } from '../icons/DashboardIcons';
import { CalendarIcon } from '../icons/HomeV2Icons';
import { useT } from '../../labels/LabelsContext';
import { dash } from '../../theme/dashboardTheme';
import { borderWidth, colors, radius } from '../../theme/tokens';

export type HomeTab = 'upcoming' | 'groups';

export const TAB_ACTIVE_HEIGHT = 104;
export const TAB_IDLE_HEIGHT = 92;
export const PANEL_RADIUS = 18;
const ICON_BOX = 40;
const FONT_CAP = 1.15;

interface HomeTabTilesProps {
  selectedTab: HomeTab;
  onSelectTab: (tab: HomeTab) => void;
  upcomingCount: number | null;
  groupsCount: number | null;
}

interface TabProps {
  testID: string;
  selected: boolean;
  onPress: () => void;
  icon: React.ReactNode;
  iconBg: string;
  count: number | null;
  title: string;
  subtitle: string;
}

function Tab({ testID, selected, onPress, icon, iconBg, count, title, subtitle }: TabProps): React.JSX.Element {
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityLabel={`${title}, ${count ?? 0}, ${subtitle}`}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.tab, selected ? styles.tabActive : styles.tabIdle]}
      testID={testID}
    >
      <View style={styles.header}>
        <View style={[styles.iconBox, { backgroundColor: iconBg }]}>{icon}</View>
        <Text style={styles.count} maxFontSizeMultiplier={FONT_CAP} numberOfLines={1}>
          {count !== null ? count : '—'}
        </Text>
      </View>
      <Text style={styles.title} numberOfLines={1} maxFontSizeMultiplier={FONT_CAP}>
        {title}
      </Text>
      <Text style={styles.subtitle} numberOfLines={1} maxFontSizeMultiplier={FONT_CAP}>
        {subtitle}
      </Text>
    </Pressable>
  );
}

export default function HomeTabTiles({
  selectedTab,
  onSelectTab,
  upcomingCount,
  groupsCount,
}: HomeTabTilesProps): React.JSX.Element {
  const t = useT();

  return (
    <View style={styles.row} accessibilityRole="tablist" testID="home-tab-tiles">
      <Tab
        testID="tab-tile-upcoming"
        selected={selectedTab === 'upcoming'}
        onPress={() => onSelectTab('upcoming')}
        icon={<CalendarIcon size={28} />}
        iconBg={colors.primaryLight}
        count={upcomingCount}
        title={t('mob.home.tab_upcoming')}
        subtitle={t('mob.home.tile_upcoming_sub')}
      />
      <Tab
        testID="tab-tile-groups"
        selected={selectedTab === 'groups'}
        onPress={() => onSelectTab('groups')}
        icon={<GroupsIcon size={28} />}
        iconBg={colors.successLight}
        count={groupsCount}
        title={t('mob.home.tab_groups')}
        subtitle={t('mob.home.tile_groups_sub')}
      />
    </View>
  );
}

/** Panel container: square top corner under the active tab, rounded elsewhere. */
export function panelStyle(selectedTab: HomeTab): object[] {
  return [styles.panel, selectedTab === 'upcoming' ? styles.panelFlatLeft : styles.panelFlatRight];
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 4,
    marginTop: 12,
    marginHorizontal: 16,
    zIndex: 2,
  },
  tab: {
    flex: 1,
    borderWidth: borderWidth.medium,
    borderBottomWidth: 0,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    paddingTop: 11,
    paddingHorizontal: 12,
    paddingBottom: 10,
    overflow: 'hidden',
  },
  tabActive: {
    height: TAB_ACTIVE_HEIGHT,
    backgroundColor: dash.page,
    borderColor: dash.panelBorder,
    marginBottom: -borderWidth.medium,
    zIndex: 2,
    elevation: 0,
  },
  tabIdle: {
    height: TAB_IDLE_HEIGHT,
    backgroundColor: dash.tabIdleBg,
    borderColor: dash.tabIdleBorder,
  },
  header: {
    height: ICON_BOX,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  iconBox: {
    width: ICON_BOX,
    height: ICON_BOX,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  count: {
    fontSize: 22,
    fontWeight: '800',
    lineHeight: 26,
    color: colors.textPrimary,
  },
  title: {
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 17,
    color: colors.textPrimary,
  },
  subtitle: {
    fontSize: 11.5,
    lineHeight: 14,
    color: colors.textSecondary,
  },
  panel: {
    marginHorizontal: 16,
    marginTop: 0,
    padding: 10,
    backgroundColor: dash.page,
    borderWidth: borderWidth.medium,
    borderColor: dash.panelBorder,
    borderRadius: PANEL_RADIUS,
    zIndex: 1,
    elevation: 0,
  },
  panelFlatLeft: { borderTopLeftRadius: 0 },
  panelFlatRight: { borderTopRightRadius: 0 },
});
