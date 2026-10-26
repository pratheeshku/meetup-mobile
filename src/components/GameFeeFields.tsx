/**
 * The optional game fee and its payee number (DES-MEETUP-ADDENDUM-teams-payments AD-8, AD-7), shared by Create game and Edit game.
 * Rendered only while the client-config switch `game_fee_enabled` is on (the caller passes `config` null otherwise): with the switch off the game
 * forms are exactly as before.
 *
 * - The amount is typed in the config currency (whole cents on the wire); empty or 0 is a free game.
 * - A fee above 0 shows the PayNow/PayLah number (prefilled from the organizer's profile, or the stored one when editing). The number is
 *   required with a fee; the server answers 422 PAYMENT_NUMBER_REQUIRED otherwise.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useT } from '../labels/LabelsContext';
import { colors, spacing, typography } from '../theme/tokens';
import { formatMoney, hasFee, parseAmountToCents } from '../utils/money';
import PayeeNumberField from './PayeeNumberField';
import TextField from './TextField';

export interface GameFeeConfig {
  currency: string | null;
  maxCents: number | null;
}

/** `{valid, cents}` of the typed fee against the server cap; empty is valid and free. */
export function parseGameFee(text: string, config: GameFeeConfig | null): { valid: boolean; cents: number | null } {
  if (!config) {
    return { valid: true, cents: null };
  }
  const parsed = parseAmountToCents(text);
  if (!parsed.valid) {
    return { valid: false, cents: null };
  }
  if (parsed.cents !== null && config.maxCents !== null && parsed.cents > config.maxCents) {
    return { valid: false, cents: null };
  }
  return { valid: true, cents: parsed.cents };
}

interface Props {
  config: GameFeeConfig;
  amount: string;
  onAmount: (text: string) => void;
  /** The stored payee number when editing (undefined: prefill from the organizer's profile). */
  initialNumber?: string | null;
  onNumber: (e164: string | null) => void;
  /** Shown under the amount, for example the "players have already joined" warning. */
  warning?: string | null;
  numberError?: string | null;
  testID?: string;
}

export default function GameFeeFields(props: Props): React.JSX.Element {
  const t = useT();
  const parsed = parseGameFee(props.amount, props.config);
  const max = props.config.currency && props.config.maxCents !== null ? formatMoney(props.config.maxCents, props.config.currency) : '';
  return (
    <View testID={props.testID ?? 'game-fee-fields'}>
      <Text style={styles.label}>{t('mob.game_fee.field_label')}</Text>
      <TextField
        value={props.amount}
        onChangeText={value => props.onAmount(value.replace(/[^0-9.]/g, ''))}
        keyboardType="decimal-pad"
        placeholder="0"
        accessibilityLabel={t('mob.game_fee.field_label')}
        style={parsed.valid ? undefined : styles.invalid}
        testID="game-fee-input"
      />
      <Text style={styles.hint}>{t('mob.game_fee.field_hint', { currency: props.config.currency ?? '' })}</Text>
      {!parsed.valid ? (
        <Text style={styles.error} accessibilityRole="alert" testID="game-fee-error">
          {t('mob.game_fee.field_error', { max })}
        </Text>
      ) : null}
      {props.warning ? (
        <Text style={styles.warning} accessibilityRole="alert" testID="game-fee-warning">
          {props.warning}
        </Text>
      ) : null}
      {parsed.valid && hasFee(parsed.cents) ? (
        <PayeeNumberField
          kind="game"
          initialValue={props.initialNumber}
          onChange={change => props.onNumber(change.e164)}
          error={props.numberError}
          testID="game-fee-payee"
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  label: { ...typography.bodyBold, color: colors.textPrimary, marginBottom: spacing.xs },
  invalid: { borderColor: colors.error },
  hint: { ...typography.caption, color: colors.textSecondary, marginTop: spacing.xs },
  error: { ...typography.bodyBold, color: colors.error, marginTop: spacing.xs },
  warning: { ...typography.bodyBold, color: colors.textPrimary, marginTop: spacing.sm },
});
