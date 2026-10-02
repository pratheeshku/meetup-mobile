/**
 * The interstitial shows ONLY when GET /users/me says onboarding_required is
 * true, and never on error, timeout or while the answer is pending. EXECUTES
 * the real overlay and hook; the screen itself is stubbed to a marker.
 */
import React from 'react';

import { getOnboardingState } from '../../api/onboarding';
import { act, renderAsync } from '../../test-utils/render';
import { ONBOARDING_CHECK_TIMEOUT_MS } from '../../hooks/useOnboardingRequired';
import OnboardingOverlay from '../OnboardingOverlay';

jest.mock('../../api/onboarding', () => ({ getOnboardingState: jest.fn() }));
jest.mock('../../screens/OnboardingScreen', () => {
  const ReactActual = jest.requireActual('react');
  const { Text } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: ({ hasMobileNumber, onDone }: { hasMobileNumber: boolean; onDone: () => void }) =>
      ReactActual.createElement(
        Text,
        { testID: 'onboarding-stub', onPress: onDone, hasMobileNumber },
        'onboarding',
      ),
  };
});
const mockState = getOnboardingState as jest.Mock;

const shown = (root: { findAll: (predicate: (node: { props: { testID?: string } }) => boolean) => unknown[] }) =>
  root.findAll(node => node.props.testID === 'onboarding-stub').length > 0;

afterEach(() => {
  jest.useRealTimers();
  mockState.mockReset();
});

describe('OnboardingOverlay', () => {
  it('shows when onboarding_required is true', async () => {
    mockState.mockResolvedValue({ onboarding_required: true, has_mobile_number: false });
    expect(shown(await renderAsync(<OnboardingOverlay userId="u1" />))).toBe(true);
  });

  it('passes whether a number is already stored', async () => {
    mockState.mockResolvedValue({ onboarding_required: true, has_mobile_number: true });
    const root = await renderAsync(<OnboardingOverlay userId="u1" />);
    expect(root.findByProps({ testID: 'onboarding-stub' }).props.hasMobileNumber).toBe(true);
  });

  it('does not show when onboarding_required is false (existing users)', async () => {
    mockState.mockResolvedValue({ onboarding_required: false, has_mobile_number: false });
    expect(shown(await renderAsync(<OnboardingOverlay userId="u1" />))).toBe(false);
  });

  it('never shows when GET /users/me errors', async () => {
    mockState.mockRejectedValue(new Error('500'));
    expect(shown(await renderAsync(<OnboardingOverlay userId="u1" />))).toBe(false);
  });

  it('never shows while the answer is pending, nor after a timeout', async () => {
    jest.useFakeTimers();
    let resolveLate!: (value: unknown) => void;
    mockState.mockReturnValue(new Promise(resolve => (resolveLate = resolve)));
    const root = await renderAsync(<OnboardingOverlay userId="u1" />);
    expect(shown(root)).toBe(false);
    await act(async () => {
      jest.advanceTimersByTime(ONBOARDING_CHECK_TIMEOUT_MS + 1);
    });
    expect(shown(root)).toBe(false);
    await act(async () => resolveLate({ onboarding_required: true, has_mobile_number: false }));
    expect(shown(root)).toBe(false);
  });

  it('goes away when finished and does not come back in the same session', async () => {
    mockState.mockResolvedValue({ onboarding_required: true, has_mobile_number: false });
    const root = await renderAsync(<OnboardingOverlay userId="u1" />);
    await act(async () => root.findByProps({ testID: 'onboarding-stub' }).props.onPress());
    expect(shown(root)).toBe(false);
  });
});
