/**
 * Step 5, boards TournReg / TournRegErrGap / TournRegErrOrder / TournRegErrStart: soft block (registration closes),
 * hard block (roster frozen), and the "what this means" timeline. Registration opens at creation (AD-20: DB now()),
 * so that row is information, not a field.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useT } from '../../../labels/LabelsContext';
import { colors, spacing, typography } from '../../../theme/tokens';
import DateTimePickerField from '../../DateTimePickerField';
import { FieldError, FieldLabel, SectionCard, StepHeading } from './parts';
import { toDate, type WizardState } from '../../../utils/tournamentWizard';

const DOT = 14;

export function formatDay(date: Date): string {
  return date.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
}

export default function RegistrationStep({
  state,
  now,
  onClosure,
  onHardBlock,
  errors,
}: {
  state: WizardState;
  now: Date;
  onClosure: (value: string) => void;
  onHardBlock: (value: string) => void;
  errors: Record<string, string>;
}): React.JSX.Element {
  const t = useT();
  const closes = toDate(state.closesAt);
  const hard = toDate(state.hardBlockAt);
  const starts = toDate(state.startsAt);
  const dash = t('mob.tw.reg_tl_unset');
  // A date that failed its rule is shown as "—" in the timeline, as the error boards do.
  const shown = (date: Date | null, field: string): string => (date && !errors[field] ? formatDay(date) : dash);
  const steps: { color: 'green' | 'blue' | 'grey'; title: string; when: string }[] = [
    { color: 'green', title: t('mob.tw.reg_tl_opens'), when: formatDay(now) },
    { color: 'blue', title: t('mob.tw.reg_tl_soft'), when: shown(closes, 'registration_closes_at') },
    { color: 'grey', title: t('mob.tw.reg_tl_hard'), when: shown(hard, 'registration_hard_block_at') },
    { color: 'grey', title: t('mob.tw.reg_tl_start'), when: starts ? formatDay(starts) : dash },
  ];
  return (
    <View>
      <StepHeading>{t('mob.tw.step_registration')}</StepHeading>
      <SectionCard title={t('mob.tw.reg_section')}>
        <FieldLabel>{t('mob.tw.reg_opens')}</FieldLabel>
        <Text style={styles.readonly} testID="tw-reg-opens">
          {t('mob.tw.reg_opens_today', { date: formatDay(now) })}
        </Text>

        <FieldLabel>{t('mob.tw.reg_soft')}</FieldLabel>
        <DateTimePickerField
          mode="datetime"
          value={state.closesAt}
          onChange={onClosure}
          placeholder={t('mob.tw.pick_date')}
          accessibilityLabel={t('mob.tw.reg_soft')}
          testID="tw-soft-block"
        />
        {errors.registration_closes_at ? (
          <FieldError message={errors.registration_closes_at} testID="tw-soft-error" />
        ) : (
          <Text style={styles.help}>{t('mob.tw.reg_soft_help')}</Text>
        )}

        <FieldLabel>{t('mob.tw.reg_hard')}</FieldLabel>
        <DateTimePickerField
          mode="datetime"
          value={state.hardBlockAt}
          onChange={onHardBlock}
          placeholder={t('mob.tw.pick_date')}
          accessibilityLabel={t('mob.tw.reg_hard')}
          testID="tw-hard-block"
        />
        {errors.registration_hard_block_at ? (
          <FieldError message={errors.registration_hard_block_at} testID="tw-hard-error" />
        ) : (
          <Text style={styles.help}>{t('mob.tw.reg_hard_help')}</Text>
        )}
      </SectionCard>

      <SectionCard title={t('mob.tw.reg_means')} style={styles.timeline}>
        {steps.map((item, index) => (
          <View key={item.title} style={styles.timelineRow}>
            <View style={styles.dotColumn}>
              <View style={[styles.dot, item.color === 'green' ? styles.dotGreen : item.color === 'blue' ? styles.dotBlue : styles.dotGrey]} />
              {index < steps.length - 1 ? <View style={styles.line} /> : null}
            </View>
            <View style={styles.timelineText}>
              <Text style={styles.timelineTitle}>{item.title}</Text>
              <Text style={styles.timelineWhen}>{item.when}</Text>
            </View>
          </View>
        ))}
      </SectionCard>
    </View>
  );
}

const styles = StyleSheet.create({
  readonly: { ...typography.body, color: colors.textPrimary, paddingVertical: spacing.sm },
  help: { ...typography.caption, color: colors.textSecondary, marginTop: spacing.xs },
  timeline: { marginTop: spacing.md },
  timelineRow: { flexDirection: 'row' },
  dotColumn: { width: DOT + spacing.sm, alignItems: 'center' },
  dot: { width: DOT, height: DOT, borderRadius: DOT / 2 },
  dotGreen: { backgroundColor: colors.success },
  dotBlue: { backgroundColor: colors.primary },
  dotGrey: { backgroundColor: colors.border },
  line: { width: 2, flex: 1, backgroundColor: colors.border, minHeight: spacing.md },
  timelineText: { flex: 1, paddingLeft: spacing.sm, paddingBottom: spacing.sm },
  timelineTitle: { ...typography.bodyBold, color: colors.textPrimary },
  timelineWhen: { ...typography.caption, color: colors.textSecondary },
});
