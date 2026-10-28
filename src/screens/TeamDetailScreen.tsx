/**
 * Tournament team detail (DES-MEETUP-ADDENDUM-team-screens-remarks AD-1, TS-01, TS-02; the addendum is the board of record, process note 1).
 *
 * Reads `GET /teams/{id}` and `GET /teams/{id}/members`. The viewer state (active, invited, requested, none) comes from the caller's own
 * roster row. A `403` from the roster route means "not on the roster", not an error; a `404` from the team route shows the not-available
 * notice. A failed read shows a retry state, never a stale detail. Role checks here are UX only: the server is the authority.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { withCorrelationId } from '../api/correlationId';
import { getTeam, getTeamMembers } from '../api/teams';
import { useAuth } from '../auth/AuthContext';
import Badge from '../components/Badge';
import ErrorView from '../components/ErrorView';
import LoadingView from '../components/LoadingView';
import UserAvatar from '../components/UserAvatar';
import { useSportDisplayName } from '../utils/labels';
import { useT } from '../labels/LabelsContext';
import type { GroupsStackParamList } from '../navigation/types';
import { borderWidth, colors, radius, spacing, typography } from '../theme/tokens';
import type { Team, TeamMembership } from '../types/team';
import { memberName, viewerStateFromRoster } from '../utils/teamViewer';

type Props = NativeStackScreenProps<GroupsStackParamList, 'TeamDetail'>;

type LoadState = { kind: 'loading' } | { kind: 'unavailable' } | { kind: 'failed' } | { kind: 'ready'; team: Team; roster: TeamMembership[] | null };

const AVATAR_BOX = 40;

function statusOf(error: unknown): number | null {
  const status = (error as { response?: { status?: unknown } } | null)?.response?.status;
  return typeof status === 'number' ? status : null;
}

export default function TeamDetailScreen({ route }: Props): React.JSX.Element {
  const { teamId } = route.params;
  const t = useT();
  const { user } = useAuth();
  const [state, setState] = useState<LoadState>({ kind: 'loading' });
  const seq = useRef(0);

  const load = useCallback(async () => {
    const mine = ++seq.current;
    setState({ kind: 'loading' });
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
    } catch (error) {
      if (mine === seq.current) {
        setState(statusOf(error) === 404 ? { kind: 'unavailable' } : { kind: 'failed' });
      }
    }
  }, [teamId]);

  useEffect(() => {
    load();
  }, [load]);

  if (state.kind === 'loading') {
    return <LoadingView />;
  }
  if (state.kind === 'unavailable') {
    return <ErrorView message={t('mob.team.not_available')} />;
  }
  if (state.kind === 'failed') {
    return <ErrorView message={t('mob.team.action_failed')} onRetry={load} />;
  }
  return <TeamDetailBody team={state.team} roster={state.roster} userId={user?.id} />;
}

function TeamDetailBody({ team, roster, userId }: { team: Team; roster: TeamMembership[] | null; userId?: string }): React.JSX.Element {
  const t = useT();
  const sportLabel = useSportDisplayName(team.sport);
  const viewer = viewerStateFromRoster(roster, userId);
  const players = (roster ?? []).filter(row => row.status === 'active');
  const visibilityLabel = t(team.visibility === 'private' ? 'mob.teams.visibility_private' : 'mob.teams.visibility_public');

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
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
            </View>
          ))}
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
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
  section: { marginTop: spacing.md },
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
