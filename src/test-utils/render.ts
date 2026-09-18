/**
 * Test-only react-test-renderer helpers. Elements are located by props /
 * host type, not by component reference: React Native's exported `Pressable`
 * is not the same reference as the fiber type, and composite + host nodes
 * both appear in the tree (see `Button.test.tsx` for the original finding).
 * Not imported by any production module.
 */
import type React from 'react';
import ReactTestRenderer from 'react-test-renderer';

export type Instance = ReactTestRenderer.ReactTestInstance;

export function render(element: React.ReactElement): Instance {
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  ReactTestRenderer.act(() => {
    renderer = ReactTestRenderer.create(element);
  });
  return renderer.root;
}

/** Renders and lets pending effects/promises (e.g. on-mount fetches) settle. */
export async function renderAsync(element: React.ReactElement): Promise<Instance> {
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(element);
  });
  return renderer.root;
}

export const act = ReactTestRenderer.act;

/** Concatenated string content of every host `Text`, one entry per node. */
export function texts(root: Instance): string[] {
  return root
    .findAll(node => (node.type as unknown) === 'Text')
    .map(node =>
      ([] as unknown[])
        .concat(node.props.children)
        .filter(child => typeof child === 'string' || typeof child === 'number')
        .join(''),
    );
}

/** Every pressable: the nodes that carry both a button role and an onPress. */
export function pressables(root: Instance): Instance[] {
  return root.findAll(
    node => node.props.accessibilityRole === 'button' && typeof node.props.onPress === 'function',
  );
}

/** The single pressable whose subtree renders exactly `text`. */
export function pressableWithText(root: Instance, text: string): Instance {
  const matches = pressables(root).filter(pressable => texts(pressable).includes(text));
  if (matches.length !== 1) {
    throw new Error(`Expected exactly one pressable with text "${text}", found ${matches.length}`);
  }
  return matches[0];
}

/** The single pressable with this accessibility label. */
export function pressableLabelled(root: Instance, label: string): Instance {
  const matches = pressables(root).filter(node => node.props.accessibilityLabel === label);
  if (matches.length !== 1) {
    throw new Error(`Expected exactly one pressable labelled "${label}", found ${matches.length}`);
  }
  return matches[0];
}
