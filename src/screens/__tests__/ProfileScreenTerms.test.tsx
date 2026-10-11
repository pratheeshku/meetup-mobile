/**
 * "Terms of Use" row on Profile: shown only for a valid https URL in
 * `config/appConfig.json`, opened with `Linking.openURL`; run as both
 * Android and iOS.
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

const LABEL = 'Terms of Use';
const mockConfig = appConfig as { termsOfUseUrl: string };

jest.mock('../../../config/appConfig.json', () => ({
  __esModule: true,
  default: { termsOfUseUrl: '', privacyPolicyUrl: '', supportContact: '', reportFormUrl: '' },
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
  getProfileSummary: jest.fn().mockResolvedValue({ games_played: 0, games_hosted: 0, groups_count: 0, recent_games: [] }),
  updateProfile: jest.fn(),
  updateSkillLevel: jest.fn(),
  deleteSkillLevel: jest.fn(),
  requestDeletion: jest.fn(),
  confirmDeletion: jest.fn(),
  uploadAvatar: jest.fn(),
  deleteAvatar: jest.fn(),
}));
jest.mock('../../api/groups', () => ({
  getMyGroups: jest.fn().mockResolvedValue({ items: [], total: 0 }),
}));
jest.mock('../../api/home', () => ({
  getCachedBanners: jest.fn().mockResolvedValue(null),
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
  mockConfig.termsOfUseUrl = '';
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

describe.each(['android', 'ios'] as const)('on %s', os => {
  beforeEach(() => {
    jest.replaceProperty(Platform, 'OS', os);
  });

  it.each([[''], ['   '], ['http://example.com/terms'], ['terms']])(
    'hides the row when the URL is %p',
    async value => {
      mockConfig.termsOfUseUrl = value;

      expect(texts(await mount())).not.toContain(LABEL);
    },
  );

  it('shows the row and opens the exact (trimmed) URL once when pressed', async () => {
    mockConfig.termsOfUseUrl = '  https://example.com/terms  ';
    const root = await mount();

    expect(texts(root)).toContain(LABEL);
    await act(async () => {
      pressableWithText(root, LABEL).props.onPress();
    });

    expect(openURL).toHaveBeenCalledTimes(1);
    expect(openURL).toHaveBeenCalledWith('https://example.com/terms');
    expect(alertSpy).not.toHaveBeenCalled();
  });

  it('shows a generic alert, without the URL, when opening fails', async () => {
    mockConfig.termsOfUseUrl = 'https://example.com/terms';
    openURL.mockRejectedValueOnce(new Error('no handler'));
    const root = await mount();

    await act(async () => {
      pressableWithText(root, LABEL).props.onPress();
    });

    expect(alertSpy).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(alertSpy.mock.calls[0])).not.toContain('example.com');
  });
});
