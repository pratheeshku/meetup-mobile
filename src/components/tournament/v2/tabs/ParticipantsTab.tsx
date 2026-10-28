/**
 * Participants tab (boards TV2MobOpenParticipants, TV2MobDoneParticipants; teams-payments boards P1-P5, DES-MEETUP-ADDENDUM-teams-payments AD-9 to AD-13):
 * one row per entrant, a player or a tournament team (the team's name, never a member's). For everyone: a search box, the entrants, a details pop-up
 * on tap. For the organizer and committee, while a fee applies: the summary tiles with Cash collected, the unpaid or excluded count first, the
 * All, Paid, Unpaid filters, a Paid switch per row (undoable), and, where the fixture engine applies, a points box per row (it replaces the points
 * Excel). Remove sits in the row's menu and in the details pop-up, behind "Are you sure?".
 *
 * Every figure comes from the server: `GET .../registrations/summary` for the tiles, the cash, the unpaid and excluded count; the payment answer carries
 * the fresh summary, so the screen updates from the answer and never adds numbers itself. A failed summary read leaves the list without tiles and
 * without the Paid column. Skill is not drawn. The Responses block (Registered, Accepted not registered, Declined, Pending) stays unchanged below.
 * Role checks are UX only; the server decides every action and a refusal shows its own label.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { withCorrelationId } from '../../../../api/correlationId';
import {
  committeeAddPlayer,
  getRegistrationRoster,
  getRegistrationSummary,
  setRegistrationPayment,
  setRegistrationPoints,
  withdrawFromTournament,
} from '../../../../api/tournaments';
import { useUserMenu } from '../../../../hooks/useUserMenu';
import { useT } from '../../../../labels/LabelsContext';
import { dash } from '../../../../theme/dashboardTheme';
import { borderWidth, colors, radius, sizes, spacing, typography } from '../../../../theme/tokens';
import type { RegistrationRoster, RegistrationSummary, Tournament, TournamentRegistration } from '../../../../types/tournament';
import type { ParticipantRow } from '../../../../types/tournamentTabs';
import type { UserIdentity } from '../../../../types/userMenu';
import { formatMoney, hasFee } from '../../../../utils/money';
import { filterByPayment, paymentStateOf, type PaymentFilter } from '../../../../utils/participants';
import { refusalText } from '../../../../utils/refusal';
import { useSportDisplayName } from '../../../../utils/labels';
import { fixturesExist } from '../../../../utils/tournamentEdit';
import { formatDayShort } from '../../../../utils/tournamentExperience';
import { filterParticipants, participantRole, participantRows } from '../../../../utils/tournamentTabs';
import AddTeamSheet from '../../participants/AddTeamSheet';
import Badge from '../../../Badge';
import Button from '../../../Button';
import TextField from '../../../TextField';
import UserAvatar from '../../../UserAvatar';
import UserSearchPicker from '../../../UserSearchPicker';
import UserMenuSheet from '../../../user/UserMenuSheet';
import {
  OrganizerSection,
  PaidSwitch,
  PointsBox,
  RemoveConfirmDialog,
  SummaryTiles,
  TeamTile,
  UnpaidWarning,
} from '../../participants/parts';
import TeamDetailsSheet from '../../participants/TeamDetailsSheet';
import { CardHead, Chip, CommitteeNote, EmptyLine, TabCard } from './parts';

const AVATAR = 40;
const MORE_BOX = 32;
const SHOWN = 8;
const SWITCH_BOX = 56;

export interface ParticipantsTabProps {
  tournament: Tournament;
  registrations: TournamentRegistration[];
  isCommittee: boolean;
  /** `registration_phase` of the scoring state; `frozen` shows the frozen note. */
  phase: string | null;
  /**
   * The fixture engine applies (the server's `scoring.enabled` and `scoring.applicable`): the committee edits points here. Absent or false hides the
   * points boxes (teams-payments AD-13, OI-9).
   */
  pointsApplicable?: boolean;
  /**
   * The invite actions (Invite groups, Invite players, Share), built by the host from `TournamentInvitePanel`: inviting is the primary way to bring
   * people in, for individual and team tournaments alike. The server's `my_invite_access` decides what the panel shows.
   */
  invitePanel?: React.ReactNode;
  /** The Responses block, built by the host (it owns the people pop-up). */
  responses: React.ReactNode;
  /** Re-reads the tournament page after a change. */
  onChanged: () => void;
}

type Details = { id: string } | null;

export default function ParticipantsTab(props: ParticipantsTabProps): React.JSX.Element {
  const t = useT();
  const { tournament } = props;
  const teamMode = tournament.participation_mode === 'team';
  const sportLabel = useSportDisplayName(tournament.sport);
  const [query, setQuery] = useState('');
  const [showAll, setShowAll] = useState(false);
  const [adding, setAdding] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState<PaymentFilter>('all');
  const [notice, setNotice] = useState<string | null>(null);
  // `undefined`: not read (or not for this viewer); `null`: the read failed (no tiles, no Paid column, never a guessed count).
  const [summary, setSummary] = useState<RegistrationSummary | null | undefined>(undefined);
  // The server's answers to this screen's own changes, laid over the loaded rows until the page reads them again.
  const [paidOverride, setPaidOverride] = useState<Record<string, string | null>>({});
  const [pointsOverride, setPointsOverride] = useState<Record<string, string | null>>({});
  const [details, setDetails] = useState<Details>(null);
  const [roster, setRoster] = useState<{ id: string; status: 'loading' | 'ready' | 'failed'; data: RegistrationRoster | null } | null>(null);
  const [removeTarget, setRemoveTarget] = useState<ParticipantRow | null>(null);
  const [removing, setRemoving] = useState(false);
  // AD-5: the organizer and the committee add and remove in every registration phase; the server ends it (409 ROSTER_LOCKED, labelled). UX only.
  const registerOpen = props.isCommittee && !teamMode;
  const addTeamOpen = props.isCommittee && teamMode;
  const [addingTeam, setAddingTeam] = useState(false);
  // The generated fixtures exist: an add or a removal resets them (AD-5, AD-6), so the screen warns first.
  const warnReset = fixturesExist(tournament);
  const menu = useUserMenu({ context: { type: 'none' } });
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const loadSummary = useCallback(async (): Promise<void> => {
    if (!props.isCommittee) {
      return;
    }
    try {
      const next = await withCorrelationId(correlationId => getRegistrationSummary(tournament.id, { correlationId }));
      if (mounted.current) {
        setSummary(next);
      }
    } catch {
      if (mounted.current) {
        setSummary(null);
      }
    }
  }, [props.isCommittee, tournament.id]);

  // The totals are read when the screen opens and whenever the page reads the registrations again (an add, a removal, a refresh).
  useEffect(() => {
    setPaidOverride({});
    setPointsOverride({});
    loadSummary();
  }, [props.registrations, loadSummary]);

  const rows = useMemo(
    () =>
      participantRows(props.registrations).map(row => ({
        ...row,
        payment_received_at: row.id in paidOverride ? paidOverride[row.id] : row.payment_received_at,
        points: row.id in pointsOverride ? pointsOverride[row.id] : row.points,
      })),
    [props.registrations, paidOverride, pointsOverride],
  );

  const paymentsOn = props.isCommittee && summary?.payments_enabled === true;
  const pointsOn = props.isCommittee && props.pointsApplicable === true;
  const pointsLocked = summary?.points_locked === true;
  const filteredByPayment = paymentsOn ? filterByPayment(rows, filter) : rows;
  const filtered = filterParticipants(filteredByPayment, query);
  const visible = showAll || query.trim() || (paymentsOn && filter !== 'all') ? filtered : filtered.slice(0, SHOWN);
  const share = tournament.max_participants > 0 ? Math.min(1, rows.length / tournament.max_participants) : 0;
  const feeText =
    summary && summary.payments_enabled && hasFee(summary.fee_cents) && summary.currency
      ? t(teamMode ? 'mob.pay.per_team' : 'mob.pay.per_player', { amount: formatMoney(summary.fee_cents, summary.currency) })
      : null;

  const setError = (id: string, message: string | null): void =>
    setErrors(previous => {
      const next = { ...previous };
      if (message) {
        next[id] = message;
      } else {
        delete next[id];
      }
      return next;
    });

  const togglePaid = async (row: ParticipantRow, next: boolean): Promise<void> => {
    setBusyId(row.id);
    setError(row.id, null);
    setNotice(null);
    try {
      const result = await withCorrelationId(correlationId => setRegistrationPayment(tournament.id, row.id, next, { correlationId }));
      if (!mounted.current) {
        return;
      }
      // The answer carries the fresh summary: the tiles and Cash collected move at once, from the server's figures.
      setSummary(result.summary);
      setPaidOverride(previous => ({ ...previous, [row.id]: result.payment_received_at }));
      if (result.draft_exists) {
        setNotice(t('mob.part.late_payer'));
      }
    } catch (e) {
      if (mounted.current) {
        setError(row.id, refusalText(e, t));
      }
    } finally {
      if (mounted.current) {
        setBusyId(null);
      }
    }
  };

  const commitPoints = async (row: ParticipantRow, value: number | null): Promise<boolean> => {
    setError(row.id, null);
    try {
      await withCorrelationId(correlationId => setRegistrationPoints(tournament.id, row.id, value, { correlationId }));
      if (mounted.current) {
        setPointsOverride(previous => ({ ...previous, [row.id]: value === null ? null : String(value) }));
      }
      return true;
    } catch (e) {
      if (mounted.current) {
        setError(row.id, refusalText(e, t));
      }
      return false;
    }
  };

  const confirmRemove = async (): Promise<void> => {
    if (!removeTarget) {
      return;
    }
    const row = removeTarget;
    setRemoving(true);
    try {
      await withCorrelationId(correlationId => withdrawFromTournament(tournament.id, row.id, { correlationId }));
      if (!mounted.current) {
        return;
      }
      setRemoveTarget(null);
      setDetails(null);
      setRoster(null);
      menu.close();
      props.onChanged();
    } catch (e) {
      if (mounted.current) {
        setRemoveTarget(null);
        setError(row.id, refusalText(e, t));
      }
    } finally {
      if (mounted.current) {
        setRemoving(false);
      }
    }
  };

  const add = async (userId: string): Promise<void> => {
    await withCorrelationId(correlationId => committeeAddPlayer(tournament.id, userId, { correlationId }));
    props.onChanged();
  };

  const identityOf = (row: ParticipantRow): UserIdentity => {
    const role = participantRole(row, tournament);
    return {
      userId: row.user_id,
      displayName: row.name,
      // The registration carries no nickname: the line under the name says when they registered.
      nickname: t('mob.part.sub_registered', { date: formatDayShort(row.registered_at) }),
      ...(role === 'organizer' ? { badge: { tone: 'organizer' as const, label: t('mob.tournament.participants.role_organizer') } } : {}),
    };
  };

  const openDetails = (row: ParticipantRow): void => {
    setDetails({ id: row.id });
    if (row.team_id) {
      setRoster({ id: row.id, status: 'loading', data: null });
      withCorrelationId(correlationId => getRegistrationRoster(tournament.id, row.id, { correlationId }))
        .then(data => mounted.current && setRoster({ id: row.id, status: 'ready', data }))
        .catch(() => mounted.current && setRoster({ id: row.id, status: 'failed', data: null }));
    } else {
      menu.openMenu(identityOf(row));
    }
  };

  const closeDetails = (): void => {
    setDetails(null);
    setRoster(null);
  };

  const openRowMenu = (row: ParticipantRow): void => {
    const label = t(row.team_id ? 'mob.part.remove_team' : 'mob.part.remove_player');
    Alert.alert(row.name, undefined, [
      { text: t('mob.part.remove_cancel'), style: 'cancel' },
      { text: label, style: 'destructive', onPress: () => setRemoveTarget(row) },
    ]);
  };

  const feeValueFor = (row: ParticipantRow): string | null => {
    if (!paymentsOn || !summary || !summary.currency) {
      return null;
    }
    const cents = row.effective_fee_cents ?? summary.fee_cents;
    return hasFee(cents) ? t(row.team_id ? 'mob.pay.per_team' : 'mob.pay.per_player', { amount: formatMoney(cents, summary.currency) }) : null;
  };

  const organizerSectionFor = (row: ParticipantRow): React.JSX.Element => {
    const exempt = row.payment_exempt === true;
    return (
      <OrganizerSection
        feeValue={feeValueFor(row)}
        paid={paymentStateOf(row) === 'paid'}
        exempt={exempt && paymentsOn}
        busy={busyId === row.id}
        name={row.name}
        onTogglePaid={next => togglePaid(row, next)}
        pointsVisible={pointsOn}
        pointsEditable={pointsOn && !pointsLocked}
        points={row.points ?? null}
        onCommitPoints={value => commitPoints(row, value)}
        error={errors[row.id] ?? null}
        removeLabel={t(row.team_id ? 'mob.part.remove_team' : 'mob.part.remove_player')}
        onRemove={() => setRemoveTarget(row)}
      />
    );
  };

  const detailRow = details ? rows.find(row => row.id === details.id) ?? null : null;
  const playerDetailRow = detailRow && !detailRow.team_id && menu.isOpen ? detailRow : null;

  const columns = (
    <View style={styles.columns} testID="participants-columns">
      <Text style={[styles.colText, styles.colName]}>{t(teamMode ? 'mob.part.col_team' : 'mob.part.col_player')}</Text>
      {pointsOn ? <Text style={[styles.colText, styles.colPoints]}>{t('mob.part.col_points')}</Text> : null}
      {paymentsOn ? <Text style={[styles.colText, styles.colPaid]}>{t('mob.part.col_paid')}</Text> : null}
      <View style={styles.moreBox} />
    </View>
  );

  return (
    <View testID="tournament-participants">
      {props.isCommittee ? (
        <CommitteeNote
          text={
            props.phase === 'frozen'
              ? t('mob.tournament.participants.frozen_note')
              : t('mob.tournament.participants.committee_note', {
                  date: tournament.registration_hard_block_at ? formatDayShort(tournament.registration_hard_block_at) : '–',
                })
          }
        />
      ) : null}
      <TabCard>
        <CardHead
          title={t('mob.tournament.participants.title')}
          badge={t('mob.tournament.participants.count', { count: rows.length })}
        />
        {props.isCommittee ? (
          <Text style={styles.subtitle} testID="participants-subtitle">
            {feeText
              ? t(teamMode ? 'mob.part.subtitle_team' : 'mob.part.subtitle_individual', { name: tournament.name, fee: feeText })
              : t(teamMode ? 'mob.part.subtitle_team_free' : 'mob.part.subtitle_individual_free', { name: tournament.name })}
          </Text>
        ) : null}
        {paymentsOn && summary ? (
          <>
            <SummaryTiles summary={summary} teamMode={teamMode} />
            <UnpaidWarning count={summary.excluded_from_fixtures} teamMode={teamMode} />
          </>
        ) : null}
        {props.isCommittee && summary === null ? (
          <Text style={styles.note} testID="participants-summary-failed">
            {t('mob.part.summary_failed')}
          </Text>
        ) : null}
        {notice ? (
          <Text style={styles.noticeText} accessibilityRole="alert" testID="participants-notice">
            {notice}
          </Text>
        ) : null}
        {paymentsOn ? (
          <View style={styles.filters} testID="participants-filters">
            {(['all', 'paid', 'unpaid'] as const).map(key => (
              <Pressable
                key={key}
                accessibilityRole="button"
                accessibilityState={{ selected: filter === key }}
                accessibilityLabel={t(`mob.part.filter_${key}` as const)}
                onPress={() => setFilter(key)}
                style={[styles.filter, filter === key ? styles.filterOn : null]}
                testID={`participants-filter-${key}`}
              >
                <Text style={[styles.filterText, filter === key ? styles.filterTextOn : null]}>{t(`mob.part.filter_${key}` as const)}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}
        <View style={styles.searchRow}>
          <TextField
            value={query}
            onChangeText={setQuery}
            placeholder={t('mob.tournament.participants.search')}
            style={styles.search}
            accessibilityLabel={t('mob.tournament.participants.search')}
            testID="participants-search"
          />
        </View>
        {props.isCommittee ? (
          !paymentsOn ? (
            <>
              <View style={styles.countRow}>
                <Text style={styles.countText}>{t('mob.tournament.participants.registered_of', { count: rows.length, max: tournament.max_participants })}</Text>
                <Text style={styles.countMuted}>{t('mob.tournament.participants.registered_label')}</Text>
              </View>
              <View style={styles.track}>
                <View style={[styles.fill, { width: `${Math.round(share * 100)}%` }]} />
              </View>
            </>
          ) : null
        ) : tournament.participant_count !== null ? (
          // AD-1 (A38): a participant sees the server's count and the Full chip, never the cap, a progress bar or spots left.
          <View style={styles.countRow} testID="participants-registered-count">
            <Text style={styles.countText}>{t('web.tournament.registered_count', { count: tournament.participant_count })}</Text>
            {tournament.is_full === true ? <Badge label={t('web.tournament.full_chip')} variant="warning" style={styles.fullChip} /> : null}
          </View>
        ) : null}
        {props.isCommittee && (pointsOn || paymentsOn) ? columns : null}
        {visible.length === 0 ? <EmptyLine text={t('mob.tournament.participants.empty')} /> : null}
        {visible.map(row => {
          const role = participantRole(row, tournament);
          const state = paymentStateOf(row);
          const unpaid = paymentsOn && state === 'unpaid';
          const name = row.name;
          const sub = row.team_id
            ? row.team_captain_name
              ? t('mob.part.sub_team', { count: row.team_player_count ?? 0, captain: row.team_captain_name })
              : row.team_player_count !== null && row.team_player_count !== undefined
              ? t('mob.part.sub_team_count', { count: row.team_player_count })
              : null
            : t('mob.part.sub_registered', { date: formatDayShort(row.registered_at) });
          return (
            <View key={row.id} testID={`participant-${row.id}`}>
              <View style={[styles.row, unpaid ? styles.rowUnpaid : null]}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={name}
                  onPress={() => openDetails(row)}
                  style={styles.rowMain}
                  testID={`participant-open-${row.id}`}
                >
                  <View style={styles.avatarBox}>
                    {row.team_id ? <TeamTile size={AVATAR} /> : <UserAvatar name={name} size={AVATAR} fallback="initials" />}
                  </View>
                  <View style={styles.rowText}>
                    <Text style={styles.name} numberOfLines={1}>
                      {name}
                    </Text>
                    {unpaid ? (
                      <Text style={styles.subUnpaid} numberOfLines={1}>
                        {t('mob.part.sub_unpaid')}
                      </Text>
                    ) : sub ? (
                      <Text style={styles.sub} numberOfLines={1}>
                        {sub}
                      </Text>
                    ) : null}
                    {role ? (
                      <View style={styles.chips}>
                        <Chip
                          label={t(role === 'organizer' ? 'mob.tournament.participants.role_organizer' : 'mob.tournament.participants.role_committee')}
                          tone={role === 'organizer' ? 'amber' : 'purple'}
                        />
                      </View>
                    ) : null}
                  </View>
                </Pressable>
                {pointsOn ? (
                  <PointsBox
                    points={row.points ?? null}
                    name={name}
                    editable={!pointsLocked}
                    onCommit={value => commitPoints(row, value)}
                    testID={`participant-points-${row.id}`}
                  />
                ) : null}
                {paymentsOn ? (
                  <View style={styles.switchBox}>
                    {state === 'exempt' ? null : (
                      <PaidSwitch
                        value={state === 'paid'}
                        busy={busyId === row.id}
                        name={name}
                        onChange={next => togglePaid(row, next)}
                        testID={`participant-paid-${row.id}`}
                      />
                    )}
                  </View>
                ) : null}
                {props.isCommittee ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t('mob.part.more_a11y', { name })}
                    onPress={() => openRowMenu(row)}
                    disabled={busyId === row.id}
                    style={styles.moreBox}
                    testID={`participant-remove-${row.id}`}
                  >
                    <Text style={styles.moreText}>…</Text>
                  </Pressable>
                ) : (
                  <Text style={styles.date}>{formatDayShort(row.registered_at)}</Text>
                )}
              </View>
              {errors[row.id] ? (
                <Text style={styles.rowError} accessibilityRole="alert" testID={`participant-error-${row.id}`}>
                  {errors[row.id]}
                </Text>
              ) : null}
            </View>
          );
        })}
        {!showAll && !query.trim() && filtered.length > SHOWN && !(paymentsOn && filter !== 'all') ? (
          <Pressable accessibilityRole="button" onPress={() => setShowAll(true)} style={styles.showAll} testID="participants-show-all">
            <Text style={styles.showAllText}>{t('mob.tournament.participants.show_all', { count: filtered.length })}</Text>
          </Pressable>
        ) : null}
        {props.isCommittee && props.invitePanel ? (
          <View style={styles.invite} testID="participants-invite">
            <Text style={styles.inviteTitle} accessibilityRole="header">
              {t('mob.part.invite_title')}
            </Text>
            <Text style={styles.note}>{t('mob.part.invite_hint')}</Text>
            {props.invitePanel}
          </View>
        ) : null}
        {registerOpen ? (
          <Button
            label={t('mob.part.register_player')}
            variant="secondary"
            onPress={() => setAdding(true)}
            style={styles.addButton}
            testID="participants-add"
          />
        ) : null}
        {addTeamOpen ? (
          <Button
            label={t('web.tournament.participants.add_team')}
            variant="secondary"
            onPress={() => setAddingTeam(true)}
            style={styles.addButton}
            testID="participants-add-team"
          />
        ) : null}
      </TabCard>
      {props.responses}
      <UserMenuSheet menu={menu} extras={props.isCommittee && playerDetailRow ? organizerSectionFor(playerDetailRow) : undefined} />
      {detailRow && detailRow.team_id ? (
        <TeamDetailsSheet
          name={detailRow.name}
          sport={sportLabel}
          playerCount={detailRow.team_player_count ?? null}
          captainName={detailRow.team_captain_name ?? null}
          roster={roster && roster.id === detailRow.id ? roster.data : null}
          rosterStatus={roster && roster.id === detailRow.id ? roster.status : 'loading'}
          onOpenPlayer={person => menu.openMenu(person)}
          extras={props.isCommittee ? organizerSectionFor(detailRow) : undefined}
          onClose={closeDetails}
        />
      ) : null}
      {removeTarget ? (
        <RemoveConfirmDialog
          body={
            t(removeTarget.team_id ? 'mob.part.remove_body_team' : 'mob.part.remove_body_player', {
              name: removeTarget.name,
              tournament: tournament.name,
            }) + (warnReset ? `\n\n${t('web.tournament_edit.reset_confirm_roster')}` : '')
          }
          paid={paymentStateOf(removeTarget) === 'paid'}
          busy={removing}
          onCancel={() => setRemoveTarget(null)}
          onYes={confirmRemove}
        />
      ) : null}
      {addTeamOpen ? (
        <AddTeamSheet
          visible={addingTeam}
          tournamentId={tournament.id}
          sport={tournament.sport}
          enteredTeamIds={rows.map(r => r.team_id).filter((id): id is string => Boolean(id))}
          warnReset={warnReset}
          onClose={() => setAddingTeam(false)}
          onAdded={props.onChanged}
        />
      ) : null}
      <Modal visible={adding} animationType="slide" transparent onRequestClose={() => setAdding(false)}>
        <View style={styles.backdrop}>
          <View style={styles.sheet} testID="participants-add-sheet">
            <View style={styles.sheetHead}>
              <Text style={styles.sheetTitle}>{t('mob.part.register_player')}</Text>
              <Button label={t('mob.tournament.close.cancel')} variant="secondary" size="sm" onPress={() => setAdding(false)} />
            </View>
            <Text style={styles.note}>{t('mob.part.register_hint')}</Text>
            {warnReset ? (
              <Text style={styles.resetWarning} testID="participants-add-reset-warning">
                {t('web.tournament_edit.reset_confirm_roster')}
              </Text>
            ) : null}
            <UserSearchPicker
              onSelect={user => add(user.id)}
              immediateRow={{
                actionLabel: name => t('mob.part.register_a11y', { name }),
                sentLabel: t('mob.part.registered_chip'),
                // committee-add and its refusals (COMMITTEE_ADD_CLOSED, INDIVIDUAL_ONLY, ALREADY_REGISTERED, LIFECYCLE_V2_ONLY, COMMITTEE_ONLY): their own label.
                errorText: error => refusalText(error, t, 'mob.add_remove.error'),
              }}
              selectionMode="immediate"
              excludeUserIds={rows.map(r => r.user_id).filter((id): id is string => Boolean(id))}
              suggestionContext="players"
              entityLabel={t('mob.tournament.participants.title')}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  invite: { marginTop: spacing.md },
  inviteTitle: { ...typography.bodyBold, color: colors.textPrimary },
  subtitle: { ...typography.caption, color: dash.textMuted, marginBottom: spacing.sm },
  note: { ...typography.caption, color: colors.textSecondary, marginVertical: spacing.sm },
  resetWarning: { ...typography.caption, color: colors.warningDark, marginBottom: spacing.sm },
  noticeText: { ...typography.caption, fontWeight: '600', color: colors.textPrimary, marginBottom: spacing.sm },
  filters: { flexDirection: 'row', marginBottom: spacing.sm },
  filter: {
    minHeight: sizes.controlSmall,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
    borderWidth: borderWidth.thin,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    marginRight: spacing.sm,
  },
  filterOn: { backgroundColor: colors.ctaBlue, borderColor: colors.ctaBlue },
  filterText: { ...typography.label, color: colors.ctaBlue },
  filterTextOn: { color: colors.white },
  searchRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  search: { flex: 1 },
  addButton: { marginTop: spacing.md },
  fullChip: { marginLeft: spacing.sm },
  countRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.xs },
  countText: { ...typography.bodyBold, color: dash.text },
  countMuted: { ...typography.caption, color: dash.textMuted },
  track: { height: 8, borderRadius: 4, backgroundColor: dash.skeleton, overflow: 'hidden', marginBottom: spacing.sm },
  fill: { height: 8, borderRadius: 4, backgroundColor: dash.brand },
  columns: { flexDirection: 'row', alignItems: 'center', paddingBottom: spacing.xs },
  colText: { ...typography.label, fontWeight: '400', color: dash.textMuted },
  colName: { flex: 1, marginLeft: AVATAR + spacing.sm },
  colPoints: { width: 64, textAlign: 'center' },
  colPaid: { width: SWITCH_BOX, textAlign: 'center' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 60,
    paddingVertical: spacing.sm,
    borderTopWidth: borderWidth.thin,
    borderTopColor: dash.cardBorder,
  },
  rowUnpaid: { backgroundColor: colors.warningLight },
  rowMain: { flex: 1, flexDirection: 'row', alignItems: 'center', minWidth: 0 },
  avatarBox: { width: AVATAR, height: AVATAR },
  rowText: { flex: 1, minWidth: 0, marginLeft: spacing.sm },
  name: { ...typography.bodyBold, color: dash.text },
  sub: { ...typography.label, fontWeight: '400', color: dash.textMuted },
  subUnpaid: { ...typography.label, fontWeight: '400', color: colors.warningDark },
  chips: { flexDirection: 'row', flexWrap: 'wrap' },
  switchBox: { width: SWITCH_BOX, alignItems: 'center', justifyContent: 'center' },
  date: { ...typography.caption, color: dash.textMuted, marginLeft: spacing.sm },
  moreBox: { width: MORE_BOX, height: sizes.touchTarget, alignItems: 'center', justifyContent: 'center' },
  moreText: { ...typography.h3, color: colors.textSecondary },
  rowError: { ...typography.caption, fontWeight: '600', color: colors.error, marginBottom: spacing.sm },
  showAll: { alignItems: 'center', paddingVertical: spacing.sm, minHeight: 44, justifyContent: 'center' },
  showAllText: { ...typography.bodyBold, color: dash.brand },
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: colors.scrim },
  sheet: { maxHeight: '85%', backgroundColor: colors.surface, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: spacing.md },
  sheetHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  sheetTitle: { ...typography.h3, color: dash.text },
});
