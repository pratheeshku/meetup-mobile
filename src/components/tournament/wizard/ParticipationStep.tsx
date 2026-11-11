/**
 * Step 2, boards M1 / M2 / M3 (team-size-capacity AD-4, AD-8): individual or team, "Maximum participants" always and
 * "Players per team" in team mode only, both steppers prefilled from the server's client config. The ranges are hints
 * (UX only): the server decides, and its refusal shows as a banner on the step (M3).
 */
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { useT } from '../../../labels/LabelsContext';
import { borderWidth, colors, spacing } from '../../../theme/tokens';
import type { WizardParticipation } from '../../../types/tournamentWizard';
import SegmentedSwitch from '../../SegmentedSwitch';
import { Banner, CountStepper, SectionCard, StepHeading, tokenFor, type StepFocus } from './parts';
import { FALLBACK_RANGE_HINTS, type WizardRangeHints, type WizardState } from '../../../utils/tournamentWizard';

export default function ParticipationStep({
  state,
  onChange,
  focus,
  hints = FALLBACK_RANGE_HINTS,
  errors = {},
}: {
  state: WizardState;
  onChange: (patch: Partial<WizardState>) => void;
  focus?: StepFocus;
  hints?: WizardRangeHints;
  /** The step's messages by field (`team_size`, `entrants_max`, `_`), a server refusal included. */
  errors?: Record<string, string>;
}): React.JSX.Element {
  const t = useT();
  const team = state.participation === 'team';
  const bannerMessage = errors.team_size ?? errors.entrants_max ?? errors._ ?? null;
  return (
    <View>
      <StepHeading>{t('mob.tw.step_participation')}</StepHeading>
      <SegmentedSwitch<WizardParticipation>
        value={state.participation}
        onChange={participation => onChange({ participation })}
        focusToken={tokenFor(focus, 'participation')}
        options={[
          { value: 'individual', label: t('mob.tw.part_individual') },
          { value: 'team', label: t('mob.tw.part_team') },
        ]}
      />
      {bannerMessage ? <Banner tone="error" message={bannerMessage} testID="tw-participation-error" /> : null}
      <SectionCard title={t(team ? 'mob.tw.part_teams_section' : 'mob.tw.part_capacity_section')} style={styles.card}>
        {team ? (
          <CountStepper
            label={t('mob.tw.team_size')}
            hint={t('mob.tw.team_size_hint', hints.teamSize)}
            value={state.teamSize}
            min={hints.teamSize.min}
            max={hints.teamSize.max}
            onChange={teamSize => onChange({ teamSize, sizesTouched: true })}
            decreaseLabel={t('mob.tw.team_size_less')}
            increaseLabel={t('mob.tw.team_size_more')}
            testID="tw-team-size"
          />
        ) : null}
        <View style={team ? styles.divided : null}>
          <CountStepper
            label={t('mob.tw.entrants_max')}
            hint={t(team ? 'mob.tw.entrants_hint_team' : 'mob.tw.entrants_hint_individual', hints.entrants)}
            value={state.entrantsMax}
            min={hints.entrants.min}
            max={hints.entrants.max}
            onChange={entrantsMax => onChange({ entrantsMax, sizesTouched: true })}
            decreaseLabel={t('mob.tw.entrants_less')}
            increaseLabel={t('mob.tw.entrants_more')}
            testID="tw-entrants-max"
          />
        </View>
        <Banner tone="info" message={team ? t('mob.tw.part_team_note') : t('mob.tw.part_individual_note')} style={styles.note} />
      </SectionCard>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginTop: spacing.md },
  divided: { borderTopWidth: borderWidth.thin, borderTopColor: colors.border },
  note: { marginTop: spacing.sm },
});
