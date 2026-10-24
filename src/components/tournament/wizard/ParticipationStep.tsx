/**
 * Step 2: individual or team. The player and team counts are no longer chosen here: the wizard sends no `overrides`
 * (tournament-experience AD-T3), so the server applies the single format's own counts.
 */
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { useT } from '../../../labels/LabelsContext';
import { spacing } from '../../../theme/tokens';
import type { WizardParticipation } from '../../../types/tournamentWizard';
import SegmentedSwitch from '../../SegmentedSwitch';
import { Banner, SectionCard, StepHeading } from './parts';
import type { WizardState } from '../../../utils/tournamentWizard';

export default function ParticipationStep({
  state,
  onChange,
}: {
  state: WizardState;
  onChange: (patch: Partial<WizardState>) => void;
}): React.JSX.Element {
  const t = useT();
  const team = state.participation === 'team';
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
      <SectionCard style={styles.card}>
        <Banner tone="info" message={team ? t('mob.tw.part_team_note') : t('mob.tw.part_locked_note')} style={styles.note} />
      </SectionCard>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginTop: spacing.md },
  note: { marginTop: 0 },
});
