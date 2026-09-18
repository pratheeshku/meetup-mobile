/**
 * Accessibility guard for `Badge`: every variant's text/background pairing
 * must meet WCAG AA (4.5:1) for normal-size text. This locks in the
 * measured contrast decisions documented in `src/theme/tokens.ts` — in
 * particular that `warning` must NOT use `colors.warning` text on
 * `colors.warningLight` (2.47:1) — so a future token or variant edit can't
 * silently regress legibility.
 */
import React from 'react';
import { StyleSheet } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';

import Badge from '../Badge';
import type { BadgeVariant } from '../Badge';
import { colors } from '../../theme/tokens';

function relativeLuminance(hex: string): number {
  const channel = (start: number): number => {
    const value = parseInt(hex.slice(start, start + 2), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** First host node of the given type (e.g. 'View', 'Text') in render order. */
function findHost(
  renderer: ReactTestRenderer.ReactTestRenderer,
  hostType: 'View' | 'Text',
): ReactTestRenderer.ReactTestInstance {
  return renderer.root.findAll(node => node.type === hostType)[0];
}

const VARIANTS: BadgeVariant[] = ['primary', 'success', 'warning', 'error', 'neutral'];

describe('Badge', () => {
  it.each(VARIANTS)('%s variant meets WCAG AA contrast (>= 4.5:1)', variant => {
    let renderer!: ReactTestRenderer.ReactTestRenderer;
    ReactTestRenderer.act(() => {
      renderer = ReactTestRenderer.create(<Badge label="Label" variant={variant} />);
    });

    const background = StyleSheet.flatten(findHost(renderer, 'View').props.style)
      .backgroundColor as string;
    const text = StyleSheet.flatten(findHost(renderer, 'Text').props.style).color as string;

    expect(contrastRatio(text, background)).toBeGreaterThanOrEqual(4.5);
  });

  it('warning variant does not use the failing warning-on-warningLight pairing', () => {
    // Negative control for the guard above: prove the pairing it exists to
    // prevent really does fail, so the test can't pass vacuously.
    expect(contrastRatio(colors.warning, colors.warningLight)).toBeLessThan(4.5);

    let renderer!: ReactTestRenderer.ReactTestRenderer;
    ReactTestRenderer.act(() => {
      renderer = ReactTestRenderer.create(<Badge label="Waitlisted" variant="warning" />);
    });
    const text = StyleSheet.flatten(findHost(renderer, 'Text').props.style).color as string;

    expect(text).not.toBe(colors.warning);
  });

  it('renders its label', () => {
    let renderer!: ReactTestRenderer.ReactTestRenderer;
    ReactTestRenderer.act(() => {
      renderer = ReactTestRenderer.create(<Badge label="Going" variant="success" />);
    });

    expect(findHost(renderer, 'Text').props.children).toBe('Going');
  });
});
