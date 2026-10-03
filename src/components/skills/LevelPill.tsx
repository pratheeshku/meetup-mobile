/** Read-only level pill: dots + label in the level's tint (colour is never the only signal). */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { getLabel, useLabels } from '../../labels/LabelsContext';
import { borderWidth, radius, spacing, typography } from '../../theme/tokens';
import LevelDots from './LevelDots';
import { levelLabelKey, levelTint } from './levels';

export default function LevelPill({ level }: { level: string }): React.JSX.Element {
  const labels = useLabels();
  const tint = levelTint(level);
  return (
    <View style={[styles.pill, { backgroundColor: tint.bg, borderColor: tint.border }]}>
      <LevelDots level={level} />
      <Text style={[styles.text, { color: tint.text }]}>{getLabel(labels, levelLabelKey(level))}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: borderWidth.thin,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  text: { ...typography.label, marginLeft: spacing.xs },
});
