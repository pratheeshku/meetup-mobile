/**
 * One group's table (board BRGroups): player, P, W, L, set difference and point difference, exactly as
 * the backend returned them in the backend's order. Qualified rows are highlighted; tied rows share a
 * place and say so. Fixed column widths keep every row aligned (AGENTS.md).
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useT } from '../../labels/LabelsContext';
import { borderWidth, colors, radius, shadows, spacing, typography } from '../../theme/tokens';
import type { ScoringGroup } from '../../types/tournamentScoring';
import { signed } from '../../utils/tournamentScoring';

const RANK_WIDTH = 24;
const COUNT_WIDTH = 28;
const DIFF_WIDTH = 60;

interface Props {
  group: ScoringGroup;
  /** Registration ids the backend has seated in the knockout. Only used once the group's qualifiers are resolved. */
  qualifiedIds: ReadonlySet<string>;
}

export default function GroupTable({ group, qualifiedIds }: Props): React.JSX.Element {
  const t = useT();
  const showQualified = group.qualifiers_resolved;

  return (
    <View style={styles.card} testID={`scoring-table-${group.group_key}`}>
      <View style={styles.headRow}>
        <Text style={[styles.head, styles.rank]} />
        <Text style={[styles.head, styles.player]}>{t('mob.scoring.col_player')}</Text>
        <Text style={[styles.head, styles.count]}>{t('mob.scoring.col_played')}</Text>
        <Text style={[styles.head, styles.count]}>{t('mob.scoring.col_won')}</Text>
        <Text style={[styles.head, styles.count]}>{t('mob.scoring.col_lost')}</Text>
        <Text style={[styles.head, styles.diff]}>{t('mob.scoring.col_set_diff')}</Text>
        <Text style={[styles.head, styles.diff]}>{t('mob.scoring.col_point_diff')}</Text>
      </View>
      {group.table.length === 0 ? (
        <Text style={styles.empty}>{t('mob.scoring.group_empty')}</Text>
      ) : (
        group.table.map(row => {
          const qualified = showQualified && qualifiedIds.has(row.registration_id);
          return (
            <View
              key={row.registration_id}
              style={[styles.row, qualified ? styles.rowQualified : null]}
              testID={`scoring-row-${row.registration_id}`}
              accessible
              accessibilityLabel={[
                t('mob.scoring.row_a11y', {
                  rank: row.rank,
                  name: row.name,
                  played: row.played,
                  won: row.won,
                  lost: row.lost,
                  setDiff: signed(row.set_diff),
                  pointDiff: signed(row.point_diff),
                }),
                row.tied ? t('mob.scoring.tied') : '',
                qualified ? t('mob.scoring.qualified') : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              <Text style={[styles.cell, styles.rank]}>{row.tied ? `=${row.rank}` : row.rank}</Text>
              <Text
                style={[styles.cell, styles.player, qualified ? styles.bold : null]}
                numberOfLines={1}
              >
                {row.name}
              </Text>
              <Text style={[styles.cell, styles.count]}>{row.played}</Text>
              <Text style={[styles.cell, styles.count, styles.bold]}>{row.won}</Text>
              <Text style={[styles.cell, styles.count]}>{row.lost}</Text>
              <Text style={[styles.cell, styles.diff]}>{signed(row.set_diff)}</Text>
              <Text style={[styles.cell, styles.diff]}>{signed(row.point_diff)}</Text>
            </View>
          );
        })
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: borderWidth.thin,
    borderColor: colors.border,
    paddingVertical: spacing.sm,
    ...shadows.card,
  },
  headRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingBottom: spacing.xs },
  head: { ...typography.label, color: colors.textMuted },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 40,
    paddingHorizontal: spacing.md,
    borderTopWidth: borderWidth.thin,
    borderTopColor: colors.border,
  },
  rowQualified: { backgroundColor: colors.primaryLight },
  cell: { ...typography.body, color: colors.textPrimary },
  bold: { fontWeight: '700' },
  rank: { width: RANK_WIDTH },
  player: { flex: 1 },
  count: { width: COUNT_WIDTH, textAlign: 'center' },
  diff: { width: DIFF_WIDTH, textAlign: 'right' },
  empty: { ...typography.caption, color: colors.textMuted, padding: spacing.md },
});
