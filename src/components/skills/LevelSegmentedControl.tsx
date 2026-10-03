/**
 * Three-segment single-select level control. Each segment shows 1/2/3 dots
 * above the level label; the selected segment is tinted and outlined in the
 * level colour. Segments are radios whose accessibility label names the sport
 * and the level. No default: `value === null` leaves every segment unselected.
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { getLabel, useLabels } from '../../labels/LabelsContext';
import { borderWidth, colors, opacity, radius, skillSizes, spacing, typography } from '../../theme/tokens';
import type { SkillLevelValue } from '../../types/user';
import LevelDots from './LevelDots';
import { SKILL_LEVEL_ORDER, levelLabelKey, levelTint } from './levels';

interface LevelSegmentedControlProps {
  value: SkillLevelValue | null;
  onChange: (level: SkillLevelValue) => void;
  /** Display name of the sport, used in each segment's accessibility label. */
  sportLabel: string;
  disabled?: boolean;
}

export default function LevelSegmentedControl({
  value,
  onChange,
  sportLabel,
  disabled = false,
}: LevelSegmentedControlProps): React.JSX.Element {
  const labels = useLabels();
  return (
    <View style={styles.row} accessibilityRole="radiogroup">
      {SKILL_LEVEL_ORDER.map((level, index) => {
        const selected = value === level;
        const tint = levelTint(level);
        const levelLabel = getLabel(labels, levelLabelKey(level));
        return (
          <Pressable
            key={level}
            accessibilityRole="radio"
            accessibilityLabel={`${sportLabel}, ${levelLabel}`}
            accessibilityState={{ selected, checked: selected, disabled }}
            disabled={disabled}
            onPress={() => onChange(level)}
            style={[
              styles.segment,
              index > 0 ? styles.segmentGap : null,
              selected ? { backgroundColor: tint.bg, borderColor: tint.border, borderWidth: borderWidth.thick } : null,
              disabled ? styles.disabled : null,
            ]}
          >
            <LevelDots level={level} />
            <Text
              style={[styles.label, { color: selected ? tint.text : colors.textSecondary }]}
              numberOfLines={1}
            >
              {levelLabel}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row' },
  segment: {
    flex: 1,
    minHeight: skillSizes.segmentMinHeight,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: borderWidth.thin,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.xs,
  },
  segmentGap: { marginLeft: spacing.sm },
  label: { ...typography.bodyBold, marginTop: spacing.xs },
  disabled: { opacity: opacity.disabled },
});
