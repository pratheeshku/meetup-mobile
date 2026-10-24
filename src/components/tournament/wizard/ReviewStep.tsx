/** Step 7, boards TournReview / TournReviewErr / TournReviewFail: a read-only summary, one "Edit" per section. */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useT } from '../../../labels/LabelsContext';
import { colors, spacing, typography } from '../../../theme/tokens';
import { Banner, SectionCard, StepHeading } from './parts';
import { toDate, WIZARD_STEP, type WizardState } from '../../../utils/tournamentWizard';
import { formatDay } from './RegistrationStep';

function day(value: string): string {
  const date = toDate(value);
  return date ? formatDay(date) : '–';
}

export default function ReviewStep({
  state,
  venueLabel,
  onEdit,
}: {
  state: WizardState;
  venueLabel: string;
  onEdit: (step: number) => void;
}): React.JSX.Element {
  const t = useT();
  const team = state.participation === 'team';
  const rows: { key: string; label: string; value: string; step: number }[] = [
    { key: 'name', label: t('mob.tw.review_name'), value: state.title.trim(), step: WIZARD_STEP.basics },
    {
      key: 'players',
      label: t('mob.tw.review_players'),
      value: team ? t('mob.tw.part_team') : t('mob.tw.part_individual'),
      step: WIZARD_STEP.participation,
    },
    {
      key: 'window',
      label: t('mob.tw.review_window'),
      value: t('mob.tw.review_window_value', { start: day(state.startsAt), end: day(state.endsAt), venue: venueLabel }),
      step: WIZARD_STEP.when,
    },
    {
      key: 'block',
      label: t('mob.tw.review_block'),
      value: t('mob.tw.review_block_value', { soft: day(state.closesAt), hard: day(state.hardBlockAt) }),
      step: WIZARD_STEP.registration,
    },
    {
      key: 'visibility',
      label: t('mob.tw.review_visibility'),
      value: !state.isPrivate
        ? t('mob.tw.review_public')
        : state.groupIds.length > 0
        ? t('mob.tw.review_private_groups', { count: state.groupIds.length })
        : t('mob.tw.review_private'),
      step: WIZARD_STEP.visibility,
    },
    {
      key: 'committee',
      label: t('mob.tw.review_committee'),
      value: [t('mob.tw.committee_you'), ...state.committee.map(person => person.displayName)].join(', '),
      step: WIZARD_STEP.committee,
    },
  ];
  return (
    <View>
      <StepHeading>{t('mob.tw.step_review')}</StepHeading>
      <SectionCard>
        {rows.map(row => (
          <View key={row.key} style={styles.row} testID={`tw-review-${row.key}`}>
            <View style={styles.rowText}>
              <Text style={styles.label}>{row.label}</Text>
              <Text style={styles.value}>{row.value}</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('mob.tw.review_edit_a11y', { section: row.label })}
              onPress={() => onEdit(row.step)}
              hitSlop={8}
              style={styles.edit}
              testID={`tw-review-edit-${row.key}`}
            >
              <Text style={styles.editText}>{t('mob.common.edit')}</Text>
            </Pressable>
          </View>
        ))}
      </SectionCard>
      <Banner tone="info" message={t('mob.tw.review_accept_note')} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm },
  rowText: { flex: 1, paddingRight: spacing.sm },
  label: { ...typography.caption, color: colors.textSecondary },
  value: { ...typography.bodyBold, color: colors.textPrimary },
  edit: { minHeight: 44, minWidth: 44, alignItems: 'flex-end', justifyContent: 'center' },
  editText: { ...typography.bodyBold, color: colors.primary },
});
