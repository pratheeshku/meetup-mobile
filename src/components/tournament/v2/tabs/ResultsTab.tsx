/**
 * Results tab (boards TV2MobDoneResults, TV2MobClose; web reference te-w2 `teResultsHtml`): champion, runner-up, third
 * place, star of the tournament, the closing comments, the first photos from Media and a summary, all read-only and all
 * the server's. The committee also gets "Close tournament" (or "Edit report") which opens the Close form (AD-T9).
 * Not drawn (te-b4 section 9, no data): the board's "6 wins from 6", points scored, and the star's nickname and note.
 */
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { withCorrelationId } from '../../../../api/correlationId';
import { getTournamentMedia } from '../../../../api/tournaments';
import { useT } from '../../../../labels/LabelsContext';
import { dash } from '../../../../theme/dashboardTheme';
import { borderWidth, colors, radius, spacing, typography } from '../../../../theme/tokens';
import type { Tournament, TournamentClosurePerson, TournamentClosureResponse } from '../../../../types/tournament';
import type { MediaPage } from '../../../../types/tournamentTabs';
import { toHttpsUrl } from '../../../../utils/httpsUrl';
import { dayCount, formatDayShort } from '../../../../utils/tournamentExperience';
import { matchesFor, playedCount } from '../../../../utils/tournamentTabs';
import Button from '../../../Button';
import { TrophyIcon } from '../../../icons/SharedIcons';
import UserAvatar from '../../../UserAvatar';
import CloseSheet from './CloseSheet';
import { CardHead, Chip, CommitteeNote, EmptyLine, TabCard } from './parts';
import type { StandingsBoard } from './useStandingsBoard';

const TILE = 96;
const MEDAL = 40;

function Podium({ label, person, first }: { label: string; person: TournamentClosurePerson | null | undefined; first?: boolean }): React.JSX.Element {
  return (
    <View style={[styles.podium, first ? styles.podiumFirst : null]} testID={`results-${label}`}>
      <View style={styles.medal}>
        <TrophyIcon size={24} />
      </View>
      <Text style={styles.kicker}>{label}</Text>
      <Text style={styles.podiumName} numberOfLines={2}>
        {person?.display_name ?? ''}
      </Text>
    </View>
  );
}

export default function ResultsTab(props: {
  tournament: Tournament;
  closure: TournamentClosureResponse | null;
  registeredCount: number;
  board: StandingsBoard;
  /** The organizer or an active committee member (UX only). */
  isCommittee: boolean;
  onOpenMedia: () => void;
  /** The report was saved: the host re-reads the page. */
  onSaved: () => void;
}): React.JSX.Element {
  const t = useT();
  const { closure, tournament } = props;
  const [media, setMedia] = useState<MediaPage | null>(null);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    if (!closure?.outcome) {
      return;
    }
    withCorrelationId(correlationId => getTournamentMedia(tournament.id, { limit: 6, offset: 0 }, { correlationId }))
      .then(setMedia)
      .catch(() => setMedia(null));
  }, [closure?.outcome, tournament.id]);

  if (!closure) {
    return <ActivityIndicator color={dash.brand} style={styles.loading} testID="results-loading" />;
  }
  const closed = Boolean(closure.outcome);
  const committeeBar = closure.can_close ? (
    <View>
      <CommitteeNote text={t('mob.tournament.results.committee_note')} />
      <Button
        label={t(closed ? 'mob.tournament.results.edit_report' : 'mob.tournament.close.title')}
        variant="secondary"
        size="sm"
        onPress={() => setClosing(true)}
        style={styles.noteButton}
        testID="results-close-button"
      />
    </View>
  ) : null;
  const sheet = closing ? (
    <CloseSheet
      tournamentId={tournament.id}
      closure={closure}
      onClose={() => setClosing(false)}
      onSaved={() => {
        setClosing(false);
        props.onSaved();
      }}
    />
  ) : null;

  if (!closed) {
    return (
      <View testID="tournament-results">
        {committeeBar}
        <EmptyLine text={t('mob.tournament.tabs.locked.tournament_closed')} />
        {sheet}
      </View>
    );
  }
  if (closure.outcome === 'not_held') {
    return (
      <View testID="tournament-results">
        {committeeBar}
        <EmptyLine text={t('mob.tournament.results.not_held')} />
        {sheet}
      </View>
    );
  }

  const played = props.board.view ? playedCount(matchesFor(props.board.view, 'all')).played : null;
  return (
    <View testID="tournament-results">
      {committeeBar}
      <TabCard>
        <CardHead title={t('mob.tournament.results.final_title')} badge={t('mob.tournament.results.status_completed')} />
        <Podium label={t('mob.tournament.results.champion')} person={closure.winner} first />
        <View style={styles.row}>
          <Podium label={t('mob.tournament.results.runner_up')} person={closure.runner_up} />
          <Podium label={t('mob.tournament.results.third')} person={closure.third_place} />
        </View>
      </TabCard>
      {closure.star ? (
        <TabCard testID="results-star">
          <Text style={styles.kicker}>{t('mob.tournament.results.star_title')}</Text>
          <View style={styles.starRow}>
            <UserAvatar imageUrl={closure.star.photo_url} name={closure.star.display_name} size={56} fallback="initials" />
            <Text style={styles.starName}>{closure.star.display_name}</Text>
          </View>
        </TabCard>
      ) : null}
      <TabCard testID="results-comments">
        <CardHead title={t('mob.tournament.results.comments_title')} badge={t('mob.tournament.results.report_badge')} />
        {closure.comments ? (
          <View>
            <View style={styles.by}>
              {tournament.organizer ? <Text style={styles.byName}>{tournament.organizer.display_name}</Text> : null}
              <Chip label={t('mob.tournament.results.organizer_badge')} tone="amber" />
              {closure.closed_at ? <Text style={styles.date}>{formatDayShort(closure.closed_at)}</Text> : null}
            </View>
            <Text style={styles.comments}>{closure.comments}</Text>
          </View>
        ) : (
          <EmptyLine text={t('mob.tournament.results.no_comments')} />
        )}
      </TabCard>
      {media && media.total > 0 ? (
        <TabCard testID="results-photos">
          <CardHead title={t('mob.tournament.results.photos_title')} badge={t('mob.tournament.results.photos_count', { count: media.total })} />
          <View style={styles.thumbs}>
            {media.items.map(item => (
              <Image key={item.id} source={{ uri: toHttpsUrl(item.url) ?? item.url }} style={styles.thumb} accessibilityLabel={t(item.kind === 'video' ? 'mob.tournament.media.video_a11y' : 'mob.tournament.media.photo_a11y', { name: item.uploaded_by ?? '' })} />
            ))}
          </View>
          <Pressable accessibilityRole="button" onPress={props.onOpenMedia} style={styles.link} testID="results-see-all-media">
            <Text style={styles.linkText}>{t('mob.tournament.results.see_all_media', { count: media.total })}</Text>
          </Pressable>
        </TabCard>
      ) : null}
      <TabCard testID="results-summary">
        <CardHead title={t('mob.tournament.results.summary_title')} />
        <View style={styles.summary}>
          <Stat value={String(props.registeredCount)} label={t('mob.tournament.results.sum_players')} />
          {played !== null ? <Stat value={String(played)} label={t('mob.tournament.results.sum_matches')} /> : null}
          {dayCount(tournament.starts_at, tournament.ends_at) !== null ? (
            <Stat value={String(dayCount(tournament.starts_at, tournament.ends_at))} label={t('mob.tournament.results.sum_days')} />
          ) : null}
          <Stat value={t('mob.tournament.results.sum_submitted')} label={t('mob.tournament.results.sum_report')} />
        </View>
      </TabCard>
      {sheet}
    </View>
  );
}

function Stat({ value, label }: { value: string; label: string }): React.JSX.Element {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  loading: { marginVertical: spacing.lg },
  noteButton: { alignSelf: 'flex-start', marginBottom: spacing.md },
  podium: { flex: 1, alignItems: 'center', borderRadius: radius.lg, borderWidth: borderWidth.thin, borderColor: dash.cardBorder, padding: spacing.md, marginBottom: spacing.sm, marginHorizontal: spacing.xs, backgroundColor: dash.page },
  podiumFirst: { backgroundColor: colors.warningLight, borderColor: colors.warning },
  medal: { width: MEDAL, height: MEDAL, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row' },
  kicker: { ...typography.label, color: dash.textMuted, textTransform: 'uppercase' },
  podiumName: { ...typography.h3, color: dash.text, textAlign: 'center', marginTop: spacing.xs },
  starRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm },
  starName: { ...typography.h3, color: dash.text, marginLeft: spacing.md, flex: 1 },
  by: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', marginBottom: spacing.xs },
  byName: { ...typography.bodyBold, color: dash.text, marginRight: spacing.xs },
  date: { ...typography.caption, color: dash.textMuted, marginLeft: spacing.xs },
  comments: { ...typography.body, color: dash.text },
  thumbs: { flexDirection: 'row', flexWrap: 'wrap' },
  thumb: { width: TILE, height: TILE, borderRadius: radius.md, marginRight: spacing.sm, marginBottom: spacing.sm, backgroundColor: dash.skeleton },
  link: { minHeight: 44, justifyContent: 'center' },
  linkText: { ...typography.bodyBold, color: dash.brand },
  summary: { flexDirection: 'row', flexWrap: 'wrap' },
  stat: { width: '50%', paddingVertical: spacing.sm },
  statValue: { ...typography.h3, color: dash.text },
  statLabel: { ...typography.caption, color: dash.textMuted },
});
