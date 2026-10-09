import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import NotificationCard from '../NotificationCard';
import type { NotificationHistoryItem } from '../../types/notification';
import { act, pressables, render, texts } from '../../test-utils/render';

function makeItem(overrides: Partial<NotificationHistoryItem> = {}): NotificationHistoryItem {
  return {
    id: 'n1',
    notification_type: 'event_reminder',
    title: 'Reminder title',
    body: 'Game is starting soon',
    entity_id: 'e1',
    entity_type: 'event',
    created_at: '2026-10-09T10:00:00Z',
    read_at: null,
    ...overrides,
  };
}

describe('NotificationCard', () => {
  it('renders unread styling (bg #EAF1FF, border #C6D9FF, title weight 800, blue dot)', () => {
    const item = makeItem({ read_at: null });
    const rendered = render(
      <NotificationCard
        item={item}
        onPress={jest.fn()}
        onToggleRead={jest.fn()}
      />,
    );

    expect(texts(rendered)).toContain('Reminder title');
    expect(texts(rendered)).toContain('Game is starting soon');

    // Title weight 800
    const titleNode = rendered.find(
      n => (n.type as unknown) === 'Text' && texts(n).includes('Reminder title'),
    );
    expect(StyleSheet.flatten(titleNode.props.style).fontWeight).toBe('800');

    // Foreground styling
    const views = rendered.findAllByType(View);
    const unreadCard = views.find(v => {
      const s = StyleSheet.flatten(v.props.style);
      return s && s.backgroundColor === '#EAF1FF';
    });
    expect(unreadCard).toBeDefined();

    // Blue dot present
    const dot = views.find(v => {
      const s = StyleSheet.flatten(v.props.style);
      return s && s.backgroundColor === '#1961F7' && s.width === 10 && s.height === 10;
    });
    expect(dot).toBeDefined();
  });

  it('renders read styling (bg #FFFFFF, border #E3EAF7, title weight 600, no blue dot)', () => {
    const item = makeItem({ read_at: '2026-10-09T11:00:00Z' });
    const rendered = render(
      <NotificationCard
        item={item}
        onPress={jest.fn()}
        onToggleRead={jest.fn()}
      />,
    );

    // Title weight 600
    const titleNode = rendered.find(
      n => (n.type as unknown) === 'Text' && texts(n).includes('Reminder title'),
    );
    expect(StyleSheet.flatten(titleNode.props.style).fontWeight).toBe('600');

    // Foreground styling
    const views = rendered.findAllByType(View);
    const readCard = views.find(v => {
      const s = StyleSheet.flatten(v.props.style);
      return s && s.backgroundColor === '#FFFFFF' && s.borderColor === '#E3EAF7';
    });
    expect(readCard).toBeDefined();

    // No blue dot
    const dot = views.find(v => {
      const s = StyleSheet.flatten(v.props.style);
      return s && s.backgroundColor === '#1961F7' && s.width === 10 && s.height === 10;
    });
    expect(dot).toBeUndefined();
  });

  it('triggers onPress when tapping the card content', () => {
    const onPress = jest.fn();
    const item = makeItem();
    const rendered = render(
      <NotificationCard
        item={item}
        onPress={onPress}
        onToggleRead={jest.fn()}
      />,
    );

    const cardPressable = pressables(rendered).find(
      p => p.props.accessibilityActions !== undefined,
    );
    expect(cardPressable).toBeDefined();

    act(() => {
      cardPressable?.props.onPress();
    });
    expect(onPress).toHaveBeenCalledWith(item);
  });

  it('triggers onToggleRead when long-pressing the card', () => {
    const onToggleRead = jest.fn();
    const item = makeItem();
    const rendered = render(
      <NotificationCard
        item={item}
        onPress={jest.fn()}
        onToggleRead={onToggleRead}
      />,
    );

    const cardPressable = pressables(rendered).find(
      p => p.props.accessibilityActions !== undefined,
    );

    act(() => {
      cardPressable?.props.onLongPress();
    });
    expect(onToggleRead).toHaveBeenCalledWith(item);
  });

  it('supports custom accessibility action toggle_read', () => {
    const onToggleRead = jest.fn();
    const item = makeItem();
    const rendered = render(
      <NotificationCard
        item={item}
        onPress={jest.fn()}
        onToggleRead={onToggleRead}
      />,
    );

    const cardPressable = pressables(rendered).find(
      p => p.props.accessibilityActions !== undefined,
    );

    act(() => {
      cardPressable?.props.onAccessibilityAction({
        nativeEvent: { actionName: 'toggle_read' },
      });
    });
    expect(onToggleRead).toHaveBeenCalledWith(item);
  });

  it('triggers onToggleRead when tapping the revealed swipe action button', () => {
    const onToggleRead = jest.fn();
    const item = makeItem();
    const rendered = render(
      <NotificationCard
        item={item}
        onPress={jest.fn()}
        onToggleRead={onToggleRead}
      />,
    );

    const actionButton = pressables(rendered).find(
      p => p.props.accessibilityActions === undefined,
    );
    expect(actionButton).toBeDefined();

    act(() => {
      actionButton?.props.onPress();
    });
    expect(onToggleRead).toHaveBeenCalledWith(item);
  });
});
