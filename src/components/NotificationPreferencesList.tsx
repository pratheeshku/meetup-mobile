/**
 * Notification preferences list — the ONE component shared by the Settings
 * screen (`NotificationPreferencesScreen`) and the first-run onboarding step
 * (DES-MEETUP-ADDENDUM-profile-onboarding.md D11, §4.3). Originally the
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
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';

import { withCorrelationId } from '../api/correlationId';
import { getPreferences, updatePreference } from '../api/notifications';
import Card from './Card';
import ErrorView from './ErrorView';
import LoadingView from './LoadingView';
import { hasNotificationPermission } from '../notifications/fcm';
import { borderWidth, colors, spacing, typography } from '../theme/tokens';
import { NOTIFICATION_TYPES } from '../types/notification';
import type {
  NotificationPreference,
  NotificationType,
} from '../types/notification';
import { useT } from '../labels/LabelsContext';
import type { LabelKey } from '../labels/fallbackLabels';

/** Label key for every known notification type (§4.8 + the two participant types + group_event_created + event_reminder). */
const NOTIFICATION_TYPE_LABEL_KEYS: Record<NotificationType, LabelKey> = {
  global: 'mob.notif_pref.type_global',
  event_invite: 'mob.notif_pref.type_event_invite',
  event_changed: 'mob.notif_pref.type_event_changed',
  event_cancelled: 'mob.notif_pref.type_event_cancelled',
  event_reminder: 'mob.notif_pref.type_event_reminder',
  event_participant_added: 'mob.notif_pref.type_event_participant_added',
  event_participant_removed: 'mob.notif_pref.type_event_participant_removed',
  group_event_created: 'mob.notif_pref.type_group_event_created',
  waitlist_promoted: 'mob.notif_pref.type_waitlist_promoted',
  group_invite: 'mob.notif_pref.type_group_invite',
  tournament_invited: 'mob.notif_pref.type_tournament_invited',
  tournament_match_scheduled: 'mob.notif_pref.type_tournament_match_scheduled',
  tournament_result_posted: 'mob.notif_pref.type_tournament_result_posted',
  tournament_cancelled: 'mob.notif_pref.type_tournament_cancelled',
  tournament_schedule_published: 'mob.notif_pref.type_tournament_schedule_published',
  tournament_standings_published: 'mob.notif_pref.type_tournament_standings_published',
  tournament_advanced: 'mob.notif_pref.type_tournament_advanced',
  tournament_result_corrected: 'mob.notif_pref.type_tournament_result_corrected',
  team_invite: 'mob.notif_pref.type_team_invite',
  team_join_request: 'mob.notif_pref.type_team_join_request',
  tournament_registration_removed: 'mob.notif_pref.type_tournament_registration_removed',
  tournament_updated: 'mob.notif_pref.type_tournament_updated',
  tournament_registration_added: 'mob.notif_pref.type_tournament_registration_added',
  group_deleted: 'mob.notif_pref.type_group_deleted',
  group_ownership_transferred: 'mob.notif_pref.type_group_ownership_transferred',
};

interface NotificationPreferencesListProps {
  /**
   * Onboarding step only: show a device-permission banner when the OS
   * notification permission is not granted. Never re-prompts — it only
   * points the user to system settings.
   */
  showPermissionBanner?: boolean;
}

export default function NotificationPreferencesList({
  showPermissionBanner = false,
}: NotificationPreferencesListProps): React.JSX.Element {
  const t = useT();
  const tRef = useRef(t);
  tRef.current = t;
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
      setLoadError(tRef.current('mob.notif_pref.load_error'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPreferences();
  }, [loadPreferences]);

  // `null` until checked; the banner shows only on a definite "not granted".
  const [permissionGranted, setPermissionGranted] = useState<boolean | null>(null);
  useEffect(() => {
    if (!showPermissionBanner) {
      return;
    }
    let active = true;
    hasNotificationPermission().then(
      granted => {
        if (active) {
          setPermissionGranted(granted);
        }
      },
      () => {},
    );
    return () => {
      active = false;
    };
  }, [showPermissionBanner]);

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
      setSaveError(t('mob.notif_pref.save_error'));
    } finally {
      setSavingType(null);
    }
  };

  if (isLoading) {
    return <LoadingView />;
  }

  if (loadError) {
    return <ErrorView message={loadError} onRetry={loadPreferences} />;
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {showPermissionBanner && permissionGranted === false ? (
        <View style={styles.permissionBanner} testID="notification-permission-banner">
          <Text style={styles.permissionText}>
            {t('mob.notif_pref.permission_off')}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('mob.notif_pref.open_settings')}
            onPress={() => Linking.openSettings()}
            style={styles.permissionAction}
          >
            <Text style={styles.permissionActionText}>{t('mob.notif_pref.open_settings')}</Text>
          </Pressable>
        </View>
      ) : null}

      {saveError ? <Text style={styles.errorText}>{saveError}</Text> : null}

      <Card>
        {NOTIFICATION_TYPES.map((type, index) => (
          <View
            key={type}
            style={[
              styles.row,
              index < NOTIFICATION_TYPES.length - 1 ? styles.rowDivider : null,
            ]}
          >
            <Text style={styles.rowLabel}>{t(NOTIFICATION_TYPE_LABEL_KEYS[type])}</Text>
            {savingType === type ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Switch
                value={preferences[type] ?? true}
                onValueChange={value => handleToggle(type, value)}
                disabled={savingType !== null}
                trackColor={{ false: colors.border, true: colors.primaryLight }}
                thumbColor={(preferences[type] ?? true) ? colors.primary : colors.textMuted}
              />
            )}
          </View>
        ))}
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.md },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  rowDivider: {
    borderBottomWidth: borderWidth.thin,
    borderBottomColor: colors.border,
  },
  rowLabel: {
    ...typography.body,
    color: colors.textPrimary,
    flex: 1,
    marginRight: spacing.md,
  },
  permissionBanner: {
    backgroundColor: colors.warningLight,
    borderRadius: 8,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  permissionText: { ...typography.body, color: colors.textPrimary },
  permissionAction: { minHeight: 44, justifyContent: 'center', marginTop: spacing.xs },
  permissionActionText: { ...typography.bodyBold, color: colors.primary },
  errorText: {
    ...typography.body,
    color: colors.error,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
});
