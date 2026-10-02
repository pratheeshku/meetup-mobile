/**
 * "Privacy Policy" and "Contact support" rows on Profile
 * (DES-MEETUP-ADDENDUM-IOS-App.md §11): each shown only for a valid configured
 * value, opened with `Linking.openURL`; run as both Android and iOS.
 */
import React from 'react';
import { Alert, Linking, Platform } from 'react-native';

import appConfig from '../../../config/appConfig.json';
import { getProfile } from '../../api/profile';
import { getSports } from '../../api/sports';
import { act, pressableWithText, renderAsync, texts } from '../../test-utils/render';
import type { Instance } from '../../test-utils/render';
import ProfileScreen from '../ProfileScreen';

type Props = React.ComponentProps<typeof ProfileScreen>;

const mockConfig = appConfig as { privacyPolicyUrl: string; supportContact: string };

jest.mock('../../../config/appConfig.json', () => ({
  __esModule: true,
  default: { privacyPolicyUrl: '', supportContact: '', reportFormUrl: '' },
}));
jest.mock('../../api/mobileNumber', () => ({
  getMobileConsent: jest.fn(() => Promise.reject(new Error('unavailable'))),
  getCountryCodes: jest.fn(() => Promise.reject(new Error('unavailable'))),
  updateMobileNumber: jest.fn(),
  classifyMobileNumberError: jest.fn(() => 'other'),
}));
jest.mock('../../auth/AuthContext', () => ({
  useAuth: () => ({ signOut: jest.fn(), updateUser: jest.fn() }),
}));
jest.mock('../../api/profile', () => ({
  getProfile: jest.fn(),
  updateProfile: jest.fn(),
  updateSkillLevel: jest.fn(),
  deleteSkillLevel: jest.fn(),
  requestDeletion: jest.fn(),
  confirmDeletion: jest.fn(),
  uploadAvatar: jest.fn(),
  deleteAvatar: jest.fn(),
}));
jest.mock('../../api/sports', () => ({ getSports: jest.fn() }));

const mount = (): Promise<Instance> =>
  renderAsync(
    <ProfileScreen {...({ navigation: { navigate: jest.fn() }, route: {} } as unknown as Props)} />,
  );

let openURL: jest.SpyInstance;
let alertSpy: jest.SpyInstance;

beforeEach(() => {
  jest.clearAllMocks();
  mockConfig.privacyPolicyUrl = '';
  mockConfig.supportContact = '';
  (getProfile as jest.Mock).mockReset().mockResolvedValue({
    id: 'u-1',
    email: 'sam@example.com',
    nickname: 'sam99',
    display_name: 'Sam Smith',
    skill_levels: [],
  });
  (getSports as jest.Mock).mockReset().mockResolvedValue([]);
  openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
  alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
});

afterEach(() => {
  jest.restoreAllMocks();
});

const CASES = [
  {
    label: 'Privacy Policy',
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
