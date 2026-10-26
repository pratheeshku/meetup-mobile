/**
 * The organizer's payments panel of a game (DES-MEETUP-ADDENDUM-teams-payments v1.2 AD-9, "Mobile game panel"; rows and tiles of boards P1, P2):
 * tiles Registered / Paid / Unpaid and Cash collected from `GET /events/{id}/payments/summary`, one row per player who is going with a Paid switch
 * (`PUT .../participants/{user_id}/payment`, idempotent, undoable), the organizer's own row with the Organizer chip and no switch. A waitlisted person
 * has no row. The tiles move from the answer of each change; nothing is added up here. A refusal shows its own label, generic text only for a fault.
 * The host renders this for the organizer only, while the game fee is on and above 0.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { withCorrelationId } from '../api/correlationId';
import { getGamePaymentSummary, setGameParticipantPayment } from '../api/events';
import { useT } from '../labels/LabelsContext';
import { borderWidth, colors, spacing, typography } from '../theme/tokens';
import type { EventParticipant } from '../types/event';
import type { RegistrationSummary } from '../types/tournament';
import { formatMoney, hasFee } from '../utils/money';
import { refusalText } from '../utils/refusal';
import { Chip } from './tournament/v2/tabs/parts';
import { PaidSwitch, SummaryTiles } from './tournament/participants/parts';
import UserAvatar from './UserAvatar';

const AVATAR = 40;
const SWITCH_BOX = 56;

export default function GamePaymentsPanel(props: {
  eventId: string;
  eventTitle: string;
  organizerId: string;
  participants: EventParticipant[];
}): React.JSX.Element | null {
  const t = useT();
  // undefined: loading; null: the read failed (no tiles, no switches, never a guessed count).
  const [summary, setSummary] = useState<RegistrationSummary | null | undefined>(undefined);
  const [paid, setPaid] = useState<Record<string, string | null>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const load = useCallback(async () => {
    try {
      const next = await withCorrelationId(correlationId => getGamePaymentSummary(props.eventId, { correlationId }));
      if (mounted.current) {
        setSummary(next);
      }
    } catch {
      if (mounted.current) {
        setSummary(null);
      }
    }
  }, [props.eventId]);

  // Read on open and whenever the host reads the participants again; the server's rows replace local answers.
  useEffect(() => {
    setPaid({});
    load();
  }, [props.participants, load]);

  const going = useMemo(() => props.participants.filter(p => p.status === 'going'), [props.participants]);

  if (summary === undefined || (summary && !summary.payments_enabled)) {
    return null;
  }

  const toggle = async (userId: string, next: boolean): Promise<void> => {
    setBusy(userId);
    setErrors(previous => {
      const rest = { ...previous };
      delete rest[userId];
      return rest;
    });
    try {
      const result = await withCorrelationId(correlationId => setGameParticipantPayment(props.eventId, userId, next, { correlationId }));
      if (mounted.current) {
        setSummary(result.summary);
        setPaid(previous => ({ ...previous, [userId]: result.payment_received_at }));
      }
    } catch (e) {
      if (mounted.current) {
        setErrors(previous => ({ ...previous, [userId]: refusalText(e, t) }));
      }
    } finally {
      if (mounted.current) {
        setBusy(null);
      }
    }
  };

  const fee = summary && hasFee(summary.fee_cents) && summary.currency ? t('mob.pay.per_player', { amount: formatMoney(summary.fee_cents, summary.currency) }) : '';

  return (
    <View style={styles.card} testID="game-payments-panel">
      <Text style={styles.title} accessibilityRole="header">
        {t('mob.part.game_title')}
      </Text>
      {summary ? (
        <>
          <Text style={styles.sub} testID="game-payments-subtitle">
            {t('mob.part.game_subtitle', { name: props.eventTitle, fee })}
          </Text>
          <SummaryTiles summary={summary} teamMode={false} />
          {summary.unpaid > 0 ? (
            <Text style={styles.warning} testID="game-payments-warning">
              {t(summary.unpaid === 1 ? 'mob.part.game_warn_one' : 'mob.part.game_warn_other', { count: summary.unpaid })}
            </Text>
          ) : null}
        </>
      ) : (
        <Text style={styles.sub} testID="game-payments-failed">
          {t('mob.part.summary_failed')}
        </Text>
      )}
      {going.length === 0 ? <Text style={styles.sub}>{t('mob.part.game_empty')}</Text> : null}
      {going.map(p => {
        const name = p.user_display_name ?? p.user_nickname ?? '';
        const exempt = p.payment_exempt === true || p.user_id === props.organizerId;
        const paidAt = p.user_id in paid ? paid[p.user_id] : p.payment_received_at ?? null;
        const unpaid = !exempt && !paidAt;
        return (
          <View key={p.user_id} testID={`game-payment-${p.user_id}`}>
            <View style={[styles.row, unpaid && summary ? styles.rowUnpaid : null]}>
              <View style={styles.avatar}>
                <UserAvatar imageUrl={p.user_photo_url} name={name} size={AVATAR} fallback="initials" />
              </View>
              <View style={styles.text}>
                <Text style={styles.name} numberOfLines={1}>
                  {name}
                </Text>
                {exempt ? (
                  <View style={styles.chips}>
                    <Chip label={t('mob.tournament.participants.role_organizer')} tone="amber" />
                  </View>
                ) : null}
              </View>
              {summary && !exempt ? (
                <View style={styles.switchBox}>
                  <PaidSwitch value={Boolean(paidAt)} busy={busy === p.user_id} name={name} onChange={next => toggle(p.user_id, next)} testID={`game-paid-${p.user_id}`} />
                </View>
              ) : null}
            </View>
            {errors[p.user_id] ? (
              <Text style={styles.error} accessibilityRole="alert" testID={`game-payment-error-${p.user_id}`}>
                {errors[p.user_id]}
              </Text>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderWidth: borderWidth.thin, borderColor: colors.border, borderRadius: 12, padding: spacing.md, marginVertical: spacing.sm },
  title: { ...typography.bodyBold, color: colors.textPrimary },
  sub: { ...typography.caption, color: colors.textSecondary, marginVertical: spacing.sm },
  warning: { ...typography.caption, color: colors.textPrimary, backgroundColor: colors.warningLight, borderRadius: 8, padding: spacing.sm, marginBottom: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 60, paddingVertical: spacing.sm, borderTopWidth: borderWidth.thin, borderTopColor: colors.border },
  rowUnpaid: { backgroundColor: colors.warningLight },
  avatar: { width: AVATAR, height: AVATAR },
  text: { flex: 1, minWidth: 0, marginLeft: spacing.sm },
  name: { ...typography.bodyBold, color: colors.textPrimary },
  chips: { flexDirection: 'row' },
  switchBox: { width: SWITCH_BOX, alignItems: 'center', justifyContent: 'center' },
  error: { ...typography.caption, fontWeight: '600', color: colors.error, marginBottom: spacing.sm },
});
