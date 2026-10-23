/**
 * Step 2, boards TournFormat / TournFormatEmpty: the published templates the server lists (groups and knockout
 * only), one selectable card each; the Empty board when there are none.
 *
 * Not built (Blocked Report, docs/reports/tl-c-mobile-2-report.md): the group-stage option picker of
 * TournFormatGroups / TournFormatGroupsErr, because `POST /tournaments/v2/create` has no field that carries the
 * chosen group option (the only overrides are entrants and team size).
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useT } from '../../../labels/LabelsContext';
import { colors, spacing, typography } from '../../../theme/tokens';
import type { WizardTemplate } from '../../../types/tournamentWizard';
import EmptyState from '../../EmptyState';
import IconBadge from '../../IconBadge';
import InlineError from '../../InlineError';
import SelectableCard from '../../SelectableCard';
import { TrophyIcon } from '../../icons/SharedIcons';
import { Banner, FieldError, StepHeading } from './parts';

const BADGE = 44;

export default function FormatStep({
  templates,
  selectedId,
  onSelect,
  sportLabel,
  loadError,
  onRetry,
  retiredMessage,
  error,
}: {
  templates: WizardTemplate[];
  selectedId: string | null;
  onSelect: (template: WizardTemplate) => void;
  sportLabel: string;
  loadError: boolean;
  onRetry: () => void;
  /** Set when the server says the chosen format was retired (board TournReviewErr). */
  retiredMessage: string | null;
  error?: string;
}): React.JSX.Element {
  const t = useT();
  if (loadError) {
    return (
      <View>
        <StepHeading>{t('mob.tw.step_format')}</StepHeading>
        <InlineError message={t('mob.tw.format_load_error')} onRetry={onRetry} />
      </View>
    );
  }
  if (templates.length === 0) {
    return (
      <View>
        <StepHeading>{t('mob.tw.step_format')}</StepHeading>
        <Banner tone="warning" message={t('mob.tw.format_empty_banner', { sport: sportLabel })} testID="tw-format-empty-banner" />
        <EmptyState title={t('mob.tw.format_empty_title')} subtitle={t('mob.tw.format_empty_sub')} />
      </View>
    );
  }
  return (
    <View>
      <StepHeading>{t('mob.tw.step_format')}</StepHeading>
      {retiredMessage ? <Banner tone="error" message={retiredMessage} testID="tw-format-retired" /> : null}
      {templates.map(template => {
        const { entrants_min: min, entrants_max: max } = template.format;
        return (
          <SelectableCard
            key={template.id}
            testID={`tw-format-${template.id}`}
            style={styles.card}
            title={template.display_name}
            accessibilityLabel={t('mob.tw.format_a11y', { name: template.display_name, version: template.version })}
            leading={
              <IconBadge size={BADGE} color="blue">
                <TrophyIcon size={22} />
              </IconBadge>
            }
            selected={template.id === selectedId}
            onPress={() => onSelect(template)}
            subtitle={[
              t('mob.tw.format_tag_group'),
              min !== null && max !== null ? t('mob.tw.format_tag_entrants', { min, max }) : null,
              t('mob.tw.format_tag_version', { version: template.version }),
            ]
              .filter(Boolean)
              .join(' · ')}
          />
        );
      })}
      <FieldError message={error} testID="tw-format-error" />
      <Text style={styles.note}>{t('mob.tw.format_note')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: spacing.sm },
  note: { ...typography.caption, color: colors.textSecondary, marginTop: spacing.sm },
});
