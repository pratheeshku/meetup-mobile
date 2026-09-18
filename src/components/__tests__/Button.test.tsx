/**
 * Behavioural contract of the design-system `Button` / `TextLink`:
 * a loading or disabled control must be non-pressable and announce its
 * state, and a loading `Button` swaps its label for a spinner without
 * removing the label from layout (so width doesn't jump).
 *
 * Elements are located by props / host type rather than `findByType(
 * Pressable)`: React Native's exported `Pressable` is not the same
 * reference as the fiber type in the rendered tree, and composite + host
 * nodes both appear, so type lookups either miss or double-count.
 */
import React from 'react';
import { ActivityIndicator, StyleSheet } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';

import Button from '../Button';
import TextLink from '../TextLink';

type Instance = ReactTestRenderer.ReactTestInstance;

function render(element: React.ReactElement): Instance {
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  ReactTestRenderer.act(() => {
    renderer = ReactTestRenderer.create(element);
  });
  return renderer.root;
}

/** The single Pressable: the only node with both a button role and an onPress. */
function findPressable(root: Instance): Instance {
  return root.find(
    node => node.props.accessibilityRole === 'button' && typeof node.props.onPress === 'function',
  );
}

/** Host `Text` nodes (one per rendered label). */
function findTexts(root: Instance): Instance[] {
  return root.findAll(node => node.type === 'Text');
}

function hasSpinner(root: Instance): boolean {
  return root.findAll(node => node.type === ActivityIndicator).length > 0;
}

describe('Button', () => {
  it('is pressable and announces itself as an enabled button by default', () => {
    const onPress = jest.fn();
    const root = render(<Button label="Join" onPress={onPress} />);

    const pressable = findPressable(root);
    expect(pressable.props.disabled).toBe(false);
    expect(pressable.props.accessibilityLabel).toBe('Join');
    expect(pressable.props.accessibilityState).toEqual({ disabled: false, busy: false });
    expect(hasSpinner(root)).toBe(false);

    pressable.props.onPress();
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('is not pressable and reports busy while loading, showing a spinner', () => {
    const root = render(<Button label="Save" onPress={jest.fn()} loading />);

    const pressable = findPressable(root);
    expect(pressable.props.disabled).toBe(true);
    expect(pressable.props.accessibilityState).toEqual({ disabled: true, busy: true });
    expect(hasSpinner(root)).toBe(true);
  });

  it('keeps the label in layout (hidden) while loading so the width does not jump', () => {
    const root = render(<Button label="Save" onPress={jest.fn()} loading />);

    const [label] = findTexts(root);
    expect(label.props.children).toBe('Save');
    expect(StyleSheet.flatten(label.props.style).opacity).toBe(0);
  });

  it('shows the label at full opacity when not loading', () => {
    const root = render(<Button label="Save" onPress={jest.fn()} />);

    const [label] = findTexts(root);
    expect(StyleSheet.flatten(label.props.style).opacity).toBeUndefined();
  });

  it('is not pressable when disabled, without showing a spinner', () => {
    const root = render(<Button label="Cancel" onPress={jest.fn()} disabled />);

    const pressable = findPressable(root);
    expect(pressable.props.disabled).toBe(true);
    expect(pressable.props.accessibilityState).toEqual({ disabled: true, busy: false });
    expect(hasSpinner(root)).toBe(false);
  });
});

describe('TextLink', () => {
  it('is pressable by default and renders its label', () => {
    const root = render(<TextLink label="Edit" onPress={jest.fn()} />);

    expect(findPressable(root).props.disabled).toBe(false);
    expect(findTexts(root).map(node => node.props.children)).toEqual(['Edit']);
  });

  it('replaces the label with a spinner and is not pressable while loading', () => {
    const root = render(<TextLink label="Remove" onPress={jest.fn()} loading />);

    const pressable = findPressable(root);
    expect(pressable.props.disabled).toBe(true);
    expect(pressable.props.accessibilityState).toEqual({ disabled: true, busy: true });
    expect(hasSpinner(root)).toBe(true);
    expect(findTexts(root)).toHaveLength(0);
  });
});
