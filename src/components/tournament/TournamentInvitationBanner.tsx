/**
 * Invitation banner for Tournament Detail (addendum AD-4, v1.2.1). Driven only
 * by the server's `my_invitation_status`:
 *   pending  -> "You're invited" prompt with Accept / Decline
 *   accepted -> "You're invited" confirmation, no buttons
 *   null     -> nothing
 * Accepting makes the invitee eligible to register; it does not register them.
 * `409 INVITES_CLOSED` (registration closed) shows the server's text and
 * refreshes. The server decides every response.
 */
import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { withCorrelationId } from '../../api/correlationId';
import { respondToTournamentInvitation } from '../../api/tournaments';
import { isNotFoundError } from '../../utils/apiError';
import { useT } from '../../labels/LabelsContext';
import { colors, radius, spacing, typography } from '../../theme/tokens';
import type { TournamentInvitationStatus } from '../../types/tournament';
import { isInvitesClosed, readTournamentInviteError } from '../../utils/tournamentInviteError';
import Button from '../Button';
import Card from '../Card';

interface Props {
  tournamentId: string;
  status: TournamentInvitationStatus | null | undefined;
  /** Re-fetches the tournament so `my_invitation_status` reflects the server. */
  onResponded: (result?: { accepted: boolean }) => Promise<void>;
  /** The respond call answered 404 (gone or no longer visible): the screen closes with the neutral message. */
  onNotFound?: () => void;
}

export default function TournamentInvitationBanner({
  tournamentId,
  status,
  onResponded,
  onNotFound,
}: Props): React.JSX.Element | null {
  const t = useT();
  const [busy, setBusy] = useState<'accept' | 'decline' | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Stays mounted so a server message (e.g. INVITES_CLOSED) survives the refresh
  // that may clear or change the status.
  if (status !== 'pending') {
    if (error) {
      return <Text style={styles.errorText}>{error}</Text>;
    }
    if (status !== 'accepted') {
      return null;
    }
    return (
      <View style={styles.acceptedPill} testID="tournament-invited-accepted">
        <Text style={styles.acceptedText}>{t('mob.tournament.invited_accepted')}</Text>
      </View>
    );
  }

  const respond = async (accept: boolean): Promise<void> => {
    setError(null);
    setBusy(accept ? 'accept' : 'decline');
    try {
      await withCorrelationId(async correlationId => {
        await respondToTournamentInvitation(tournamentId, accept, { correlationId });
      });
    } catch (e) {
      if (isNotFoundError(e) && onNotFound) {
        setBusy(null);
        onNotFound();
        return;
      }
      const info = readTournamentInviteError(e);
      setError(
        info.message ??
          (isInvitesClosed(info)
            ? t('mob.tournament.invites_closed')
            : t('mob.tournament.invite_respond_error')),
      );
      if (isInvitesClosed(info)) {
        // Registration closed: the invitation is no longer actionable; reflect server state.
        await onResponded().catch(() => undefined);
      }
      setBusy(null);
      return;
    }
    try {
      await onResponded({ accepted: accept });
    } finally {
      setBusy(null);
    }
  };

  return (
    <View testID="tournament-invitation-banner">
    <Card style={styles.card}>
      <Text style={styles.title}>{t('mob.tournament.invited_banner_title')}</Text>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      <View style={styles.row}>
        <Button
          label={t('mob.tournament.invite_accept')}
          variant="primary"
          onPress={() => respond(true)}
          loading={busy === 'accept'}
          disabled={busy !== null}
          style={styles.rowButton}
        />
        <Button
          label={t('mob.tournament.invite_decline')}
          variant="secondary"
          onPress={() => respond(false)}
          loading={busy === 'decline'}
          disabled={busy !== null}
          style={styles.rowButton}
        />
      </View>
    </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: spacing.md },
  title: { ...typography.bodyBold, color: colors.textPrimary, marginBottom: spacing.sm },
  errorText: { ...typography.body, color: colors.error, marginBottom: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.sm },
  rowButton: { flex: 1, marginBottom: 0 },
  acceptedPill: {
    alignSelf: 'flex-start',
    backgroundColor: colors.successLight,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    marginBottom: spacing.md,
  },
  acceptedText: { ...typography.bodyBold, color: colors.textPrimary },
});
