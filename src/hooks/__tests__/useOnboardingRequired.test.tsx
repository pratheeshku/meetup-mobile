/** Fail-open first-run check. EXECUTES the hook (fake timers for the timeout). */
import React from 'react';

import { getOnboardingState } from '../../api/onboarding';
import { act, renderAsync } from '../../test-utils/render';
import { ONBOARDING_CHECK_TIMEOUT_MS, useOnboardingRequired } from '../useOnboardingRequired';
import type { OnboardingCheck } from '../useOnboardingRequired';

jest.mock('../../api/onboarding', () => ({ getOnboardingState: jest.fn() }));
const mockState = getOnboardingState as jest.Mock;

function probe(userId: string | null | undefined) {
  const ref: { current: OnboardingCheck | null | undefined } = { current: undefined };
  function Probe(): React.JSX.Element {
    ref.current = useOnboardingRequired(userId);
    return <></>;
  }
  return { ref, Probe };
}

afterEach(() => {
  jest.useRealTimers();
  mockState.mockReset();
});

describe('useOnboardingRequired', () => {
  it('is required only on a definite onboarding_required: true', async () => {
    mockState.mockResolvedValue({ onboarding_required: true, has_mobile_number: false });
    const { ref, Probe } = probe('u1');
    await renderAsync(<Probe />);
    expect(ref.current).toEqual({ required: true, hasMobileNumber: false });
  });

  it('is not required when the server says false', async () => {
    mockState.mockResolvedValue({ onboarding_required: false, has_mobile_number: true });
    const { ref, Probe } = probe('u1');
    await renderAsync(<Probe />);
    expect(ref.current).toEqual({ required: false, hasMobileNumber: true });
  });

  it('fails open on an error: never required', async () => {
    mockState.mockRejectedValue(new Error('500'));
    const { ref, Probe } = probe('u1');
    await renderAsync(<Probe />);
    expect(ref.current).toEqual({ required: false, hasMobileNumber: false });
  });

  it('fails open on a timeout, and ignores an answer that arrives after it', async () => {
    jest.useFakeTimers();
    let resolveLate!: (value: unknown) => void;
    mockState.mockReturnValue(new Promise(resolve => (resolveLate = resolve)));
    const { ref, Probe } = probe('u1');
    await renderAsync(<Probe />);
    expect(ref.current).toBeNull(); // still checking: nothing is shown yet
    await act(async () => {
      jest.advanceTimersByTime(ONBOARDING_CHECK_TIMEOUT_MS + 1);
    });
    expect(ref.current).toEqual({ required: false, hasMobileNumber: false });
    await act(async () => {
      resolveLate({ onboarding_required: true, has_mobile_number: false });
    });
    expect(ref.current?.required).toBe(false);
  });

  it('does not check without a signed-in user', async () => {
    const { ref, Probe } = probe(null);
    await renderAsync(<Probe />);
    expect(mockState).not.toHaveBeenCalled();
    expect(ref.current).toBeNull();
  });
});
