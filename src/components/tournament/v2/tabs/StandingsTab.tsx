/**
 * Standings tab (board TV2MobLiveStandings, TV2MobDoneStandings; web reference te-w2 `teStandingsHtml`): the group tables
 * exactly as the server returned them (rank, played, won, lost, set and point difference, the qualifier mark, "adjusted
 * by committee", "tie not resolved yet"), then how standings are decided. Read-only. The tables refresh at the server's
 * `live_poll_seconds` while the screen is focused (the hook); nothing is ranked or qualified on the device.
 * The board's "Win = 2 points" rows and the PTS column are not drawn: the addendum has no points rule (te-b4 section 9).
 */
import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { useT } from '../../../../labels/LabelsContext';
import { dash } from '../../../../theme/dashboardTheme';
import { colors, spacing, typography } from '../../../../theme/tokens';
import { tiebreakKeys } from '../../../../utils/tournamentTabs';
import GroupTable from '../../../scoring/GroupTable';
import KnockoutBracket from './KnockoutBracket';
import { CardHead, Chip, CommitteeNote, EmptyLine, TabCard } from './parts';
import type { StandingsBoard } from './useStandingsBoard';

export default function StandingsTab({ board, isCommittee }: { board: StandingsBoard; isCommittee: boolean }): React.JSX.Element {
  const t = useT();
  const view = board.view;
  const advance = view?.groups[0]?.advance_per_group ?? 0;

  if (board.status === 'loading' && !view) {
    return <ActivityIndicator color={dash.brand} style={styles.loading} testID="standings-loading" />;
  }
  if (!view || view.groups.length === 0) {
    return (
      <TabCard testID="tournament-standings">
        <EmptyLine text={t(board.status === 'error' ? 'mob.scoring.load_error' : 'mob.tournament.standings.empty')} />
      </TabCard>
    );
  }
  const order = tiebreakKeys(view);
  return (
    <View testID="tournament-standings">
      {isCommittee && advance > 0 ? <CommitteeNote text={t('mob.tournament.standings.committee_note', { count: advance })} /> : null}
      {view.groups.map(group => (
        <TabCard key={group.group_key} testID={`standings-group-${group.group_key}`}>
          <CardHead
            title={t('mob.tournament.standings.group_title', { group: group.group_key })}
            badge={group.advance_per_group > 0 ? t('mob.tournament.standings.qualify', { count: group.advance_per_group }) : null}
          />
          <View style={styles.flags}>
            {group.adjusted_by_committee ? <Chip label={t('mob.tournament.standings.adjusted')} tone="amber" /> : null}
            {group.unresolved_tie ? <Chip label={t('mob.tournament.standings.tie_unresolved')} tone="amber" /> : null}
          </View>
          <GroupTable group={group} />
          {group.advance_per_group > 0 ? (
            <Text style={styles.note}>{t('mob.tournament.standings.qualify_note', { count: group.advance_per_group })}</Text>
          ) : null}
        </TabCard>
      ))}
      {view.knockout.length > 0 ? (
        <TabCard testID="standings-knockouts">
          <CardHead title={t('mob.tournament.knockouts.title')} badge={t('mob.tournament.knockouts.live')} />
          <KnockoutBracket view={view} justSet={board.justSet} onScore={null} />
        </TabCard>
      ) : null}
      {order.length > 0 ? (
        <TabCard>
          <CardHead title={t('mob.tournament.standings.how_title')} badge={t('mob.tournament.standings.live_note')} />
          <Text style={styles.body}>
            {t('mob.tournament.standings.tiebreak_title')}: {order.map(key => t(key)).join(', ')}
          </Text>
          <Text style={styles.note}>{t('mob.tournament.standings.pd_note')}</Text>
        </TabCard>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  loading: { marginVertical: spacing.lg },
  flags: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: spacing.xs },
  note: { ...typography.caption, color: colors.textMuted, marginTop: spacing.sm },
  body: { ...typography.body, color: dash.text },
});
