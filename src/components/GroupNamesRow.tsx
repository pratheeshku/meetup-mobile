/**
 * Group row for game and tournament detail: one row per group (a 32dp icon box
 * with the groups icon, then the name). Takes a list so a future multi-group
 * game needs no UI rework; today it is given one name. Renders nothing for an
 * empty list.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { GroupsIcon } from './icons/SharedIcons';
import { colors, radius, spacing, typography } from '../theme/tokens';

interface GroupNamesRowProps {
  names: string[];
}

export default function GroupNamesRow({ names }: GroupNamesRowProps): React.JSX.Element | null {
  const shown = names.map(name => name.trim()).filter(name => name.length > 0);
  if (shown.length === 0) {
    return null;
  }
  return (
    <View testID="group-names-row">
      {shown.map(name => (
        <View key={name} style={styles.row} testID="group-name-item">
          <View style={styles.iconBox}>
            <GroupsIcon size={18} />
          </View>
          <Text style={styles.text} numberOfLines={1}>
            {name}
          </Text>
        </View>
      ))}
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
    width: 32,
    height: 32,
    borderRadius: radius.md,
    backgroundColor: colors.successLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { ...typography.bodyBold, color: colors.textPrimary, flex: 1 },
});
