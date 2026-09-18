/**
 * Horizontally scrollable sport filter row: "All" first, then one pill per
 * sport (emoji + name). Purely presentational — the selected key and the
 * option list are owned by the screen. `selectedKey === null` means "All".
 *
 * The row is full-bleed (no horizontal padding on the ScrollView itself);
 * the inset lives in `contentContainerStyle` so pills scroll to the screen
 * edge instead of being clipped at the page gutter.
 */
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';

import { borderWidth, colors, opacity, radius, sizes, spacing, typography } from '../../theme/tokens';
import type { SportOption } from '../../utils/homeDashboard';

interface SportFilterPillsProps {
  sports: SportOption[];
  selectedKey: string | null;
  onSelect: (sportKey: string | null) => void;
}

interface FilterPillProps {
  label: string;
  /** Plain-text label for screen readers (the visible one carries an emoji). */
  accessibilityLabel: string;
  selected: boolean;
  onPress: () => void;
}

function FilterPill({
  label,
  accessibilityLabel,
  selected,
  onPress,
}: FilterPillProps): React.JSX.Element {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.pill,
        selected ? styles.pillSelected : styles.pillIdle,
        pressed ? styles.pressed : null,
      ]}
    >
      <Text style={[typography.bodyBold, selected ? styles.textSelected : styles.textIdle]}>
        {label}
      </Text>
    </Pressable>
  );
}

export default function SportFilterPills({
  sports,
  selectedKey,
  onSelect,
}: SportFilterPillsProps): React.JSX.Element {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
    >
      <FilterPill
        label="All"
        accessibilityLabel="All sports"
        selected={selectedKey === null}
        onPress={() => onSelect(null)}
      />
      {sports.map(sport => (
        <FilterPill
          key={sport.key}
          label={`${sport.emoji} ${sport.label}`}
          accessibilityLabel={sport.label}
          selected={selectedKey === sport.key}
          onPress={() => onSelect(sport.key)}
        />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { paddingHorizontal: spacing.md, gap: spacing.sm },
  pill: {
    minHeight: sizes.controlSmall,
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
    borderWidth: borderWidth.thin,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  pillIdle: { backgroundColor: colors.surface, borderColor: colors.border },
  pressed: { opacity: opacity.pressed },
  textSelected: { color: colors.white },
  textIdle: { color: colors.textSecondary },
});
