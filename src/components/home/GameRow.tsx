/**
 * Game row (DES-MEETUP-ADDENDUM-dashboard.md §4): 44px sport icon tile,
 * title, date and venue, right badge "x/y going". On the Games screen
 * (AD-15) the same row also shows one status badge (Hosting / Going /
 * Waitlisted / Open) under the going count.
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { SportIcon } from '../icons/DashboardIcons';
import { dash, dashRadius, dashSize, sportTileColors } from '../../theme/dashboardTheme';
import { spacing, typography } from '../../theme/tokens';
import type { Event } from '../../types/event';
import { sportSlug } from '../icons/DashboardIcons';
import { formatRowDate } from '../../utils/formatGameTime';
import type { GameBadge } from '../../utils/gameLists';
import { useT } from '../../labels/LabelsContext';
import type { LabelKey } from '../../labels/fallbackLabels';

export function sportTileColor(slug: string | null | undefined): string {
  return sportTileColors[sportSlug(slug)] ?? sportTileColors.fallback;
}

interface GameRowProps {
  event: Event;
  onPress: () => void;
  /** Games screen only (AD-15). */
  badge?: GameBadge | null;
}

const BADGE_LABEL_KEY: Record<GameBadge, LabelKey> = {
  Hosting: 'mob.game_badge.hosting',
  Going: 'mob.game_badge.going',
  Waitlisted: 'mob.game_badge.waitlisted',
  Open: 'mob.game_badge.open',
};

export default function GameRow({ event, onPress, badge }: GameRowProps): React.JSX.Element {
  const t = useT();
  const badgeText = badge ? t(BADGE_LABEL_KEY[badge]) : null;
  const venue = event.venue_name || event.location || '';
  const dateLine = [formatRowDate(event.starts_at), venue].filter(Boolean).join(' · ');
  const going = t('mob.game_row.going', {
    count: event.participant_count,
    capacity: event.capacity,
  });

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${event.title}, ${dateLine}, ${going}${badgeText ? `, ${badgeText}` : ''}`}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed ? styles.pressed : null]}
    >
      <View style={[styles.tile, { backgroundColor: sportTileColor(event.sport) }]}>
        <SportIcon slug={event.sport} size={dashSize.rowIcon} />
      </View>
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={1}>
          {event.title}
        </Text>
        {dateLine ? (
          <Text style={styles.meta} numberOfLines={1}>
            {dateLine}
          </Text>
        ) : null}
      </View>
      <View style={styles.right}>
        <View style={styles.goingPill}>
          <Text style={styles.goingText}>{going}</Text>
        </View>
        {badge ? (
          <View style={[styles.statusPill, badge === 'Open' ? styles.statusOpen : null]}>
            <Text style={[styles.statusText, badge === 'Open' ? styles.statusOpenText : null]}>
              {badgeText}
            </Text>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: dashSize.touchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: dash.card,
    borderRadius: dashRadius.card,
    borderWidth: 1,
    borderColor: dash.cardBorder,
    padding: spacing.sm + 2,
    marginBottom: spacing.sm,
  },
  pressed: { opacity: 0.85 },
  tile: {
    width: dashSize.rowIconTile,
    height: dashSize.rowIconTile,
    borderRadius: dashRadius.rowTile,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1, marginLeft: spacing.sm + 2, marginRight: spacing.sm },
  title: { ...typography.bodyBold, color: dash.text },
  meta: { ...typography.caption, color: dash.textMuted, marginTop: 2 },
  right: { alignItems: 'flex-end' },
  goingPill: {
    backgroundColor: dash.goingBg,
    borderRadius: dashRadius.chip,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  goingText: { ...typography.label, color: dash.goingText },
  statusPill: {
    marginTop: spacing.xs,
    borderRadius: dashRadius.chip,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    backgroundColor: dash.page,
    borderWidth: 1,
    borderColor: dash.cardBorder,
  },
  statusOpen: { backgroundColor: dash.white, borderColor: dash.brand },
  statusText: { ...typography.label, color: dash.text },
  statusOpenText: { color: dash.brand },
});
