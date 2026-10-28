/**
 * Series parts of the game view (DES-MEETUP-ADDENDUM-tournament-edit-recurring AD-8; A38 board of record, nearest board family
 * `game-view-redesign/game-view` and `design-ref-p23/EditGame`, DeleteGame). Everything shown comes from `EventResponse.series`; the app counts
 * nothing and computes no date. Each action is one call under one `withCorrelationId()`; the server is the authority and its codes
 * (`SERIES_HAS_PARTICIPANTS`, `SERIES_LIMIT_EXCEEDED`, `SERIES_END_INVALID`, `SERIES_ORGANIZER_CANNOT_LEAVE`) show their own labels.
 * Theme tokens only.
 */
import React, { useState } from 'react';
import { Alert, Modal, StyleSheet, Text, View } from 'react-native';

import { withCorrelationId } from '../../api/correlationId';
import { cancelEventSeries, leaveEventSeries, updateEventSeries } from '../../api/events';
import { useT } from '../../labels/LabelsContext';
import type { TranslateFn } from '../../labels/LabelsContext';
import { borderWidth, colors, radius, spacing, typography } from '../../theme/tokens';
import type { EventSeries } from '../../types/event';
import { refusalText } from '../../utils/refusal';
import { seriesChipText, seriesLineText } from '../../utils/seriesDisplay';
import Badge from '../Badge';
import Button from '../Button';
import TextField from '../TextField';

/** The chip "Weekly · n of N" and the line "Repeats weekly · ends after N games or on a date", from the server's `series` only. */
export function SeriesInfo({ series }: { series: EventSeries }): React.JSX.Element {
  const t = useT();
  const chip = seriesChipText(series, t);
  return (
    <View style={styles.info} testID="series-info">
      {chip ? <Badge label={chip} variant="primary" style={styles.chip} /> : null}
      <Text style={styles.line} testID="series-line">
        {seriesLineText(series, t)}
      </Text>
    </View>
  );
}

/** Under Accept and Join for a person who has not joined: accepting joins every future game of the series. */
export function SeriesAcceptNote(): React.JSX.Element {
  const t = useT();
  return (
    <Text style={styles.note} testID="series-accept-note">
      {t('web.series.accept_note')}
    </Text>
  );
}

/** Leave series (active members only; the organizer never sees it). Confirms, then `POST /events/{id}/series/leave` and shows `games_left`. */
export function SeriesLeaveButton({
  eventId,
  disabled,
  onLeft,
  onError,
}: {
  eventId: string;
  disabled?: boolean;
  /** `gamesLeft` is the server's `games_left` (null when it did not send it). */
  onLeft: (gamesLeft: number | null) => void;
  onError: (message: string) => void;
}): React.JSX.Element {
  const t = useT();
  const [busy, setBusy] = useState(false);
  const run = async (): Promise<void> => {
    setBusy(true);
    try {
      const result = await withCorrelationId(correlationId => leaveEventSeries(eventId, { correlationId }));
      onLeft(result.gamesLeft);
    } catch (e) {
      onError(refusalText(e, t, 'mob.game_detail.leave_error'));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Button
      label={t('web.series.leave')}
      variant="secondary"
      loading={busy}
      disabled={disabled}
      onPress={() =>
        Alert.alert(t('web.series.leave'), t('web.series.leave_confirm'), [
          { text: t('mob.common.cancel'), style: 'cancel' },
          { text: t('web.series.leave'), style: 'destructive', onPress: run },
        ])
      }
      style={styles.action}
      testID="series-leave"
    />
  );
}

/** Confirmation, then `POST /events/{id}/series/cancel`: this and the following games. */
export function confirmSeriesCancel(options: {
  t: TranslateFn;
  eventId: string;
  reason: string;
  onDone: () => void;
  onError: (message: string) => void;
}): void {
  const { t } = options;
  Alert.alert(t('web.series.scope_cancel_title'), t('web.series.cancel_confirm'), [
    { text: t('mob.common.cancel'), style: 'cancel' },
    {
      text: t('web.series.scope_following'),
      style: 'destructive',
      onPress: async () => {
        try {
          await withCorrelationId(correlationId => cancelEventSeries(options.eventId, options.reason, { correlationId }));
          options.onDone();
        } catch (e) {
          options.onError(refusalText(e, t, 'mob.game_detail.cancel_error'));
        }
      },
    },
  ]);
}

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * Edit this and the following games: only `start_time` (a local HH:MM; each game keeps its date) and `duration_minutes` (A21). A box left empty
 * or not readable is not sent; with nothing to send the screen says so.
 */
export function SeriesEditModal({
  visible,
  eventId,
  onClose,
  onSaved,
}: {
  visible: boolean;
  eventId: string;
  onClose: () => void;
  onSaved: () => void;
}): React.JSX.Element {
  const t = useT();
  const [startTime, setStartTime] = useState('');
  const [duration, setDuration] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const save = async (): Promise<void> => {
    const body: { start_time?: string; duration_minutes?: number } = {};
    if (TIME.test(startTime.trim())) {
      body.start_time = startTime.trim();
    }
    if (/^\d+$/.test(duration.trim()) && Number(duration) >= 1) {
      body.duration_minutes = Number(duration);
    }
    if (Object.keys(body).length === 0) {
      setError(t('web.series.edit_none'));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await withCorrelationId(correlationId => updateEventSeries(eventId, body, { correlationId }));
      setStartTime('');
      setDuration('');
      onSaved();
    } catch (e) {
      setError(refusalText(e, t, 'mob.game_detail.edit_error'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet} testID="series-edit-sheet">
          <Text style={styles.title} accessibilityRole="header">
            {t('web.series.edit_title')}
          </Text>
          <Text style={styles.note}>{t('web.series.edit_hint')}</Text>
          <Text style={styles.label}>{t('web.series.edit_start_time')}</Text>
          <TextField
            value={startTime}
            onChangeText={value => {
              setError(null);
              setStartTime(value);
            }}
            keyboardType="numbers-and-punctuation"
            maxLength={5}
            accessibilityLabel={t('web.series.edit_start_time')}
            editable={!busy}
            testID="series-edit-time"
          />
          <Text style={styles.label}>{t('web.series.edit_duration')}</Text>
          <TextField
            value={duration}
            onChangeText={value => {
              setError(null);
              setDuration(value);
            }}
            keyboardType="number-pad"
            maxLength={4}
            accessibilityLabel={t('web.series.edit_duration')}
            editable={!busy}
            testID="series-edit-duration"
          />
          {error ? (
            <Text style={styles.error} accessibilityRole="alert" testID="series-edit-error">
              {error}
            </Text>
          ) : null}
          <Button label={t('mob.common.save')} onPress={save} loading={busy} style={styles.action} testID="series-edit-save" />
          <Button label={t('mob.common.cancel')} variant="secondary" onPress={onClose} disabled={busy} style={styles.action} testID="series-edit-close" />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  info: { marginTop: spacing.sm },
  chip: { alignSelf: 'flex-start' },
  line: { ...typography.caption, color: colors.textSecondary, marginTop: spacing.xs },
  note: { ...typography.caption, color: colors.textSecondary, marginTop: spacing.sm },
  action: { marginTop: spacing.sm },
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: colors.scrim },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    borderTopWidth: borderWidth.thin,
    borderColor: colors.border,
    padding: spacing.md,
  },
  title: { ...typography.h3, color: colors.textPrimary },
  label: { ...typography.label, color: colors.textSecondary, marginTop: spacing.md, marginBottom: spacing.xs },
  error: { ...typography.bodyBold, color: colors.error, marginTop: spacing.sm },
});
