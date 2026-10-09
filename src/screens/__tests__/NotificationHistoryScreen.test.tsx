/**
 * Notification History: list rendering, unread/read styles, paging, empty states,
 * tabs, mark all as read, swipe actions, undo toasts, and routing.
 */
import React from 'react';
import { SectionList, StyleSheet } from 'react-native';

import {
  getNotificationHistory,
  getUnreadCount,
  markAllNotificationsRead,
  markNotificationRead,
  markNotificationUnread,
} from '../../api/notifications';
import { navigateToNotificationTarget } from '../../notifications/notificationRouting';
import type { NotificationHistoryItem } from '../../types/notification';
import {
  act,
  pressables,
  pressableWithText,
  renderAsync,
  texts,
} from '../../test-utils/render';
import type { Instance } from '../../test-utils/render';
import NotificationHistoryScreen from '../NotificationHistoryScreen';

jest.mock('../../api/notifications', () => ({
  getNotificationHistory: jest.fn(),
  getUnreadCount: jest.fn(),
  markNotificationRead: jest.fn(),
  markNotificationUnread: jest.fn(),
  markAllNotificationsRead: jest.fn(),
}));

jest.mock('../../notifications/notificationRouting', () => ({
  ...jest.requireActual('../../notifications/notificationRouting'),
  navigateToNotificationTarget: jest.fn(),
}));

const mockHistory = getNotificationHistory as jest.Mock;
const mockUnreadCount = getUnreadCount as jest.Mock;
const mockMarkRead = markNotificationRead as jest.Mock;
const mockMarkUnread = markNotificationUnread as jest.Mock;
const mockMarkAllRead = markAllNotificationsRead as jest.Mock;
const mockNavigate = navigateToNotificationTarget as jest.Mock;

function makeItem(overrides: Partial<NotificationHistoryItem> = {}): NotificationHistoryItem {
  return {
    id: 'n1',
    notification_type: 'event_changed',
    title: 'Event updated',
    body: 'Sunday football moved to 6pm',
    entity_id: 'evt-1',
    entity_type: 'event',
    created_at: new Date().toISOString(),
    read_at: null,
    ...overrides,
  };
}

function titleWeight(root: Instance, title: string): string | undefined {
  const node = root.find(n => (n.type as unknown) === 'Text' && texts(n).includes(title));
  return StyleSheet.flatten(node.props.style).fontWeight as string | undefined;
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  mockUnreadCount.mockResolvedValue({ count: 1 });
  mockMarkRead.mockResolvedValue(undefined);
  mockMarkUnread.mockResolvedValue(undefined);
  mockMarkAllRead.mockResolvedValue(undefined);
});

afterEach(() => {
  act(() => {
    jest.runOnlyPendingTimers();
  });
  jest.useRealTimers();
});

it('shows a loading state, then the items', async () => {
  let resolve!: (page: unknown) => void;
  mockHistory.mockReturnValue(new Promise(r => (resolve = r)));
  const root = await renderAsync(<NotificationHistoryScreen />);
  expect(root.findAll(n => n.props.accessibilityRole === 'progressbar').length).toBeGreaterThan(0);

  await act(async () => resolve({ items: [makeItem()], next_cursor: null }));
  expect(texts(root)).toContain('Event updated');
});

it('renders unread items with weight 800 and read items with weight 600, with body and time', async () => {
  mockHistory.mockResolvedValue({
    items: [
      makeItem({ id: 'u', title: 'Unread one', read_at: null }),
      makeItem({
        id: 'r',
        title: 'Read one',
        read_at: '2026-09-21T10:00:00Z',
        created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      }),
    ],
  });
  const root = await renderAsync(<NotificationHistoryScreen />);

  expect(titleWeight(root, 'Unread one')).toBe('800');
  expect(titleWeight(root, 'Read one')).toBe('600');
  expect(texts(root)).toContain('Sunday football moved to 6pm');
});

it('truncates the body to 2 lines', async () => {
  mockHistory.mockResolvedValue({ items: [makeItem()] });
  const root = await renderAsync(<NotificationHistoryScreen />);
  const body = root.find(
    n => (n.type as unknown) === 'Text' && texts(n).includes('Sunday football moved to 6pm'),
  );
  expect(body.props.numberOfLines).toBe(2);
});

it('shows the empty state when there are no notifications', async () => {
  mockHistory.mockResolvedValue({ items: [], next_cursor: null });
  mockUnreadCount.mockResolvedValue({ count: 0 });
  const root = await renderAsync(<NotificationHistoryScreen />);
  expect(texts(root)).toContain('No notifications yet');
  expect(texts(root)).toContain('Notifications are kept for 90 days');
});

it('shows an error with retry, and retry reloads', async () => {
  mockHistory.mockRejectedValueOnce(new Error('boom'));
  const root = await renderAsync(<NotificationHistoryScreen />);
  expect(texts(root)).toContain('Could not load your notifications. Please try again.');

  mockHistory.mockResolvedValueOnce({ items: [makeItem()] });
  await act(async () => pressableWithText(root, 'Retry').props.onPress());
  expect(texts(root)).toContain('Event updated');
});

describe('tapping an unread item', () => {
  it('calls markNotificationRead, updates the row to read optimistically, and routes', async () => {
    mockHistory.mockResolvedValue({ items: [makeItem()] });
    const root = await renderAsync(<NotificationHistoryScreen />);
    expect(titleWeight(root, 'Event updated')).toBe('800');

    await act(async () => pressableWithText(root, 'Event updated').props.onPress());

    expect(mockMarkRead).toHaveBeenCalledTimes(1);
    expect(mockMarkRead).toHaveBeenCalledWith('n1');
    expect(titleWeight(root, 'Event updated')).toBe('600');
    expect(mockNavigate).toHaveBeenCalledWith({
      tab: 'Home',
      screen: 'EventDetail',
      params: { eventId: 'evt-1' },
    });
  });

  it('reverts the row to unread if marking read fails, but still routes', async () => {
    mockHistory.mockResolvedValue({ items: [makeItem()] });
    mockMarkRead.mockRejectedValue(new Error('500'));
    const root = await renderAsync(<NotificationHistoryScreen />);

    await act(async () => pressableWithText(root, 'Event updated').props.onPress());

    expect(titleWeight(root, 'Event updated')).toBe('800');
    expect(mockNavigate).toHaveBeenCalledTimes(1);
  });

  it('recognizes event_reminder as a known type, marks read, and routes to EventDetail', async () => {
    mockHistory.mockResolvedValue({
      items: [
        makeItem({
          id: 'rem-1',
          notification_type: 'event_reminder',
          title: 'Event starting soon',
          entity_id: 'evt-99',
        }),
      ],
    });
    const root = await renderAsync(<NotificationHistoryScreen />);

    await act(async () => pressableWithText(root, 'Event starting soon').props.onPress());

    expect(mockMarkRead).toHaveBeenCalledWith('rem-1');
    expect(mockNavigate).toHaveBeenCalledWith({
      tab: 'Home',
      screen: 'EventDetail',
      params: { eventId: 'evt-99' },
    });
  });
});

it('does not call markNotificationRead for an already-read item, but still routes', async () => {
  mockHistory.mockResolvedValue({ items: [makeItem({ read_at: '2026-09-21T10:00:00Z' })] });
  const root = await renderAsync(<NotificationHistoryScreen />);

  await act(async () => pressableWithText(root, 'Event updated').props.onPress());

  expect(mockMarkRead).not.toHaveBeenCalled();
  expect(mockNavigate).toHaveBeenCalledTimes(1);
});

describe('routing guards (negative)', () => {
  it('marks read but does not navigate for a type this build does not know', async () => {
    mockHistory.mockResolvedValue({ items: [makeItem({ notification_type: 'brand_new_type' })] });
    const root = await renderAsync(<NotificationHistoryScreen />);

    await act(async () => pressableWithText(root, 'Event updated').props.onPress());

    expect(mockMarkRead).toHaveBeenCalledWith('n1');
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('does not navigate to a detail screen when entity_id is missing', async () => {
    mockHistory.mockResolvedValue({ items: [makeItem({ entity_id: null })] });
    const root = await renderAsync(<NotificationHistoryScreen />);

    await act(async () => pressableWithText(root, 'Event updated').props.onPress());

    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('routes a global notification without an entity_id', async () => {
    mockHistory.mockResolvedValue({
      items: [makeItem({ notification_type: 'global', entity_id: null })],
    });
    const root = await renderAsync(<NotificationHistoryScreen />);

    await act(async () => pressableWithText(root, 'Event updated').props.onPress());

    expect(mockNavigate).toHaveBeenCalledWith({ tab: 'Home', screen: 'EventsList' });
  });

  it('renders a row with null title/body using fallback title without crashing', async () => {
    mockHistory.mockResolvedValue({ items: [makeItem({ title: null, body: null })] });
    const root = await renderAsync(<NotificationHistoryScreen />);
    expect(texts(root)).toContain('Notification');
  });

  it('displays payload.display.title and payload.display.body directly as returned by API', async () => {
    mockHistory.mockResolvedValue({
      items: [
        makeItem({
          title: 'Direct Title',
          body: 'Direct Body',
          payload: {
            display: {
              title: 'API Display Title',
              body: 'API Display Body',
            },
          },
        }),
      ],
    });
    const root = await renderAsync(<NotificationHistoryScreen />);
    expect(texts(root)).toContain('API Display Title');
    expect(texts(root)).toContain('API Display Body');
  });
});

describe('pagination', () => {
  it('loads the next page with next_cursor when scrolled to the end, de-duplicating', async () => {
    mockHistory.mockResolvedValueOnce({
      items: [makeItem({ id: 'a', title: 'First' })],
      next_cursor: '2026-09-20T00:00:00Z',
    });
    const root = await renderAsync(<NotificationHistoryScreen />);

    mockHistory.mockResolvedValueOnce({
      items: [makeItem({ id: 'a', title: 'First' }), makeItem({ id: 'b', title: 'Second' })],
      next_cursor: null,
    });
    await act(async () => root.findByType(SectionList).props.onEndReached());

    expect(mockHistory).toHaveBeenLastCalledWith('2026-09-20T00:00:00Z');
    expect(texts(root).filter(t => t === 'First')).toHaveLength(1);
    expect(texts(root)).toContain('Second');
  });

  it('does not request another page when there is no next_cursor', async () => {
    mockHistory.mockResolvedValue({ items: [makeItem()], next_cursor: null });
    const root = await renderAsync(<NotificationHistoryScreen />);

    await act(async () => root.findByType(SectionList).props.onEndReached());

    expect(mockHistory).toHaveBeenCalledTimes(1);
  });

  it('keeps the loaded items and offers a retry when a later page fails', async () => {
    mockHistory.mockResolvedValueOnce({ items: [makeItem()], next_cursor: 'c1' });
    const root = await renderAsync(<NotificationHistoryScreen />);

    mockHistory.mockRejectedValueOnce(new Error('offline'));
    await act(async () => root.findByType(SectionList).props.onEndReached());

    expect(texts(root)).toContain('Event updated');
    expect(texts(root)).toContain('Could not load more. Tap to retry.');
  });
});

function tabWithText(root: Instance, text: string): Instance {
  const tabs = root.findAll(
    n =>
      n.props.accessibilityRole === 'tab' &&
      typeof n.props.onPress === 'function' &&
      texts(n).includes(text),
  );
  if (tabs.length !== 1) {
    throw new Error(`Expected 1 tab with text ${text}, found ${tabs.length}`);
  }
  return tabs[0];
}

describe('Tabs & Filtering', () => {
  it('switches between All, Unread, and Read tabs', async () => {
    mockHistory.mockResolvedValue({
      items: [
        makeItem({ id: 'u1', title: 'Unread Item', read_at: null }),
        makeItem({ id: 'r1', title: 'Read Item', read_at: '2026-10-09T08:00:00Z' }),
      ],
      next_cursor: null,
    });
    mockUnreadCount.mockResolvedValue({ count: 1 });
    const root = await renderAsync(<NotificationHistoryScreen />);

    // All tab shows both
    expect(texts(root)).toContain('Unread Item');
    expect(texts(root)).toContain('Read Item');

    // Tap Unread tab
    await act(async () => tabWithText(root, 'Unread').props.onPress());
    expect(texts(root)).toContain('Unread Item');
    expect(texts(root)).not.toContain('Read Item');

    // Tap Read tab
    await act(async () => tabWithText(root, 'Read').props.onPress());
    expect(texts(root)).not.toContain('Unread Item');
    expect(texts(root)).toContain('Read Item');
  });

  it('shows empty caught-up state with View all notifications button on empty Unread tab', async () => {
    mockHistory.mockResolvedValue({
      items: [makeItem({ id: 'r1', title: 'Only Read Item', read_at: '2026-10-09T08:00:00Z' })],
      next_cursor: null,
    });
    mockUnreadCount.mockResolvedValue({ count: 0 });
    const root = await renderAsync(<NotificationHistoryScreen />);

    // Switch to Unread
    await act(async () => tabWithText(root, 'Unread').props.onPress());

    expect(texts(root)).toContain("You're all caught up");
    expect(texts(root)).toContain('View all notifications');

    // Tapping 'View all notifications' switches back to All tab
    await act(async () => pressableWithText(root, 'View all notifications').props.onPress());
    expect(texts(root)).toContain('Only Read Item');
  });
});

describe('Mark all as read', () => {
  it('is disabled when unread count is 0', async () => {
    mockHistory.mockResolvedValue({
      items: [makeItem({ id: 'r1', read_at: '2026-10-09T08:00:00Z' })],
      next_cursor: null,
    });
    mockUnreadCount.mockResolvedValue({ count: 0 });
    const root = await renderAsync(<NotificationHistoryScreen />);

    const markAllBtn = pressables(root).find(p => texts(p).includes('Mark all as read'));
    expect(markAllBtn?.props.accessibilityState?.disabled).toBe(true);

    await act(async () => markAllBtn?.props.onPress());
    expect(mockMarkAllRead).not.toHaveBeenCalled();
  });

  it('calls bulk endpoint, turns all cards read, and shows undo toast', async () => {
    mockHistory.mockResolvedValue({
      items: [
        makeItem({ id: 'u1', title: 'Item 1', read_at: null }),
        makeItem({ id: 'u2', title: 'Item 2', read_at: null }),
      ],
      next_cursor: null,
    });
    mockUnreadCount.mockResolvedValue({ count: 2 });
    const root = await renderAsync(<NotificationHistoryScreen />);

    const markAllBtn = pressables(root).find(p => texts(p).includes('Mark all as read'));
    expect(markAllBtn?.props.accessibilityState?.disabled).toBe(false);

    await act(async () => markAllBtn?.props.onPress());

    expect(mockMarkAllRead).toHaveBeenCalledTimes(1);
    expect(titleWeight(root, 'Item 1')).toBe('600');
    expect(titleWeight(root, 'Item 2')).toBe('600');
    expect(texts(root)).toContain('Marked all as read');
    expect(texts(root)).toContain('Undo');
  });
});

describe('Swipe actions and Undo toast', () => {
  it('marking unread item as read via toggle action shows toast and can be undone', async () => {
    mockHistory.mockResolvedValue({
      items: [makeItem({ id: 'u1', title: 'Item to toggle', read_at: null })],
      next_cursor: null,
    });
    const root = await renderAsync(<NotificationHistoryScreen />);

    // Card pressable with toggle_read action
    const cardPressable = pressables(root).find(p => p.props.accessibilityActions !== undefined);
    expect(cardPressable).toBeDefined();

    // Trigger toggle_read action
    await act(async () => {
      cardPressable?.props.onAccessibilityAction({
        nativeEvent: { actionName: 'toggle_read' },
      });
    });

    expect(mockMarkRead).toHaveBeenCalledWith('u1');
    expect(titleWeight(root, 'Item to toggle')).toBe('600');
    expect(texts(root)).toContain('Marked as read');
    expect(texts(root)).toContain('Undo');

    // Tap Undo
    await act(async () => pressableWithText(root, 'Undo').props.onPress());

    expect(mockMarkUnread).toHaveBeenCalledWith('u1');
    expect(titleWeight(root, 'Item to toggle')).toBe('800');
  });

  it('toast auto-dismisses after 5 seconds', async () => {
    mockHistory.mockResolvedValue({
      items: [makeItem({ id: 'u1', title: 'Item', read_at: null })],
      next_cursor: null,
    });
    const root = await renderAsync(<NotificationHistoryScreen />);

    const cardPressable = pressables(root).find(p => p.props.accessibilityActions !== undefined);
    await act(async () => {
      cardPressable?.props.onAccessibilityAction({
        nativeEvent: { actionName: 'toggle_read' },
      });
    });

    expect(texts(root)).toContain('Undo');

    act(() => {
      jest.advanceTimersByTime(5100);
    });

    expect(texts(root)).not.toContain('Undo');
  });
});
