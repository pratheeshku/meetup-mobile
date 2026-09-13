/**
 * Event Detail screen (DES-MEETUP-MOBILE.md §4.3; R-021, R-024, R-025).
 *
 * Role/permission gating here is UX-only (§3.10, §5.3, R-017/R-082) —
 * every gated action still calls its endpoint normally and the backend
 * remains the sole authority; a stale `is_organiser`/`status` value can
 * briefly show an affordance that then fails server-side, which §3.10
 * itself accepts as a trade-off.
 *
 * Proposed Assumption: the brief specifies "'Join' if status is none"
 * without naming a button state for `withdrawn`. Treated the same as
 * `none` (offers "Join" again) — a user who withdrew must be able to
 * re-join, and no other button state is described for that value.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { cancelEvent, getEvent, rsvpEvent, withdrawEvent } from '../api/events';
import { withCorrelationId } from '../api/correlationId';
import type { Event } from '../types/event';
import type { HomeStackParamList } from '../navigation/types';
import { formatEventDate, formatEventTimeRange } from '../utils/formatEventDateTime';

type Props = NativeStackScreenProps<HomeStackParamList, 'EventDetail'>;

export default function EventDetailScreen({ route, navigation }: Props): React.JSX.Element {
  const { eventId } = route.params;

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

  const handleCancel = async (): Promise<void> => {
    setActionError(null);
    setIsActionLoading(true);
    try {
      await cancelEvent(eventId);
      navigation.goBack();
    } catch {
      setActionError('Could not cancel this event. Please try again.');
      setIsActionLoading(false);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (loadError || !event) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{loadError ?? 'Event not found.'}</Text>
        <Pressable style={styles.retryButton} onPress={loadEvent}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  const isRsvpVisible =
    !event.is_organiser && event.status !== 'cancelled' && event.status !== 'completed';
  const isGoingOrWaitlisted =
    event.current_user_rsvp_status === 'going' || event.current_user_rsvp_status === 'waitlisted';
  const isAtCapacity = event.participant_count >= event.capacity;
  const isCancelVisible =
    event.is_organiser && (event.status === 'upcoming' || event.status === 'active');

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>{event.title}</Text>
        {event.is_recurring ? (
          <View style={styles.recurringBadge}>
            <Text style={styles.recurringBadgeText}>Recurring</Text>
          </View>
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

      {isAtCapacity ? (
        <Text style={styles.waitlistNotice}>
          This event is at capacity — new RSVPs join the waitlist.
        </Text>
      ) : null}

      {actionError ? <Text style={styles.errorText}>{actionError}</Text> : null}

      {isRsvpVisible ? (
        <Pressable
          style={[styles.button, isActionLoading && styles.buttonDisabled]}
          onPress={isGoingOrWaitlisted ? handleWithdraw : handleRsvp}
          disabled={isActionLoading}
        >
          {isActionLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>{isGoingOrWaitlisted ? 'Leave' : 'Join'}</Text>
          )}
        </Pressable>
      ) : null}

      {isCancelVisible ? (
        <Pressable
          style={[styles.cancelButton, isActionLoading && styles.buttonDisabled]}
          onPress={handleCancel}
          disabled={isActionLoading}
        >
          {isActionLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Cancel Event</Text>
          )}
        </Pressable>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  title: { fontSize: 22, fontWeight: '700', flexShrink: 1 },
  recurringBadge: {
    backgroundColor: '#eee',
    borderRadius: 6,
    paddingVertical: 3,
    paddingHorizontal: 8,
    marginLeft: 8,
  },
  recurringBadgeText: { fontSize: 12, fontWeight: '600', color: '#555' },
  cancelledBanner: { color: '#c0392b', fontWeight: '600', marginBottom: 12 },
  meta: { fontSize: 15, color: '#444', marginBottom: 4 },
  description: { fontSize: 15, color: '#222', marginTop: 12, marginBottom: 16 },
  waitlistNotice: { fontSize: 14, color: '#b8860b', marginBottom: 16 },
  errorText: { fontSize: 15, color: '#c0392b', textAlign: 'center', marginBottom: 16 },
  retryButton: {
    backgroundColor: '#2563eb',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  retryButtonText: { color: '#fff', fontWeight: '600' },
  button: {
    backgroundColor: '#2563eb',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  cancelButton: {
    backgroundColor: '#c0392b',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    marginTop: 12,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 16 },
});
