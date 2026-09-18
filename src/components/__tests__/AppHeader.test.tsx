import React from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { colors, sizes } from '../../theme/tokens';
import { pressableLabelled, render, texts } from '../../test-utils/render';
import type { Instance } from '../../test-utils/render';
import AppHeader from '../AppHeader';

const METRICS = {
  frame: { x: 0, y: 0, width: 360, height: 640 },
  insets: { top: 24, left: 0, right: 0, bottom: 0 },
};

function renderHeader(props: Partial<React.ComponentProps<typeof AppHeader>> = {}): Instance {
  return render(
    <SafeAreaProvider initialMetrics={METRICS}>
      <AppHeader onNotificationsPress={jest.fn()} {...props} />
    </SafeAreaProvider>,
  );
}

const badges = (root: Instance): Instance[] =>
  root.findAll(node => (node.type as unknown) === 'View' && node.props.testID === 'notification-badge');

describe('AppHeader', () => {
  it('shows the logo and app name', () => {
    const t = texts(renderHeader());
    expect(t).toContain('⚽');
    expect(t).toContain('Meetup');
  });

  it('hides the badge when there is no unread count or it is 0', () => {
    expect(badges(renderHeader())).toHaveLength(0);
    expect(badges(renderHeader({ unreadCount: 0 }))).toHaveLength(0);
    // Defensive: a bad (negative) count must never render a badge.
    expect(badges(renderHeader({ unreadCount: -3 }))).toHaveLength(0);
  });

  it('shows a red badge with the count when unread > 0, and reflects it in the a11y label', () => {
    const root = renderHeader({ unreadCount: 3 });
    const found = badges(root);
    expect(found).toHaveLength(1);
    expect(texts(found[0])).toEqual(['3']);
    expect(StyleSheet.flatten(found[0].props.style).backgroundColor).toBe(colors.error);
    expect(pressableLabelled(root, 'Notifications, 3 unread')).toBeDefined();
  });

  it('caps the badge label at 99+', () => {
    expect(texts(badges(renderHeader({ unreadCount: 99 }))[0])).toEqual(['99']);
    expect(texts(badges(renderHeader({ unreadCount: 100 }))[0])).toEqual(['99+']);
  });

  it('fires onNotificationsPress when the bell is tapped', () => {
    const onNotificationsPress = jest.fn();
    const root = renderHeader({ onNotificationsPress });
    pressableLabelled(root, 'Notifications').props.onPress();
    expect(onNotificationsPress).toHaveBeenCalledTimes(1);
  });

  it('is 56 tall plus the status-bar inset, on the surface colour', () => {
    const root = renderHeader();
    const container = root.findAll(
      node => (node.type as unknown) === 'View' && StyleSheet.flatten(node.props.style)?.borderBottomWidth,
    )[0];
    const style = StyleSheet.flatten(container.props.style);
    expect(style.height).toBe(sizes.appHeader + METRICS.insets.top);
    expect(style.paddingTop).toBe(METRICS.insets.top);
    expect(style.backgroundColor).toBe(colors.surface);
    expect(style.borderBottomColor).toBe(colors.border);
  });
});
