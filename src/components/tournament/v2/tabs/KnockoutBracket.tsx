/**
 * The knockout rounds (boards TV2MobLiveKnockouts, TV2MobDoneKnockouts): one card per match with the names the server
 * has filled in, the words of the slots it has not ("Group B, place 2", "Winner Semi-final 1"), "Just set" on a slot that
 * was filled just now, and Enter score or Edit score for the committee. Used inside Fixtures (the Knockouts view) and
 * below the tables of Standings. Nothing is decided here.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useT } from '../../../../labels/LabelsContext';
import { dash } from '../../../../theme/dashboardTheme';
import { borderWidth, colors, radius, spacing, typography } from '../../../../theme/tokens';
import type { ScoringMatch, TournamentStandingsView } from '../../../../types/tournamentScoring';
import { groupKnockoutRounds } from '../../../../utils/tournamentScoring';
import { bothSidesKnown, roundTitle, setsWon } from '../../../../utils/tournamentTabs';
import Button from '../../../Button';
import UserAvatar from '../../../UserAvatar';
import { knockoutName, slotText } from './matchLabels';
import { Chip, EmptyLine } from './parts';

const AVATAR = 32;

export default function KnockoutBracket({
  view,
  justSet,
  onScore,
}: {
  view: TournamentStandingsView;
  justSet: Set<string>;
  /** Enter score or Edit score for the committee; null hides the button. */
  onScore: ((match: ScoringMatch) => void) | null;
}): React.JSX.Element {
  const t = useT();
  const rounds = groupKnockoutRounds(view.knockout);
  if (rounds.length === 0) {
    return <EmptyLine text={t('mob.tournament.knockouts.empty')} />;
  }
  return (
    <View testID="knockout-bracket">
      {rounds.map(round => {
        const title = roundTitle(round.stage, round.matches.length);
        return (
          <View key={round.key}>
            <Text style={styles.roundTitle}>{t(title.key, title.count !== null ? { count: title.count } : undefined)}</Text>
            {round.matches.map(match => {
              const open = !match.side_a.name || !match.side_b.name;
              const [wa, wb] = setsWon(match);
              return (
                <View key={match.fixture_id} style={[styles.card, open ? styles.cardOpen : null]} testID={`knockout-${match.fixture_id}`}>
                  <View style={styles.head}>
                    <Text style={styles.title}>{knockoutName(match, view, t)}</Text>
                    {justSet.has(match.fixture_id) ? <Chip label={t('mob.tournament.knockouts.just_set')} tone="green" /> : null}
                  </View>
                  {(['a', 'b'] as const).map(side => {
                    const info = side === 'a' ? match.side_a : match.side_b;
                    return (
                      <View key={side} style={styles.side}>
                        <UserAvatar name={info.name ?? ''} size={AVATAR} fallback="initials" />
                        <Text style={[styles.name, !info.name ? styles.slot : null]} numberOfLines={1}>
                          {slotText(info, view, t)}
                        </Text>
                        {match.result ? <Text style={styles.sets}>{side === 'a' ? wa : wb}</Text> : null}
                      </View>
                    );
                  })}
                  {onScore && bothSidesKnown(match) ? (
                    <Button
                      label={t(match.result ? 'mob.tournament.fixtures.edit_score' : 'mob.tournament.fixtures.enter_score')}
                      variant="secondary"
                      size="sm"
                      onPress={() => onScore(match)}
                      style={styles.button}
                      testID={`fixture-score-${match.fixture_id}`}
                    />
                  ) : null}
                </View>
              );
            })}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  roundTitle: { ...typography.label, color: dash.textMuted, marginTop: spacing.sm, marginBottom: spacing.xs, textTransform: 'uppercase' },
  card: { borderWidth: borderWidth.medium, borderColor: colors.successDark, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.sm },
  cardOpen: { borderStyle: 'dashed', borderColor: dash.panelBorder },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { ...typography.label, color: dash.textMuted, textTransform: 'uppercase' },
  side: { flexDirection: 'row', alignItems: 'center', minHeight: 44 },
  name: { ...typography.bodyBold, color: dash.text, flex: 1, marginLeft: spacing.sm },
  slot: { ...typography.body, fontStyle: 'italic', color: dash.textMuted },
  sets: { ...typography.h3, color: dash.text, width: 32, textAlign: 'right' },
  button: { marginTop: spacing.sm, alignSelf: 'flex-start' },
});
