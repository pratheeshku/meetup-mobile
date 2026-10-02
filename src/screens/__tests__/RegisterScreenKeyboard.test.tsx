/**
 * Register screen keyboard behaviour: return-key chain through the four fields,
 * and focus (hence scroll-into-view) on the first invalid field at submit.
 */
import React from 'react';
import { Platform, TextInput } from 'react-native';

import { act, pressableWithText, renderAsync } from '../../test-utils/render';
import type { Instance } from '../../test-utils/render';
import RegisterScreen from '../RegisterScreen';

jest.mock('../../api/client', () => ({ apiClient: { post: jest.fn() } }));

const focusMock = TextInput.prototype.focus as unknown as jest.Mock;
const mount = (): Promise<Instance> =>
  renderAsync(
    <RegisterScreen
      {...({
        navigation: { navigate: jest.fn(), goBack: jest.fn(), canGoBack: jest.fn(() => true) },
        route: {},
      } as unknown as React.ComponentProps<typeof RegisterScreen>)}
    />,
  );
const field = (root: Instance, placeholder: string): Instance =>
  root.findAll(n => (n.type as unknown) === 'TextInput' && n.props.placeholder === placeholder)[0];
const focused = (): string[] =>
  focusMock.mock.contexts.map((ctx: { props: { placeholder: string } }) => ctx.props.placeholder);

beforeEach(() => focusMock.mockClear());
afterEach(() => jest.restoreAllMocks());

describe.each(['android', 'ios'] as const)('on %s', os => {
  beforeEach(() => {
    jest.replaceProperty(Platform, 'OS', os);
  });

  it('chains Nickname → Display Name → Email → Password and finishes with "done"', async () => {
    const root = await mount();
    expect(field(root, 'Nickname').props.returnKeyType).toBe('next');
    expect(field(root, 'Password').props.returnKeyType).toBe('done');
    act(() => field(root, 'Nickname').props.onSubmitEditing());
    act(() => field(root, 'Display Name').props.onSubmitEditing());
    act(() => field(root, 'Email').props.onSubmitEditing());
    expect(focused()).toEqual(['Display Name', 'Email', 'Password']);
  });

  it('focuses the first empty field when submitting with fields missing', async () => {
    const root = await mount();
    act(() => field(root, 'Nickname').props.onChangeText('sam'));
    await act(async () => pressableWithText(root, 'Register').props.onPress());
    expect(focused()).toEqual(['Display Name']);
  });

  it('focuses the password field when it is too short', async () => {
    const root = await mount();
    act(() => {
      field(root, 'Nickname').props.onChangeText('sam');
      field(root, 'Display Name').props.onChangeText('Sam');
      field(root, 'Email').props.onChangeText('sam@example.com');
      field(root, 'Password').props.onChangeText('short');
    });
    await act(async () => pressableWithText(root, 'Register').props.onPress());
    expect(focused()).toEqual(['Password']);
  });
});
