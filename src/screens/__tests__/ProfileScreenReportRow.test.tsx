/**
 * "Report a problem or content" row (DES-MEETUP-ADDENDUM-IOS-App.md §7): shown only for a
 * valid https URL in `config/appConfig.json`, opened with `Linking.openURL`, platform-blind
 * (run as both Android and iOS). The row now lives on the Settings screen (HELP section).
 */
import React from 'react';
import { Alert, Linking, Platform } from 'react-native';

import appConfig from '../../../config/appConfig.json';
import { getNotificationSettings } from '../../api/profile';
import { act, pressableWithText, renderAsync, texts } from '../../test-utils/render';
import type { Instance } from '../../test-utils/render';
import SettingsScreen from '../SettingsScreen';

type Props = React.ComponentProps<typeof SettingsScreen>;

// The approved design names this row "Report a problem or content" (IOS-App §7); SettingsScreen renders it from
// 'mob.settings.report_problem'.
const ROW = 'Report a problem or content';
const mockConfig = appConfig as { reportFormUrl: string };

jest.mock('../../../config/appConfig.json', () => ({
  __esModule: true,
  default: { reportFormUrl: '' },
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
  mockConfig.reportFormUrl = '';
  (getNotificationSettings as jest.Mock).mockReset().mockResolvedValue({ push_enabled: true, email_enabled: true });
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
