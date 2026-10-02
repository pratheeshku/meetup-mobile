/**
 * Register: required "I agree to the Terms of Use [and Privacy Policy]"
 * checkbox (email registration only), shown only for a valid https terms URL
 * in `config/appConfig.json`; run as both Android and iOS.
 */
import React from 'react';
import { Alert, Linking, Platform } from 'react-native';

import appConfig from '../../../config/appConfig.json';
import { apiClient } from '../../api/client';
import { act, pressableWithText, renderAsync, texts } from '../../test-utils/render';
import type { Instance } from '../../test-utils/render';
import RegisterScreen from '../RegisterScreen';

const mockConfig = appConfig as { termsOfUseUrl: string; privacyPolicyUrl: string };
const TERMS = 'https://example.com/terms';
const PRIVACY = 'https://example.com/privacy';
const AGREE_PREFIX = 'I agree to the';

jest.mock('../../../config/appConfig.json', () => ({
  __esModule: true,
  default: { termsOfUseUrl: '', privacyPolicyUrl: '' },
}));
jest.mock('../../api/client', () => ({ apiClient: { post: jest.fn() } }));

const mockNavigate = jest.fn();
const mount = (): Promise<Instance> =>
  renderAsync(
    <RegisterScreen
      {...({
        navigation: { navigate: mockNavigate, goBack: jest.fn(), canGoBack: jest.fn(() => true) },
        route: {},
      } as unknown as React.ComponentProps<typeof RegisterScreen>)}
    />,
  );

const checkbox = (root: Instance): Instance | undefined =>
  root.findAll(n => n.props.accessibilityRole === 'checkbox' && typeof n.props.onPress === 'function')[0];
const link = (root: Instance, label: string): Instance =>
  root.findAll(
    n => (n.type as unknown) === 'Text' && n.props.accessibilityRole === 'link' && texts(n).includes(label),
  )[0];
const field = (root: Instance, placeholder: string): Instance =>
  root.findAll(n => (n.type as unknown) === 'TextInput' && n.props.placeholder === placeholder)[0];
/** Every string rendered anywhere below `node`, in order (nested Text and fragments included). */
const flatText = (node: Instance | string): string =>
  typeof node === 'string' ? node : node.children.map(flatText).join('');
const registerButton = (root: Instance): Instance => pressableWithText(root, 'Register');
const isDisabled = (node: Instance): boolean => node.props.accessibilityState?.disabled === true;

let openURL: jest.SpyInstance;
let alertSpy: jest.SpyInstance;

beforeEach(() => {
  jest.clearAllMocks();
  mockConfig.termsOfUseUrl = '';
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

  it.each([[''], ['   '], ['http://example.com/terms'], ['terms']])(
    'shows no checkbox and does not gate Register when the terms URL is %p',
    async value => {
      mockConfig.termsOfUseUrl = value;
      const root = await mount();

      expect(checkbox(root)).toBeUndefined();
      expect(flatText(root)).not.toContain(AGREE_PREFIX);
      expect(isDisabled(registerButton(root))).toBe(false);
    },
  );

  it('shows an unchecked checkbox with the full sentence when both URLs are valid', async () => {
    mockConfig.termsOfUseUrl = TERMS;
    mockConfig.privacyPolicyUrl = PRIVACY;
    const root = await mount();

    const box = checkbox(root) as Instance;
    expect(box.props.accessibilityState.checked).toBe(false);
    expect(box.props.accessibilityLabel).toBe('I agree to the Terms of Use and Privacy Policy');
    expect(flatText(root)).toContain('I agree to the Terms of Use and Privacy Policy');
  });

  it('omits the Privacy Policy part when the privacy URL is invalid', async () => {
    mockConfig.termsOfUseUrl = TERMS;
    mockConfig.privacyPolicyUrl = 'http://example.com/privacy';
    const root = await mount();

    expect((checkbox(root) as Instance).props.accessibilityLabel).toBe('I agree to the Terms of Use');
    expect(link(root, 'Privacy Policy')).toBeUndefined();
    expect(link(root, 'Terms of Use')).toBeDefined();
  });

  it('has a 44x44 touch target and a visible check mark when checked (not colour alone)', async () => {
    mockConfig.termsOfUseUrl = TERMS;
    const root = await mount();
    const target = checkbox(root) as Instance;
    const style = target.props.style;
    expect(style).toEqual(expect.objectContaining({ width: 44, height: 44 }));
    expect(texts(root)).not.toContain('✓');

    act(() => (checkbox(root) as Instance).props.onPress());
    expect(texts(root)).toContain('✓');
  });

  it('disables Register until checked, enables it after, and disables it again on uncheck', async () => {
    mockConfig.termsOfUseUrl = TERMS;
    const root = await mount();
    expect(isDisabled(registerButton(root))).toBe(true);

    act(() => (checkbox(root) as Instance).props.onPress());
    expect((checkbox(root) as Instance).props.accessibilityState.checked).toBe(true);
    expect(isDisabled(registerButton(root))).toBe(false);

    act(() => (checkbox(root) as Instance).props.onPress());
    expect(isDisabled(registerButton(root))).toBe(true);
  });

  it('does not submit while unchecked, and submits once checked', async () => {
    mockConfig.termsOfUseUrl = TERMS;
    (apiClient.post as jest.Mock).mockResolvedValue({ status: 200 });
    const root = await mount();
    act(() => {
      field(root, 'Nickname').props.onChangeText('sam');
      field(root, 'Display Name').props.onChangeText('Sam');
      field(root, 'Email').props.onChangeText('sam@example.com');
      field(root, 'Password').props.onChangeText('password123');
    });

    await act(async () => registerButton(root).props.onPress());
    expect(apiClient.post).not.toHaveBeenCalled();

    act(() => (checkbox(root) as Instance).props.onPress());
    await act(async () => registerButton(root).props.onPress());
    expect(apiClient.post).toHaveBeenCalledTimes(1);
  });

  it('starts unchecked on every mount', async () => {
    mockConfig.termsOfUseUrl = TERMS;
    const first = await mount();
    act(() => (checkbox(first) as Instance).props.onPress());

    const second = await mount();
    expect((checkbox(second) as Instance).props.accessibilityState.checked).toBe(false);
  });

  it.each([
    ['Terms of Use', TERMS],
    ['Privacy Policy', PRIVACY],
  ])('opens %s once with the exact URL', async (label, url) => {
    mockConfig.termsOfUseUrl = ` ${TERMS} `;
    mockConfig.privacyPolicyUrl = PRIVACY;
    const root = await mount();

    await act(async () => link(root, label).props.onPress());

    expect(openURL).toHaveBeenCalledTimes(1);
    expect(openURL).toHaveBeenCalledWith(url);
    expect(alertSpy).not.toHaveBeenCalled();
  });

  it('shows a generic alert, without the URL, when a link fails to open', async () => {
    mockConfig.termsOfUseUrl = TERMS;
    openURL.mockRejectedValueOnce(new Error('no handler'));
    const root = await mount();

    await act(async () => link(root, 'Terms of Use').props.onPress());

    expect(alertSpy).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(alertSpy.mock.calls[0])).not.toContain('example.com');
  });
});
