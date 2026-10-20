import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import Card from '../Card';
import Button from '../Button';
import { TrophyIcon } from '../icons/SharedIcons';
import { colors, radius, spacing, typography } from '../../theme/tokens';
import { useT } from '../../labels/LabelsContext';

interface ClosureSummaryCardProps {
  outcome?: string | null;
  winnerName?: string | null;
  runnerUpName?: string | null;
  canEdit?: boolean;
  onEditPress?: () => void;
  entityType?: 'event' | 'tournament';
}

export default function ClosureSummaryCard({
  outcome,
  winnerName,
  runnerUpName,
  canEdit = false,
  onEditPress,
  entityType: _entityType = 'event',
}: ClosureSummaryCardProps): React.JSX.Element {
  const t = useT();

  const outcomeText =
    outcome === 'completed'
      ? t('mob.closure.outcome_played')
      : outcome === 'not_held'
      ? t('mob.closure.not_held_sub')
      : null;

  return (
    <Card style={styles.card} testID="closure-summary-card">
      <View style={styles.headerRow}>
        <Text style={styles.title}>{t('mob.closure.title')}</Text>
        {outcomeText ? (
          <View style={styles.outcomeBadge}>
            <Text style={styles.outcomeText}>{outcomeText}</Text>
          </View>
        ) : null}
      </View>

      {outcome === 'completed' ? (
        <View style={styles.resultsContainer}>
          {winnerName ? (
            <View style={styles.resultRow} testID="closure-winner-row">
              <View style={styles.iconBox}>
                <TrophyIcon size={18} />
              </View>
              <View style={styles.resultDetails}>
                <Text style={styles.roleLabel}>{t('mob.closure.winner')}</Text>
                <Text style={styles.nameText}>{winnerName}</Text>
              </View>
            </View>
          ) : null}

          {runnerUpName ? (
            <View style={styles.resultRow} testID="closure-runner-up-row">
              <View style={styles.iconBoxSecondary}>
                <Text style={styles.runnerUpNumber}>2</Text>
              </View>
              <View style={styles.resultDetails}>
                <Text style={styles.roleLabel}>{t('mob.closure.runner_up')}</Text>
                <Text style={styles.nameText}>{runnerUpName}</Text>
              </View>
            </View>
          ) : null}
        </View>
      ) : null}

      {canEdit && onEditPress ? (
        <View style={styles.buttonWrapper}>
          <Button
            label={t('mob.closure.edit_closure')}
            variant="secondary"
            onPress={onEditPress}
            testID="edit-closure-button"
          />
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  title: {
    ...typography.h3,
    color: colors.textPrimary,
  },
  outcomeBadge: {
    backgroundColor: colors.track,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
  },
  outcomeText: {
    ...typography.label,
    color: colors.textPrimary,
  },
  resultsContainer: {
    marginVertical: spacing.xs,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  iconBox: {
    width: 32,
    height: 32,
    borderRadius: radius.full,
    backgroundColor: colors.warningLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  iconBoxSecondary: {
    width: 32,
    height: 32,
    borderRadius: radius.full,
    backgroundColor: colors.track,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  runnerUpNumber: {
    ...typography.bodyBold,
    color: colors.textSecondary,
  },
  resultDetails: {
    flex: 1,
  },
  roleLabel: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  nameText: {
    ...typography.bodyBold,
    color: colors.textPrimary,
  },
  buttonWrapper: {
    marginTop: spacing.sm,
  },
});
