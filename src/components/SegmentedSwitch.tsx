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

import { focusRingStyle, useAccessibilityFocus } from '../hooks/useAccessibilityFocus';
import { dash, dashRadius, dashSize } from '../theme/dashboardTheme';
import { spacing, typography } from '../theme/tokens';

interface SegmentedSwitchProps<T extends string> {
  options: ReadonlyArray<{ value: T; label: string; shortLabel?: string; badge?: number; badgeLabel?: string }>;
  value: T;
  onChange: (value: T) => void;
  compact?: boolean;
  /** A new non-zero value moves focus to the selected segment (ring and screen reader) without changing it (te-a4). */
  focusToken?: number;
}

export default function SegmentedSwitch<T extends string>({
  options,
  value,
  onChange,
  compact = false,
  focusToken,
}: SegmentedSwitchProps<T>): React.JSX.Element {
  const focus = useAccessibilityFocus(focusToken);
  return (
    <View style={[styles.track, compact ? styles.trackCompact : null]} accessibilityRole="tablist">
      {options.map(option => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            ref={selected ? focus.ref : undefined}
            onBlur={selected ? focus.clear : undefined}
            accessibilityRole="tab"
            accessibilityLabel={option.badge && option.badge > 0 && option.badgeLabel ? `${option.label}, ${option.badgeLabel}` : option.label}
            accessibilityState={{ selected }}
            onPress={() => onChange(option.value)}
            style={({ pressed }) => [
              styles.segment,
              compact ? styles.segmentCompact : null,
              selected ? styles.segmentSelected : null,
              pressed ? styles.pressed : null,
              selected && focus.ringed ? focusRingStyle : null,
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
            {option.badge && option.badge > 0 ? (
              <View style={styles.badge} testID={`segment-badge-${option.value}`}>
                <Text style={styles.badgeText}>{option.badge}</Text>
              </View>
            ) : null}
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
  badge: {
    position: 'absolute',
    top: 2,
    right: 2,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: dashRadius.circle,
    backgroundColor: dash.badgeRed,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { ...typography.label, fontSize: 11, color: dash.white, lineHeight: 14 },
  label: { ...typography.bodyBold, color: dash.textMuted, paddingHorizontal: spacing.sm },
  labelCompact: { ...typography.caption, fontWeight: '700', paddingHorizontal: spacing.xs },
  labelSelected: { color: dash.brand },
});
