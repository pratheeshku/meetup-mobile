/**
 * Group rows for game and tournament detail and the create summary: one row per
 * group (a 32dp icon box with the groups icon, then the name). A game can be
 * shared with many groups, so only the first `MAX_VISIBLE_GROUP_NAMES` rows show,
 * followed by a "+n more" line. Renders nothing for an empty list.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { GroupsIcon } from './icons/SharedIcons';
import { useT } from '../labels/LabelsContext';
import { colors, radius, spacing, typography } from '../theme/tokens';

export const MAX_VISIBLE_GROUP_NAMES = 3;
const ICON_BOX = 32;

interface GroupNamesRowProps {
  names: string[];
}

export default function GroupNamesRow({ names }: GroupNamesRowProps): React.JSX.Element | null {
  const t = useT();
  const all = names.map(name => name.trim()).filter(name => name.length > 0);
  if (all.length === 0) {
    return null;
  }
  const shown = all.slice(0, MAX_VISIBLE_GROUP_NAMES);
  const hidden = all.length - shown.length;
  return (
    <View testID="group-names-row">
      {shown.map((name, index) => (
        <View key={`${index}-${name}`} style={styles.row} testID="group-name-item">
          <View style={styles.iconBox}>
            <GroupsIcon size={18} />
          </View>
          <Text style={styles.text} numberOfLines={1}>
            {name}
          </Text>
        </View>
      ))}
      {hidden > 0 ? (
        <Text style={styles.more} testID="group-names-more">
          {t('mob.group_names.more', { count: hidden })}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.xs,
  },
  iconBox: {
    width: ICON_BOX,
    height: ICON_BOX,
    borderRadius: radius.md,
    backgroundColor: colors.successLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { ...typography.bodyBold, color: colors.textPrimary, flex: 1 },
  more: {
    ...typography.caption,
    color: colors.textSecondary,
    paddingLeft: ICON_BOX + spacing.md,
  },
});
