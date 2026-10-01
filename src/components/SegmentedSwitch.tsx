/**
 * Two-or-more option segmented switch (DES-MEETUP-ADDENDUM-dashboard.md
 * AD-15 "Games | Tournaments"). Buttons with a selected state; 44px targets.
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { dash, dashRadius, dashSize } from '../theme/dashboardTheme';
import { spacing, typography } from '../theme/tokens';

interface SegmentedSwitchProps<T extends string> {
  options: ReadonlyArray<{ value: T; label: string }>;
  value: T;
  onChange: (value: T) => void;
}

export default function SegmentedSwitch<T extends string>({
  options,
  value,
  onChange,
}: SegmentedSwitchProps<T>): React.JSX.Element {
  return (
    <View style={styles.track} accessibilityRole="tablist">
      {options.map(option => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="tab"
            accessibilityLabel={option.label}
            accessibilityState={{ selected }}
            onPress={() => onChange(option.value)}
            style={({ pressed }) => [
              styles.segment,
              selected ? styles.segmentSelected : null,
              pressed ? styles.pressed : null,
            ]}
          >
            <Text style={[styles.label, selected ? styles.labelSelected : null]}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    backgroundColor: dash.cardBorder,
    borderRadius: dashRadius.chip,
    padding: 3,
  },
  segment: {
    flex: 1,
    minHeight: dashSize.touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: dashRadius.chip - 3,
  },
  segmentSelected: { backgroundColor: dash.card },
  pressed: { opacity: 0.8 },
  label: { ...typography.bodyBold, color: dash.textMuted, paddingHorizontal: spacing.sm },
  labelSelected: { color: dash.brand },
});
