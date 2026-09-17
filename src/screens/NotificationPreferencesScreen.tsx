/**
 * Notification Preferences screen (DES-MEETUP-MOBILE.md §4.8, §7.6;
 * R-076).
 *
 * Lists all 12 confirmed notification types (§4.8's own mapping table),
 * not just the ones present in whatever `GET /notifications/preferences`
 * returns — a user with no stored preference for a type yet defaults to
 * "on" (Proposed Assumption: the task brief doesn't specify a default for
 * a type absent from the response; "on" is the conservative reading,
 * since a missing preference row most plausibly means "never explicitly
 * turned off" rather than "opted out", and a silent opt-out would
 * contradict R-071's "no notification type missing" intent). Toggling
 * calls `updatePreference()` immediately (no separate Save step),
 * matching this codebase's established pattern of immediate-effect
 * mutations elsewhere (e.g. `GroupDetailScreen`'s role changes).
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';

import { withCorrelationId } from '../api/correlationId';
import { getPreferences, updatePreference } from '../api/notifications';
import { NOTIFICATION_TYPES } from '../types/notification';
import type {
  NotificationPreference,
  NotificationType,
} from '../types/notification';

/** Human-readable labels for each of the 12 confirmed types (§4.8). */
const NOTIFICATION_TYPE_LABELS: Record<NotificationType, string> = {
  global: 'Announcements',
  event_invite: 'Event invitations',
  event_changed: 'Event changes',
  event_cancelled: 'Event cancellations',
  waitlist_promoted: 'Waitlist promotions',
  group_invite: 'Group invitations',
  tournament_match_scheduled: 'Tournament match scheduled',
  tournament_result_posted: 'Tournament results',
  tournament_cancelled: 'Tournament cancellations',
  tournament_schedule_published: 'Tournament schedule published',
  tournament_standings_published: 'Tournament standings published',
  team_invite: 'Team invitations',
};

export default function NotificationPreferencesScreen(): React.JSX.Element {
  const [preferences, setPreferences] = useState<
    Record<NotificationType, boolean>
  >({} as Record<NotificationType, boolean>);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [savingType, setSavingType] = useState<NotificationType | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const loadPreferences = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const data = await getPreferences();
      const byType = {} as Record<NotificationType, boolean>;
      NOTIFICATION_TYPES.forEach(type => {
        byType[type] = true; // default: on (see file header)
      });
      data.forEach((pref: NotificationPreference) => {
        byType[pref.notification_type] = pref.enabled;
      });
      setPreferences(byType);
    } catch {
      setLoadError(
        'Could not load your notification preferences. Please try again.',
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPreferences();
  }, [loadPreferences]);

  const handleToggle = async (
    type: NotificationType,
    nextEnabled: boolean,
  ): Promise<void> => {
    const previousEnabled = preferences[type];
    setSaveError(null);
    setSavingType(type);
    // Optimistic update — reverted on failure below.
    setPreferences(current => ({ ...current, [type]: nextEnabled }));
    try {
      await withCorrelationId(correlationId =>
        updatePreference(type, nextEnabled, { correlationId }),
      );
    } catch {
      setPreferences(current => ({ ...current, [type]: previousEnabled }));
      setSaveError('Could not save this preference. Please try again.');
    } finally {
      setSavingType(null);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (loadError) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{loadError}</Text>
        <Pressable style={styles.retryButton} onPress={loadPreferences}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {saveError ? <Text style={styles.errorText}>{saveError}</Text> : null}

      {NOTIFICATION_TYPES.map(type => (
        <View key={type} style={styles.row}>
          <Text style={styles.rowLabel}>{NOTIFICATION_TYPE_LABELS[type]}</Text>
          {savingType === type ? (
            <ActivityIndicator size="small" />
          ) : (
            <Switch
              value={preferences[type] ?? true}
              onValueChange={value => handleToggle(type, value)}
              disabled={savingType !== null}
            />
          )}
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24 },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  rowLabel: { fontSize: 15, color: '#222', flex: 1, marginRight: 12 },
  errorText: {
    fontSize: 14,
    color: '#c0392b',
    marginBottom: 12,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: '#2563eb',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  retryButtonText: { color: '#fff', fontWeight: '600' },
});
