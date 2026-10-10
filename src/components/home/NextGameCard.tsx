/**
 * Next-game card (DES-MEETUP-ADDENDUM-dashboard.md §4): white card, radius
 * 22, overlapping the banner by 40px. Sport icon tile, "Next game" and day,
 * title, time and venue, chevron. Tapping opens game detail.
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { SportIcon } from '../icons/DashboardIcons';
import { dash, dashRadius, dashSize } from '../../theme/dashboardTheme';
import { spacing, typography } from '../../theme/tokens';
import type { Event } from '../../types/event';
import { formatDayLabel, formatTimeOfDay } from '../../utils/formatGameTime';
import { sportPalette } from '../../sports/style';
import { useSportVisual } from '../../sports/catalog';
import { useT } from '../../labels/LabelsContext';

export default function NextGameCard({
  event,
  onPress,
}: {
  event: Event;
  onPress: () => void;
}): React.JSX.Element {
  const venue = event.venue_name || event.location || '';
  const t = useT();
  const sport = useSportVisual(event.sport);
  const day = formatDayLabel(event.starts_at, undefined, t);
  const detail = [formatTimeOfDay(event.starts_at), venue].filter(Boolean).join(' · ');

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('mob.next_game.a11y', { day, title: event.title, detail })}
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed ? styles.pressed : null]}
    >
      <View style={[styles.tile, { backgroundColor: sportPalette(sport.color).chip }]}>
        <SportIcon iconKey={sport.iconKey} size={dashSize.sportIcon} />
      </View>
      <View style={styles.body}>
        <Text style={styles.kicker}>{day ? t('mob.next_game.kicker_day', { day }) : t('mob.next_game.kicker')}</Text>
        <Text style={styles.title} numberOfLines={1}>
          {event.title}
        </Text>
        {detail ? (
          <Text style={styles.meta} numberOfLines={1}>
            {detail}
          </Text>
        ) : null}
      </View>
      <Text style={styles.chevron} accessibilityElementsHidden importantForAccessibility="no">
        ›
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: dashSize.touchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: dash.card,
    borderRadius: dashRadius.nextGameCard,
    borderWidth: 1,
    borderColor: dash.cardBorder,
    padding: spacing.md,
    shadowColor: dash.brandDeep,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 4,
  },
  pressed: { opacity: 0.9 },
  tile: {
    width: dashSize.sportTile,
    height: dashSize.sportTile,
    borderRadius: dashRadius.sportTile,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1, marginLeft: spacing.md },
  kicker: { ...typography.label, color: dash.brand },
  title: { ...typography.h3, color: dash.text, marginTop: 2 },
  meta: { ...typography.caption, color: dash.textMuted, marginTop: 2 },
  chevron: { fontSize: 28, color: dash.textMuted, marginLeft: spacing.sm },
});
