/** Test-only helpers for the skill-level components (roles, labels, host views, styles). */
import { StyleSheet } from 'react-native';

import { act } from './render';
import type { Instance } from './render';

/** Controls found by role (+ label): the composite Pressable carries both role and onPress. */
export function controls(root: Instance, role: string): Instance[] {
  return root.findAll(
    node => node.props.accessibilityRole === role && typeof node.props.onPress === 'function',
  );
}

export function control(root: Instance, role: string, label: string): Instance {
  const matches = controls(root, role).filter(node => node.props.accessibilityLabel === label);
  if (matches.length !== 1) {
    throw new Error(`Expected one ${role} labelled "${label}", found ${matches.length}`);
  }
  return matches[0];
}

export function tap(root: Instance, role: string, label: string): void {
  act(() => control(root, role, label).props.onPress());
}

/** Host `View`s with this testID (the composite wrapper repeats the prop, so match on host type). */
export function hostViews(root: Instance, testID: string): Instance[] {
  return root.findAll(node => (node.type as unknown) === 'View' && node.props.testID === testID);
}

/** Pressable `style` may be a function of the pressed state. */
export function styleOf(node: Instance): Record<string, unknown> {
  const style = typeof node.props.style === 'function' ? node.props.style({ pressed: false }) : node.props.style;
  return (StyleSheet.flatten(style) ?? {}) as Record<string, unknown>;
}
