/**
 * "Report a problem or content" row on Profile (DES-MEETUP-ADDENDUM-IOS-App.md
 * §7): shown only for a valid https URL in `config/appConfig.json`, opened
 * with `Linking.openURL`, platform-blind (run as both Android and iOS).
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

const ROW = 'Report a problem or content';
const mockConfig = appConfig as { reportFormUrl: string };

jest.mock('../../../config/appConfig.json', () => ({
  __esModule: true,
  default: { reportFormUrl: '' },
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
  mockConfig.reportFormUrl = '';
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

  it.each([[''], ['   '], ['http://forms.example.com/r']])(
    'hides the row when the URL is %p',
    async url => {
      mockConfig.reportFormUrl = url;

      expect(texts(await mount())).not.toContain(ROW);
    },
  );

  it('shows the row and opens the exact (trimmed) URL once when pressed', async () => {
    mockConfig.reportFormUrl = '  https://forms.example.com/report  ';
    const root = await mount();

    expect(texts(root)).toContain(ROW);
    await act(async () => {
      pressableWithText(root, ROW).props.onPress();
    });

    expect(openURL).toHaveBeenCalledTimes(1);
    expect(openURL).toHaveBeenCalledWith('https://forms.example.com/report');
    expect(alertSpy).not.toHaveBeenCalled();
  });

  it('shows a generic alert, without the URL, when opening fails', async () => {
    mockConfig.reportFormUrl = 'https://forms.example.com/report';
    openURL.mockRejectedValueOnce(new Error('no handler'));
    const root = await mount();

    await act(async () => {
      pressableWithText(root, ROW).props.onPress();
    });

    expect(alertSpy).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(alertSpy.mock.calls[0])).not.toContain('forms.example.com');
  });
});
