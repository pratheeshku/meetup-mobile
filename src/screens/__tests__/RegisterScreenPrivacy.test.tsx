/**
 * "Privacy Policy" link on Register (DES-MEETUP-ADDENDUM-IOS-App.md §11):
 * shown only for a valid https URL in `config/appConfig.json`; run as both
 * Android and iOS.
 */
import React from 'react';
import { Alert, Linking, Platform } from 'react-native';

import appConfig from '../../../config/appConfig.json';
import { act, pressableWithText, renderAsync, texts } from '../../test-utils/render';
import type { Instance } from '../../test-utils/render';
import RegisterScreen from '../RegisterScreen';

const LABEL = 'Privacy Policy';
const mockConfig = appConfig as { privacyPolicyUrl: string };

jest.mock('../../../config/appConfig.json', () => ({
  __esModule: true,
  default: { privacyPolicyUrl: '' },
}));
jest.mock('../../api/client', () => ({ apiClient: { post: jest.fn() } }));

const mount = (): Promise<Instance> =>
  renderAsync(
    <RegisterScreen
      {...({
        navigation: { navigate: jest.fn(), goBack: jest.fn(), canGoBack: jest.fn(() => true) },
        route: {},
      } as unknown as React.ComponentProps<typeof RegisterScreen>)}
    />,
  );

let openURL: jest.SpyInstance;
let alertSpy: jest.SpyInstance;

beforeEach(() => {
  jest.clearAllMocks();
  mockConfig.privacyPolicyUrl = '';
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

  it.each([[''], ['   '], ['http://example.com/privacy'], ['privacy']])(
    'hides the link for %p',
    async value => {
      mockConfig.privacyPolicyUrl = value;

      expect(texts(await mount())).not.toContain(LABEL);
    },
  );

  it('shows the link for a valid URL and opens it once, exactly', async () => {
    mockConfig.privacyPolicyUrl = '  https://example.com/privacy  ';
    const root = await mount();

    expect(texts(root)).toContain(LABEL);
    await act(async () => {
      pressableWithText(root, LABEL).props.onPress();
    });

    expect(openURL).toHaveBeenCalledTimes(1);
    expect(openURL).toHaveBeenCalledWith('https://example.com/privacy');
  });

  it('shows a generic alert, without the URL, when opening fails', async () => {
    mockConfig.privacyPolicyUrl = 'https://example.com/privacy';
    openURL.mockRejectedValueOnce(new Error('no handler'));
    const root = await mount();

    await act(async () => {
      pressableWithText(root, LABEL).props.onPress();
    });

    expect(alertSpy).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(alertSpy.mock.calls[0])).not.toContain('example.com');
  });
});
