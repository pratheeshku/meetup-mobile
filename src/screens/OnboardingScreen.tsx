/**
 * First-run full-screen interstitial (DES-MEETUP-ADDENDUM-profile-
 * onboarding.md AD-4, AD-5, §4.3, §7). Steps run in `ONBOARDING_STEP_ORDER`
 * (skills, notifications, mobile number, photo) minus the omitted ones; every
 * step has Save and Skip, both advance. The final action calls
 * `POST /users/me/onboarding/complete`; if that fails the flow is dismissed
 * locally for the session (it reappears next launch). The hardware back
 * button never dismisses it.
 *
 * Fail-open everywhere: a save error shows inline with Skip still available;
 * a missing consent text / country list drops the number step.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { BackHandler, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { withCorrelationId } from '../api/correlationId';
import { completeOnboarding } from '../api/onboarding';
import MobileNumberStep from '../components/onboarding/MobileNumberStep';
import NotificationsStep from '../components/onboarding/NotificationsStep';
import SkillsStep from '../components/onboarding/SkillsStep';
import { useMobileNumberConfig } from '../hooks/useMobileNumberConfig';
import { DEFAULT_STEP_CONTEXT, getActiveSteps } from '../onboarding/steps';
import type { OnboardingStepId, StepContext } from '../onboarding/steps';
import { colors, spacing, typography } from '../theme/tokens';
import LoadingView from '../components/LoadingView';

const STEP_TITLES: Record<OnboardingStepId, string> = {
  skills: 'Your sports',
  notifications: 'Notifications',
  mobile: 'Mobile number (optional)',
  photo: 'Profile photo',
};

interface OnboardingScreenProps {
  /** The account already has a stored number. */
  hasMobileNumber: boolean;
  /** Called once the flow ends (completed, or dismissed after a failed complete). */
  onDone: () => void;
  /** Overrides for tests; defaults come from the architect's step flags. */
  stepFlags?: Pick<StepContext, 'notificationStep' | 'photoStep'>;
}

export default function OnboardingScreen({
  hasMobileNumber,
  onDone,
  stepFlags = DEFAULT_STEP_CONTEXT,
}: OnboardingScreenProps): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const mobileConfig = useMobileNumberConfig();
  const [index, setIndex] = useState(0);
  const [finishing, setFinishing] = useState(false);

  // Hardware back must NOT dismiss the interstitial.
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => subscription.remove();
  }, []);

  const mobileSettled = mobileConfig.status !== 'loading';
  const steps = useMemo(
    () =>
      getActiveSteps({
        ...stepFlags,
        hasMobileNumber,
        mobileAvailable: mobileConfig.status === 'ready',
      }).filter(step => step !== 'photo'),
    [stepFlags, hasMobileNumber, mobileConfig.status],
  );

  const finish = useCallback(async () => {
    setFinishing(true);
    try {
      await withCorrelationId(correlationId => completeOnboarding({ correlationId }));
    } catch {
      // Fail open: dismiss locally for this session; the server flag stays
      // unset so the flow returns on the next launch.
    }
    onDone();
  }, [onDone]);

  const advance = useCallback(() => {
    if (index + 1 >= steps.length) {
      finish();
    } else {
      setIndex(index + 1);
    }
  }, [index, steps.length, finish]);

  // The mobile step needs the config settled so the step list is stable.
  if (!mobileSettled || finishing) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <LoadingView />
      </View>
    );
  }

  const step = steps[Math.min(index, steps.length - 1)];

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]} testID="onboarding-screen">
      <View style={styles.header}>
        <Text style={styles.progress}>
          Step {Math.min(index, steps.length - 1) + 1} of {steps.length}
        </Text>
        <Text style={styles.title} accessibilityRole="header">
          {step ? STEP_TITLES[step] : ''}
        </Text>
      </View>
      <View style={styles.body}>
        {step === 'skills' ? <SkillsStep key="skills" onDone={advance} /> : null}
        {step === 'notifications' ? <NotificationsStep key="notifications" onDone={advance} /> : null}
        {step === 'mobile' && mobileConfig.status === 'ready' ? (
          <MobileNumberStep key="mobile" config={mobileConfig} onDone={advance} />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.background,
  },
  header: { paddingHorizontal: spacing.md, paddingTop: spacing.md },
  progress: { ...typography.caption, color: colors.textMuted },
  title: { ...typography.h1, color: colors.textPrimary, marginTop: spacing.xs },
  body: { flex: 1 },
});
