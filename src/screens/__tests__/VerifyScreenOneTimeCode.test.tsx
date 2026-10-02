/**
 * Verify screen: the 6-digit code field requests iOS one-time-code autofill
 * (`textContentType="oneTimeCode"`). The prop is iOS-only; React Native ignores
 * it on Android, so it is set on both platforms and nothing else about the
 * field changes.
 */
import React from 'react';
import { Platform, TextInput } from 'react-native';

import { renderAsync } from '../../test-utils/render';
import VerifyScreen from '../VerifyScreen';

jest.mock('../../api/client', () => ({ apiClient: { post: jest.fn() } }));

const mount = () =>
  renderAsync(
    <VerifyScreen
      {...({
        navigation: { navigate: jest.fn(), goBack: jest.fn(), canGoBack: jest.fn(() => true) },
        route: { params: { email: 'user@example.com' } },
      } as unknown as React.ComponentProps<typeof VerifyScreen>)}
    />,
  );

afterEach(() => {
  jest.restoreAllMocks();
});

describe.each(['android', 'ios'] as const)('on %s', os => {
  beforeEach(() => {
    jest.replaceProperty(Platform, 'OS', os);
  });

  it('marks the code field for one-time-code autofill and keeps its other settings', async () => {
    const root = await mount();
    const field = root
      .findAllByType(TextInput)
      .find(input => input.props.placeholder === '6-digit code');

    expect(field).toBeDefined();
    expect(field?.props.textContentType).toBe('oneTimeCode');
    expect(field?.props.keyboardType).toBe('number-pad');
    expect(field?.props.maxLength).toBe(6);
  });
});
