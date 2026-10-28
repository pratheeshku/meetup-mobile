/**
 * "Repeat weekly" on Create game step 3 (DES-MEETUP-ADDENDUM-tournament-edit-recurring AD-8; A38 board of record, nearest board family
 * `design-ref-p23/Game3When`). A switch, the interval in weeks, the read-only weekday of the start date, and one end rule: after a number of
 * games or on a date. No bound is hard-coded: the server answers `SERIES_LIMIT_EXCEEDED` or `SERIES_END_INVALID` and the screen shows the label.
 * The copy says invitations go to the first game only. Theme tokens only.
 */
import React from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';

import { useT } from '../labels/LabelsContext';
import { borderWidth, colors, radius, spacing, typography } from '../theme/tokens';
import type { RepeatEnd, RepeatState } from '../utils/repeatWeekly';
import DateTimePickerField from './DateTimePickerField';
import OptionChips from './OptionChips';
import TextField from './TextField';

export interface RepeatWeeklyControlProps {
  state: RepeatState;
  onChange: (next: RepeatState) => void;
  /** The weekday name of the chosen start date: a label on that date, not an occurrence and not sent. */
  weekday: string;
  /** The label shown when the screen refused the control (a message already resolved by the screen). */
  error: string | null;
  disabled?: boolean;
}

export default function RepeatWeeklyControl({ state, onChange, weekday, error, disabled }: RepeatWeeklyControlProps): React.JSX.Element {
  const t = useT();
  const patch = (change: Partial<RepeatState>): void => onChange({ ...state, ...change });
  return (
    <View style={styles.box} testID="repeat-weekly">
      <View style={styles.headRow}>
        <Text style={styles.title}>{t('web.series.repeat_toggle')}</Text>
        <Switch
          value={state.on}
          onValueChange={on => patch({ on })}
          disabled={disabled}
          trackColor={{ false: colors.border, true: colors.primaryLight }}
          thumbColor={state.on ? colors.primary : colors.textMuted}
          accessibilityLabel={t('web.series.repeat_toggle')}
          testID="repeat-toggle"
        />
      </View>
      {state.on ? (
        <View>
          <Text style={styles.label}>{t('web.series.every_label')}</Text>
          <View style={styles.everyRow}>
            <TextField
              value={state.every}
              onChangeText={every => patch({ every })}
              keyboardType="number-pad"
              maxLength={3}
              accessibilityLabel={t('web.series.every_label')}
              style={styles.everyInput}
              editable={!disabled}
              testID="repeat-every"
            />
            <Text style={styles.suffix}>{t('web.series.weeks_suffix')}</Text>
          </View>
          <Text style={styles.note} testID="repeat-weekday">
            {t('web.series.weekday_note', { weekday })}
          </Text>

          <Text style={styles.label}>{t('web.series.end_title')}</Text>
          <OptionChips<RepeatEnd>
            options={[
              { value: 'count', label: t('web.series.end_count') },
              { value: 'date', label: t('web.series.end_date') },
            ]}
            value={state.end}
            onChange={end => patch({ end })}
            disabled={disabled}
          />
          {state.end === 'count' ? (
            <View>
              <Text style={styles.label}>{t('web.series.end_count_label')}</Text>
              <TextField
                value={state.count}
                onChangeText={count => patch({ count })}
                keyboardType="number-pad"
                maxLength={3}
                accessibilityLabel={t('web.series.end_count_label')}
                editable={!disabled}
                testID="repeat-count"
              />
            </View>
          ) : null}
          {state.end === 'date' ? (
            <View>
              <Text style={styles.label}>{t('web.series.end_date_label')}</Text>
              <DateTimePickerField
                mode="date"
                value={state.endDate}
                onChange={endDate => patch({ endDate })}
                accessibilityLabel={t('web.series.end_date_label')}
                disabled={disabled}
                testID="repeat-end-date"
              />
            </View>
          ) : null}
          <Text style={styles.note} testID="repeat-invite-note">
            {t('web.series.invite_note')}
          </Text>
        </View>
      ) : null}
      {error ? (
        <Text style={styles.error} accessibilityRole="alert" testID="repeat-error">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    marginTop: spacing.md,
    padding: spacing.md,
    borderWidth: borderWidth.thin,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  headRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { ...typography.bodyBold, color: colors.textPrimary, flex: 1, marginRight: spacing.md },
  label: { ...typography.label, color: colors.textSecondary, marginTop: spacing.md, marginBottom: spacing.xs },
  everyRow: { flexDirection: 'row', alignItems: 'center' },
  everyInput: { width: 72 },
  suffix: { ...typography.body, color: colors.textPrimary, marginLeft: spacing.sm },
  note: { ...typography.caption, color: colors.textSecondary, marginTop: spacing.sm },
  error: { ...typography.bodyBold, color: colors.error, marginTop: spacing.sm },
});
