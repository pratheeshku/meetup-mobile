/**
 * Fixtures tab (boards TV2MobDoneFixtures, TV2MobLiveKnockouts, TV2MobPlayerView; web reference te-w2 `teFixturesHtml`):
 * the matches with the filter chips (All, Group stage, Knockouts, My matches), "N of M played", Enter score and Edit
 * score for the committee, and the Knockouts view that fills itself as scores are saved (TE-09). Every name, score,
 * winner, slot and "mine" mark is the server's; a refresh at `live_poll_seconds` (the server's value) keeps other
 * viewers current, only while the screen is focused. A saved score re-renders only the regions the entry response names.
 *
 * Not built here (blocked, see the te-a2 report): the committee's fixtures setup (points workbook download and upload,
 * draw options, draft, submit for approval). The app has no flow for it and no file picker or file store dependency.
 */
import React, { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { useT } from '../../../../labels/LabelsContext';
import { dash } from '../../../../theme/dashboardTheme';
import { borderWidth, colors, radius, spacing, typography } from '../../../../theme/tokens';
import type { CommitteeSetup, ScoringMatch } from '../../../../types/tournamentScoring';
import type { MatchEntryResponse } from '../../../../types/tournamentTabs';
import { formatClock, formatDayShort } from '../../../../utils/tournamentExperience';
import {
  bothSidesKnown,
  matchesFor,
  playedCount,
  setsWon,
  winnerSide,
  type FixtureFilter,
} from '../../../../utils/tournamentTabs';
import Button from '../../../Button';
import UserAvatar from '../../../UserAvatar';
import FixturesSetup from './FixturesSetup';
import KnockoutBracket from './KnockoutBracket';
import { knockoutName, slotText } from './matchLabels';
import { CardHead, Chip, CommitteeNote, EmptyLine, TabCard } from './parts';
import ResultsFileCard from './ResultsFileCard';
import ScoreSheet from './ScoreSheet';
import type { StandingsBoard } from './useStandingsBoard';

const AVATAR = 32;
const FILTERS: FixtureFilter[] = ['all', 'group', 'knockouts', 'mine'];
const FILTER_KEYS = {
  all: 'mob.tournament.fixtures.filter_all',
  group: 'mob.tournament.fixtures.filter_group',
  knockouts: 'mob.tournament.fixtures.filter_knockouts',
  mine: 'mob.tournament.fixtures.filter_mine',
} as const;

export interface FixturesTabProps {
  tournamentId: string;
  board: StandingsBoard;
  fixturesPublished: boolean;
  /** The organizer or an active committee member (UX only; the server decides each write). */
  isCommittee: boolean;
  /** `lifecycle_status` is `closed`: results are locked after the closure report (`RESULTS_LOCKED`). */
  resultsLocked: boolean;
  /** A proposal was sent for approval: the host refreshes the Approvals badge. */
  onSentForApproval: () => void;
  /** Committee setup of `scoring/state` (points, latest draft, draw options), and what the setup steps need (AD-T12). */
  setup: CommitteeSetup | null;
  phase: string | null;
  names: ReadonlyMap<string, string>;
  fileStem: string;
  /** A team tournament (the excluded count reads "tournament teams"). */
  teamMode?: boolean;
  /** Something changed on the server that the page's scoring state shows: the host reads it again. */
  onChanged: () => void;
}

export default function FixturesTab(props: FixturesTabProps): React.JSX.Element {
  const t = useT();
  const { board } = props;
  const [filter, setFilter] = useState<FixtureFilter>('all');
  const [editing, setEditing] = useState<{ match: ScoringMatch; group: string | null } | null>(null);
  const [lastEntry, setLastEntry] = useState<MatchEntryResponse | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const view = board.view;
  const entries = matchesFor(view, filter);
  const { played, total } = playedCount(matchesFor(view, 'all'));

  const saved = (entry: MatchEntryResponse): void => {
    board.accept(entry);
    setLastEntry(entry);
    setEditing(null);
    setNotice(t('mob.tournament.score.saved'));
  };

  const qualifiedLine = (entry: MatchEntryResponse | null): string | null => {
    if (!entry || entry.qualified.length === 0) {
      return null;
    }
    const group = entry.qualified[0].group_key;
    const names = entry.qualified
      .filter(q => q.group_key === group)
      .map(q => q.name)
      .join(', ');
    return t('mob.tournament.knockouts.group_finished', { group, names });
  };

  if (!props.fixturesPublished && props.isCommittee) {
    return (
      <FixturesSetup
        tournamentId={props.tournamentId}
        fileStem={props.fileStem}
        teamMode={props.teamMode}
        setup={props.setup}
        phase={props.phase}
        names={props.names}
        onChanged={props.onChanged}
      />
    );
  }
  if (!props.fixturesPublished) {
    return (
      <View testID="tournament-fixtures">
        <TabCard>
          <EmptyLine text={t('mob.tournament.fixtures.empty')} />
        </TabCard>
      </View>
    );
  }

  const renderCard = (entry: { match: ScoringMatch; group: string | null }): React.JSX.Element => {
    const { match } = entry;
    const [winsA, winsB] = setsWon(match);
    const winner = winnerSide(match);
    const known = bothSidesKnown(match);
    const stage = entry.group
      ? t('mob.tournament.standings.group_title', { group: entry.group })
      : knockoutName(match, view, t);
    const mine = match.side_a.is_mine || match.side_b.is_mine;
    return (
      <View key={match.fixture_id} style={styles.match} testID={`fixture-${match.fixture_id}`}>
        <View style={styles.chips}>
          {match.scheduled_at ? <Chip label={formatClock(match.scheduled_at)} /> : null}
          {match.court ? <Chip label={match.court} tone="teal" /> : null}
          <Chip label={stage} tone="amber" />
          <Chip
            label={t(match.result ? 'mob.tournament.fixtures.status_completed' : 'mob.tournament.fixtures.status_scheduled')}
            tone={match.result ? 'green' : 'neutral'}
          />
          {mine ? <Chip label={t('mob.tournament.fixtures.your_match')} tone="purple" /> : null}
        </View>
        {(['a', 'b'] as const).map(side => {
          const info = side === 'a' ? match.side_a : match.side_b;
          const name = slotText(info, view, t);
          return (
            <View key={side} style={styles.sideRow}>
              <UserAvatar name={info.name ?? ''} size={AVATAR} fallback="initials" />
              <Text style={[styles.sideName, winner === side ? styles.sideWinner : null, !info.name ? styles.sideSlot : null]} numberOfLines={1}>
                {name}
              </Text>
              {match.result ? <Text style={[styles.sets, winner === side ? styles.sideWinner : null]}>{side === 'a' ? winsA : winsB}</Text> : null}
            </View>
          );
        })}
        {!match.result && known ? <Text style={styles.muted}>{t('mob.tournament.fixtures.not_scored')}</Text> : null}
        {!known ? <Text style={styles.muted}>{t('mob.tournament.fixtures.waiting_sides')}</Text> : null}
        {props.isCommittee && known && !props.resultsLocked ? (
          <Button
            label={t(match.result ? 'mob.tournament.fixtures.edit_score' : 'mob.tournament.fixtures.enter_score')}
            variant="secondary"
            size="sm"
            onPress={() => setEditing(entry)}
            style={styles.scoreButton}
            testID={`fixture-score-${match.fixture_id}`}
          />
        ) : null}
      </View>
    );
  };

  const first = (filter === 'knockouts' ? matchesFor(view, 'knockouts') : matchesFor(view, 'group'))[0]?.match;
  const heading =
    filter === 'knockouts'
      ? t('mob.tournament.knockouts.title')
      : t('mob.tournament.fixtures.stage_heading', {
          stage: t(filter === 'mine' || filter === 'all' || filter === 'group' ? 'mob.tournament.fixtures.filter_group' : 'mob.tournament.fixtures.filter_knockouts'),
          date: first?.scheduled_at ? formatDayShort(first.scheduled_at) : '',
        });
  const banner = lastEntry && lastEntry.advanced.length > 0 ? t('mob.tournament.knockouts.filled_banner') : null;

  return (
    <View testID="tournament-fixtures">
      {props.isCommittee ? (
        <CommitteeNote text={props.resultsLocked ? t('mob.tournament.score.err.RESULTS_LOCKED') : t('mob.tournament.fixtures.committee_note')} />
      ) : null}
      <TabCard>
        <CardHead title={heading} badge={filter === 'knockouts' ? t('mob.tournament.knockouts.live') : t('mob.tournament.fixtures.played_of', { played, total })} />
        {filter === 'knockouts' ? <Text style={styles.muted}>{t('mob.tournament.knockouts.note')}</Text> : null}
        <View style={styles.filters}>
          {FILTERS.map(key => (
            <Pressable
              key={key}
              accessibilityRole="button"
              accessibilityState={{ selected: filter === key }}
              onPress={() => setFilter(key)}
              style={[styles.filter, filter === key ? styles.filterOn : null]}
              testID={`fixtures-filter-${key}`}
            >
              <Text style={[styles.filterText, filter === key ? styles.filterTextOn : null]}>{t(FILTER_KEYS[key])}</Text>
            </Pressable>
          ))}
        </View>
        {notice ? (
          <Text style={styles.notice} accessibilityRole="alert" testID="fixtures-notice">
            {notice}
          </Text>
        ) : null}
        {board.status === 'loading' && !view ? <ActivityIndicator color={dash.brand} style={styles.loading} testID="fixtures-loading" /> : null}
        {board.status === 'error' && !view ? <EmptyLine text={t('mob.scoring.load_error')} /> : null}
        {view && filter === 'knockouts' ? (
          <View testID="fixtures-knockouts">
            {qualifiedLine(lastEntry) || banner ? (
              <View style={styles.filled}>
                {qualifiedLine(lastEntry) ? <Text style={styles.filledText}>{qualifiedLine(lastEntry)}</Text> : null}
                {banner ? <Text style={styles.filledText}>{banner}</Text> : null}
              </View>
            ) : null}
            <KnockoutBracket
              view={view}
              justSet={board.justSet}
              onScore={props.isCommittee && !props.resultsLocked ? match => setEditing({ match, group: null }) : null}
            />
            <Text style={styles.muted}>{t('mob.tournament.knockouts.auto_note')}</Text>
          </View>
        ) : null}
        {view && filter !== 'knockouts' ? (
          entries.length === 0 ? (
            <EmptyLine text={t('mob.tournament.fixtures.empty')} />
          ) : (
            entries.map(renderCard)
          )
        ) : null}
      </TabCard>
      {props.isCommittee && !props.resultsLocked ? (
        <ResultsFileCard
          tournamentId={props.tournamentId}
          fileStem={props.fileStem}
          matches={matchesFor(view, 'all').map(e => e.match)}
          onUploaded={() => {
            board.reload();
            props.onChanged();
          }}
        />
      ) : null}
      {editing ? (
        <ScoreSheet
          tournamentId={props.tournamentId}
          match={editing.match}
          group={editing.group}
          view={view}
          onClose={() => setEditing(null)}
          onSaved={saved}
          onSentForApproval={() => {
            setEditing(null);
            setNotice(t('mob.tournament.score.sent_for_approval'));
            props.onSentForApproval();
          }}
          onStale={() => {
            setEditing(null);
            board.reload();
          }}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  loading: { marginVertical: spacing.lg },
  filters: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: spacing.sm },
  filter: { minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.md, borderRadius: radius.full, borderWidth: borderWidth.thin, borderColor: dash.cardBorder, marginRight: spacing.sm, marginBottom: spacing.xs, backgroundColor: colors.surface },
  filterOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  filterText: { ...typography.bodyBold, color: dash.text },
  filterTextOn: { color: colors.white },
  notice: { ...typography.bodyBold, color: colors.successDark, marginBottom: spacing.sm },
  match: { borderWidth: borderWidth.thin, borderColor: dash.cardBorder, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: spacing.xs },
  sideRow: { flexDirection: 'row', alignItems: 'center', minHeight: 44 },
  sideName: { ...typography.bodyBold, color: dash.text, flex: 1, marginLeft: spacing.sm },
  sideWinner: { color: colors.successDark },
  sideSlot: { ...typography.body, fontStyle: 'italic', color: dash.textMuted },
  sets: { ...typography.h3, color: dash.text, width: 32, textAlign: 'right' },
  muted: { ...typography.caption, color: dash.textMuted, marginTop: spacing.xs },
  scoreButton: { marginTop: spacing.sm, alignSelf: 'flex-start' },
  filled: { backgroundColor: colors.successLight, borderRadius: radius.md, padding: spacing.sm + 4, marginBottom: spacing.sm },
  filledText: { ...typography.bodyBold, color: colors.successDark },
});
