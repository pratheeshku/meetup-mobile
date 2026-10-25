/**
 * The fee on the tournament view itself (DES-MEETUP-ADDENDUM-tournament-registration AD-4 Display): "Registration fee: {amount} per player|per
 * tournament team", or "Free registration". Shown only from `registration_fee_cents` / `registration_fee_currency`; nothing while the fee is
 * null (the server sends null while its fee flag is off) and nothing for a fee that cannot be formatted. No payment control.
 */
import React from 'react';
import { StyleSheet, Text } from 'react-native';

import { useT } from '../../labels/LabelsContext';
import { colors, spacing, typography } from '../../theme/tokens';
import type { Tournament } from '../../types/tournament';
import { hasFee } from '../../utils/money';
import { feeLineFor } from '../../utils/registration';

export default function TournamentFeeLine({ tournament }: { tournament: Tournament }): React.JSX.Element | null {
  const t = useT();
  const cents = tournament.registration_fee_cents;
  const currency = tournament.registration_fee_currency;
  if (typeof cents !== 'number' || (hasFee(cents) && !currency)) {
    return null;
  }
  return (
    <Text style={styles.line} testID="tournament-fee-line">
      {feeLineFor(t, cents, currency, tournament.participation_mode)}
    </Text>
  );
}

const styles = StyleSheet.create({
  line: { ...typography.bodyBold, color: colors.textPrimary, marginTop: spacing.sm },
});
