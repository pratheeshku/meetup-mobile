/**
 * Single-select 2x2 grid of skill-requirement pills for the create-game form
 * and the edit wizard. Row 1: All levels, Beginner. Row 2: Intermediate,
 * Advanced (`expert` on the wire). Purely presentational.
 */
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { useT } from '../labels/LabelsContext';
import { colors, radius, sizes, spacing, typography } from '../theme/tokens';
import type { EventSkillLevel } from '../types/event';
import { SKILL_REQUIREMENT_OPTIONS, skillRequirementLabelKey } from '../utils/skillRequirement';

interface SkillRequirementPickerProps {
  value: EventSkillLevel;
  onChange: (value: EventSkillLevel) => void;
}

export default function SkillRequirementPicker({
  value,
  onChange,
}: SkillRequirementPickerProps): React.JSX.Element {
  const t = useT();
  const rows = [SKILL_REQUIREMENT_OPTIONS.slice(0, 2), SKILL_REQUIREMENT_OPTIONS.slice(2, 4)];
  return (
    <View style={styles.grid} testID="skill-requirement-grid">
      {rows.map((row, index) => (
        <View key={index} style={styles.row} testID="skill-requirement-row">
          {row.map(level => {
            const selected = value === level;
            const label = t(skillRequirementLabelKey(level));
            return (
              <TouchableOpacity
                key={level}
                testID={`skill-requirement-${level}`}
                accessibilityRole="button"
                accessibilityLabel={label}
                accessibilityState={{ selected }}
                style={[styles.pill, selected && styles.pillSelected]}
                onPress={() => onChange(level)}
              >
                <Text style={[styles.pillText, selected && styles.pillTextSelected]}>{label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    gap: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  pill: {
    flex: 1,
    height: sizes.controlSmall,
    borderRadius: radius.md,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillSelected: {
    backgroundColor: colors.primary,
  },
  pillText: {
    ...typography.caption,
    fontWeight: '600',
    color: colors.primaryDark,
  },
  pillTextSelected: {
    color: colors.white,
  },
});
