/**
 * Render test for the token-converted `NotificationBanner`. The banner only
 * mounts content when the banner store holds a payload, so this drives the
 * store directly. Asserts the banner uses palette tokens (not the old
 * off-palette grey) and that its text stays legible on the dark surface.
 */
import React from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import ReactTestRenderer from 'react-test-renderer';

import NotificationBanner from '../NotificationBanner';
import { dismissBanner, showBanner } from '../../notifications/notificationBannerStore';
import { colors } from '../../theme/tokens';

const METRICS = {
  frame: { x: 0, y: 0, width: 360, height: 640 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

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

/** Host nodes only (string `type`), so composite wrappers aren't double-counted. */
function hostNodes(
  renderer: ReactTestRenderer.ReactTestRenderer,
  hostType: string,
): ReactTestRenderer.ReactTestInstance[] {
  return renderer.root.findAll(node => (node.type as unknown) === hostType);
}

describe('NotificationBanner', () => {
  let renderer: ReactTestRenderer.ReactTestRenderer | undefined;

  afterEach(() => {
    ReactTestRenderer.act(() => {
      renderer?.unmount();
      dismissBanner();
    });
    renderer = undefined;
  });

  function renderWithBanner(): ReactTestRenderer.ReactTestRenderer {
    ReactTestRenderer.act(() => {
      showBanner({
        notification_type: 'event_invite',
        entity_id: 'evt-1',
        title: 'New invite',
        body: 'You have been invited to an event',
      });
    });
    ReactTestRenderer.act(() => {
      renderer = ReactTestRenderer.create(
        <SafeAreaProvider initialMetrics={METRICS}>
          <NotificationBanner />
        </SafeAreaProvider>,
      );
    });
    return renderer as ReactTestRenderer.ReactTestRenderer;
  }

  it('renders nothing when there is no banner', () => {
    ReactTestRenderer.act(() => {
      renderer = ReactTestRenderer.create(
        <SafeAreaProvider initialMetrics={METRICS}>
          <NotificationBanner />
        </SafeAreaProvider>,
      );
    });

    expect(hostNodes(renderer as ReactTestRenderer.ReactTestRenderer, 'Text')).toHaveLength(0);
  });

  it('shows the payload title and body', () => {
    const tree = renderWithBanner();
    const texts = hostNodes(tree, 'Text').map(node => node.props.children);

    expect(texts).toContain('New invite');
    expect(texts).toContain('You have been invited to an event');
  });

  it('uses the palette navy surface, not the old off-palette grey', () => {
    const tree = renderWithBanner();
    const backgrounds = hostNodes(tree, 'View')
      .map(node => StyleSheet.flatten(node.props.style)?.backgroundColor)
      .filter(Boolean);

    expect(backgrounds).toContain(colors.textPrimary);
    expect(backgrounds).not.toContain('#1f2937');
  });

  it('keeps title, body and dismiss text legible on the dark surface (>= 4.5:1)', () => {
    const tree = renderWithBanner();
    const textColors = hostNodes(tree, 'Text').map(
      node => StyleSheet.flatten(node.props.style).color as string,
    );

    expect(textColors.length).toBeGreaterThanOrEqual(3);
    textColors.forEach(color => {
      expect(contrastRatio(color, colors.textPrimary)).toBeGreaterThanOrEqual(4.5);
    });
  });
});
