/**
 * Step 3, boards TournPart / TournPartErr / TournPartTeam: individual or team, and the player or team counts.
 * A count is editable only when the template lists it as an organizer override (`organizer_overrides`); otherwise
 * it shows the template's own value, locked. The server accepts no other count (`overrides` is closed).
 */
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { useT } from '../../../labels/LabelsContext';
import { spacing } from '../../../theme/tokens';
import type { WizardOverrideField, WizardParticipation, WizardTemplate } from '../../../types/tournamentWizard';
import SegmentedSwitch from '../../SegmentedSwitch';
import { Banner, CountStepper, LockedRow, SectionCard, StepHeading } from './parts';
import { overrideLimits, templateDefault, type WizardState } from '../../../utils/tournamentWizard';

export default function ParticipationStep({
  state,
  template,
  onChange,
  errors,
}: {
  state: WizardState;
  template: WizardTemplate;
  onChange: (patch: Partial<WizardState>) => void;
  errors: string[];
}): React.JSX.Element {
  const t = useT();
  const team = state.participation === 'team';

  const row = (
    field: WizardOverrideField,
    value: number | null,
    label: string,
    patchKey: 'entrantsMin' | 'entrantsMax' | 'teamSizeMin' | 'teamSizeMax',
    testID: string,
  ): React.JSX.Element => {
    const limit = overrideLimits(template, field);
    if (!limit) {
      const fixed = templateDefault(template, field);
      return <LockedRow key={field} label={label} value={fixed === null ? '–' : String(fixed)} />;
    }
    return (
      <CountStepper
        key={field}
        testID={testID}
        label={label}
        hint={t('mob.tw.part_template_allows', { min: limit.min, max: limit.max })}
        value={value}
        min={limit.min}
        max={limit.max}
        onChange={next => onChange({ [patchKey]: next } as Partial<WizardState>)}
        decreaseLabel={t('mob.number_field.decrease')}
        increaseLabel={t('mob.number_field.increase')}
      />
    );
  };

  return (
    <View>
      <StepHeading>{t('mob.tw.step_participation')}</StepHeading>
      <SegmentedSwitch<WizardParticipation>
        value={state.participation}
        onChange={participation => onChange({ participation })}
        options={[
          { value: 'individual', label: t('mob.tw.part_individual') },
          { value: 'team', label: t('mob.tw.part_team') },
        ]}
      />
      <SectionCard
        style={styles.card}
        title={team ? t('mob.tw.part_teams_section') : t('mob.tw.part_players_section')}
      >
        {team ? (
          <>
            {row('team_size_min', state.teamSizeMin, t('mob.tw.part_team_min'), 'teamSizeMin', 'tw-team-size-min')}
            {row('team_size_max', state.teamSizeMax, t('mob.tw.part_team_max'), 'teamSizeMax', 'tw-team-size-max')}
            {row('entrants_min', state.entrantsMin, t('mob.tw.part_min_teams'), 'entrantsMin', 'tw-entrants-min')}
            {row('entrants_max', state.entrantsMax, t('mob.tw.part_max_teams'), 'entrantsMax', 'tw-entrants-max')}
          </>
        ) : (
          <>
            {row('entrants_min', state.entrantsMin, t('mob.tw.part_min_players'), 'entrantsMin', 'tw-entrants-min')}
            {row('entrants_max', state.entrantsMax, t('mob.tw.part_max_players'), 'entrantsMax', 'tw-entrants-max')}
          </>
        )}
        {errors.map(message => (
          <Banner key={message} tone="error" message={message} testID="tw-part-error" />
        ))}
        <Banner
          tone="info"
          message={team ? t('mob.tw.part_team_note') : t('mob.tw.part_locked_note')}
          style={styles.note}
        />
      </SectionCard>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginTop: spacing.md },
  note: { marginTop: spacing.sm },
});
