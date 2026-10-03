/**
 * One card per sport: sport icon + name, the segmented level control, and one
 * line below it — the selected level's descriptor, or the pick-a-level hint
 * when nothing is selected (`invalid` renders that hint in the error colour).
 * All text comes from `LabelsContext`.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { getLabel, useLabels } from '../../labels/LabelsContext';
import { SportIcon } from '../icons/DashboardIcons';
import { sportTileColor } from '../home/GameRow';
import { colors, radius, shadows, skillSizes, spacing, typography } from '../../theme/tokens';
import type { SkillLevelValue } from '../../types/user';
import LevelSegmentedControl from './LevelSegmentedControl';
import { levelDescKey } from './levels';

interface LevelPerSportCardProps {
  /** Sport key (`Sport.name`), also the icon/tint lookup. */
  sport: string;
  sportLabel: string;
  value: SkillLevelValue | null;
  onChange: (level: SkillLevelValue) => void;
  invalid?: boolean;
  disabled?: boolean;
}

export default function LevelPerSportCard({
  sport,
  sportLabel,
  value,
  onChange,
  invalid = false,
  disabled = false,
}: LevelPerSportCardProps): React.JSX.Element {
  const labels = useLabels();
  const line = value
    ? getLabel(labels, levelDescKey(value))
    : getLabel(labels, 'mob_skill_pick_level_hint');
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={[styles.circle, { backgroundColor: sportTileColor(sport) }]}>
          <SportIcon slug={sport} size={skillSizes.sportIconSmall} />
        </View>
        <Text style={styles.name} numberOfLines={1}>
          {sportLabel}
        </Text>
      </View>
      <LevelSegmentedControl
        value={value}
        onChange={onChange}
        sportLabel={sportLabel}
        disabled={disabled}
      />
      <Text
        style={[styles.line, !value && invalid ? styles.lineInvalid : null]}
        accessibilityLiveRegion="polite"
      >
        {line}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...shadows.card,
  },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md },
  circle: {
    width: skillSizes.sportCircleSmall,
    height: skillSizes.sportCircleSmall,
    borderRadius: skillSizes.sportCircleSmall / 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  name: { ...typography.h3, color: colors.textPrimary, flex: 1 },
  line: { ...typography.caption, color: colors.textSecondary, marginTop: spacing.sm },
  lineInvalid: { color: colors.error },
});
