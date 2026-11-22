/** Bell badge on the live Home bell (NB-01, NB-06): 0 hidden, 1-99 exact, 100+ "99+". */
import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { pressableLabelled, render, texts } from '../../../test-utils/render';
import HomeTopBar from '../HomeTopBar';

const METRICS = {
  frame: { x: 0, y: 0, width: 360, height: 640 },
  insets: { top: 24, left: 0, right: 0, bottom: 0 },
};

function bar(unreadCount: number) {
  return render(
    <SafeAreaProvider initialMetrics={METRICS}>
      <HomeTopBar
        name="Sam"
        photoUrl={null}
        unreadCount={unreadCount}
        onHamburgerPress={jest.fn()}
        onBellPress={jest.fn()}
        onProfilePress={jest.fn()}
        sportOptions={[]}
        selectedSports={[]}
        onToggleSport={jest.fn()}
      />
    </SafeAreaProvider>,
  );
}

const badges = (root: ReturnType<typeof bar>) =>
  root.findAll(n => typeof n.type === 'string' && n.props.testID === 'notification-badge');

it('hides the badge at 0 and keeps the plain label', () => {
  const root = bar(0);
  expect(badges(root)).toHaveLength(0);
  expect(pressableLabelled(root, 'Notifications')).toBeDefined();
});

it('shows the exact count and puts it in the accessibility label', () => {
  const root = bar(5);
  expect(texts(badges(root)[0])).toEqual(['5']);
  expect(pressableLabelled(root, 'Notifications, 5 unread')).toBeDefined();
});

it('shows 99 as 99 and 100+ as 99+', () => {
  expect(texts(badges(bar(99))[0])).toEqual(['99']);
  expect(texts(badges(bar(150))[0])).toEqual(['99+']);
});
