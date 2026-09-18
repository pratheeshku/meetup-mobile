/**
 * Create Game center action button: an action, not a destination. Pressing it
 * must open Home -> CreateGame and never select the `Create` tab; the button
 * itself carries no selected/active state.
 */
import React from 'react';
import { StyleSheet } from 'react-native';
import type { BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';

import { colors, radius, spacing } from '../../theme/tokens';
import { act, pressableLabelled, render, texts } from '../../test-utils/render';
import { CreateTabButton, CreateTabScreen, createTabListeners } from '../CreateTabButton';

const FAB_SIZE = spacing.xxl + spacing.sm;

function renderButton(onPress = jest.fn()) {
  const props = { onPress, style: { flex: 1 }, children: null } as unknown as BottomTabBarButtonProps;
  return { root: render(<CreateTabButton {...props} />), onPress };
}

describe('CreateTabButton', () => {
  it('is a labelled button showing a white "+"', () => {
    const { root } = renderButton();
    expect(pressableLabelled(root, 'Create Game')).toBeDefined();
    expect(texts(root)).toContain('+');
    const plus = root.find(node => (node.type as unknown) === 'Text');
    expect(StyleSheet.flatten(plus.props.style).color).toBe(colors.white);
  });

  it('is a 56dp primary circle raised above the bar', () => {
    const { root } = renderButton();
    const pressable = pressableLabelled(root, 'Create Game');
    const style = StyleSheet.flatten(
      (pressable.props.style as (s: { pressed: boolean }) => unknown)({ pressed: false }),
    ) as Record<string, unknown>;
    expect(style).toMatchObject({
      width: FAB_SIZE,
      height: FAB_SIZE,
      borderRadius: radius.full,
      backgroundColor: colors.primary,
    });
    expect(FAB_SIZE).toBe(56);
    expect(style.marginTop as number).toBeLessThan(0);
  });

  it('has no selected/active state (it is not a tab destination)', () => {
    const pressable = pressableLabelled(renderButton().root, 'Create Game');
    expect(pressable.props.accessibilityState?.selected).toBeUndefined();
    expect(pressable.props['aria-selected']).toBeUndefined();
  });

  it('forwards the press to the tab bar (which emits tabPress for the listener)', () => {
    const { root, onPress } = renderButton();
    act(() => pressableLabelled(root, 'Create Game').props.onPress());
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});

describe('createTabListeners', () => {
  it('cancels the tab switch and opens Home -> CreateGame', () => {
    const navigate = jest.fn();
    const preventDefault = jest.fn();
    const { tabPress } = createTabListeners({ navigation: { navigate } as never });
    tabPress({ preventDefault });
    expect(preventDefault).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith('Home', { screen: 'CreateGame' });
  });
});

describe('CreateTabScreen', () => {
  it('renders nothing', () => {
    expect(CreateTabScreen()).toBeNull();
  });
});
