/**
 * The Payment card (DES-MEETUP-ADDENDUM-teams-payments AD-7, board J7): what a person who registered for a tournament, or joined a game, owes and
 * how to pay it. It shows the amount, a Paid or Payment pending chip, the payee PayNow/PayLah number with Copy number, and the line that the
 * organizer marks the payment as received. The app takes no payment.
 *
 * - The number is the server's `payment_contact_number` and is shown only when the API returned it (null otherwise): then the card says "Ask the
 *   organizer how to pay". It is never logged, never put in an accessibility hint or an error, and appears only here and on the organizer screens.
 * - The caller renders the card only for the people the server allows (`my_registration` / `my_participation` present) and only when a fee applies;
 *   the organizer's own entry (`exempt`) has no payment and shows no card.
 */
import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useT } from '../../labels/LabelsContext';
import { borderWidth, colors, radius, spacing, typography } from '../../theme/tokens';
import { formatMoney, hasFee } from '../../utils/money';
import { formatPayeeNumber } from '../../utils/phoneNumber';
import { copyTextToClipboard } from '../../utils/shareLink';
import Button from '../Button';
import Toast from '../Toast';

export interface PaymentCardProps {
  /** The entrant's fee in whole cents (the effective fee, else the fee at registration). The card renders nothing without a fee above 0. */
  feeCents: number | null | undefined;
  currency: string | null | undefined;
  /** `team`: the fee is per tournament team. */
  perTeam?: boolean;
  /** True once the organizer marked the payment received. */
  paid: boolean;
  /** The organizer's own entry: no payment, no card. */
  exempt?: boolean;
  /** The payee number as the API returned it; null when withheld or not set. */
  number: string | null | undefined;
  /** A game's footnote ("players who joined") instead of the tournament one. */
  game?: boolean;
}

export default function PaymentCard(props: PaymentCardProps): React.JSX.Element | null {
  const t = useT();
  const [toast, setToast] = useState<string | null>(null);
  if (props.exempt || !hasFee(props.feeCents) || !props.currency) {
    return null;
  }
  const amount = formatMoney(props.feeCents, props.currency);
  const number = props.number?.trim() ? props.number.trim() : null;
  return (
    <View style={styles.card} testID="payment-card">
      <View style={styles.head}>
        <Text style={styles.title} accessibilityRole="header">
          {t('mob.pay.title')}
        </Text>
        <View style={[styles.chip, props.paid ? styles.chipPaid : styles.chipPending]} testID="payment-status-chip">
          <Text style={[styles.chipText, props.paid ? styles.chipTextPaid : null]}>
            {t(props.paid ? 'mob.pay.status_paid' : 'mob.pay.status_pending')}
          </Text>
        </View>
      </View>
      <View style={styles.line}>
        <Text style={styles.lineLabel}>{t('mob.pay.amount')}</Text>
        <Text style={styles.lineValue} testID="payment-amount">
          {t(props.perTeam ? 'mob.pay.per_team' : 'mob.pay.per_player', { amount })}
        </Text>
      </View>
      {number ? (
        <>
          <View style={styles.line}>
            <Text style={styles.lineLabel}>{t('mob.pay.pay_to')}</Text>
            <Text style={styles.lineValue} testID="payment-number">
              {formatPayeeNumber(number)}
            </Text>
          </View>
          <Button
            label={t('mob.pay.copy')}
            variant="secondary"
            onPress={() => {
              copyTextToClipboard(number);
              setToast(t('mob.pay.copied'));
            }}
            style={styles.copy}
            testID="payment-copy"
          />
        </>
      ) : (
        <Text style={styles.noNumber} testID="payment-no-number">
          {t('mob.pay.no_number')}
        </Text>
      )}
      <Text style={styles.footnote}>{t(props.game ? 'mob.pay.footnote_game' : 'mob.pay.footnote')}</Text>
      <Toast message={toast} onDismiss={() => setToast(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: spacing.md,
    marginVertical: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: borderWidth.thin,
    borderColor: colors.border,
    borderRadius: radius.lg,
  },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  title: { ...typography.bodyBold, color: colors.textPrimary },
  chip: { borderRadius: radius.full, paddingHorizontal: spacing.sm + 2, paddingVertical: 3 },
  chipPending: { backgroundColor: colors.warningLight },
  chipPaid: { backgroundColor: colors.successLight },
  chipText: { ...typography.label, color: colors.textPrimary },
  chipTextPaid: { color: colors.successDark },
  line: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  lineLabel: { ...typography.body, color: colors.textSecondary },
  lineValue: { ...typography.bodyBold, color: colors.textPrimary, flexShrink: 1, textAlign: 'right', marginLeft: spacing.sm },
  copy: { marginTop: spacing.sm },
  noNumber: { ...typography.body, color: colors.textPrimary, marginTop: spacing.xs },
  footnote: { ...typography.caption, color: colors.textSecondary, marginTop: spacing.sm + 2 },
});
