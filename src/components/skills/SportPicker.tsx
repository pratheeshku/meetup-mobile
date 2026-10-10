/**
 * Multi-select sport tiles, two columns: tinted circular sport icon, name and
 * a tick badge when selected. The icon comes from `icon_key` and the circle
 * colour from the API `color`. Pure presentation; selection is owned by
 * the caller. Each tile is a checkbox (checked state + name), so selection
 * never relies on colour alone.
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { SportIcon } from '../icons/DashboardIcons';
import { sportPalette } from '../../sports/style';
import { borderWidth, colors, opacity, radius, sizes, skillSizes, spacing, typography } from '../../theme/tokens';
import type { Sport } from '../../types/sport';

interface SportPickerProps {
  sports: readonly Sport[];
  /** Selected `Sport.name` values. */
  selected: readonly string[];
  onToggle: (name: string) => void;
  disabled?: boolean;
}

export default function SportPicker({
  sports,
  selected,
  onToggle,
  disabled = false,
}: SportPickerProps): React.JSX.Element {
  return (
    <View style={styles.grid}>
      {sports.map(sport => {
        const checked = selected.includes(sport.name);
        return (
          <Pressable
            key={sport.name}
            accessibilityRole="checkbox"
            accessibilityLabel={sport.display_name}
            accessibilityState={{ checked, disabled }}
            disabled={disabled}
            onPress={() => onToggle(sport.name)}
            style={({ pressed }) => [
              styles.tile,
              checked ? styles.tileChecked : null,
              pressed ? styles.pressed : null,
              disabled ? styles.disabled : null,
            ]}
          >
            <View style={[styles.circle, { backgroundColor: sportPalette(sport.color).chip }]}>
              <SportIcon iconKey={sport.icon_key} size={skillSizes.sportIcon} />
            </View>
            <Text style={styles.name} numberOfLines={2}>
              {sport.display_name}
            </Text>
            {checked ? (
              <View
                testID="sport-tick"
                style={styles.tick}
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
              >
                <Svg width={14} height={14} viewBox="0 0 24 24">
                  <Path
                    d="M5 12.5l4.5 4.5L19 7.5"
                    stroke={colors.white}
                    strokeWidth={3}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill="none"
                  />
                </Svg>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  tile: {
    width: '48%',
    minHeight: sizes.touchTarget,
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: borderWidth.thin,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    marginBottom: spacing.md,
  },
  tileChecked: { borderColor: colors.primary, borderWidth: borderWidth.thick },
  pressed: { opacity: opacity.pressed },
  disabled: { opacity: opacity.disabled },
  circle: {
    width: skillSizes.sportCircle,
    height: skillSizes.sportCircle,
    borderRadius: skillSizes.sportCircle / 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  name: { ...typography.bodyBold, color: colors.textPrimary, textAlign: 'center' },
  tick: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    width: skillSizes.tick,
    height: skillSizes.tick,
    borderRadius: skillSizes.tick / 2,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
