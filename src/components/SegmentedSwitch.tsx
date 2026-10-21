/**
 * Two-or-more option segmented switch (DES-MEETUP-ADDENDUM-dashboard.md
 * AD-15 "Games | Tournaments"). Buttons with a selected state; 44px targets.
 *
 * `compact` (game-view-redesign GV-1): the small right-aligned switch of the Games list
 * scope row. Segments show `shortLabel` when given; the accessible name stays the full
 * `label`. The touch target stays 44px high.
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { dash, dashRadius, dashSize } from '../theme/dashboardTheme';
import { spacing, typography } from '../theme/tokens';

interface SegmentedSwitchProps<T extends string> {
  options: ReadonlyArray<{ value: T; label: string; shortLabel?: string }>;
  value: T;
  onChange: (value: T) => void;
  compact?: boolean;
}

export default function SegmentedSwitch<T extends string>({
  options,
  value,
  onChange,
  compact = false,
}: SegmentedSwitchProps<T>): React.JSX.Element {
  return (
    <View style={[styles.track, compact ? styles.trackCompact : null]} accessibilityRole="tablist">
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
              compact ? styles.segmentCompact : null,
              selected ? styles.segmentSelected : null,
              pressed ? styles.pressed : null,
            ]}
          >
            <Text
              style={[
                styles.label,
                compact ? styles.labelCompact : null,
                selected ? styles.labelSelected : null,
              ]}
            >
              {compact && option.shortLabel ? option.shortLabel : option.label}
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
  trackCompact: { alignSelf: 'flex-end' },
  segmentCompact: { flex: 0, paddingHorizontal: spacing.xs },
  segmentSelected: { backgroundColor: dash.card },
  pressed: { opacity: 0.8 },
  label: { ...typography.bodyBold, color: dash.textMuted, paddingHorizontal: spacing.sm },
  labelCompact: { ...typography.caption, fontWeight: '700', paddingHorizontal: spacing.xs },
  labelSelected: { color: dash.brand },
});
