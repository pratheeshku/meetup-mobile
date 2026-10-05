/**
 * Sports row (DES-MEETUP-ADDENDUM-dashboard.md AD-9, §4): multi-select tiles
 * (60x60, radius 20, icon 38, label 11), "All" first. Pure presentation — the
 * selection state lives in `useSportFilter`.
 *
 * Layout: a horizontal ScrollView whose content container has
 * `flexGrow: 1` + `justifyContent: 'space-between'`. When the chips fit they
 * spread across the full section width (first at the left edge, last at the
 * right edge); when they do not fit the content grows past the viewport and
 * the row scrolls horizontally.
 *
 * Chips are buttons with a pressed state; a selected chip has a 2px brand
 * ring.
 */
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AllSportsIcon, SportIcon } from '../icons/DashboardIcons';
import { dash, dashRadius, dashSize, sportTileColors } from '../../theme/dashboardTheme';
import { spacing } from '../../theme/tokens';
import type { SportOption } from '../../utils/gameLists';
import { sportTileColor } from './GameRow';
import { useT } from '../../labels/LabelsContext';

interface SportChipsRowProps {
  options: readonly SportOption[];
  /** Selected sport keys; `[]` = All. */
  selected: readonly string[];
  onToggle: (key: string | null) => void;
  /** Admin sports list is still loading. */
  isLoading?: boolean;
}

function Chip({
  label,
  selected,
  onPress,
  tileColor,
  children,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  tileColor: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [styles.chip, pressed ? styles.pressed : null]}
    >
      <View
        testID={selected ? 'sport-chip-ring' : undefined}
        style={[
          styles.tile,
          { backgroundColor: tileColor },
          selected ? styles.tileSelected : styles.tileIdle,
        ]}
      >
        {children}
      </View>
      <Text style={[styles.label, selected ? styles.labelSelected : null]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

export default function SportChipsRow({
  options,
  selected,
  onToggle,
  isLoading = false,
}: SportChipsRowProps): React.JSX.Element {
  const t = useT();
  if (isLoading) {
    return (
      <View style={styles.skeletonRow} testID="sport-chips-loading" accessibilityLabel={t('mob.dashboard.sports_loading')}>
        {Array.from({ length: 4 }, (_, index) => (
          <View key={index} style={styles.skeletonTile} />
        ))}
      </View>
    );
  }

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      testID="sport-chips-scroll"
      contentContainerStyle={styles.content}
    >
      <Chip
        label={t('mob.dashboard.sports_all')}
        selected={selected.length === 0}
        onPress={() => onToggle(null)}
        tileColor={sportTileColors.all}
      >
        <AllSportsIcon size={dashSize.sportIcon} />
      </Chip>
      {options.map(option => (
        <Chip
          key={option.key}
          label={option.label}
          selected={selected.includes(option.key)}
          onPress={() => onToggle(option.key)}
          tileColor={sportTileColor(option.slug)}
        >
          <SportIcon slug={option.slug} size={dashSize.sportIcon} />
        </Chip>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    justifyContent: 'space-between',
    // Minimum spacing when the row has to scroll.
    columnGap: spacing.sm,
  },
  chip: {
    minWidth: dashSize.sportTile,
    minHeight: dashSize.touchTarget,
    alignItems: 'center',
  },
  pressed: { opacity: 0.7 },
  tile: {
    width: dashSize.sportTile,
    height: dashSize.sportTile,
    borderRadius: dashRadius.sportTile,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileIdle: { borderWidth: dashSize.chipRing, borderColor: 'transparent' },
  tileSelected: { borderWidth: dashSize.chipRing, borderColor: dash.brand },
  label: {
    fontSize: dashSize.sportLabel,
    color: dash.textMuted,
    marginTop: spacing.xs,
    maxWidth: dashSize.sportTile + spacing.sm,
  },
  labelSelected: { color: dash.brand, fontWeight: '700' },
  skeletonRow: { flexDirection: 'row', justifyContent: 'space-between' },
  skeletonTile: {
    width: dashSize.sportTile,
    height: dashSize.sportTile,
    borderRadius: dashRadius.sportTile,
    backgroundColor: dash.skeleton,
  },
});
