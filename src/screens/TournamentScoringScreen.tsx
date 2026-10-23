/**
 * Tournament standings, results and bracket (match-scoring v1.2 S4 "mobile read views";
 * boards BRGroups*, BRKnockout*, BRThird, BRMine). Read-only: uploads, corrections and approvals
 * are web-only.
 *
 * Everything shown is what `GET /tournaments/{id}/standings` returned (tables, ranks, results,
 * winners, qualification, placeholders, "mine"). Nothing is recomputed here. Qualifier markers are the
 * backend's `qualifies` (null shows none). The screen first asks `GET /tournaments/{id}/scoring/state`:
 * scoring shows only when it is enabled and applies to this tournament; the standings call (which keeps
 * handling the v1 shape and an unpublished fixture) is made only then.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { withCorrelationId } from '../api/correlationId';
import { getTournamentScoringState, getTournamentStandings } from '../api/tournaments';
import EmptyState from '../components/EmptyState';
import ErrorView from '../components/ErrorView';
import LoadingView from '../components/LoadingView';
import GroupTable from '../components/scoring/GroupTable';
import ScoringMatchCard, { stageRef } from '../components/scoring/ScoringMatchCard';
import SegmentedSwitch from '../components/SegmentedSwitch';
import { useRefetchOnFocus } from '../hooks/useRefetchOnFocus';
import { useT } from '../labels/LabelsContext';
import type { TournamentsStackParamList } from '../navigation/types';
import { colors, spacing, typography } from '../theme/tokens';
import type { TournamentStandingsView } from '../types/tournamentScoring';
import {
  groupKnockoutRounds,
  isMyMatch,
  mainRoundSize,
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

  const [view, setView] = useState<TournamentStandingsView | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [tab, setTab] = useState<Tab>('groups');
  const [groupKey, setGroupKey] = useState<string | null>(null);
  const [roundKey, setRoundKey] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');

  const load = useCallback(async (): Promise<void> => {
    try {
      await withCorrelationId(async correlationId => {
        const state = await getTournamentScoringState(tournamentId, { correlationId });
        // Scoring off or not applicable (or no such state): no standings call, no scoring UI.
        const standings =
          state && state.enabled && state.applicable
            ? await getTournamentStandings(tournamentId, { correlationId })
            : null;
        setView(standings);
        setStatus('ready');
      });
    } catch {
      setStatus(prev => (prev === 'ready' ? prev : 'error'));
    }
  }, [tournamentId]);

  useRefetchOnFocus(navigation, load, tournamentId);

  const knockout = useMemo(() => sortKnockout(view?.knockout ?? []), [view]);
  const rounds = useMemo(() => groupKnockoutRounds(knockout), [knockout]);
  const refLabel = useCallback(
    (matchId: string): string | null => {
      const all = [...(view?.groups.flatMap(g => g.matches) ?? []), ...knockout];
      const found = all.find(m => m.match_id === matchId);
      return found ? stageRef(found, t, mainRoundSize(found, knockout)) : null;
    },
    [view, knockout, t],
  );
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
  const canFilter =
    view.groups.some(g => g.matches.some(isMyMatch)) || knockout.some(isMyMatch);
  const mineMatches = knockout.filter(isMyMatch);

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
          <GroupTable group={group} />
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
              <ScoringMatchCard key={match.fixture_id} match={match} refLabel={refLabel} />
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
                    mainRoundSize={mainRoundSize(match, knockout)}
                    refLabel={refLabel}
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
                    mainRoundSize={mainRoundSize(match, knockout)}
                    refLabel={refLabel}
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
