/**
 * Home stats strip: ONE card (fixed height 56) with four equal cells in this
 * order: Played, Won, Hosted, Groups. Each cell is [28dp icon badge] +
 * [value over label]; cells are separated by 1 x 26dp divider lines.
 * Missing, null or NaN values show 0 (Won included): no spinner, dash or NaN.
 * Sizes are fixed (no content-driven sizing); text is one line and fits
 * its cell, including at a 1.3 system font scale on a 360dp phone.
 *
 * priority1-nov23 P1-03: when the screen passes a handler, a cell is a button (Played, Won and Hosted open their game
 * lists, Groups opens the Groups screen). Without a handler the cell stays plain, as before.
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import IconBadge from './IconBadge';
import { MedalIcon, PeopleIcon, StarIcon, TrophyIcon } from './icons/SharedIcons';
import { useT } from '../labels/LabelsContext';
import { borderWidth, colors, radius } from '../theme/tokens';

export interface ProfileStatsStripProps {
  gamesPlayed?: number | null;
  gamesHosted?: number | null;
  groupsCount?: number | null;
  gamesWon?: number | null;
  onPressPlayed?: () => void;
  onPressWon?: () => void;
  onPressHosted?: () => void;
  onPressGroups?: () => void;
}

const STRIP_HEIGHT = 56;
const BADGE_SIZE = 28;
const GLYPH_SIZE = 15;
const DIVIDER_HEIGHT = 26;
const FIT_MIN_SCALE = 0.75;

const count = (value: number | null | undefined): number =>
  typeof value === 'number' && !Number.isNaN(value) ? value : 0;

interface CellProps {
  testID: string;
  badge: 'blue' | 'purple' | 'amber' | 'green';
  glyph: React.ReactNode;
  value: number;
  valueColor: string;
  label: string;
  onPress?: () => void;
}

function Cell({ testID, badge, glyph, value, valueColor, label, onPress }: CellProps): React.JSX.Element {
  const t = useT();
  const content = (
    <>
      <IconBadge color={badge} size={BADGE_SIZE} borderRadius={BADGE_SIZE / 2}>
        {glyph}
      </IconBadge>
      <View style={styles.textStack}>
        <Text
          style={[styles.value, { color: valueColor }]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={FIT_MIN_SCALE}
        >
          {value}
        </Text>
        <Text
          style={styles.label}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={FIT_MIN_SCALE}
        >
          {label}
        </Text>
      </View>
    </>
  );
  if (!onPress) {
    return (
      <View style={styles.cell} testID={testID}>
        {content}
      </View>
    );
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('mob.stats.open_a11y', { label, count: value })}
      onPress={onPress}
      style={({ pressed }) => [styles.cell, pressed ? styles.pressed : null]}
      testID={testID}
    >
      {content}
    </Pressable>
  );
}

const Divider = (): React.JSX.Element => <View style={styles.divider} />;

export default function ProfileStatsStrip({
  gamesPlayed,
  gamesHosted,
  groupsCount,
  gamesWon,
  onPressPlayed,
  onPressWon,
  onPressHosted,
  onPressGroups,
}: ProfileStatsStripProps): React.JSX.Element {
  const t = useT();

  return (
    <View style={styles.container} testID="profile-stats-strip">
      <Cell
        testID="profile-stat-played"
        onPress={onPressPlayed}
        badge="blue"
        glyph={<TrophyIcon size={GLYPH_SIZE} />}
        value={count(gamesPlayed)}
        valueColor={colors.primary}
        label={t('mob.profile.stat_played')}
      />
      <Divider />
      <Cell
        testID="profile-stat-won"
        onPress={onPressWon}
        badge="purple"
        glyph={<MedalIcon size={GLYPH_SIZE} />}
        value={count(gamesWon)}
        valueColor={colors.accentPurple}
        label={t('mob.profile.stat_won')}
      />
      <Divider />
      <Cell
        testID="profile-stat-hosted"
        onPress={onPressHosted}
        badge="amber"
        glyph={<StarIcon size={GLYPH_SIZE} />}
        value={count(gamesHosted)}
        valueColor={colors.warningDark}
        label={t('mob.profile.stat_hosted')}
      />
      <Divider />
      <Cell
        testID="profile-stat-groups"
        onPress={onPressGroups}
        badge="green"
        glyph={<PeopleIcon size={GLYPH_SIZE} />}
        value={count(groupsCount)}
        valueColor={colors.successDark}
        label={t('mob.profile.stat_groups')}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: STRIP_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: borderWidth.medium,
    borderColor: colors.border,
    borderRadius: radius.lg,
  },
  cell: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  pressed: { opacity: 0.7 },
  textStack: {
    flexShrink: 1,
    minWidth: 0,
  },
  value: {
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 18,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    lineHeight: 13,
    color: colors.textSecondary,
  },
  divider: {
    width: borderWidth.thin,
    height: DIVIDER_HEIGHT,
    backgroundColor: colors.border,
  },
});
