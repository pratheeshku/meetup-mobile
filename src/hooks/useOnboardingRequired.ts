/**
 * Decides whether the first-run flow shows (DES-MEETUP-ADDENDUM-profile-
 * onboarding.md AD-4, §7): it shows ONLY when `GET /users/me` answers with
 * `onboarding_required === true`. Fail-open: an error, or no answer within
 * the timeout, means "not required" — the flow must never lock anyone out.
 * A late answer after the timeout is ignored.
 */
import { useEffect, useState } from 'react';

import { withCorrelationId } from '../api/correlationId';
import { getOnboardingState } from '../api/onboarding';

export const ONBOARDING_CHECK_TIMEOUT_MS = 8_000;

export interface OnboardingCheck {
  /** `true` only on a definite `onboarding_required: true` answer in time. */
  required: boolean;
  hasMobileNumber: boolean;
}

const NOT_REQUIRED: OnboardingCheck = { required: false, hasMobileNumber: false };

/** `null` while checking. */
export function useOnboardingRequired(userId: string | null | undefined): OnboardingCheck | null {
  const [result, setResult] = useState<{ userId: string; check: OnboardingCheck } | null>(null);

  useEffect(() => {
    if (!userId) {
      return undefined;
    }
    let settled = false;
    const settle = (check: OnboardingCheck): void => {
      if (!settled) {
        settled = true;
        setResult({ userId, check });
      }
    };
    const timer = setTimeout(() => settle(NOT_REQUIRED), ONBOARDING_CHECK_TIMEOUT_MS);
    withCorrelationId(correlationId => getOnboardingState({ correlationId })).then(
      state =>
        settle({
          required: state.onboarding_required,
          hasMobileNumber: state.has_mobile_number,
        }),
      () => settle(NOT_REQUIRED),
    );
    return () => {
      settled = true;
      clearTimeout(timer);
    };
  }, [userId]);

  return result && result.userId === userId ? result.check : null;
}
