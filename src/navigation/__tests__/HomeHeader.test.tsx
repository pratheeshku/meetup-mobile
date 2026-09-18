import React from 'react';
import type { NativeStackHeaderProps } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { pressableLabelled, render } from '../../test-utils/render';
import HomeHeader from '../HomeHeader';

const METRICS = {
  frame: { x: 0, y: 0, width: 360, height: 640 },
  insets: { top: 24, left: 0, right: 0, bottom: 0 },
};

function mount(getParent: () => unknown) {
  const props = { navigation: { getParent } } as unknown as NativeStackHeaderProps;
  return render(
    <SafeAreaProvider initialMetrics={METRICS}>
      <HomeHeader {...props} />
    </SafeAreaProvider>,
  );
}

describe('HomeHeader', () => {
  it('opens Notification Preferences on the Profile tab when the bell is tapped', () => {
    const navigate = jest.fn();
    const root = mount(() => ({ navigate }));
    pressableLabelled(root, 'Notifications').props.onPress();
    expect(navigate).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith('Profile', { screen: 'NotificationPreferences' });
  });

  it('does not crash when there is no parent tab navigator', () => {
    const root = mount(() => undefined);
    expect(() => pressableLabelled(root, 'Notifications').props.onPress()).not.toThrow();
  });

  it('never shows an unread badge (no unread-count source exists yet)', () => {
    const root = mount(() => ({ navigate: jest.fn() }));
    expect(root.findAll(node => node.props.testID === 'notification-badge')).toHaveLength(0);
  });
});
