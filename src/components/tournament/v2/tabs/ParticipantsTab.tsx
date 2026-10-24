/**
 * Participants tab (board TV2MobOpenParticipants, TV2MobDoneParticipants; web reference te-w2 `tePartHtml`): the players
 * of the tournament, a search box, and for the committee "Add player" and "Remove player". The roster, the roles and the
 * counts are the server's (registrations, organizer and committee of the tournament). The Responses block (Registered,
 * Accepted not registered, Declined, Pending) is kept unchanged below, supplied by the host screen (addendum section 2).
 * Skill is not drawn: the registration carries a number, the board shows level names and no route offers them.
 */
import React, { useMemo, useState } from 'react';
import { Alert, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { withCorrelationId } from '../../../../api/correlationId';
import { committeeAddPlayer, withdrawFromTournament } from '../../../../api/tournaments';
import { useT } from '../../../../labels/LabelsContext';
import { dash } from '../../../../theme/dashboardTheme';
import { borderWidth, colors, radius, spacing, typography } from '../../../../theme/tokens';
import type { Tournament, TournamentRegistration } from '../../../../types/tournament';
import { getApiErrorMessage } from '../../../../utils/apiError';
import { formatDayShort } from '../../../../utils/tournamentExperience';
import type { ParticipantRow } from '../../../../types/tournamentTabs';
import { filterParticipants, participantRole, participantRows } from '../../../../utils/tournamentTabs';
import Button from '../../../Button';
import { TrashIcon } from '../../../icons/ActionIcons';
import TextField from '../../../TextField';
import UserAvatar from '../../../UserAvatar';
import UserSearchPicker from '../../../UserSearchPicker';
import { CardHead, Chip, CommitteeNote, EmptyLine, TabCard } from './parts';

const AVATAR = 40;
const ICON_BOX = 40;
const SHOWN = 8;

export interface ParticipantsTabProps {
  tournament: Tournament;
  registrations: TournamentRegistration[];
  isCommittee: boolean;
  /** `registration_phase` of the scoring state; `frozen` shows the frozen note. */
  phase: string | null;
  /** The Responses block, built by the host (it owns the people pop-up). */
  responses: React.ReactNode;
  /** Re-reads the tournament page after a change. */
  onChanged: () => void;
}

export default function ParticipantsTab(props: ParticipantsTabProps): React.JSX.Element {
  const t = useT();
  const { tournament } = props;
  const [query, setQuery] = useState('');
  const [showAll, setShowAll] = useState(false);
  const [adding, setAdding] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const rows = useMemo(() => participantRows(props.registrations), [props.registrations]);
  const filtered = filterParticipants(rows, query);
  const visible = showAll || query.trim() ? filtered : filtered.slice(0, SHOWN);
  const share = tournament.max_participants > 0 ? Math.min(1, rows.length / tournament.max_participants) : 0;

  const remove = (row: ParticipantRow): void => {
    Alert.alert(t('mob.tournament.participants.remove_confirm', { name: row.name }), undefined, [
      { text: t('mob.tournament.close.cancel'), style: 'cancel' },
      {
        text: t('mob.tournament.participants.remove_player'),
        style: 'destructive',
        onPress: async () => {
          setBusyId(row.id);
          setError(null);
          try {
            await withCorrelationId(correlationId => withdrawFromTournament(tournament.id, row.id, { correlationId }));
            props.onChanged();
          } catch (e) {
            setError(getApiErrorMessage(e, t('mob.errors.server')));
          } finally {
            setBusyId(null);
          }
        },
      },
    ]);
  };

  const add = async (userId: string): Promise<void> => {
    await withCorrelationId(correlationId => committeeAddPlayer(tournament.id, userId, { correlationId }));
    props.onChanged();
  };

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
        <View style={styles.searchRow}>
          <TextField
            value={query}
            onChangeText={setQuery}
            placeholder={t('mob.tournament.participants.search')}
            style={styles.search}
            accessibilityLabel={t('mob.tournament.participants.search')}
            testID="participants-search"
          />
          {props.isCommittee ? (
            <Button
              label={t('mob.tournament.participants.add_player')}
              size="sm"
              onPress={() => setAdding(true)}
              style={styles.addButton}
              testID="participants-add"
            />
          ) : null}
        </View>
        <View style={styles.countRow}>
          <Text style={styles.countText}>{t('mob.tournament.participants.registered_of', { count: rows.length, max: tournament.max_participants })}</Text>
          <Text style={styles.countMuted}>{t('mob.tournament.participants.registered_label')}</Text>
        </View>
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${Math.round(share * 100)}%` }]} />
        </View>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {visible.length === 0 ? <EmptyLine text={t('mob.tournament.participants.empty')} /> : null}
        {visible.map(row => {
          const role = participantRole(row, tournament);
          return (
            <View key={row.id} style={styles.row} testID={`participant-${row.id}`}>
              <UserAvatar name={row.name} size={AVATAR} fallback="initials" />
              <View style={styles.rowText}>
                <Text style={styles.name} numberOfLines={1}>
                  {row.name}
                </Text>
                {role ? (
                  <View style={styles.chips}>
                    <Chip
                      label={t(role === 'organizer' ? 'mob.tournament.participants.role_organizer' : 'mob.tournament.participants.role_committee')}
                      tone={role === 'organizer' ? 'amber' : 'purple'}
                    />
                  </View>
                ) : null}
              </View>
              <Text style={styles.date}>{formatDayShort(row.registered_at)}</Text>
              {props.isCommittee ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${t('mob.tournament.participants.remove_player')}, ${row.name}`}
                  onPress={() => remove(row)}
                  disabled={busyId === row.id}
                  style={styles.iconBox}
                  testID={`participant-remove-${row.id}`}
                >
                  <TrashIcon size={18} color={colors.error} />
                </Pressable>
              ) : null}
            </View>
          );
        })}
        {!showAll && !query.trim() && filtered.length > SHOWN ? (
          <Pressable accessibilityRole="button" onPress={() => setShowAll(true)} style={styles.showAll} testID="participants-show-all">
            <Text style={styles.showAllText}>{t('mob.tournament.participants.show_all', { count: filtered.length })}</Text>
          </Pressable>
        ) : null}
      </TabCard>
      {props.responses}
      <Modal visible={adding} animationType="slide" transparent onRequestClose={() => setAdding(false)}>
        <View style={styles.backdrop}>
          <View style={styles.sheet} testID="participants-add-sheet">
            <View style={styles.sheetHead}>
              <Text style={styles.sheetTitle}>{t('mob.tournament.participants.add_player')}</Text>
              <Button label={t('mob.tournament.close.cancel')} variant="secondary" size="sm" onPress={() => setAdding(false)} />
            </View>
            <UserSearchPicker
              onSelect={user => add(user.id)}
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
  searchRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  search: { flex: 1 },
  addButton: { marginLeft: spacing.sm },
  countRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.xs },
  countText: { ...typography.bodyBold, color: dash.text },
  countMuted: { ...typography.caption, color: dash.textMuted },
  track: { height: 8, borderRadius: 4, backgroundColor: dash.skeleton, overflow: 'hidden', marginBottom: spacing.sm },
  fill: { height: 8, borderRadius: 4, backgroundColor: dash.brand },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 60,
    paddingVertical: spacing.sm,
    borderTopWidth: borderWidth.thin,
    borderTopColor: dash.cardBorder,
  },
  rowText: { flex: 1, minWidth: 0, marginLeft: spacing.sm },
  name: { ...typography.bodyBold, color: dash.text },
  chips: { flexDirection: 'row', flexWrap: 'wrap' },
  date: { ...typography.caption, color: dash.textMuted, marginLeft: spacing.sm },
  iconBox: { width: ICON_BOX, height: ICON_BOX, alignItems: 'center', justifyContent: 'center' },
  showAll: { alignItems: 'center', paddingVertical: spacing.sm, minHeight: 44, justifyContent: 'center' },
  showAllText: { ...typography.bodyBold, color: dash.brand },
  error: { ...typography.caption, color: colors.error, marginBottom: spacing.sm },
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: colors.scrim },
  sheet: { maxHeight: '85%', backgroundColor: colors.surface, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: spacing.md },
  sheetHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  sheetTitle: { ...typography.h3, color: dash.text },
});
