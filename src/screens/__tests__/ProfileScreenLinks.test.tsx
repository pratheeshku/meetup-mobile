/**
 * "Privacy policy" and "Contact support" rows on the Settings screen, reached from
 * Profile (DES-MEETUP-ADDENDUM-IOS-App.md §11): each shown only for a valid configured
 * value, opened with `Linking.openURL`; run as both Android and iOS.
 */
import React from 'react';
import { Alert, Linking, Platform } from 'react-native';

import appConfig from '../../../config/appConfig.json';
import { getNotificationSettings } from '../../api/profile';
import { act, pressableWithText, renderAsync, texts } from '../../test-utils/render';
import type { Instance } from '../../test-utils/render';
import SettingsScreen from '../SettingsScreen';

type Props = React.ComponentProps<typeof SettingsScreen>;

const mockConfig = appConfig as { privacyPolicyUrl: string; supportContact: string };

jest.mock('../../../config/appConfig.json', () => ({
  __esModule: true,
  default: { privacyPolicyUrl: '', supportContact: '', reportFormUrl: '' },
}));
jest.mock('../../api/profile', () => ({
  getNotificationSettings: jest.fn(),
  updateNotificationSettings: jest.fn(),
  requestDeletion: jest.fn(),
  parseOwnsGroupsError: jest.fn(),
}));

const mount = (): Promise<Instance> =>
  renderAsync(
    <SettingsScreen {...({ navigation: { navigate: jest.fn(), goBack: jest.fn() }, route: {} } as unknown as Props)} />,
  );

let openURL: jest.SpyInstance;
let alertSpy: jest.SpyInstance;

beforeEach(() => {
  jest.clearAllMocks();
  mockConfig.privacyPolicyUrl = '';
  mockConfig.supportContact = '';
  (getNotificationSettings as jest.Mock).mockReset().mockResolvedValue({ push_enabled: true, email_enabled: true });
  openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
  alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
});

afterEach(() => {
  jest.restoreAllMocks();
});

const CASES = [
  {
    label: 'Privacy policy',
    key: 'privacyPolicyUrl' as const,
    invalid: ['', '   ', 'http://example.com/privacy', 'privacy', 'support@example.com'],
    valid: '  https://example.com/privacy  ',
    expected: 'https://example.com/privacy',
  },
  {
    label: 'Contact support',
    key: 'supportContact' as const,
    invalid: ['', '   ', 'http://example.com/help', 'help me', 'a@b'],
    valid: ' support@example.com ',
    expected: 'mailto:support@example.com',
  },
];

describe.each(['android', 'ios'] as const)('on %s', os => {
  beforeEach(() => {
    jest.replaceProperty(Platform, 'OS', os);
  });

  describe.each(CASES)('$label row', ({ label, key, invalid, valid, expected }) => {
    it.each(invalid)('is hidden for %p', async value => {
      mockConfig[key] = value;

      expect(texts(await mount())).not.toContain(label);
    });

    it('is shown for a valid value and opens it once, exactly', async () => {
      mockConfig[key] = valid;
      const root = await mount();

      expect(texts(root)).toContain(label);
      await act(async () => {
        pressableWithText(root, label).props.onPress();
      });

      expect(openURL).toHaveBeenCalledTimes(1);
      expect(openURL).toHaveBeenCalledWith(expected);
      expect(alertSpy).not.toHaveBeenCalled();
    });

    it('shows a generic alert, without the value, when opening fails', async () => {
      mockConfig[key] = valid;
      openURL.mockRejectedValueOnce(new Error('no handler'));
      const root = await mount();

      await act(async () => {
        pressableWithText(root, label).props.onPress();
      });

      expect(alertSpy).toHaveBeenCalledTimes(1);
      expect(JSON.stringify(alertSpy.mock.calls[0])).not.toContain('example.com');
    });
  });
});
