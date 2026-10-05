/**
 * Group row (AD-8): a Players Group shows the groups icon (groups have no
 * sport); a Tournament Team shows its sport icon. Meta shows the member
 * count when known, plus the sport only for teams. Tap opens the group.
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { GroupsIcon, SportIcon } from '../icons/DashboardIcons';
import { dash, dashRadius, dashSize } from '../../theme/dashboardTheme';
import { spacing, typography } from '../../theme/tokens';
import type { Group } from '../../types/group';
import { sportTileColor } from './GameRow';
import { useT } from '../../labels/LabelsContext';

interface GroupRowProps {
  group: Group;
  onPress: () => void;
  /** Present only for a Tournament Team: its sport slug and display name. */
  team?: { sportSlug: string; sportName: string };
}

export default function GroupRow({ group, onPress, team }: GroupRowProps): React.JSX.Element {
  const t = useT();
  const metaParts: string[] = [];
  if (typeof group.member_count === 'number') {
    metaParts.push(
      t(group.member_count === 1 ? 'mob.group_card.members_one' : 'mob.group_card.members_other', {
        count: group.member_count,
      }),
    );
  }
  if (team) {
    metaParts.push(team.sportName);
  }
  const meta = metaParts.join(' · ');

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={meta ? `${group.name}, ${meta}` : group.name}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed ? styles.pressed : null]}
    >
      <View
        style={[
          styles.tile,
          { backgroundColor: team ? sportTileColor(team.sportSlug) : dash.page },
        ]}
      >
        {team ? (
          <SportIcon slug={team.sportSlug} size={dashSize.rowIcon} />
        ) : (
          <GroupsIcon size={dashSize.rowIcon} />
        )}
      </View>
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={1}>
          {group.name}
        </Text>
        {meta ? <Text style={styles.meta}>{meta}</Text> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: dashSize.touchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: dash.card,
    borderRadius: dashRadius.card,
    borderWidth: 1,
    borderColor: dash.cardBorder,
    padding: spacing.sm + 2,
    marginBottom: spacing.sm,
  },
  pressed: { opacity: 0.85 },
  tile: {
    width: dashSize.rowIconTile,
    height: dashSize.rowIconTile,
    borderRadius: dashRadius.rowTile,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1, marginLeft: spacing.sm + 2 },
  title: { ...typography.bodyBold, color: dash.text },
  meta: { ...typography.caption, color: dash.textMuted, marginTop: 2 },
});
