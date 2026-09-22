/**
 * Events-feed card, laid out to match the web app's event card (layout
 * supplied by the user from direct inspection of meetups.duckdns.org):
 *
 *   Row 1  pill tags: sport, category, and (only when the user is going /
 *          waitlisted) an RSVP pill
 *   Row 2  bold uppercase title, max two lines
 *   Row 3  ONE inline meta line: 📅 date, time · 📍 location · 👤 n/cap
 *          (segments with no value are dropped together with their icon)
 *
 * Container is a bordered surface (no elevation) — the web reference uses a
 * 1px border, not a shadow. `Card` supplies the pressable behaviour; its
 * `shadows.card` is neutralised through the style override below.
 *
 * Pill colours are the same token pairings as `Badge` (warning uses
 * `textPrimary` on `warningLight` because `warning` on `warningLight` fails
 * WCAG AA — see tokens.ts). `Badge` itself is not reused: its padding,
 * weight and lack of letter-spacing/uppercase don't match the reference
 * pill, and the brief limits this change to the event card.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { borderWidth, colors, radius, spacing, typography } from '../theme/tokens';
import type { Event, EventVisibility, RsvpStatus } from '../types/event';
import { formatEventDate, formatEventTimeRange } from '../utils/formatEventDateTime';
import Card from './Card';

interface EventCardProps {
  event: Event;
  onPress: () => void;
}

type PillTone = 'tag' | 'success' | 'warning';

const PILL_COLORS: Record<PillTone, { background: string; text: string }> = {
  tag: { background: colors.primaryLight, text: colors.primary },
  success: { background: colors.successLight, text: colors.success },
  warning: { background: colors.warningLight, text: colors.textPrimary },
};

/**
 * Correction (Create Flow Amendment research, 2026-09-22): the prior
 * `invite` key was never reachable — `EventVisibility`'s real third value
 * is `invite_only` (see `types/event.ts`). Confirmed directly against
 * `frontend/app.js`'s event card/detail rendering (`pratheeshku/meetup`),
 * which special-cases `visibility === "invite_only"` to display "PRIVATE"
 * rather than the raw enum value — matched here rather than the previous
 * "labelled INVITE, the enum value" guess.
 */
const CATEGORY_LABEL: Record<EventVisibility, string> = {
  public: 'Public',
  group: 'Group',
  invite_only: 'Private',
};

/**
 * `none` and `withdrawn` show no pill (brief: None → omit). `withdrawn` is
 * folded into "none" for feed display, as the previous card did.
 */
const RSVP_PILL: Partial<Record<RsvpStatus, { label: string; tone: PillTone }>> = {
  going: { label: 'Going', tone: 'success' },
  waitlisted: { label: 'Waitlisted', tone: 'warning' },
};

/** No letter-spacing token exists; one shared value for pills and title. */
const LETTER_SPACING = 0.5;

function Pill({ label, tone }: { label: string; tone: PillTone }): React.JSX.Element {
  return (
    <View style={[styles.pill, { backgroundColor: PILL_COLORS[tone].background }]}>
      <Text style={[styles.pillText, { color: PILL_COLORS[tone].text }]}>{label}</Text>
    </View>
  );
}

/** Meta segments in display order; empty/missing values are dropped with their icon. */
export function buildMetaSegments(event: Event): string[] {
  const segments: string[] = [];
  const when = [formatEventDate(event.starts_at), formatEventTimeRange(event.starts_at, event.ends_at)]
    .filter(part => part.length > 0)
    .join(', ');
  if (when) {
    segments.push(`📅 ${when}`);
  }
  if (event.location) {
    segments.push(`📍 ${event.location}`);
  }
  segments.push(`👤 ${event.participant_count}/${event.capacity}`);
  return segments;
}

export default function EventCard({ event, onPress }: EventCardProps): React.JSX.Element {
  const rsvp = RSVP_PILL[event.current_user_rsvp_status];

  return (
    <Card style={styles.card} onPress={onPress}>
      <View style={styles.tagRow}>
        {event.sport ? <Pill label={event.sport} tone="tag" /> : null}
        <Pill label={CATEGORY_LABEL[event.visibility]} tone="tag" />
        {rsvp ? <Pill label={rsvp.label} tone={rsvp.tone} /> : null}
      </View>
      <Text style={styles.title} numberOfLines={2}>
        {event.title}
      </Text>
      <Text style={styles.meta}>{buildMetaSegments(event).join(' · ')}</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  // Overrides `Card`'s shadow with a hairline border (web reference).
  card: {
    marginBottom: spacing.md,
    borderWidth: borderWidth.thin,
    borderColor: colors.border,
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  // 6px / 12px per the brief, derived from spacing tokens (no 6 or 12 token).
  pill: {
    borderRadius: radius.full,
    paddingVertical: spacing.xs + spacing.xs / 2,
    paddingHorizontal: spacing.sm + spacing.xs,
  },
  pillText: {
    fontSize: typography.label.fontSize,
    fontWeight: '700',
    letterSpacing: LETTER_SPACING,
    textTransform: 'uppercase',
  },
  title: {
    ...typography.h3,
    fontWeight: '700',
    letterSpacing: LETTER_SPACING,
    textTransform: 'uppercase',
    color: colors.textPrimary,
    marginTop: spacing.sm,
  },
  meta: { ...typography.caption, color: colors.textSecondary, marginTop: spacing.sm },
});
