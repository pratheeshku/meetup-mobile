/**
 * Stats strip (Played, Hosted, Groups, Won).
 * Compact row of four equal-width tiles with explicit fixed height.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import IconBadge from './IconBadge';
import { MedalIcon, PeopleIcon, StarIcon, TrophyIcon } from './icons/SharedIcons';
import { useT } from '../labels/LabelsContext';
import { borderWidth, colors, radius, spacing, typography } from '../theme/tokens';

export interface ProfileStatsStripProps {
  gamesPlayed?: number | null;
  gamesHosted?: number | null;
  groupsCount?: number | null;
  gamesWon?: number | null;
}

export default function ProfileStatsStrip({
  gamesPlayed,
  gamesHosted,
  groupsCount,
  gamesWon,
}: ProfileStatsStripProps): React.JSX.Element {
  const t = useT();

  const played = typeof gamesPlayed === 'number' && !Number.isNaN(gamesPlayed) ? gamesPlayed : 0;
  const hosted = typeof gamesHosted === 'number' && !Number.isNaN(gamesHosted) ? gamesHosted : 0;
  const groups = typeof groupsCount === 'number' && !Number.isNaN(groupsCount) ? groupsCount : 0;
  const won = typeof gamesWon === 'number' && !Number.isNaN(gamesWon) ? gamesWon : 0;

  return (
    <View style={styles.container} testID="profile-stats-strip">
      <View style={styles.tile} testID="profile-stat-played">
        <IconBadge color="blue" size={20} borderRadius={10}>
          <TrophyIcon size={12} />
        </IconBadge>
        <Text style={[styles.statNumber, { color: colors.primary }]} numberOfLines={1}>
          {played}
        </Text>
        <Text style={styles.statLabel} numberOfLines={1}>
          {t('mob.profile.stat_played')}
        </Text>
      </View>

      <View style={styles.tile} testID="profile-stat-hosted">
        <IconBadge color="amber" size={20} borderRadius={10}>
          <StarIcon size={12} />
        </IconBadge>
        <Text style={[styles.statNumber, { color: colors.warning }]} numberOfLines={1}>
          {hosted}
        </Text>
        <Text style={styles.statLabel} numberOfLines={1}>
          {t('mob.profile.stat_hosted')}
        </Text>
      </View>

      <View style={styles.tile} testID="profile-stat-groups">
        <IconBadge color="green" size={20} borderRadius={10}>
          <PeopleIcon size={12} />
        </IconBadge>
        <Text style={[styles.statNumber, { color: colors.success }]} numberOfLines={1}>
          {groups}
        </Text>
        <Text style={styles.statLabel} numberOfLines={1}>
          {t('mob.profile.stat_groups')}
        </Text>
      </View>

      <View style={styles.tile} testID="profile-stat-won">
        <IconBadge color="purple" size={20} borderRadius={10}>
          <MedalIcon size={12} />
        </IconBadge>
        <Text style={[styles.statNumber, { color: colors.accentPurple }]} numberOfLines={1}>
          {won}
        </Text>
        <Text style={styles.statLabel} numberOfLines={1}>
          {t('mob.profile.stat_won')}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  tile: {
    flex: 1,
    height: 60,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: borderWidth.thin,
    borderColor: colors.border,
    paddingVertical: spacing.xs,
    paddingHorizontal: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statNumber: {
    fontSize: 14,
    fontWeight: '700',
    marginTop: 2,
  },
  statLabel: {
    ...typography.caption,
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 1,
  },
});
