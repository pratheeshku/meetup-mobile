/**
 * Two shortcut tiles (DES-MEETUP-ADDENDUM-dashboard.md §4): My games
 * ("{n} active", gamepad icon) and My groups ("{n} groups", groups icon).
 * Counts are never filtered by the sport chips. When a count's source
 * failed (`null`) the count text is dropped rather than showing a wrong 0.
 * No Tournaments tile (AD-5).
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { GamesIcon, GroupsIcon } from '../icons/DashboardIcons';
import { dash, dashRadius, dashSize } from '../../theme/dashboardTheme';
import { spacing, typography } from '../../theme/tokens';
import { useT } from '../../labels/LabelsContext';

interface ShortcutTilesProps {
  /** `null` = the games request failed / not loaded. */
  gamesCount: number | null;
  /** `null` = the groups request failed / not loaded. */
  groupsCount: number | null;
  onPressGames: () => void;
  onPressGroups: () => void;
}

function Tile({
  title,
  subtitle,
  onPress,
  children,
}: {
  title: string;
  subtitle: string;
  onPress: () => void;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={subtitle ? `${title}, ${subtitle}` : title}
      onPress={onPress}
      style={({ pressed }) => [styles.tile, pressed ? styles.pressed : null]}
    >
      {children}
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </Pressable>
  );
}

export default function ShortcutTiles({
  gamesCount,
  groupsCount,
  onPressGames,
  onPressGroups,
}: ShortcutTilesProps): React.JSX.Element {
  const t = useT();
  return (
    <View style={styles.row}>
      <Tile
        title={t('mob.dashboard.my_games')}
        subtitle={gamesCount === null ? '' : t('mob.shortcuts.games_active', { count: gamesCount })}
        onPress={onPressGames}
      >
        <GamesIcon size={dashSize.sportIcon} />
      </Tile>
      <Tile
        title={t('mob.dashboard.my_groups')}
        subtitle={
          groupsCount === null
            ? ''
            : t(groupsCount === 1 ? 'mob.shortcuts.groups_one' : 'mob.shortcuts.groups_other', {
                count: groupsCount,
              })
        }
        onPress={onPressGroups}
      >
        <GroupsIcon size={dashSize.sportIcon} />
      </Tile>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.md },
  tile: {
    flex: 1,
    minHeight: dashSize.touchTarget,
    backgroundColor: dash.card,
    borderRadius: dashRadius.tile,
    borderWidth: 1,
    borderColor: dash.cardBorder,
    padding: spacing.md,
  },
  pressed: { opacity: 0.85 },
  title: { ...typography.bodyBold, color: dash.text, marginTop: spacing.sm },
  subtitle: { ...typography.caption, color: dash.textMuted, marginTop: 2 },
});
