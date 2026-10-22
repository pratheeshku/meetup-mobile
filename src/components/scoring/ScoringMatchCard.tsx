/**
 * One match on the scoring views (boards BRGroups*, BRKnockout*, BRMine; match-scoring v1.2 §4).
 *
 * Layout follows the board: a muted meta line, then one row per side with the name on the left
 * and that side's score on the right. The set-by-set line is each side's games in every set, one
 * fixed-width cell per set. The winner is whoever the backend names in `winner_registration_id`
 * (bold name, green score): the card never works out a winner. W/O and RET come from the
 * result type and are shown as labels.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useT } from '../../labels/LabelsContext';
import type { TranslateFn } from '../../labels/LabelsContext';
import { borderWidth, colors, radius, shadows, spacing, typography } from '../../theme/tokens';
import type { ScoringMatch, ScoringSide } from '../../types/tournamentScoring';
import { sideSetScores } from '../../utils/tournamentScoring';

/** One score cell: fixed width so set columns line up across both rows and across cards. */
const SCORE_CELL_WIDTH = 32;

const STAGE_KEYS = {
  group: 'mob.scoring.stage_group',
  quarterfinal: 'mob.scoring.stage_quarterfinal',
  semifinal: 'mob.scoring.stage_semifinal',
  final: 'mob.scoring.stage_final',
  third_place: 'mob.scoring.stage_third_place',
} as const;

const PLACEHOLDER_KEYS = {
  group_place: 'mob.scoring.placeholder_group_place',
  winner: 'mob.scoring.placeholder_winner',
  loser: 'mob.scoring.placeholder_loser',
} as const;

/** Short stage reference, e.g. QF1, SF2, Final. `main` rounds carry their size (R16) from the caller. */
export function stageRef(
  match: ScoringMatch,
  t: TranslateFn,
  mainRoundSize?: number,
): string {
  const stage = match.stage;
  if (stage === 'final' || stage === 'third_place') {
    return t(STAGE_KEYS[stage]);
  }
  const base =
    stage === 'main' && mainRoundSize
      ? t('mob.scoring.round_size', { size: mainRoundSize })
      : stage in STAGE_KEYS
        ? t(STAGE_KEYS[stage as keyof typeof STAGE_KEYS])
        : t('mob.scoring.stage_other');
  if (stage === 'group') {
    return base;
  }
  return stage === 'main' ? `${base}-${match.fixture_order}` : `${base}${match.fixture_order}`;
}

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    weekday: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function sideName(side: ScoringSide, mineIds: ReadonlySet<string>, t: TranslateFn): string {
  if (side.registration_id && mineIds.has(side.registration_id)) {
    return t('mob.scoring.you');
  }
  if (side.name) {
    return side.name;
  }
  return side.placeholder ? t(PLACEHOLDER_KEYS[side.placeholder]) : t('mob.scoring.to_be_decided');
}

interface Props {
  match: ScoringMatch;
  /** Registration ids that belong to the signed-in user (shown as "You"). */
  mineIds?: ReadonlySet<string>;
  /** Number of entrants of a `main` round (16 for R16), shown in the stage reference. */
  mainRoundSize?: number;
}

const NO_IDS: ReadonlySet<string> = new Set();

export default function ScoringMatchCard({
  match,
  mineIds = NO_IDS,
  mainRoundSize,
}: Props): React.JSX.Element {
  const t = useT();
  const { result } = match;
  const nameA = sideName(match.side_a, mineIds, t);
  const nameB = sideName(match.side_b, mineIds, t);

  const metaParts = [stageRef(match, t, mainRoundSize)];
  if (match.scheduled_at) {
    metaParts.push(formatWhen(match.scheduled_at));
  }
  if (match.court) {
    metaParts.push(t('mob.scoring.court', { court: match.court }));
  }
  if (result?.result_type === 'walkover') {
    metaParts.push(t('mob.scoring.result_walkover'));
  } else if (result?.result_type === 'retired') {
    metaParts.push(t('mob.scoring.result_retired'));
  }
  if (match.status === 'cancelled') {
    metaParts.push(t('mob.scoring.status_cancelled'));
  }

  const renderRow = (side: 'a' | 'b', name: string): React.JSX.Element => {
    const info = side === 'a' ? match.side_a : match.side_b;
    const isWinner =
      match.winner_registration_id !== null && info.registration_id === match.winner_registration_id;
    const scores = sideSetScores(result, side);
    return (
      <View style={styles.row} testID={`scoring-match-${match.fixture_id}-${side}`}>
        <Text
          style={[styles.name, isWinner ? styles.winnerName : styles.loserName]}
          numberOfLines={1}
          accessibilityHint={isWinner ? t('mob.scoring.winner_a11y') : undefined}
        >
          {name}
        </Text>
        {scores.map((score, index) => (
          <Text
            // The set number is the position; a set list never reorders.
            key={index}
            style={[styles.score, isWinner ? styles.winnerScore : styles.loserScore]}
          >
            {score}
          </Text>
        ))}
      </View>
    );
  };

  return (
    <View
      style={styles.card}
      testID={`scoring-match-${match.fixture_id}`}
      accessible
      accessibilityLabel={`${t('mob.scoring.match_a11y', { a: nameA, b: nameB })}. ${metaParts.join(', ')}`}
    >
      <Text style={styles.meta}>{metaParts.join(' · ')}</Text>
      {renderRow('a', nameA)}
      {renderRow('b', nameB)}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: borderWidth.thin,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...shadows.card,
  },
  meta: { ...typography.caption, color: colors.textMuted, marginBottom: spacing.xs },
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 24 },
  name: { ...typography.body, flex: 1 },
  winnerName: { fontWeight: '700', color: colors.textPrimary },
  loserName: { color: colors.textPrimary },
  score: { ...typography.bodyBold, width: SCORE_CELL_WIDTH, textAlign: 'right' },
  winnerScore: { color: colors.success },
  loserScore: { color: colors.textPrimary },
});
