/** Settings: the Notifications row opens the per-type preferences, whatever the master toggles say (np-t3). */
import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { getNotificationSettings } from '../../api/profile';
import { act, renderAsync, texts } from '../../test-utils/render';
import type { Instance } from '../../test-utils/render';
import SettingsScreen from '../SettingsScreen';

jest.mock('../../api/profile', () => ({
  getNotificationSettings: jest.fn(),
  updateNotificationSettings: jest.fn(),
  requestDeletion: jest.fn(),
  parseOwnsGroupsError: jest.fn(),
}));

const METRICS = { frame: { x: 0, y: 0, width: 360, height: 640 }, insets: { top: 0, left: 0, right: 0, bottom: 24 } };

async function mount(navigate: jest.Mock): Promise<Instance> {
  const props = { navigation: { goBack: jest.fn(), navigate } } as unknown as React.ComponentProps<typeof SettingsScreen>;
  return renderAsync(
    <SafeAreaProvider initialMetrics={METRICS}>
      <SettingsScreen {...props} />
    </SafeAreaProvider>,
  );
}
const row = (root: Instance): Instance => root.findAll(n => n.props.testID === 'settings-notifications-row' && typeof n.props.onPress === 'function')[0];

describe.each([
  ['both on', { push_enabled: true, email_enabled: true }],
  ['both off', { push_enabled: false, email_enabled: false }],
])('Settings Notifications row (%s)', (_name, settings) => {
  beforeEach(() => {
    (getNotificationSettings as jest.Mock).mockResolvedValue(settings);
  });

  it('shows the label and caption', async () => {
    const all = texts(await mount(jest.fn()));
    expect(all).toContain('Notifications');
    expect(all).toContain('Choose which notifications you get');
  });

  it('opens NotificationPreferences', async () => {
    const navigate = jest.fn();
    const root = await mount(navigate);
    await act(async () => {
      row(root).props.onPress();
    });
    expect(navigate).toHaveBeenCalledWith('NotificationPreferences');
  });
});
