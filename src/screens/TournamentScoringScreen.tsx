/**
 * Tournament standings, results and bracket (match-scoring v1.2 S4 "mobile read views";
 * boards BRGroups*, BRKnockout*, BRThird, BRMine). Read-only: uploads, corrections and approvals
 * are web-only.
 *
 * Everything shown is what `GET /tournaments/{id}/standings` returned (tables, ranks, results,
 * winners, qualification). Nothing is recomputed here. A group's qualifier highlight is drawn only
 * once the backend says that group's qualifiers are resolved, and marks the players the backend has
 * already seated in the knockout. An unpublished fixture, the v1 shape or a 404 shows no scoring.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { withCorrelationId } from '../api/correlationId';
import { getRegistrations, getTournamentStandings } from '../api/tournaments';
import { useAuth } from '../auth/AuthContext';
import EmptyState from '../components/EmptyState';
import ErrorView from '../components/ErrorView';
import LoadingView from '../components/LoadingView';
import GroupTable from '../components/scoring/GroupTable';
import ScoringMatchCard from '../components/scoring/ScoringMatchCard';
import SegmentedSwitch from '../components/SegmentedSwitch';
import { useRefetchOnFocus } from '../hooks/useRefetchOnFocus';
import { useT } from '../labels/LabelsContext';
import type { TournamentsStackParamList } from '../navigation/types';
import { colors, spacing, typography } from '../theme/tokens';
import type { TournamentStandingsView } from '../types/tournamentScoring';
import {
  groupKnockoutRounds,
  seatedKnockoutIds,
  sortKnockout,
} from '../utils/tournamentScoring';

type Props = NativeStackScreenProps<TournamentsStackParamList, 'TournamentScoring'>;

type Tab = 'groups' | 'knockout';
type Filter = 'all' | 'mine';

const STAGE_PILL_KEYS = {
  quarterfinal: 'mob.scoring.stage_quarterfinal',
  semifinal: 'mob.scoring.stage_semifinal',
  final: 'mob.scoring.stage_final',
  third_place: 'mob.scoring.stage_third_place',
} as const;

export default function TournamentScoringScreen({ navigation, route }: Props): React.JSX.Element {
  const t = useT();
  const { tournamentId } = route.params;
  const { user } = useAuth();
  const currentUserId = user?.id;

  const [view, setView] = useState<TournamentStandingsView | null>(null);
  const [mineIds, setMineIds] = useState<ReadonlySet<string>>(new Set());
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [tab, setTab] = useState<Tab>('groups');
  const [groupKey, setGroupKey] = useState<string | null>(null);
  const [roundKey, setRoundKey] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');

  const load = useCallback(async (): Promise<void> => {
    try {
      await withCorrelationId(async correlationId => {
        const [standings, registrations] = await Promise.all([
          getTournamentStandings(tournamentId, { correlationId }),
          // "My matches" is a convenience: if the registrations are unreadable the switch is simply hidden.
          getRegistrations(tournamentId, { correlationId }).catch(() => []),
        ]);
        setView(standings);
        setMineIds(
          new Set(
            registrations
              .filter(r => currentUserId && r.user_id === currentUserId && r.status !== 'withdrawn')
              .map(r => r.id),
          ),
        );
        setStatus('ready');
      });
    } catch {
      setStatus(prev => (prev === 'ready' ? prev : 'error'));
    }
  }, [tournamentId, currentUserId]);

  useRefetchOnFocus(navigation, load, tournamentId);

  const knockout = useMemo(() => sortKnockout(view?.knockout ?? []), [view]);
  const rounds = useMemo(() => groupKnockoutRounds(knockout), [knockout]);
  const qualifiedIds = useMemo(() => seatedKnockoutIds(knockout), [knockout]);
  const hasGroups = (view?.groups.length ?? 0) > 0;
  const hasKnockout = knockout.length > 0;

  // Keep the selected tab, group and round valid as data arrives or changes.
  useEffect(() => {
    if (!view) {
      return;
    }
    if (tab === 'groups' && !hasGroups && hasKnockout) {
      setTab('knockout');
    }
    if (!view.groups.some(g => g.group_key === groupKey)) {
      setGroupKey(view.groups[0]?.group_key ?? null);
    }
    if (!rounds.some(r => r.key === roundKey)) {
      setRoundKey(rounds[0]?.key ?? null);
    }
  }, [view, hasGroups, hasKnockout, rounds, tab, groupKey, roundKey]);

  useEffect(() => {
    navigation.setOptions?.({
      title: tab === 'groups' ? t('mob.scoring.title_groups') : t('mob.scoring.title_knockout'),
    });
  }, [navigation, tab, t]);

  if (status === 'loading') {
    return <LoadingView />;
  }
  if (status === 'error') {
    return <ErrorView message={t('mob.scoring.load_error')} onRetry={load} />;
  }
  if (!view) {
    return (
      <View style={styles.page}>
        <EmptyState title={t('mob.scoring.not_available')} />
      </View>
    );
  }

  const group = view.groups.find(g => g.group_key === groupKey) ?? view.groups[0];
  const round = rounds.find(r => r.key === roundKey) ?? rounds[0];
  const groupNote = group
    ? [
        group.provisional
          ? t('mob.scoring.note_provisional')
          : group.unresolved_tie || group.needs_override
            ? t('mob.scoring.note_tie')
            : group.qualifiers_resolved
              ? t('mob.scoring.note_qualified')
              : '',
        group.adjusted_by_committee ? t('mob.scoring.note_adjusted') : '',
      ]
        .filter(Boolean)
        .join(' ')
    : '';
  const canFilter = mineIds.size > 0;
  const mineMatches = knockout.filter(
    m =>
      (m.side_a.registration_id && mineIds.has(m.side_a.registration_id)) ||
      (m.side_b.registration_id && mineIds.has(m.side_b.registration_id)),
  );
  const roundSize = (stage: string, count: number): number | undefined =>
    stage === 'main' ? count * 2 : undefined;

  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={styles.content}
      testID="tournament-scoring-screen"
    >
      {hasGroups && hasKnockout ? (
        <View style={styles.switchRow}>
          <SegmentedSwitch<Tab>
            value={tab}
            onChange={setTab}
            options={[
              { value: 'groups', label: t('mob.scoring.tab_groups') },
              { value: 'knockout', label: t('mob.scoring.tab_knockout') },
            ]}
          />
        </View>
      ) : null}

      {tab === 'groups' && group ? (
        <>
          <View style={styles.switchRow}>
            <SegmentedSwitch<string>
              value={group.group_key}
              onChange={setGroupKey}
              options={view.groups.map(g => ({
                value: g.group_key,
                label: g.group_key,
              }))}
            />
          </View>
          <GroupTable group={group} qualifiedIds={qualifiedIds} />
          {group.provisional ? (
            <Text style={styles.provisional} testID="scoring-provisional">
              {t('mob.scoring.provisional')}
            </Text>
          ) : null}
          {groupNote ? <Text style={styles.note}>{groupNote}</Text> : null}
          {group.matches.length === 0 ? (
            <Text style={styles.note}>{t('mob.scoring.matches_empty')}</Text>
          ) : (
            group.matches.map(match => (
              <ScoringMatchCard key={match.fixture_id} match={match} mineIds={mineIds} />
            ))
          )}
        </>
      ) : null}

      {tab === 'knockout' ? (
        hasKnockout ? (
          <>
            {canFilter ? (
              <View style={styles.switchRow}>
                <SegmentedSwitch<Filter>
                  value={filter}
                  onChange={setFilter}
                  options={[
                    { value: 'all', label: t('mob.scoring.filter_all') },
                    { value: 'mine', label: t('mob.scoring.filter_mine') },
                  ]}
                />
              </View>
            ) : null}
            {filter === 'mine' && canFilter ? (
              mineMatches.length === 0 ? (
                <Text style={styles.note}>{t('mob.scoring.mine_empty')}</Text>
              ) : (
                mineMatches.map(match => (
                  <ScoringMatchCard
                    key={match.fixture_id}
                    match={match}
                    mineIds={mineIds}
                    mainRoundSize={roundSize(
                      match.stage,
                      knockout.filter(
                        k => k.stage === match.stage && k.round_number === match.round_number,
                      ).length,
                    )}
                  />
                ))
              )
            ) : (
              <>
                {rounds.length > 1 ? (
                  <View style={styles.switchRow}>
                    <SegmentedSwitch<string>
                      value={round?.key ?? ''}
                      onChange={setRoundKey}
                      options={rounds.map(r => ({
                        value: r.key,
                        label:
                          r.stage in STAGE_PILL_KEYS
                            ? t(STAGE_PILL_KEYS[r.stage as keyof typeof STAGE_PILL_KEYS])
                            : r.stage === 'main'
                              ? t('mob.scoring.round_size', { size: r.matches.length * 2 })
                              : t('mob.scoring.stage_other'),
                      }))}
                    />
                  </View>
                ) : null}
                {round?.matches.map(match => (
                  <ScoringMatchCard
                    key={match.fixture_id}
                    match={match}
                    mineIds={mineIds}
                    mainRoundSize={roundSize(match.stage, round.matches.length)}
                  />
                ))}
              </>
            )}
          </>
        ) : (
          <Text style={styles.note}>{t('mob.scoring.knockout_empty')}</Text>
        )
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: spacing.xxl },
  switchRow: { marginBottom: spacing.sm },
  note: { ...typography.caption, color: colors.textMuted, marginVertical: spacing.sm },
  provisional: {
    ...typography.label,
    alignSelf: 'flex-start',
    marginTop: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 999,
    overflow: 'hidden',
    color: colors.textPrimary,
    backgroundColor: colors.warningLight,
  },
});
