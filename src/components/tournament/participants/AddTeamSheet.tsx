/**
 * Add team (DES-MEETUP-ADDENDUM-tournament-edit-recurring AD-2, AD-5; A38 board of record, supersedes the CMAddTeam board). Team
 * tournaments only: the committee adds an existing tournament team through `POST .../registrations/committee-add` with `team_id` only.
 * The list is `GET /teams` filtered to the tournament's sport, minus the teams already entered, as the web does (web report D-6). The server
 * stays the authority (skill, team size, capacity, `ROSTER_LOCKED` answer with their own labels). When fixtures exist the server resets them,
 * so the person is warned before the add. Theme tokens only; the row's icon-plus-text uses a fixed-size box.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { withCorrelationId } from '../../../api/correlationId';
import { getTeams } from '../../../api/teams';
import { committeeAddTeam } from '../../../api/tournaments';
import { useT } from '../../../labels/LabelsContext';
import { dash } from '../../../theme/dashboardTheme';
import { borderWidth, colors, radius, sizes, spacing, typography } from '../../../theme/tokens';
import type { Team } from '../../../types/team';
import { refusalText } from '../../../utils/refusal';
import Button from '../../Button';
import TextField from '../../TextField';
import { TeamTile } from './parts';

const TILE = 40;

export interface AddTeamSheetProps {
  visible: boolean;
  tournamentId: string;
  /** The tournament's sport: only teams of this sport are offered. */
  sport: string;
  /** Teams already entered in this tournament (`team_id` of the registrations). */
  enteredTeamIds: readonly string[];
  /** Fixtures exist: the add resets them, so the person confirms first. */
  warnReset: boolean;
  onClose: () => void;
  /** A team was added: the host re-reads the page. */
  onAdded: () => void;
}

export default function AddTeamSheet(props: AddTeamSheetProps): React.JSX.Element {
  const t = useT();
  const [teams, setTeams] = useState<Team[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [query, setQuery] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (!props.visible) {
      return;
    }
    setTeams(null);
    setFailed(false);
    setError(null);
    setQuery('');
    withCorrelationId(correlationId => getTeams({ correlationId }))
      .then(list => mounted.current && setTeams(list))
      .catch(() => mounted.current && setFailed(true));
  }, [props.visible]);

  const offered = useMemo(() => {
    const entered = new Set(props.enteredTeamIds);
    const needle = query.trim().toLowerCase();
    return (teams ?? []).filter(
      team => team.sport === props.sport && !entered.has(team.id) && (needle === '' || team.name.toLowerCase().includes(needle)),
    );
  }, [teams, props.sport, props.enteredTeamIds, query]);

  const add = useCallback(
    async (team: Team): Promise<void> => {
      setBusyId(team.id);
      setError(null);
      try {
        await withCorrelationId(correlationId => committeeAddTeam(props.tournamentId, team.id, { correlationId }));
        if (mounted.current) {
          props.onAdded();
          props.onClose();
        }
      } catch (e) {
        if (mounted.current) {
          setError(refusalText(e, t));
        }
      } finally {
        if (mounted.current) {
          setBusyId(null);
        }
      }
    },
    [props, t],
  );

  const choose = (team: Team): void => {
    if (!props.warnReset) {
      add(team);
      return;
    }
    Alert.alert(t('web.tournament.participants.add_team_title'), t('web.tournament_edit.reset_confirm_roster'), [
      { text: t('mob.common.cancel'), style: 'cancel' },
      { text: t('web.tournament.participants.add_team'), onPress: () => add(team) },
    ]);
  };

  return (
    <Modal visible={props.visible} animationType="slide" transparent onRequestClose={props.onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet} testID="add-team-sheet">
          <View style={styles.head}>
            <Text style={styles.title} accessibilityRole="header">
              {t('web.tournament.participants.add_team_title')}
            </Text>
            <Button label={t('mob.tournament.close.cancel')} variant="secondary" size="sm" onPress={props.onClose} testID="add-team-close" />
          </View>
          {props.warnReset ? (
            <Text style={styles.warning} testID="add-team-reset-warning">
              {t('web.tournament_edit.reset_confirm_roster')}
            </Text>
          ) : null}
          <TextField
            value={query}
            onChangeText={setQuery}
            placeholder={t('web.tournament.participants.search_teams')}
            accessibilityLabel={t('web.tournament.participants.search_teams')}
            testID="add-team-search"
          />
          {error ? (
            <Text style={styles.error} accessibilityRole="alert" testID="add-team-error">
              {error}
            </Text>
          ) : null}
          {teams === null && !failed ? (
            <ActivityIndicator color={dash.brand} style={styles.loading} testID="add-team-loading" />
          ) : failed ? (
            <Text style={styles.error} accessibilityRole="alert" testID="add-team-load-error">
              {t('mob.reg.err.internal_error')}
            </Text>
          ) : offered.length === 0 ? (
            <Text style={styles.empty} testID="add-team-empty">
              {t('web.tournament.participants.add_team_empty')}
            </Text>
          ) : (
            <FlatList
              data={offered}
              keyExtractor={team => team.id}
              renderItem={({ item }) => (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={item.name}
                  disabled={busyId !== null}
                  onPress={() => choose(item)}
                  style={({ pressed }) => [styles.row, pressed ? styles.pressed : null]}
                  testID={`add-team-row-${item.id}`}
                >
                  <View style={styles.tile}>
                    <TeamTile size={TILE} />
                  </View>
                  <View style={styles.rowText}>
                    <Text style={styles.name} numberOfLines={1}>
                      {item.name}
                    </Text>
                    {item.player_count !== null && item.player_count !== undefined ? (
                      <Text style={styles.sub}>{t('web.tournament.participants.team_players', { count: item.player_count })}</Text>
                    ) : null}
                  </View>
                  {busyId === item.id ? <ActivityIndicator color={dash.brand} /> : null}
                </Pressable>
              )}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: colors.scrim },
  sheet: { maxHeight: '85%', backgroundColor: colors.surface, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: spacing.md },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  title: { ...typography.h3, color: dash.text },
  warning: { ...typography.caption, color: colors.warningDark, marginBottom: spacing.sm },
  error: { ...typography.bodyBold, color: colors.error, marginTop: spacing.sm },
  empty: { ...typography.body, color: dash.textMuted, marginTop: spacing.md },
  loading: { marginVertical: spacing.md },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: sizes.touchTarget,
    paddingVertical: spacing.sm,
    borderBottomWidth: borderWidth.thin,
    borderBottomColor: dash.cardBorder,
  },
  pressed: { opacity: 0.7 },
  tile: { width: TILE, height: TILE, alignItems: 'center', justifyContent: 'center', marginRight: spacing.sm },
  rowText: { flex: 1 },
  name: { ...typography.bodyBold, color: dash.text },
  sub: { ...typography.caption, color: dash.textMuted },
});
