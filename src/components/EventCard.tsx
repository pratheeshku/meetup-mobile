/**
 * Events-feed card rebuilt to match the mobile artboards from
 * https://claude.ai/artifact/S7V1xJ3912GC78up1v4Nms
 *
 * Layout:
 *   Row 1: Sport tag pill (sport-colored pill with circular icon + sport name)
 *          Status label on top-right (e.g. "Hosting", "2 left", "Waitlisted", "Open")
 *   Row 2: Event title (bold, textPrimary)
 *   Row 3: Date and venue with middle dot (e.g. "Sun, 9:00 AM · Punggol Sports Hall")
 *   Row 4: Avatar stack with initials (e.g. PK, RS, +5) + capacity ("7/8") on left,
 *          Action link with arrow on right ("Manage →", "View →", "Join →")
 *   Row 5: Colored progress bar at bottom matching the sport's palette color
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useAuth } from '../auth/AuthContext';
import { borderWidth, colors, getSportColor, radius, spacing, typography } from '../theme/tokens';
import type { Event } from '../types/event';
import { useSportDisplayName } from '../utils/labels';
import Card from './Card';

interface EventCardProps {
  event: Event;
  onPress: () => void;
  currentUserId?: string;
}

function useOptionalUser(): { id: string } | null {
  try {
    const auth = useAuth();
    return auth.user;
  } catch {
    return null;
  }
}

/** Formats "Sun, 9:00 AM" or similar for the card subtitle */
export function formatCardDate(isoString: string): string {
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return '';
    const weekday = d.toLocaleDateString(undefined, { weekday: 'short' });
    const time = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
    return `${weekday}, ${time}`;
  } catch {
    return '';
  }
}

/** Derives the top-right status label */
export function getEventStatusLabel(event: Event, currentUserId?: string): string {
  const isOrganiser = Boolean(
    (currentUserId && (event.organiser_id === currentUserId || event.is_organiser)) ||
      event.is_organiser,
  );
  if (isOrganiser) {
    return 'Hosting';
  }
  if (event.current_user_rsvp_status === 'waitlisted') {
    return 'Waitlisted';
  }
  const remaining = Math.max(0, event.capacity - event.participant_count);
  if (remaining === 0) {
    return 'Full';
  }
  if (event.current_user_rsvp_status === 'going') {
    return `${remaining} left`;
  }
  // Open / unjoined
  return remaining <= 3 ? `${remaining} left` : 'Open';
}

/** Derives the right-aligned action link */
export function getEventActionLabel(event: Event, currentUserId?: string): string {
  const isOrganiser = Boolean(
    (currentUserId && (event.organiser_id === currentUserId || event.is_organiser)) ||
      event.is_organiser,
  );
  if (isOrganiser) {
    return 'Manage →';
  }
  if (
    event.current_user_rsvp_status === 'going' ||
    event.current_user_rsvp_status === 'waitlisted'
  ) {
    return 'View →';
  }
  return 'Join →';
}

/** Returns status text color */
function getStatusTextColor(status: string): string {
  if (status === 'Hosting') return colors.accent;
  if (status === 'Waitlisted') return '#67509B';
  return colors.textMuted;
}

export default function EventCard({
  event,
  onPress,
  currentUserId,
}: EventCardProps): React.JSX.Element {
  const authUser = useOptionalUser();
  const effectiveUserId = currentUserId ?? authUser?.id;
  const sportLabel = useSportDisplayName(event.sport);
  const sportColor = getSportColor(event.sport);
  const statusLabel = getEventStatusLabel(event, effectiveUserId);
  const actionLabel = getEventActionLabel(event, effectiveUserId);

  const formattedDate = formatCardDate(event.starts_at);
  const venue = event.venue_name || event.location || '';
  const dateAndVenue = [formattedDate, venue].filter(Boolean).join(' · ');

  const progressPercent = Math.min(
    100,
    Math.max(0, event.capacity > 0 ? (event.participant_count / event.capacity) * 100 : 0),
  );

  // Avatar initials derivation
  const orgInitials = (event.organiser_nickname || 'PK')
    .slice(0, 2)
    .toUpperCase();
  const showSecondAvatar = event.participant_count >= 2;
  const overflowCount = event.participant_count - 2;

  return (
    <Card style={styles.card} onPress={onPress}>
      {/* Row 1: Sport pill tag + Status label */}
      <View style={styles.topRow}>
        {event.sport ? (
          <View style={[styles.sportPill, { backgroundColor: sportColor }]}>
            <View style={styles.sportDot} />
            <Text style={styles.sportText}>{sportLabel}</Text>
          </View>
        ) : (
          <View />
        )}
        <Text style={[styles.statusText, { color: getStatusTextColor(statusLabel) }]}>
          {statusLabel}
        </Text>
      </View>

      {/* Row 2: Event title */}
      <Text style={styles.title} numberOfLines={2}>
        {event.title}
      </Text>

      {/* Row 3: Date & Venue */}
      {dateAndVenue ? <Text style={styles.dateVenue}>{dateAndVenue}</Text> : null}

      {/* Row 4: Avatar stack + Capacity & Action Link */}
      <View style={styles.bottomRow}>
        <View style={styles.avatarCapacityGroup}>
          {event.participant_count > 0 ? (
            <View style={styles.avatarStack}>
              <View style={[styles.avatarCircle, styles.avatarZ3]}>
                <Text style={styles.avatarInitials}>{orgInitials}</Text>
              </View>
              {showSecondAvatar ? (
                <View style={[styles.avatarCircle, styles.avatarOverlap, styles.avatarZ2]}>
                  <Text style={styles.avatarInitials}>RS</Text>
                </View>
              ) : null}
              {overflowCount > 0 ? (
                <View style={[styles.avatarCircle, styles.avatarOverlap, styles.avatarZ1]}>
                  <Text style={styles.avatarInitials}>+{overflowCount}</Text>
                </View>
              ) : null}
            </View>
          ) : null}
          <Text style={styles.capacityText}>
            {event.participant_count}/{event.capacity}
          </Text>
        </View>

        <Text style={styles.actionLink}>{actionLabel}</Text>
      </View>

      {/* Row 5: Colored progress bar */}
      <View style={styles.progressTrack}>
        <View
          style={[
            styles.progressFill,
            { width: `${progressPercent}%`, backgroundColor: sportColor },
          ]}
        />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: borderWidth.thin,
    borderColor: colors.border,
    shadowColor: '#1B1918',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  sportPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.full,
    gap: 6,
  },
  sportDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    borderWidth: 1.5,
    borderColor: colors.white,
  },
  sportText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '600',
  },
  statusText: {
    fontSize: 13,
    fontWeight: '600',
  },
  title: {
    ...typography.h3,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  dateVenue: {
    ...typography.caption,
    color: colors.textMuted,
    marginBottom: spacing.md,
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  avatarCapacityGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  avatarStack: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#EBE7E0',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.surface,
  },
  avatarOverlap: {
    marginLeft: -6,
  },
  avatarZ3: {
    zIndex: 3,
  },
  avatarZ2: {
    zIndex: 2,
  },
  avatarZ1: {
    zIndex: 1,
  },
  avatarInitials: {
    fontSize: 9,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  capacityText: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  actionLink: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.accent,
  },
  progressTrack: {
    height: 4,
    backgroundColor: colors.track,
    borderRadius: 2,
    overflow: 'hidden',
    width: '100%',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
});
