/**
 * First-run flow endpoints (DES-MEETUP-ADDENDUM-profile-onboarding.md AD-4,
 * AD-5, §4.1). Contract verified against the live OpenAPI document:
 * `PrivateUserProfile` (`GET /users/me`) has `onboarding_required: boolean`
 * and `mobile_number: string | null`; `POST /users/me/onboarding/complete`
 * is idempotent and returns 200.
 *
 * `mobile_number` is PII: it is returned to the caller only, never logged.
 */
import { apiClient } from './client';

interface RequestOptions {
  correlationId?: string;
}

export interface OnboardingState {
  onboarding_required: boolean;
  /** Whether the account already has a stored number (the value is not kept). */
  has_mobile_number: boolean;
}

interface PrivateUserProfileOnboardingFields {
  onboarding_required?: boolean;
  mobile_number?: string | null;
}

export async function getOnboardingState(options?: RequestOptions): Promise<OnboardingState> {
  const { data } = await apiClient.get<PrivateUserProfileOnboardingFields>('/users/me', {
    correlationId: options?.correlationId,
  });
  return {
    onboarding_required: data.onboarding_required === true,
    has_mobile_number: typeof data.mobile_number === 'string' && data.mobile_number.length > 0,
  };
}

export async function completeOnboarding(options?: RequestOptions): Promise<void> {
  await apiClient.post('/users/me/onboarding/complete', undefined, {
    correlationId: options?.correlationId,
  });
}
