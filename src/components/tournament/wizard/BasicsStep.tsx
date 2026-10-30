/** Step 1, board TournBasics / TournBasicsErr: sport row, tournament name. The description row moved to the last input step (team-screens-remarks D-2). */
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { focusRingStyle, useAccessibilityFocus, useTextFocus } from '../../../hooks/useAccessibilityFocus';
import { useT } from '../../../labels/LabelsContext';
import { borderWidth, colors, radius, spacing, typography } from '../../../theme/tokens';
import type { Sport } from '../../../types/sport';
import IconBadge from '../../IconBadge';
import TextField from '../../TextField';
import { ChevronRightIcon } from '../../icons/ActionIcons';
import { TrophyIcon } from '../../icons/SharedIcons';
import InlineError from '../../InlineError';
import ImagesCard from './ImagesCard';
import { FieldError, FieldLabel, SectionCard, StepHeading, tokenFor, type StepFocus } from './parts';
import { TITLE_MAX, type WizardState } from '../../../utils/tournamentWizard';

const BADGE = 44;

export default function BasicsStep({
  state,
  sports,
  sportsError,
  onRetrySports,
  onChange,
  errors,
  focus,
}: {
  state: WizardState;
  sports: Sport[];
  sportsError: boolean;
  onRetrySports: () => void;
  onChange: (patch: Partial<WizardState>) => void;
  errors: Record<string, string>;
  focus?: StepFocus;
}): React.JSX.Element {
  const t = useT();
  const sportFocus = useAccessibilityFocus(tokenFor(focus, 'sport'));
  const titleRef = useTextFocus(tokenFor(focus, 'title'));
  const [picking, setPicking] = useState(false);
  const [pickFailed, setPickFailed] = useState(false);
  const current = sports.find(item => item.name === state.sport);
  return (
    <View>
      <StepHeading>{t('mob.tw.step_basics')}</StepHeading>
      {sportsError ? <InlineError message={t('mob.common.sports_load_error')} onRetry={onRetrySports} /> : null}
      <ImagesCard
        banner={state.banner}
        logo={state.logo}
        onBanner={banner => {
          setPickFailed(false);
          onChange({ banner });
        }}
        onLogo={logo => {
          setPickFailed(false);
          onChange({ logo });
        }}
        onPickFailed={() => setPickFailed(true)}
      />
      {pickFailed ? <FieldError message={t('mob.tw.images_pick_failed')} testID="tw-images-pick-error" /> : null}
      <SectionCard title={t('mob.tw.sport')} style={styles.basicsCard}>
        <Pressable
          ref={sportFocus.ref}
          onBlur={sportFocus.clear}
          accessibilityRole="button"
          accessibilityLabel={t('mob.tw.sport_change')}
          onPress={() => {
            sportFocus.clear();
            setPicking(open => !open);
          }}
          style={[styles.sportRow, sportFocus.ringed ? focusRingStyle : null]}
          testID="tw-sport-row"
        >
          <IconBadge size={BADGE} color="blue">
            <TrophyIcon size={22} />
          </IconBadge>
          <Text style={styles.sportName} numberOfLines={1}>
            {current?.display_name ?? state.sport}
          </Text>
          <View style={styles.chevronBox}>
            <ChevronRightIcon size={18} color={colors.textMuted} />
          </View>
        </Pressable>
        {picking
          ? sports.map(sport => (
              <Pressable
                key={sport.name}
                accessibilityRole="radio"
                accessibilityState={{ selected: sport.name === state.sport }}
                accessibilityLabel={sport.display_name}
                onPress={() => {
                  setPicking(false);
                  if (sport.name !== state.sport) {
                    onChange({ sport: sport.name });
                  }
                }}
                style={styles.sportOption}
              >
                <Text style={[styles.sportOptionText, sport.name === state.sport ? styles.sportOptionOn : null]}>
                  {sport.display_name}
                </Text>
              </Pressable>
            ))
          : null}
        <FieldError message={errors.sport} />

        <FieldLabel>{t('mob.tw.name')}</FieldLabel>
        <TextField
          ref={titleRef}
          value={state.title}
          onChangeText={title => onChange({ title })}
          placeholder={t('mob.tw.name_placeholder')}
          maxLength={TITLE_MAX + 20}
          accessibilityLabel={t('mob.tw.name')}
          style={errors.title ? styles.invalid : undefined}
          testID="tw-title"
        />
        <FieldError message={errors.title} testID="tw-title-error" />
      </SectionCard>
    </View>
  );
}

const styles = StyleSheet.create({
  sportRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: borderWidth.thin,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.sm,
  },
  sportName: { ...typography.bodyBold, color: colors.textPrimary, flex: 1, marginLeft: spacing.sm },
  chevronBox: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  sportOption: { paddingVertical: spacing.sm, paddingHorizontal: spacing.sm, minHeight: 44, justifyContent: 'center' },
  sportOptionText: { ...typography.body, color: colors.textPrimary },
  sportOptionOn: { fontWeight: '700', color: colors.primary },
  basicsCard: { marginTop: spacing.md },
  invalid: { borderColor: colors.error },
});
