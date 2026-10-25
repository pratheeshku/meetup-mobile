/**
 * Registration dates, boards TV2MobCreateDates and TV2MobCreateDatesErr (tournament-experience AD-T4): the soft block
 * and the hard block, a checklist of the three rules, and a "So far" summary. Registration opens at creation
 * (AD-20: DB now()), so that row is information, not a field. The rules mirror the server for early feedback only:
 * the server's answer always wins. Rule state is carried by the glyph (check or cross) as well as the colour.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useT } from '../../../labels/LabelsContext';
import { borderWidth, colors, radius, spacing, typography } from '../../../theme/tokens';
import DateTimePickerField from '../../DateTimePickerField';
import TextField from '../../TextField';
import { CheckIcon, CrossIcon } from '../../icons/ActionIcons';
import { FieldLabel, SectionCard, StepHeading, tokenFor, type StepFocus } from './parts';
import { formatMoney, parseAmountToCents } from '../../../utils/money';
import { registrationRules, toDate, type RuleState, type WizardFeeConfig, type WizardState } from '../../../utils/tournamentWizard';

const RULE_BOX = 22;

export function formatDay(date: Date): string {
  return date.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
}

/** "Sat 14 Nov, 9:00 AM". */
export function formatDayTime(date: Date): string {
  return `${formatDay(date)}, ${date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`;
}

function shortDay(date: Date): string {
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

export default function RegistrationStep({
  state,
  now,
  onClosure,
  onHardBlock,
  fee,
  onFee,
  errors,
  focus,
}: {
  state: WizardState;
  now: Date;
  onClosure: (value: string) => void;
  onHardBlock: (value: string) => void;
  /** Null while the server's fee flag is off: the fee field is not shown (tournament-registration AD-4, OI-10). */
  fee?: WizardFeeConfig | null;
  onFee?: (value: string) => void;
  errors: Record<string, string>;
  focus?: StepFocus;
}): React.JSX.Element {
  const t = useT();
  const closes = toDate(state.closesAt);
  const hard = toDate(state.hardBlockAt);
  const starts = toDate(state.startsAt);
  const dash = t('mob.tw.reg_tl_unset');
  const rules = registrationRules(state, now);
  const parsedFee = parseAmountToCents(state.feeAmount);
  const previewCents = parsedFee.valid ? parsedFee.cents : null;
  const firstGame = starts ? formatDayTime(starts) : dash;
  const rows: { key: 'future' | 'order' | 'start'; state: RuleState; text: string }[] = [
    { key: 'future', state: rules.future, text: t('mob.tw.dates_rule_future') },
    { key: 'order', state: rules.order, text: t('mob.tw.dates_rule_order') },
    { key: 'start', state: rules.start, text: t('mob.tw.dates_rule_start', { when: firstGame }) },
  ];
  return (
    <View>
      <StepHeading>{t('mob.tw.dates_title')}</StepHeading>
      <SectionCard>
        <FieldLabel>{t('mob.tw.reg_opens')}</FieldLabel>
        <View style={styles.readonly}>
          <Text style={styles.readonlyText} testID="tw-reg-opens">
            {t('mob.tw.dates_opens_now', { date: formatDay(now) })}
          </Text>
        </View>

        <FieldLabel>{t('mob.tw.dates_soft')}</FieldLabel>
        <DateTimePickerField
          mode="datetime"
          value={state.closesAt}
          onChange={onClosure}
          placeholder={t('mob.tw.pick_date')}
          accessibilityLabel={t('mob.tw.dates_soft')}
          focusToken={tokenFor(focus, 'registration_closes_at')}
          testID="tw-soft-block"
        />
        {errors.registration_closes_at ? (
          <FieldProblem message={errors.registration_closes_at} testID="tw-soft-error" />
        ) : null}

        <FieldLabel>{t('mob.tw.dates_hard')}</FieldLabel>
        <DateTimePickerField
          mode="datetime"
          value={state.hardBlockAt}
          onChange={onHardBlock}
          placeholder={t('mob.tw.pick_date')}
          accessibilityLabel={t('mob.tw.dates_hard')}
          focusToken={tokenFor(focus, 'registration_hard_block_at')}
          testID="tw-hard-block"
        />
        {errors.registration_hard_block_at ? (
          <FieldProblem message={errors.registration_hard_block_at} testID="tw-hard-error" />
        ) : null}

        {fee && onFee ? (
          <>
            <FieldLabel>{t('mob.tw.fee_label')}</FieldLabel>
            <TextField
              value={state.feeAmount}
              onChangeText={onFee}
              keyboardType="decimal-pad"
              placeholder="0"
              accessibilityLabel={t('mob.tw.fee_label')}
              style={errors.registration_fee_cents ? styles.invalidField : undefined}
              testID="tw-fee"
            />
            <Text style={styles.feeHint}>{t('mob.tw.fee_hint', { currency: fee.currency ?? '' })}</Text>
            {previewCents !== null && fee.currency && !errors.registration_fee_cents ? (
              <Text style={styles.feeHint} testID="tw-fee-preview">
                {t('mob.tw.fee_preview', { amount: formatMoney(previewCents, fee.currency) })}
              </Text>
            ) : null}
            {errors.registration_fee_cents ? (
              <FieldProblem message={errors.registration_fee_cents} testID="tw-fee-error" />
            ) : null}
          </>
        ) : null}

        <View style={styles.rules} testID="tw-date-rules">
          {rows.map(row => (
            <View key={row.key} style={styles.ruleRow} testID={`tw-rule-${row.key}-${row.state}`}>
              <View
                style={[
                  styles.ruleBox,
                  row.state === 'ok' ? styles.ruleOk : row.state === 'bad' ? styles.ruleBad : styles.ruleUnknown,
                ]}
                accessible
                accessibilityLabel={
                  row.state === 'ok'
                    ? t('mob.tw.dates_rule_ok_a11y')
                    : row.state === 'bad'
                    ? t('mob.tw.dates_rule_bad_a11y')
                    : undefined
                }
              >
                {row.state === 'ok' ? <CheckIcon size={14} color={colors.white} /> : null}
                {row.state === 'bad' ? <CrossIcon size={14} color={colors.white} /> : null}
              </View>
              <Text style={[styles.ruleText, row.state === 'bad' ? styles.ruleTextBad : null]}>{row.text}</Text>
            </View>
          ))}
        </View>
      </SectionCard>

      <SectionCard style={styles.sofar}>
        <Text style={styles.sofarTitle}>{t('mob.tw.dates_sofar')}</Text>
        <SoFarRow label={t('mob.tw.dates_sofar_soft')} value={closes ? shortDay(closes) : dash} />
        <SoFarRow label={t('mob.tw.dates_sofar_hard')} value={hard ? shortDay(hard) : dash} />
        <SoFarRow
          label={t('mob.tw.dates_sofar_first')}
          value={starts ? `${shortDay(starts)}, ${starts.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}` : dash}
        />
        <Text style={styles.sofarNote}>{t('mob.tw.dates_sofar_note')}</Text>
      </SectionCard>
    </View>
  );
}

function FieldProblem({ message, testID }: { message: string; testID: string }): React.JSX.Element {
  return (
    <View style={styles.problem} accessibilityRole="alert">
      <View style={styles.problemGlyph}>
        <CrossIcon size={12} color={colors.error} />
      </View>
      <Text style={styles.problemText} testID={testID}>
        {message}
      </Text>
    </View>
  );
}

function SoFarRow({ label, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <View style={styles.sofarRow}>
      <Text style={styles.sofarLabel}>{label}</Text>
      <Text style={styles.sofarValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  readonly: {
    minHeight: 48,
    borderWidth: borderWidth.medium,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.track,
    justifyContent: 'center',
    paddingHorizontal: spacing.md - 2,
  },
  readonlyText: { ...typography.body, color: colors.textPrimary },
  invalidField: { borderColor: colors.error },
  feeHint: { ...typography.caption, color: colors.textSecondary, marginTop: spacing.xs },
  problem: { flexDirection: 'row', alignItems: 'flex-start', marginTop: spacing.xs },
  problemGlyph: { width: 18, height: 18, alignItems: 'center', justifyContent: 'center', marginRight: spacing.xs },
  problemText: { ...typography.caption, fontWeight: '600', color: colors.error, flex: 1 },
  rules: { marginTop: spacing.md },
  ruleRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: spacing.sm },
  ruleBox: {
    width: RULE_BOX,
    height: RULE_BOX,
    borderRadius: RULE_BOX / 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  ruleOk: { backgroundColor: colors.successDark },
  ruleBad: { backgroundColor: colors.error },
  ruleUnknown: { borderWidth: borderWidth.medium, borderColor: colors.border },
  ruleText: { ...typography.caption, fontWeight: '600', color: colors.textPrimary, flex: 1 },
  ruleTextBad: { color: colors.error },
  sofar: { marginTop: spacing.md },
  sofarTitle: { ...typography.bodyBold, color: colors.textPrimary, marginBottom: spacing.sm },
  sofarRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.xs },
  sofarLabel: { ...typography.caption, color: colors.textSecondary },
  sofarValue: { ...typography.caption, fontWeight: '700', color: colors.textPrimary },
  sofarNote: { ...typography.caption, color: colors.textSecondary, marginTop: spacing.sm },
});
