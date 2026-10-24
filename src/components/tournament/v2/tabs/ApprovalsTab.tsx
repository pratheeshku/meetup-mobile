/**
 * Approvals tab (boards TV2MobClosedApprovals, TV2MobLiveApprovals; web reference te-w2 `teApprovalsHtml`). Drawn only
 * when the server sent `tabs.approvals` (the host decides from the server object, not from a role). Requests that need
 * the viewer's decision come first, then the viewer's own waiting requests, then the history. Names, never ids. Approve
 * runs the request in the same call (version 2 has no code and no confirm); Reject takes NO reason and the screen has no
 * reason field; the maker's own pending request is withdrawn with the same reject route.
 *
 * Not built (te-a2 report): the board's "Review fixtures" sheet (the draft's matches before approving a publication).
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, View } from 'react-native';

import { withCorrelationId } from '../../../../api/correlationId';
import {
  approveCommitteeAction,
  getCommitteeActions,
  getCommitteeMembers,
  rejectCommitteeAction,
} from '../../../../api/tournaments';
import { useT } from '../../../../labels/LabelsContext';
import { dash } from '../../../../theme/dashboardTheme';
import { colors, spacing, typography } from '../../../../theme/tokens';
import type { CommitteeMember, Tournament } from '../../../../types/tournament';
import type { ApprovalRequest } from '../../../../types/tournamentTabs';
import { formatDayShort } from '../../../../utils/tournamentExperience';
import { approvalCards, type ApprovalCard } from '../../../../utils/tournamentTabs';
import Button from '../../../Button';
import { CardHead, EmptyLine, TabCard } from './parts';
import ReviewFixturesSheet from './ReviewFixturesSheet';
import type { StandingsBoard } from './useStandingsBoard';

export interface ApprovalsTabProps {
  tournament: Tournament;
  board: StandingsBoard;
  viewerId: string | undefined;
  /** Registration id (lower case) to display name, for the draft under review. */
  names: ReadonlyMap<string, string>;
  /** A decision was made: the host refreshes the badge and the page. */
  onDecided: () => void;
}

export default function ApprovalsTab(props: ApprovalsTabProps): React.JSX.Element {
  const t = useT();
  const { tournament } = props;
  const [requests, setRequests] = useState<ApprovalRequest[] | null>(null);
  const [members, setMembers] = useState<CommitteeMember[]>([]);
  const [failed, setFailed] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [toast, setToast] = useState<string | null>(null);
  const [reviewing, setReviewing] = useState<ApprovalCard | null>(null);

  const load = useCallback(async (): Promise<void> => {
    try {
      await withCorrelationId(async correlationId => {
        const [list, people] = await Promise.all([
          getCommitteeActions(tournament.id, { correlationId }),
          getCommitteeMembers(tournament.id, { correlationId }).catch(() => [] as CommitteeMember[]),
        ]);
        setRequests(list);
        setMembers(people);
      });
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, [tournament.id]);

  useEffect(() => {
    load();
  }, [load]);

  const cards = useMemo(() => {
    const names = new Map<string, string>();
    members.forEach(m => m.display_name && names.set(m.user_id.toLowerCase(), m.display_name));
    [tournament.organizer, ...(tournament.committee ?? [])].forEach(person => {
      if (person) {
        names.set(person.user_id.toLowerCase(), person.display_name);
      }
    });
    const active = members.filter(m => m.status === 'active').map(m => m.user_id);
    return approvalCards(requests ?? [], {
      viewerId: props.viewerId,
      names,
      activeMemberIds: active,
      isActiveMember: members.some(m => m.status === 'active' && m.user_id.toLowerCase() === props.viewerId?.toLowerCase()),
      view: props.board.view,
      matchLabel: (a, b) => t('mob.tournament.fixtures.match_label', { a, b }),
      groupLabel: group => t('mob.tournament.standings.group_title', { group }),
    });
  }, [requests, members, tournament.organizer, tournament.committee, props.viewerId, props.board.view, t]);

  const decide = async (card: ApprovalCard, verb: 'approve' | 'reject' | 'withdraw'): Promise<void> => {
    setBusyId(card.id);
    setNotes(previous => ({ ...previous, [card.id]: '' }));
    try {
      await withCorrelationId(correlationId =>
        verb === 'approve'
          ? approveCommitteeAction(tournament.id, card.id, { correlationId })
          : rejectCommitteeAction(tournament.id, card.id, { correlationId }),
      );
      setToast(t(verb === 'approve' ? 'mob.tournament.approvals.approved_ok' : verb === 'withdraw' ? 'mob.tournament.approvals.withdrawn_ok' : 'mob.tournament.approvals.rejected_ok'));
      await load();
      props.board.reload();
      props.onDecided();
    } catch (e) {
      setNotes(previous => ({ ...previous, [card.id]: t(approvalErrorKey(e)) }));
    } finally {
      setBusyId(null);
    }
  };

  const confirm = (card: ApprovalCard, verb: 'reject' | 'withdraw'): void => {
    Alert.alert(t(verb === 'reject' ? 'mob.tournament.approvals.confirm_reject' : 'mob.tournament.approvals.confirm_withdraw'), undefined, [
      { text: t('mob.tournament.close.cancel'), style: 'cancel' },
      {
        text: t(verb === 'reject' ? 'mob.tournament.approvals.reject' : 'mob.tournament.approvals.withdraw'),
        style: verb === 'reject' ? 'destructive' : 'default',
        onPress: () => decide(card, verb),
      },
    ]);
  };

  if (requests === null && !failed) {
    return <ActivityIndicator color={dash.brand} style={styles.loading} testID="approvals-loading" />;
  }
  if (failed && requests === null) {
    return (
      <TabCard>
        <EmptyLine text={t('mob.scoring.load_error')} />
      </TabCard>
    );
  }

  const needs = cards.filter(c => c.bucket === 'needs');
  const waiting = cards.filter(c => c.bucket === 'waiting');
  const history = cards.filter(c => c.bucket === 'history');

  const renderCard = (card: ApprovalCard): React.JSX.Element => {
    const when = formatDayShort(card.resolvedAt ?? card.createdAt);
    const meta = card.initiatorIsViewer
      ? t('mob.tournament.approvals.submitted_by_you', { name: card.initiatorName, when })
      : t('mob.tournament.approvals.requested_by', { name: card.initiatorName, when });
    const status =
      card.bucket !== 'history'
        ? null
        : card.status === 'executed' && card.approverName
          ? t('mob.tournament.approvals.approved_by', { name: card.approverName })
          : card.status === 'rejected' && card.approverName
            ? t('mob.tournament.approvals.rejected_by', { name: card.approverName })
            : null;
    return (
      <View key={card.id} style={styles.card} testID={`approval-${card.id}`}>
        <Text style={styles.title}>{t(card.titleKey)}</Text>
        {card.subject ? <Text style={styles.sub}>{card.subject}</Text> : null}
        {card.reason ? <Text style={styles.sub}>{`${t('mob.tournament.score.reason')}: ${card.reason}`}</Text> : null}
        <Text style={styles.sub}>{meta}</Text>
        {card.bucket === 'needs' ? <Text style={styles.needs}>{t('mob.tournament.approvals.needs_you')}</Text> : null}
        {card.bucket === 'waiting' && card.waitingFor ? (
          <Text style={styles.sub}>{t('mob.tournament.approvals.waiting_for', { names: card.waitingFor })}</Text>
        ) : null}
        {status ? <Text style={styles.status}>{status}</Text> : null}
        {notes[card.id] ? (
          <Text style={styles.error} accessibilityRole="alert">
            {notes[card.id]}
          </Text>
        ) : null}
        {card.canDecide || card.canWithdraw ? (
          <View style={styles.actions}>
            {card.canDecide ? (
              <>
                {card.draftId ? (
                  <Button
                    label={t('mob.tournament.approvals.review_and_approve')}
                    variant="secondary"
                    size="sm"
                    onPress={() => setReviewing(card)}
                    style={styles.action}
                    testID={`approval-review-${card.id}`}
                  />
                ) : null}
                <Button
                  label={t(card.titleKey === 'mob.tournament.approvals.type_publish' ? 'mob.tournament.approvals.approve_publish' : 'mob.tournament.approvals.approve')}
                  size="sm"
                  onPress={() => decide(card, 'approve')}
                  loading={busyId === card.id}
                  style={styles.action}
                  testID={`approval-approve-${card.id}`}
                />
                <Button
                  label={t('mob.tournament.approvals.reject')}
                  variant="secondary"
                  size="sm"
                  onPress={() => confirm(card, 'reject')}
                  disabled={busyId === card.id}
                  style={styles.action}
                  testID={`approval-reject-${card.id}`}
                />
              </>
            ) : (
              <Button
                label={t('mob.tournament.approvals.withdraw')}
                variant="secondary"
                size="sm"
                onPress={() => confirm(card, 'withdraw')}
                disabled={busyId === card.id}
                style={styles.action}
                testID={`approval-withdraw-${card.id}`}
              />
            )}
          </View>
        ) : null}
      </View>
    );
  };

  const section = (title: string, list: ApprovalCard[], empty: string): React.JSX.Element => (
    <TabCard>
      <CardHead title={title} badge={String(list.length)} />
      {list.length === 0 ? <EmptyLine text={empty} /> : list.map(renderCard)}
    </TabCard>
  );

  return (
    <View testID="tournament-approvals">
      {reviewing && reviewing.draftId ? (
        <ReviewFixturesSheet
          tournamentId={tournament.id}
          draftId={reviewing.draftId}
          requestedBy={t('mob.tournament.approvals.requested_by', { name: reviewing.initiatorName, when: formatDayShort(reviewing.createdAt) })}
          names={props.names}
          busy={busyId === reviewing.id}
          onApprove={async () => {
            const card = reviewing;
            await decide(card, 'approve');
            setReviewing(null);
          }}
          onReject={() => {
            const card = reviewing;
            setReviewing(null);
            confirm(card, 'reject');
          }}
          onClose={() => setReviewing(null)}
        />
      ) : null}
      <View style={styles.note}>
        <Text style={styles.noteText}>{t('mob.tournament.approvals.note')}</Text>
      </View>
      {toast ? (
        <Text style={styles.toast} accessibilityRole="alert">
          {toast}
        </Text>
      ) : null}
      {section(t('mob.tournament.approvals.needs_review'), needs, t('mob.tournament.approvals.nothing_waiting'))}
      {section(t('mob.tournament.approvals.waiting_title'), waiting, t('mob.tournament.approvals.nothing_submitted'))}
      {history.length > 0 ? section(t('mob.tournament.approvals.history'), history, t('mob.tournament.approvals.nothing_submitted')) : null}
    </View>
  );
}

/** Label of a refused decision, from the server's refusal (own request, a later match already has a result, out of date). */
export function approvalErrorKey(error: unknown) {
  const response = (error as { response?: { status?: number; data?: { code?: string; detail?: unknown } } } | null)?.response;
  const detail = typeof response?.data?.detail === 'string' ? response.data.detail : '';
  if (response?.data?.code === 'DOWNSTREAM_PLAYED') {
    return 'mob.tournament.approvals.err.downstream' as const;
  }
  if (response?.status === 403) {
    return /own request/i.test(detail) ? ('mob.tournament.approvals.err.own' as const) : ('mob.tournament.approvals.err.forbidden' as const);
  }
  if (response?.status === 409 && /stale/i.test(detail)) {
    return 'mob.tournament.approvals.err.stale' as const;
  }
  if (response?.status === 409 && /not pending/i.test(detail)) {
    return 'mob.tournament.approvals.err.not_pending' as const;
  }
  return 'mob.tournament.score.save_failed' as const;
}

const styles = StyleSheet.create({
  loading: { marginVertical: spacing.lg },
  note: { backgroundColor: colors.avatarTint5, borderRadius: 16, padding: spacing.md, marginBottom: spacing.md },
  noteText: { ...typography.bodyBold, color: colors.avatarTintText5 },
  toast: { ...typography.bodyBold, color: colors.successDark, marginBottom: spacing.sm },
  card: { paddingVertical: spacing.sm },
  title: { ...typography.bodyBold, color: dash.text },
  sub: { ...typography.caption, color: dash.textMuted, marginTop: 2 },
  needs: { ...typography.label, color: colors.error, marginTop: spacing.xs },
  status: { ...typography.bodyBold, color: dash.text, marginTop: spacing.xs },
  error: { ...typography.caption, color: colors.error, marginTop: spacing.xs },
  actions: { flexDirection: 'row', flexWrap: 'wrap', marginTop: spacing.sm },
  action: { marginRight: spacing.sm },
});
