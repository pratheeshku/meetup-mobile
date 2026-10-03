/** 1/2/3 filled dots for a level; decorative (the level label is always shown beside it). */
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { levelDotEmpty, skillSizes, spacing } from '../../theme/tokens';
import { SKILL_LEVEL_ORDER, levelDotCount, levelTint } from './levels';

export default function LevelDots({ level }: { level: string }): React.JSX.Element {
  const filled = levelDotCount(level);
  const fill = levelTint(level).border;
  return (
    <View
      style={styles.row}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {SKILL_LEVEL_ORDER.map((_, index) => (
        <View
          key={index}
          testID={index < filled ? 'level-dot-filled' : 'level-dot-empty'}
          style={[styles.dot, { backgroundColor: index < filled ? fill : levelDotEmpty }]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  dot: {
    width: skillSizes.dot,
    height: skillSizes.dot,
    borderRadius: skillSizes.dot / 2,
    marginHorizontal: spacing.xs / 2,
  },
});
