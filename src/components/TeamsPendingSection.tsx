/**
 * Pending section of Groups > Tournament teams > Mine (DES-MEETUP-ADDENDUM-nov10-enhancements NE-05, AD-5; the web has the same section).
 * Invitations to the caller (Accept / Decline) and join requests on teams the caller captains (Approve / Decline), from `GET /teams/pending`.
 * The actions are the existing respond endpoints; one correlation id per tap. After any action the parent reads Pending and Mine again.
 * A refusal shows its label (`refusalText`), never the server text. Role checks are the server's: this only lists what it returned.
 * No board exists for this section: it is built from existing tokens and components, and is for the owner to review.
 */
import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { withCorrelationId } from '../api/correlationId';
import { respondToTeamInvite, respondToTeamRequest } from '../api/teams';
import { useT } from '../labels/LabelsContext';
import { borderWidth, colors, radius, spacing, typography } from '../theme/tokens';
import type { PendingTeams } from '../types/team';
import { useSportDisplayName } from '../utils/labels';
import { refusalText } from '../utils/refusal';
import Button from './Button';

interface Props {
  pending: PendingTeams;
  /** Reads Pending and Mine again; resolves when both are done. */
  onChanged: () => Promise<void> | void;
}

function PendingRow({
  name,
  sport,
  sub,
  primaryLabel,
  secondaryLabel,
  busy,
  onPrimary,
  onSecondary,
  testID,
}: {
  name: string;
  sport: string;
  sub: string;
  primaryLabel: string;
  secondaryLabel: string;
  busy: boolean;
  onPrimary: () => void;
  onSecondary: () => void;
  testID: string;
}): React.JSX.Element {
  const sportLabel = useSportDisplayName(sport);
  return (
    <View style={styles.row} testID={testID}>
      <Text style={styles.name} numberOfLines={2}>
        {name}
      </Text>
      <Text style={styles.sub} numberOfLines={1}>
        {sportLabel}
      </Text>
      <Text style={styles.sub} numberOfLines={2}>
        {sub}
      </Text>
      <View style={styles.actions}>
        <Button label={primaryLabel} size="sm" style={styles.action} disabled={busy} onPress={onPrimary} testID={`${testID}-primary`} />
        <Button
          label={secondaryLabel}
          size="sm"
          variant="secondary"
          style={styles.action}
          disabled={busy}
          onPress={onSecondary}
          testID={`${testID}-secondary`}
        />
      </View>
    </View>
  );
}

export default function TeamsPendingSection({ pending, onChanged }: Props): React.JSX.Element | null {
  const t = useT();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!(pending.pending_count > 0)) {
    return null;
  }

  const who = (name: string | null): string => name || t('mob.teams.pending_unknown_person');

  const run = async (action: (correlationId: string) => Promise<void>): Promise<void> => {
    if (busy) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await withCorrelationId(action);
    } catch (e) {
      setError(refusalText(e, t, 'mob.team.action_failed'));
    }
    try {
      await onChanged();
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.section} testID="teams-pending">
      <View style={styles.header}>
        <Text style={styles.title} accessibilityRole="header">
          {t('mob.teams.pending_title')}
        </Text>
        <View style={styles.count}>
          <Text style={styles.countText}>{pending.pending_count}</Text>
        </View>
      </View>
      {error ? (
        <Text style={styles.error} accessibilityRole="alert" testID="teams-pending-error">
          {error}
        </Text>
      ) : null}
      {pending.invitations.length > 0 ? (
        <>
          <Text style={styles.heading}>{t('mob.teams.pending_invitations')}</Text>
          {pending.invitations.map(inv => (
            <PendingRow
              key={`inv-${inv.team_id}`}
              testID={`pending-invite-${inv.team_id}`}
              name={inv.team_name}
              sport={inv.sport}
              sub={t('mob.teams.pending_invited_by', { name: who(inv.inviter_display_name) })}
              primaryLabel={t('mob.team.accept')}
              secondaryLabel={t('mob.team.decline')}
              busy={busy}
              onPrimary={() => run(correlationId => respondToTeamInvite(inv.team_id, true, { correlationId }))}
              onSecondary={() => run(correlationId => respondToTeamInvite(inv.team_id, false, { correlationId }))}
            />
          ))}
        </>
      ) : null}
      {pending.requests.length > 0 ? (
        <>
          <Text style={styles.heading}>{t('mob.teams.pending_requests')}</Text>
          {pending.requests.map(req => (
            <PendingRow
              key={`req-${req.team_id}-${req.requester_user_id}`}
              testID={`pending-request-${req.team_id}-${req.requester_user_id}`}
              name={req.team_name}
              sport={req.sport}
              sub={t('mob.teams.pending_requested_by', { name: who(req.requester_display_name) })}
              primaryLabel={t('mob.team.approve')}
              secondaryLabel={t('mob.team.decline')}
              busy={busy}
              onPrimary={() => run(correlationId => respondToTeamRequest(req.team_id, req.requester_user_id, true, { correlationId }))}
              onSecondary={() => run(correlationId => respondToTeamRequest(req.team_id, req.requester_user_id, false, { correlationId }))}
            />
          ))}
        </>
      ) : null}
    </View>
  );
}

const COUNT_BOX = 22;

const styles = StyleSheet.create({
  section: { marginBottom: spacing.md },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  title: { ...typography.h3, color: colors.textPrimary },
  count: {
    minWidth: COUNT_BOX,
    height: COUNT_BOX,
    paddingHorizontal: spacing.xs,
    borderRadius: radius.full,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countText: { ...typography.label, color: colors.white },
  heading: { ...typography.label, color: colors.textMuted, textTransform: 'uppercase', marginTop: spacing.xs, marginBottom: spacing.xs },
  error: { ...typography.caption, color: colors.error, marginBottom: spacing.sm },
  row: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: borderWidth.thin,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  name: { ...typography.bodyBold, color: colors.textPrimary },
  sub: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  action: { flex: 1 },
});
