/**
 * Tournament team detail (DES-MEETUP-ADDENDUM-team-screens-remarks AD-1, TS-01, TS-02; the addendum is the board of record, process note 1).
 *
 * Reads `GET /teams/{id}` and `GET /teams/{id}/members`. The viewer state (active, invited, requested, none) comes from the caller's own
 * roster row. A `403` from the roster route means "not on the roster", not an error; a `404` from the team route shows the not-available
 * notice. A failed read shows a retry state, never a stale detail. Role checks here are UX only: the server is the authority.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { withCorrelationId } from '../api/correlationId';
import {
  getTeam,
  getTeamMembers,
  inviteToTeam,
  removeTeamMember,
  requestToJoinTeam,
  respondToTeamInvite,
  respondToTeamRequest,
  updateTeam,
} from '../api/teams';
import { useAuth } from '../auth/AuthContext';
import Badge from '../components/Badge';
import Button from '../components/Button';
import ErrorView from '../components/ErrorView';
import InlineError from '../components/InlineError';
import LoadingView from '../components/LoadingView';
import OptionChips from '../components/OptionChips';
import TextField from '../components/TextField';
import Toast from '../components/Toast';
import UserSearchPicker from '../components/UserSearchPicker';
import UserAvatar from '../components/UserAvatar';
import { useSportDisplayName } from '../utils/labels';
import { useT } from '../labels/LabelsContext';
import type { GroupsStackParamList } from '../navigation/types';
import { borderWidth, colors, radius, spacing, typography } from '../theme/tokens';
import type { Team, TeamMembership, TeamVisibility } from '../types/team';
import { refusalText } from '../utils/refusal';
import { memberName, viewerStateFromRoster } from '../utils/teamViewer';

type Props = NativeStackScreenProps<GroupsStackParamList, 'TeamDetail'>;

type LoadState = { kind: 'loading' } | { kind: 'unavailable' } | { kind: 'failed' } | { kind: 'ready'; team: Team; roster: TeamMembership[] | null };

const AVATAR_BOX = 40;

function statusOf(error: unknown): number | null {
  const status = (error as { response?: { status?: unknown } } | null)?.response?.status;
  return typeof status === 'number' ? status : null;
}

export default function TeamDetailScreen({ navigation, route }: Props): React.JSX.Element {
  const { teamId } = route.params;
  const t = useT();
  const { user } = useAuth();
  const [state, setState] = useState<LoadState>({ kind: 'loading' });
  const seq = useRef(0);

  /**
   * `silent` (a re-read after an action) keeps the detail on screen while it reads; it returns false when the read failed, so the caller can
   * say so, and leaves the previous state untouched.
   */
  const load = useCallback(async (silent = false): Promise<boolean> => {
    const mine = ++seq.current;
    if (!silent) {
      setState({ kind: 'loading' });
    }
    try {
      // One correlation id for the whole read of this screen (one logical action).
      const next = await withCorrelationId(async correlationId => {
        const team = await getTeam(teamId, { correlationId });
        try {
          return { team, roster: await getTeamMembers(teamId, { correlationId }) };
        } catch (error) {
          // 403: no membership row, so not on the roster (AD-1). Anything else is a failed read.
          if (statusOf(error) === 403) {
            return { team, roster: null };
          }
          throw error;
        }
      });
      if (mine === seq.current) {
        setState({ kind: 'ready', ...next });
      }
      return true;
    } catch (error) {
      if (mine === seq.current && !silent) {
        setState(statusOf(error) === 404 ? { kind: 'unavailable' } : { kind: 'failed' });
      } else if (mine === seq.current && statusOf(error) === 404) {
        // The action removed the caller's access to a private team (for example a declined invitation): the team is no longer available.
        setState({ kind: 'unavailable' });
      }
      return false;
    }
  }, [teamId]);

  useEffect(() => {
    load();
  }, [load]);

  const reload = useCallback(() => load(true), [load]);

  if (state.kind === 'loading') {
    return <LoadingView />;
  }
  if (state.kind === 'unavailable') {
    return <ErrorView message={t('mob.team.not_available')} />;
  }
  if (state.kind === 'failed') {
    return <ErrorView message={t('mob.team.action_failed')} onRetry={() => load()} />;
  }
  return <TeamDetailBody team={state.team} roster={state.roster} userId={user?.id} reload={reload} onLeft={navigation.goBack} />;
}

interface BodyProps {
  team: Team;
  roster: TeamMembership[] | null;
  userId?: string;
  /** Reads the team again without the loading state; false when the read failed. */
  reload: () => Promise<boolean>;
  /** The caller left the team: the detail has nothing more to show them. */
  onLeft: () => void;
}

const NAME_MAX_LENGTH = 100;

function TeamDetailBody({ team, roster, userId, reload, onLeft }: BodyProps): React.JSX.Element {
  const t = useT();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const dismissNotice = useCallback(() => setNotice(null), []);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(team.name);
  const [editVisibility, setEditVisibility] = useState<TeamVisibility>(team.visibility === 'private' ? 'private' : 'public');
  const [inviting, setInviting] = useState(false);

  /**
   * One user action: one correlation id for the call, then a re-read. A refusal keeps the screen as it was and shows its label, never the
   * server's text (a coded refusal has its own label; anything else is "That did not work. Please try again."). Resolves true when the
   * server accepted the action.
   */
  const run = async (action: (correlationId: string) => Promise<void>, success?: string): Promise<boolean> => {
    if (busy) {
      return false;
    }
    setBusy(true);
    setError(null);
    try {
      await withCorrelationId(action);
    } catch (e) {
      setError(refusalText(e, t, 'mob.team.action_failed'));
      setBusy(false);
      return false;
    }
    if (success) {
      setNotice(success);
    }
    if (!(await reload())) {
      setError(t('mob.team.action_failed'));
    }
    setBusy(false);
    return true;
  };

  const sportLabel = useSportDisplayName(team.sport);
  const viewer = viewerStateFromRoster(roster, userId);
  const players = (roster ?? []).filter(row => row.status === 'active');
  const visibilityLabel = t(team.visibility === 'private' ? 'mob.teams.visibility_private' : 'mob.teams.visibility_public');

  // UX only: the server decides every one of these (policies.py); a refusal is shown as a label.
  const isCaptain = viewer === 'active' && team.captain_user_id === userId;
  const requests = (roster ?? []).filter(row => row.status === 'requested');

  const confirm = (label: string, onConfirm: () => void): void => {
    Alert.alert(label, undefined, [
      { text: t('mob.common.cancel'), style: 'cancel' },
      { text: label, style: 'destructive', onPress: onConfirm },
    ]);
  };

  const saveEdit = async (): Promise<void> => {
    const name = editName.trim();
    // Changed fields only (TeamUpdate forbids anything else; an unchanged form just closes).
    const body = { ...(name !== team.name ? { name } : {}), ...(editVisibility !== team.visibility ? { visibility: editVisibility } : {}) };
    if (name === '' || Object.keys(body).length === 0) {
      setEditing(false);
      return;
    }
    if (await run(correlationId => updateTeam(team.id, body, { correlationId }).then(() => undefined))) {
      setEditing(false);
    }
  };

  return (
    <View style={styles.screen}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <View style={styles.headerCard}>
          <Text style={styles.title} accessibilityRole="header">
            {team.name}
          </Text>
          <Text style={styles.meta}>{sportLabel}</Text>
          <Text style={styles.meta}>{visibilityLabel}</Text>
          {viewer === 'requested' ? (
            <Badge label={t('mob.team.request_pending')} variant="warning" style={styles.statusBadge} />
          ) : null}
          {viewer === 'invited' ? <Text style={styles.banner}>{t('mob.team.invited_banner')}</Text> : null}
        </View>

        {error ? <InlineError message={error} style={styles.error} /> : null}

        {/* The server decides: a private team refuses a join request, so the button is only drawn for a public team. */}
        {viewer === 'none' && team.visibility === 'public' ? (
          <View style={styles.actions}>
            <Button
              label={t('mob.team.request_join')}
              loading={busy}
              onPress={() => run(correlationId => requestToJoinTeam(team.id, { correlationId }), t('mob.team.request_sent'))}
              testID="team-request-join"
            />
          </View>
        ) : null}
        {viewer === 'invited' ? (
          <View style={styles.actionRow}>
            <Button
              label={t('mob.team.accept')}
              style={styles.actionRowItem}
              disabled={busy}
              onPress={() => run(correlationId => respondToTeamInvite(team.id, true, { correlationId }))}
              testID="team-accept"
            />
            <Button
              label={t('mob.team.decline')}
              variant="secondary"
              style={styles.actionRowItem}
              disabled={busy}
              onPress={() => run(correlationId => respondToTeamInvite(team.id, false, { correlationId }))}
              testID="team-decline"
            />
          </View>
        ) : null}

        {isCaptain && !editing ? (
          <View style={styles.actions}>
            <Button
              label={t('mob.team.edit')}
              variant="secondary"
              onPress={() => {
                setEditName(team.name);
                setEditVisibility(team.visibility === 'private' ? 'private' : 'public');
                setEditing(true);
              }}
              testID="team-edit"
            />
          </View>
        ) : null}
        {isCaptain && editing ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('mob.create_group.team_name')}</Text>
            <TextField
              value={editName}
              onChangeText={setEditName}
              maxLength={NAME_MAX_LENGTH}
              accessibilityLabel={t('mob.create_group.team_name')}
              testID="team-edit-name"
            />
            <View style={styles.chips}>
              <OptionChips<TeamVisibility>
                options={[
                  { value: 'public', label: t('mob.teams.visibility_public') },
                  { value: 'private', label: t('mob.teams.visibility_private') },
                ]}
                value={editVisibility}
                onChange={setEditVisibility}
                disabled={busy}
              />
            </View>
            <View style={styles.actionRow}>
              <Button label={t('mob.common.save')} style={styles.actionRowItem} loading={busy} onPress={saveEdit} testID="team-edit-save" />
              <Button
                label={t('mob.common.cancel')}
                variant="secondary"
                style={styles.actionRowItem}
                disabled={busy}
                onPress={() => setEditing(false)}
                testID="team-edit-cancel"
              />
            </View>
          </View>
        ) : null}

        {isCaptain && requests.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle} accessibilityRole="header">
              {t('mob.team.requests_title')}
            </Text>
            {requests.map(row => (
              <View key={row.id} style={styles.requestRow} testID="team-request-row">
                <View style={styles.avatarBox}>
                  <UserAvatar name={memberName(row)} size={AVATAR_BOX} />
                </View>
                <Text style={styles.playerName} numberOfLines={1}>
                  {memberName(row)}
                </Text>
                <Button
                  label={t('mob.team.approve')}
                  size="sm"
                  disabled={busy}
                  onPress={() => run(correlationId => respondToTeamRequest(team.id, row.user_id, true, { correlationId }))}
                  testID={`team-approve-${row.user_id}`}
                />
                <Button
                  label={t('mob.team.reject')}
                  size="sm"
                  variant="secondary"
                  style={styles.rowGap}
                  disabled={busy}
                  onPress={() => run(correlationId => respondToTeamRequest(team.id, row.user_id, false, { correlationId }))}
                  testID={`team-reject-${row.user_id}`}
                />
              </View>
            ))}
          </View>
        ) : null}

        {roster ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle} accessibilityRole="header">
              {t('mob.team.section_players')}
            </Text>
            {players.map(row => (
              <View key={row.id} style={styles.playerRow} testID="team-player-row">
                <View style={styles.avatarBox}>
                  <UserAvatar name={memberName(row)} size={AVATAR_BOX} />
                </View>
                <Text style={styles.playerName} numberOfLines={1}>
                  {memberName(row)}
                </Text>
                {row.user_id === team.captain_user_id ? <Badge label={t('mob.team.captain_badge')} variant="primary" /> : null}
                {isCaptain && row.user_id !== team.captain_user_id ? (
                  <Button
                    label={t('mob.team.remove_player')}
                    size="sm"
                    variant="destructive"
                    style={styles.rowGap}
                    disabled={busy}
                    accessibilityLabel={`${t('mob.team.remove_player')}: ${memberName(row)}`}
                    onPress={() =>
                      confirm(t('mob.team.remove_player'), () => run(correlationId => removeTeamMember(team.id, row.user_id, { correlationId })))
                    }
                    testID={`team-remove-${row.user_id}`}
                  />
                ) : null}
              </View>
            ))}
          </View>
        ) : null}

        {viewer === 'active' ? (
          <View style={styles.section}>
            <Button
              label={t('mob.team.invite_player')}
              variant="secondary"
              onPress={() => setInviting(open => !open)}
              testID="team-invite-toggle"
            />
            {inviting ? (
              <View style={styles.inviteBox}>
                <UserSearchPicker
                  selectionMode="immediate"
                  suggestionContext="team_players"
                  entityLabel={t('mob.team.section_players')}
                  placeholder={t('mob.team.invite_search_placeholder')}
                  excludeTeamId={team.id}
                  excludeUserIds={(roster ?? []).map(row => row.user_id)}
                  immediateRow={{
                    actionLabel: name => `${t('mob.team.invite_player')}: ${name}`,
                    sentLabel: t('mob.team.invite_sent'),
                    errorText: e => refusalText(e, t, 'mob.team.action_failed'),
                  }}
                  onSelect={user => withCorrelationId(correlationId => inviteToTeam(team.id, user.id, { correlationId }))}
                />
              </View>
            ) : null}
          </View>
        ) : null}

        {/* A captain cannot leave: the server refuses it (teams/service.py remove_member) and offers no route to hand the captaincy over. */}
        {viewer === 'active' && !isCaptain ? (
          <View style={styles.actions}>
            <Button
              label={t('mob.team.leave')}
              variant="destructive"
              disabled={busy}
              onPress={() =>
                confirm(t('mob.team.leave'), async () => {
                  if (userId && (await run(correlationId => removeTeamMember(team.id, userId, { correlationId })))) {
                    onLeft();
                  }
                })
              }
              testID="team-leave"
            />
          </View>
        ) : null}
      </ScrollView>
      <Toast message={notice} onDismiss={dismissNotice} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  scroll: { flex: 1 },
  content: { padding: spacing.md },
  headerCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: borderWidth.thin,
    borderColor: colors.border,
    padding: spacing.md,
  },
  title: { ...typography.h1, color: colors.textPrimary },
  meta: { ...typography.body, color: colors.textSecondary, marginTop: spacing.xs },
  statusBadge: { alignSelf: 'flex-start', marginTop: spacing.sm },
  banner: { ...typography.bodyBold, color: colors.primary, marginTop: spacing.sm },
  error: { marginTop: spacing.md },
  actions: { marginTop: spacing.md },
  actionRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  actionRowItem: { flex: 1 },
  section: { marginTop: spacing.md },
  chips: { marginTop: spacing.sm },
  inviteBox: { marginTop: spacing.sm },
  rowGap: { marginLeft: spacing.xs },
  requestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: AVATAR_BOX + spacing.sm,
    paddingVertical: spacing.xs,
  },
  sectionTitle: { ...typography.bodyBold, color: colors.textPrimary, marginBottom: spacing.sm },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: AVATAR_BOX + spacing.sm,
    paddingVertical: spacing.xs,
  },
  avatarBox: { width: AVATAR_BOX, height: AVATAR_BOX, marginRight: spacing.sm },
  playerName: { ...typography.body, color: colors.textPrimary, flex: 1, marginRight: spacing.sm },
});
