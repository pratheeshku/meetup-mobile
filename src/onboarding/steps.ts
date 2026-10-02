/**
 * First-run flow definition (DES-MEETUP-ADDENDUM-profile-onboarding.md AD-4,
 * §4.3). The step ORDER lives in ONE constant; flags decide which steps take
 * part. Order: skills, notifications, mobile number, profile photo.
 *
 * STEP FLAGS (architect-edited; defaults per the brief): a step flagged
 * `OMIT` is left out of the flow entirely.
 */

export type StepFlag = 'ENABLED' | 'OMIT';

export const NOTIFICATION_STEP: StepFlag = 'ENABLED';
export const PHOTO_STEP: StepFlag = 'OMIT';

export type OnboardingStepId = 'skills' | 'notifications' | 'mobile' | 'photo';

/** The ONE ordered list of steps. */
export const ONBOARDING_STEP_ORDER: readonly OnboardingStepId[] = [
  'skills',
  'notifications',
  'mobile',
  'photo',
];

export interface StepContext {
  notificationStep: StepFlag;
  photoStep: StepFlag;
  /** The account already has a number (the mobile step is then omitted). */
  hasMobileNumber: boolean;
  /** The consent text and country list loaded; otherwise the field is hidden (§7). */
  mobileAvailable: boolean;
}

export const DEFAULT_STEP_CONTEXT: Pick<StepContext, 'notificationStep' | 'photoStep'> = {
  notificationStep: NOTIFICATION_STEP,
  photoStep: PHOTO_STEP,
};

/** Steps that take part, in `ONBOARDING_STEP_ORDER` order. */
export function getActiveSteps(context: StepContext): OnboardingStepId[] {
  return ONBOARDING_STEP_ORDER.filter(step => {
    switch (step) {
      case 'skills':
        return true;
      case 'notifications':
        return context.notificationStep === 'ENABLED';
      case 'mobile':
        return !context.hasMobileNumber && context.mobileAvailable;
      case 'photo':
        return context.photoStep === 'ENABLED';
      default:
        return false;
    }
  });
}
