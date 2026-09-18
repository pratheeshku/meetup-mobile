/**
 * Event Detail screen (DES-MEETUP-MOBILE.md §4.3; R-021, R-024, R-025).
 *
 * Role/permission gating here is UX-only (§3.10, §5.3, R-017/R-082) —
 * every gated action still calls its endpoint normally and the backend
 * remains the sole authority; a stale organiser/`status` value can
 * briefly show an affordance that then fails server-side, which §3.10
 * itself accepts as a trade-off.
 *
 * Organiser detection: `Event.is_organiser` is a stub that `mapEventApiItem`
 * always sets to `false` (the endpoint returns no such field), so it cannot
 * drive the RSVP/Cancel gates on its own — that hid Cancel from everyone and
 * showed organisers an RSVP button on their own events. The gates use
 * `isOrganiserOf(event, currentUserId)`, which also compares `organiser_id`
 * with the signed-in user's id (same derivation as `TournamentDetailScreen`
 * and the Home dashboard).
 *
 * Cancel Event is intentionally NOT rendered (fix/events RSVP-withdraw
 * contract task). `POST /events/{id}/cancel` requires a `reason` body
 * (`EventCancelRequest`, 1–500 chars) and there is no cancellation-reason UI
 * yet, so the previous button could only ever 422. `cancelEvent()` is kept in
 * `src/api/events.ts` but not called from here. FOLLOW-UP: build the reason
 * input UI, send `{ reason }`, then restore an organiser-only Cancel action
 * (previously gated on `isOrganiser && status in upcoming|active`).
 *
 * Proposed Assumption: the brief specifies "'Join' if status is none"
 * without naming a button state for `withdrawn`. Treated the same as
 * `none` (offers "Join" again) — a user who withdrew must be able to
 * re-join, and no other button state is described for that value.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { getEvent, rsvpEvent, withdrawEvent } from '../api/events';
import { withCorrelationId } from '../api/correlationId';
import { useAuth } from '../auth/AuthContext';
import Badge from '../components/Badge';
import Button from '../components/Button';
import Card from '../components/Card';
import ErrorView from '../components/ErrorView';
import LoadingView from '../components/LoadingView';
import { colors, radius, spacing, typography } from '../theme/tokens';
import type { Event } from '../types/event';
import type { HomeStackParamList } from '../navigation/types';
import { formatEventDate, formatEventTimeRange } from '../utils/formatEventDateTime';
import { isOrganiserOf } from '../utils/homeDashboard';

type Props = NativeStackScreenProps<HomeStackParamList, 'EventDetail'>;

export default function EventDetailScreen({ route }: Props): React.JSX.Element {
  const { eventId } = route.params;
  const { user } = useAuth();

  const [event, setEvent] = useState<Event | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const loadEvent = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const data = await getEvent(eventId);
      setEvent(data);
    } catch {
      setLoadError('Could not load this event. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    loadEvent();
  }, [loadEvent]);

  const handleRsvp = async (): Promise<void> => {
    setActionError(null);
    setIsActionLoading(true);
    try {
      await withCorrelationId(async correlationId => {
        await rsvpEvent(eventId, { correlationId });
        setEvent(await getEvent(eventId, { correlationId }));
      });
    } catch {
      setActionError('Could not join this event. Please try again.');
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleWithdraw = async (): Promise<void> => {
    setActionError(null);
    setIsActionLoading(true);
    try {
      await withCorrelationId(async correlationId => {
        await withdrawEvent(eventId, { correlationId });
        setEvent(await getEvent(eventId, { correlationId }));
      });
    } catch {
      setActionError('Could not leave this event. Please try again.');
    } finally {
      setIsActionLoading(false);
    }
  };

  if (isLoading) {
    return <LoadingView />;
  }

  if (loadError || !event) {
    return <ErrorView message={loadError ?? 'Event not found.'} onRetry={loadEvent} />;
  }

  const isOrganiser = isOrganiserOf(event, user?.id);
  const isRsvpVisible =
    !isOrganiser && event.status !== 'cancelled' && event.status !== 'completed';
  const isGoingOrWaitlisted =
    event.current_user_rsvp_status === 'going' || event.current_user_rsvp_status === 'waitlisted';
  const isAtCapacity = event.participant_count >= event.capacity;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Card style={styles.infoCard}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>{event.title}</Text>
          {event.is_recurring ? (
            <Badge label="Recurring" variant="neutral" style={styles.recurringBadge} />
          ) : null}
        </View>

        {event.status === 'cancelled' ? (
          <Text style={styles.cancelledBanner}>This event has been cancelled.</Text>
        ) : null}

        <Text style={styles.meta}>
          {event.sport} · {event.location}
        </Text>
        <Text style={styles.meta}>{formatEventDate(event.starts_at)}</Text>
        <Text style={styles.meta}>{formatEventTimeRange(event.starts_at, event.ends_at)}</Text>
        <Text style={styles.meta}>
          {event.participant_count}/{event.capacity} going
          {event.waitlist_count > 0 ? ` · ${event.waitlist_count} waitlisted` : ''}
        </Text>
        <Text style={styles.meta}>Organised by {event.organiser_nickname}</Text>
        {event.cost != null ? <Text style={styles.meta}>Cost: {event.cost}</Text> : null}

        <Text style={styles.description}>{event.description}</Text>
      </Card>

      {isAtCapacity ? (
        <Text style={styles.waitlistNotice}>
          This event is at capacity — new RSVPs join the waitlist.
        </Text>
      ) : null}

      {actionError ? <Text style={styles.errorText}>{actionError}</Text> : null}

      {isRsvpVisible ? (
        <Button
          label={isGoingOrWaitlisted ? 'Leave' : 'Join'}
          variant={isGoingOrWaitlisted ? 'secondary' : 'primary'}
          onPress={isGoingOrWaitlisted ? handleWithdraw : handleRsvp}
          loading={isActionLoading}
          style={styles.button}
        />
      ) : null}

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.md },
  infoCard: { marginBottom: spacing.md },
  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md },
  title: { ...typography.h2, color: colors.textPrimary, flexShrink: 1 },
  recurringBadge: { marginLeft: spacing.sm },
  cancelledBanner: {
    ...typography.bodyBold,
    color: colors.error,
    backgroundColor: colors.errorLight,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  meta: { ...typography.body, color: colors.textSecondary, marginBottom: spacing.xs },
  description: { ...typography.body, color: colors.textPrimary, marginTop: spacing.md },
  waitlistNotice: {
    ...typography.body,
    color: colors.textPrimary,
    backgroundColor: colors.warningLight,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  errorText: {
    ...typography.body,
    color: colors.error,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  button: { marginBottom: spacing.sm },
});
