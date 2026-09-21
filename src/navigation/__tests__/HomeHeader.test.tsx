import React from 'react';
import type { NativeStackHeaderProps } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { getUnreadCount } from '../../api/notifications';
import { setUnreadBadgeCount } from '../../notifications/unreadCountStore';
import { act, pressableLabelled, renderAsync, texts } from '../../test-utils/render';
import HomeHeader from '../HomeHeader';

jest.mock('../../api/notifications', () => ({ getUnreadCount: jest.fn() }));

const mockGetUnreadCount = getUnreadCount as jest.Mock;

const METRICS = {
  frame: { x: 0, y: 0, width: 360, height: 640 },
  insets: { top: 24, left: 0, right: 0, bottom: 0 },
};

function makeNavigation() {
  const listeners: Record<string, () => void> = {};
  return {
    navigate: jest.fn(),
    addListener: jest.fn((event: string, cb: () => void) => {
      listeners[event] = cb;
      return jest.fn();
    }),
    emit: (event: string) => listeners[event](),
  };
}

async function mount(navigation: ReturnType<typeof makeNavigation>) {
  const props = { navigation } as unknown as NativeStackHeaderProps;
  return renderAsync(
    <SafeAreaProvider initialMetrics={METRICS}>
      <HomeHeader {...props} />
    </SafeAreaProvider>,
  );
}

const badges = (root: Awaited<ReturnType<typeof mount>>) =>
  root.findAll(node => (node.type as unknown) === 'View' && node.props.testID === 'notification-badge');

beforeEach(() => {
  jest.clearAllMocks();
  // Earlier tests' trees stay mounted and subscribed; reset inside act().
  act(() => setUnreadBadgeCount(0));
  mockGetUnreadCount.mockResolvedValue({ count: 0 });
});

describe('HomeHeader', () => {
  it('opens Notification History when the bell is tapped', async () => {
    const navigation = makeNavigation();
    const root = await mount(navigation);
    pressableLabelled(root, 'Notifications').props.onPress();
    expect(navigation.navigate).toHaveBeenCalledTimes(1);
    expect(navigation.navigate).toHaveBeenCalledWith('NotificationHistory');
  });

  it('loads the unread count on mount and shows it on the badge', async () => {
    mockGetUnreadCount.mockResolvedValue({ count: 3 });
    const root = await mount(makeNavigation());
    expect(mockGetUnreadCount).toHaveBeenCalledTimes(1);
    expect(badges(root)).toHaveLength(1);
    expect(texts(root)).toContain('3');
  });

  it('hides the badge when the count is 0', async () => {
    const root = await mount(makeNavigation());
    expect(badges(root)).toHaveLength(0);
  });

  it('keeps the badge hidden if the count request fails', async () => {
    mockGetUnreadCount.mockRejectedValue(new Error('offline'));
    const root = await mount(makeNavigation());
    expect(badges(root)).toHaveLength(0);
  });

  it('refreshes the count when the screen regains focus (returning from history)', async () => {
    const navigation = makeNavigation();
    const root = await mount(navigation);
    expect(badges(root)).toHaveLength(0);

    mockGetUnreadCount.mockResolvedValue({ count: 1 });
    await act(async () => {
      navigation.emit('focus');
    });

    expect(texts(root)).toContain('1');
  });
});
