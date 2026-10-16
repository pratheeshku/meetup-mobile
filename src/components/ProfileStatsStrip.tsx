/**
 * Stats strip (Played, Hosted, Groups, plus Won when `gamesWon` > 0).
 * Shared by the Home dashboard; each column is `flex: 1`, so 3 and 4 tiles
 * both fill the card evenly. Icon badges are fixed-size boxes.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import IconBadge from './IconBadge';
import { MedalIcon, PeopleIcon, StarIcon, TrophyIcon } from './icons/SharedIcons';
import { useT } from '../labels/LabelsContext';
import { borderWidth, colors, radius, spacing, typography } from '../theme/tokens';

export interface ProfileStatsStripProps {
  gamesPlayed: number;
  gamesHosted: number;
  groupsCount: number;
  /** Fourth tile renders only when this is a number greater than 0. */
  gamesWon?: number | null;
}

export default function ProfileStatsStrip({
  gamesPlayed,
  gamesHosted,
  groupsCount,
  gamesWon,
}: ProfileStatsStripProps): React.JSX.Element {
  const t = useT();
  const showWon = typeof gamesWon === 'number' && gamesWon > 0;

  return (
    <View style={styles.statsCard} testID="profile-stats-strip">
      <View style={styles.statColumn}>
        <IconBadge color="blue" size={36} borderRadius={18}>
          <TrophyIcon size={18} />
        </IconBadge>
        <Text style={[styles.statNumber, { color: colors.primary }]}>{gamesPlayed}</Text>
        <Text style={styles.statLabel}>{t('mob.profile.stat_played')}</Text>
      </View>

      <View style={styles.statDivider} />

      <View style={styles.statColumn}>
        <IconBadge color="amber" size={36} borderRadius={18}>
          <StarIcon size={18} />
        </IconBadge>
        <Text style={[styles.statNumber, { color: colors.warning }]}>{gamesHosted}</Text>
        <Text style={styles.statLabel}>{t('mob.profile.stat_hosted')}</Text>
      </View>

      <View style={styles.statDivider} />

      <View style={styles.statColumn}>
        <IconBadge color="green" size={36} borderRadius={18}>
          <PeopleIcon size={18} />
        </IconBadge>
        <Text style={[styles.statNumber, { color: colors.success }]}>{groupsCount}</Text>
        <Text style={styles.statLabel}>{t('mob.profile.stat_groups')}</Text>
      </View>

      {showWon ? (
        <>
          <View style={styles.statDivider} />
          <View style={styles.statColumn} testID="profile-stat-won">
            <IconBadge color="purple" size={36} borderRadius={18}>
              <MedalIcon size={18} />
            </IconBadge>
            <Text style={[styles.statNumber, { color: colors.textPrimary }]}>{gamesWon}</Text>
            <Text style={styles.statLabel}>{t('mob.profile.stat_won')}</Text>
          </View>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  statsCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: borderWidth.thin,
    borderColor: colors.border,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
  },
  statColumn: {
    flex: 1,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 20,
    fontWeight: '700',
    marginTop: 6,
  },
  statLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  statDivider: {
    width: borderWidth.thin,
    height: 48,
    backgroundColor: colors.border,
  },
});
