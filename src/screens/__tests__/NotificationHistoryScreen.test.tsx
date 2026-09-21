/**
 * Notification History: list rendering (unread bold), paging, empty/error
 * states, and tap behaviour (mark read + route).
 */
import React from 'react';
import { FlatList, StyleSheet } from 'react-native';

import { getNotificationHistory, markNotificationRead } from '../../api/notifications';
import { navigateToNotificationTarget } from '../../notifications/notificationRouting';
import type { NotificationHistoryItem } from '../../types/notification';
import { act, pressableWithText, renderAsync, texts } from '../../test-utils/render';
import type { Instance } from '../../test-utils/render';
import NotificationHistoryScreen from '../NotificationHistoryScreen';

jest.mock('../../api/notifications', () => ({
  getNotificationHistory: jest.fn(),
  markNotificationRead: jest.fn(),
}));
jest.mock('../../notifications/notificationRouting', () => ({
  ...jest.requireActual('../../notifications/notificationRouting'),
  navigateToNotificationTarget: jest.fn(),
}));

const mockHistory = getNotificationHistory as jest.Mock;
const mockMarkRead = markNotificationRead as jest.Mock;
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
  // FlatList batches its render window on a timer; fake timers let us flush it
  // inside act() instead of having it fire after the test.
  jest.useFakeTimers();
  jest.clearAllMocks();
  mockMarkRead.mockResolvedValue(undefined);
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

it('renders unread items bold and read items normal, with the body and relative time', async () => {
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

  expect(titleWeight(root, 'Unread one')).toBe('700');
  expect(titleWeight(root, 'Read one')).toBe('400');
  expect(texts(root)).toContain('Sunday football moved to 6pm');
  expect(texts(root)).toContain('2h ago');
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
  const root = await renderAsync(<NotificationHistoryScreen />);
  expect(texts(root)).toContain('No notifications in the last 5 days');
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
    expect(titleWeight(root, 'Event updated')).toBe('700');

    await act(async () => pressableWithText(root, 'Event updated').props.onPress());

    expect(mockMarkRead).toHaveBeenCalledTimes(1);
    expect(mockMarkRead).toHaveBeenCalledWith('n1');
    expect(titleWeight(root, 'Event updated')).toBe('400');
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

    expect(titleWeight(root, 'Event updated')).toBe('700');
    expect(mockNavigate).toHaveBeenCalledTimes(1);
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

  it('renders a row with null title/body without crashing', async () => {
    mockHistory.mockResolvedValue({ items: [makeItem({ title: null, body: null })] });
    const root = await renderAsync(<NotificationHistoryScreen />);
    expect(texts(root)).toContain('Notification');
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
    await act(async () => root.findByType(FlatList).props.onEndReached());

    expect(mockHistory).toHaveBeenLastCalledWith('2026-09-20T00:00:00Z');
    expect(texts(root).filter(t => t === 'First')).toHaveLength(1);
    expect(texts(root)).toContain('Second');
  });

  it('does not request another page when there is no next_cursor', async () => {
    mockHistory.mockResolvedValue({ items: [makeItem()], next_cursor: null });
    const root = await renderAsync(<NotificationHistoryScreen />);

    await act(async () => root.findByType(FlatList).props.onEndReached());

    expect(mockHistory).toHaveBeenCalledTimes(1);
  });

  it('keeps the loaded items and offers a retry when a later page fails', async () => {
    mockHistory.mockResolvedValueOnce({ items: [makeItem()], next_cursor: 'c1' });
    const root = await renderAsync(<NotificationHistoryScreen />);

    mockHistory.mockRejectedValueOnce(new Error('offline'));
    await act(async () => root.findByType(FlatList).props.onEndReached());

    expect(texts(root)).toContain('Event updated');
    expect(texts(root)).toContain('Could not load more. Tap to retry.');
  });
});
