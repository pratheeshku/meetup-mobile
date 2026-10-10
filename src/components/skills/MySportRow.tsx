/** Read-only "My sports" row: sport icon, name, level pill (dots + label), chevron. Tap opens the edit sheet. */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { getLabel, useLabels } from '../../labels/LabelsContext';
import { useSportDisplayName } from '../../utils/labels';
import { SportIcon } from '../icons/DashboardIcons';
import { sportPalette } from '../../sports/style';
import { useSportVisual } from '../../sports/catalog';
import { borderWidth, colors, opacity, sizes, skillSizes, spacing, typography } from '../../theme/tokens';
import LevelPill from './LevelPill';
import { levelLabelKey } from './levels';

interface MySportRowProps {
  /** Stored sport key (`Sport.name`). */
  sport: string;
  skillLevel: string;
  onPress: () => void;
}

export default function MySportRow({ sport, skillLevel, onPress }: MySportRowProps): React.JSX.Element {
  const labels = useLabels();
  const sportLabel = useSportDisplayName(sport);
  const visual = useSportVisual(sport);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${sportLabel}, ${getLabel(labels, levelLabelKey(skillLevel))}`}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed ? styles.pressed : null]}
    >
      <View style={[styles.circle, { backgroundColor: sportPalette(visual.color).chip }]}>
        <SportIcon iconKey={visual.iconKey} size={skillSizes.sportIconSmall} />
      </View>
      <Text style={styles.name} numberOfLines={1}>
        {sportLabel}
      </Text>
      <LevelPill level={skillLevel} />
      <Svg
        width={skillSizes.chevron}
        height={skillSizes.chevron}
        viewBox="0 0 24 24"
        style={styles.chevron}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <Path
          d="M9 5l7 7-7 7"
          stroke={colors.textMuted}
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </Svg>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: sizes.touchTarget,
    paddingVertical: spacing.sm,
    borderBottomWidth: borderWidth.thin,
    borderBottomColor: colors.border,
  },
  pressed: { opacity: opacity.pressed },
  circle: {
    width: skillSizes.sportCircleSmall,
    height: skillSizes.sportCircleSmall,
    borderRadius: skillSizes.sportCircleSmall / 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  name: { ...typography.body, color: colors.textPrimary, flex: 1, marginRight: spacing.sm },
  chevron: { marginLeft: spacing.sm },
});
