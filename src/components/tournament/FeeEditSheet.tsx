/**
 * Organizer fee edit (DES-MEETUP-ADDENDUM-tournament-registration AD-4 "Set and edit"; brief tr-mobile-5 M2). A small sheet, not a tournament edit
 * screen: one field in the config currency (the M3 field: `parseAmountToCents`, `feeMaxText`, `centsToAmountText`), prefilled with the stored fee.
 *
 * - Warning: shown when players have already registered (active rows, not withdrawn) AND the valid entry differs from the stored fee.
 * - Save: `PATCH /tournaments/{id}` with `{ registration_fee_cents }` (an integer, or null to clear) and, for a fee above 0, the PayNow/PayLah number
 *   (teams-payments AD-7: required with a fee; the stored number is the start, else the organizer's own profile number), only when something
 *   changed; an unchanged value just closes. A coded refusal shows its own label; 409: "Registration has closed"; 422: the field error.
 * - UX only: who may see this, and every refusal, is decided by the server.
 */
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { withCorrelationId } from '../../api/correlationId';
import { updateTournamentFee } from '../../api/tournaments';
import { classifyRefusal } from '../../utils/refusal';
import PayeeNumberField from '../PayeeNumberField';
import { useT } from '../../labels/LabelsContext';
import { borderWidth, colors, radius, sizes, spacing, typography } from '../../theme/tokens';
import { centsToAmountText, formatMoney, hasFee, parseAmountToCents } from '../../utils/money';
import { ChevronRightIcon } from '../icons/ActionIcons';
import Button from '../Button';
import TextField from '../TextField';
import BottomSheet from '../skills/BottomSheet';

export interface FeeEditConfig {
  currency: string | null;
  maxCents: number | null;
}

interface Props {
  tournamentId: string;
  /** The stored fee in whole cents; null or absent = free. */
  storedCents: number | null;
  /** The stored payee number (E.164) the organizer can read; null when none (the field then starts from the organizer's own profile number). */
  storedNumber?: string | null;
  config: FeeEditConfig;
  /** Registrations whose status is not "withdrawn". */
  activeRegistrations: number;
  onSaved: () => void;
  onClose: () => void;
}

export function feeMaxLabel(config: FeeEditConfig): string {
  return config.currency && config.maxCents !== null ? formatMoney(config.maxCents, config.currency) : '';
}

/** The row that opens the sheet (organizer only, while registration is open). Shows the current fee beside the label. */
export function FeeEditRow({
  storedCents,
  currency,
  onPress,
}: {
  storedCents: number | null;
  currency: string | null;
  onPress: () => void;
}): React.JSX.Element {
  const t = useT();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('mob.tournament.fee_edit_action')}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed ? styles.pressed : null]}
      testID="fee-edit-row"
    >
      <Text style={styles.rowLabel}>{t('mob.tournament.fee_edit_action')}</Text>
      <Text style={styles.rowValue} numberOfLines={1}>
        {hasFee(storedCents) && currency ? formatMoney(storedCents, currency) : t('mob.reg.free')}
      </Text>
      <ChevronRightIcon size={18} color={colors.textMuted} />
    </Pressable>
  );
}

export default function FeeEditSheet(props: Props): React.JSX.Element {
  const t = useT();
  const stored = props.storedCents ?? null;
  const [text, setText] = useState(stored === null ? '' : centsToAmountText(stored));
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const storedNumber = props.storedNumber ?? null;
  const [number, setNumber] = useState<string | null>(storedNumber);

  const parsed = parseAmountToCents(text);
  const { maxCents } = props.config;
  const valid = parsed.valid && (parsed.cents === null || maxCents === null || parsed.cents <= maxCents);
  const entered = parsed.valid ? parsed.cents : null;
  // The number is asked for when the fee is set or changed to an amount above 0; an unchanged fee leaves the stored number alone.
  const needsNumber = valid && hasFee(entered) && entered !== stored;
  const numberChanged = needsNumber && number !== storedNumber;
  const missingNumber = needsNumber && !number;
  const changed = valid && (entered !== stored || numberChanged);
  const fieldError = valid ? null : t('mob.tw.fee_error', { max: feeMaxLabel(props.config) });
  const showWarning = changed && props.activeRegistrations > 0;
  const numberWarning = numberChanged && storedNumber !== null && props.activeRegistrations > 0;

  const save = async (): Promise<void> => {
    if (busy) {
      return;
    }
    if (!valid) {
      return;
    }
    if (missingNumber) {
      setProblem(t('mob.reg.err.payment_number_required'));
      return;
    }
    if (!changed) {
      props.onClose();
      return;
    }
    setBusy(true);
    setProblem(null);
    try {
      await withCorrelationId(correlationId =>
        updateTournamentFee(props.tournamentId, entered, { correlationId, paymentContactNumber: number }),
      );
      props.onSaved();
    } catch (error) {
      const refusal = classifyRefusal(error, 'mob.tw.fee_edit_failed');
      const status = refusal.status;
      setProblem(
        refusal.code !== null && refusal.code.startsWith('PAYMENT_NUMBER')
          ? t(refusal.labelKey)
          : status === 409
          ? t('mob.tw.fee_edit_closed')
          : status === 422
          ? t('mob.tw.fee_error', { max: feeMaxLabel(props.config) })
          : t('mob.tw.fee_edit_failed'),
      );
      setBusy(false);
    }
  };

  return (
    <BottomSheet onClose={props.onClose} closeLabel={t('mob.common.close')}>
      <View testID="fee-edit-sheet">
        <Text style={styles.title} accessibilityRole="header">
          {t('mob.tw.fee_edit_title')}
        </Text>
        <Text style={styles.label}>{t('mob.tw.fee_label')}</Text>
        <TextField
          value={text}
          onChangeText={value => {
            setProblem(null);
            setText(value.replace(/[^0-9.]/g, ''));
          }}
          keyboardType="decimal-pad"
          placeholder="0"
          accessibilityLabel={t('mob.tw.fee_label')}
          style={fieldError ? styles.invalid : undefined}
          editable={!busy}
          testID="fee-edit-input"
        />
        <Text style={styles.hint}>{t('mob.tw.fee_hint', { currency: props.config.currency ?? '' })}</Text>
        {fieldError ? (
          <Text style={styles.error} accessibilityRole="alert" testID="fee-edit-field-error">
            {fieldError}
          </Text>
        ) : null}
        {needsNumber ? (
          <PayeeNumberField
            kind="tournament"
            initialValue={storedNumber ?? undefined}
            onChange={change => {
              setProblem(null);
              setNumber(change.e164);
            }}
            testID="fee-edit-payee"
          />
        ) : null}
        {showWarning ? (
          <Text style={styles.warning} accessibilityRole="alert" testID="fee-edit-warning">
            {t('mob.tw.fee_edit_warning')}
          </Text>
        ) : null}
        {numberWarning ? (
          <Text style={styles.warning} accessibilityRole="alert" testID="fee-edit-number-warning">
            {t('mob.pay.number_change_warning')}
          </Text>
        ) : null}
        {problem ? (
          <Text style={styles.error} accessibilityRole="alert" testID="fee-edit-error">
            {problem}
          </Text>
        ) : null}
        <View style={styles.buttons}>
          <Button
            label={t('mob.reg.cancel')}
            variant="secondary"
            onPress={props.onClose}
            disabled={busy}
            style={styles.button}
            testID="fee-edit-cancel"
          />
          <Button
            label={t('mob.tw.fee_edit_save')}
            onPress={save}
            loading={busy}
            disabled={!valid}
            style={styles.button}
            testID="fee-edit-save"
          />
        </View>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: sizes.touchTarget,
    borderWidth: borderWidth.thin,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  pressed: { opacity: 0.8 },
  rowLabel: { ...typography.bodyBold, color: colors.textPrimary, flex: 1 },
  rowValue: { ...typography.body, color: colors.textSecondary, marginRight: spacing.sm },
  title: { ...typography.h3, color: colors.textPrimary },
  label: { ...typography.bodyBold, color: colors.textPrimary, marginTop: spacing.md, marginBottom: spacing.xs },
  invalid: { borderColor: colors.error },
  hint: { ...typography.caption, color: colors.textSecondary, marginTop: spacing.xs },
  error: { ...typography.bodyBold, color: colors.error, marginTop: spacing.sm },
  warning: { ...typography.bodyBold, color: colors.textPrimary, marginTop: spacing.sm },
  buttons: { flexDirection: 'row', marginTop: spacing.lg },
  button: { flex: 1, marginHorizontal: spacing.xs },
});
