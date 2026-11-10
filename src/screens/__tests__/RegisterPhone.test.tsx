/**
 * Register with the mobile number (NE-01, NE-01b): flag off = the screen and the request are exactly as before; flag on = a required
 * number field, validated before submit, sent with the consent version; 422 and 409 show labels, never the server text or the number.
 */
import React from 'react';
import { TextInput } from 'react-native';

import { apiClient } from '../../api/client';
import { act, pressableWithText, renderAsync, texts } from '../../test-utils/render';
import type { Instance } from '../../test-utils/render';
import { COUNTRIES } from '../../test-utils/mobileNumberFixtures';
import RegisterScreen from '../RegisterScreen';

jest.mock('../../../config/appConfig.json', () => ({
  __esModule: true,
  default: { ...jest.requireActual('../../../config/appConfig.json'), termsOfUseUrl: '' },
}));
jest.mock('../../api/client', () => ({ apiClient: { post: jest.fn(), get: jest.fn() } }));

const mockPost = apiClient.post as jest.Mock;
const mockGet = apiClient.get as jest.Mock;
const navigate = jest.fn();
const NUMBER = '91234567';

const consent = (over: Record<string, unknown> = {}) => ({
  version: 'consent-v1',
  text: 'We may call you.',
  phone_required: true,
  whatsapp_otp_enabled: false,
  ...over,
});
const serve = (c: ReturnType<typeof consent>) =>
  mockGet.mockImplementation((url: string) =>
    Promise.resolve({ data: url.includes('country-codes') ? COUNTRIES : c }),
  );

const mount = (): Promise<Instance> =>
  renderAsync(<RegisterScreen {...({ navigation: { navigate }, route: {} } as unknown as React.ComponentProps<typeof RegisterScreen>)} />);

const input = (root: Instance, placeholder: string): Instance => root.findAllByType(TextInput).find(i => i.props.placeholder === placeholder) as Instance;
const fill = (root: Instance, withNumber: boolean): void => {
  act(() => {
    input(root, 'Nickname').props.onChangeText('ann');
    input(root, 'Display Name').props.onChangeText('Ann Lee');
    input(root, 'Email').props.onChangeText('ann@example.com');
    input(root, 'Password').props.onChangeText('password123');
    if (withNumber) input(root, 'Mobile number').props.onChangeText(NUMBER);
  });
};
const submit = async (root: Instance): Promise<void> => {
  await act(async () => pressableWithText(root, 'Register').props.onPress());
};
const hasField = (root: Instance): boolean => root.findAllByType(TextInput).some(i => i.props.placeholder === 'Mobile number');

beforeEach(() => {
  jest.clearAllMocks();
  mockPost.mockReset().mockResolvedValue({ data: {} });
  mockGet.mockReset();
});

describe('flag off', () => {
  it('shows no mobile number field and sends no mobile fields', async () => {
    serve(consent({ phone_required: false }));
    const root = await mount();
    expect(hasField(root)).toBe(false);
    fill(root, false);
    await submit(root);
    const body = mockPost.mock.calls[0][1];
    expect(Object.keys(body).sort()).toEqual(['display_name', 'email', 'nickname', 'password', 'terms_version']);
    expect(navigate).toHaveBeenCalledWith('Verify', { email: 'ann@example.com' });
  });

  it('with the consent unreadable the screen is also unchanged', async () => {
    mockGet.mockRejectedValue(new Error('offline'));
    const root = await mount();
    expect(hasField(root)).toBe(false);
    fill(root, false);
    await submit(root);
    expect(mockPost.mock.calls[0][1]).not.toHaveProperty('mobile_number');
  });
});

describe('flag on', () => {
  it('shows the field with the consent text and requires it before any request', async () => {
    serve(consent());
    const root = await mount();
    expect(hasField(root)).toBe(true);
    expect(texts(root)).toContain('We may call you.');
    fill(root, false);
    await submit(root);
    expect(mockPost).not.toHaveBeenCalled();
    expect(texts(root)).toContain('Enter your mobile number.');
  });

  it('refuses a number that cannot be valid before any request', async () => {
    serve(consent());
    const root = await mount();
    fill(root, false);
    act(() => input(root, 'Mobile number').props.onChangeText('12'));
    await submit(root);
    expect(mockPost).not.toHaveBeenCalled();
    expect(texts(root)).toContain('Enter a valid mobile number.');
  });

  it('sends mobile_number (E.164) and mobile_consent_version with the rest', async () => {
    serve(consent());
    const root = await mount();
    fill(root, true);
    await submit(root);
    expect(mockPost.mock.calls[0][1]).toMatchObject({
      email: 'ann@example.com',
      mobile_number: '+6591234567',
      mobile_consent_version: 'consent-v1',
    });
    expect(navigate).toHaveBeenCalledWith('Verify', { email: 'ann@example.com' });
  });

  it('422 "Mobile number is required" and "Invalid mobile number format" show labels, not the server text', async () => {
    serve(consent());
    const root = await mount();
    fill(root, true);
    mockPost.mockRejectedValueOnce({ response: { status: 422, data: { detail: 'Mobile number is required' } } });
    await submit(root);
    expect(texts(root)).toContain('Enter your mobile number.');
    expect(texts(root)).not.toContain('Mobile number is required');
    mockPost.mockRejectedValueOnce({ response: { status: 422, data: { detail: 'Invalid mobile number format' } } });
    await submit(root);
    expect(texts(root)).toContain('Enter a valid mobile number.');
    expect(texts(root).join('|')).not.toContain(NUMBER);
  });

  it('409 consent_version_stale reads the consent again, asks to review it, and the retry sends the new version', async () => {
    serve(consent());
    const root = await mount();
    fill(root, true);
    mockPost.mockRejectedValueOnce({ response: { status: 409, data: { detail: { code: 'consent_version_stale', current_version: 'consent-v2' } } } });
    serve(consent({ version: 'consent-v2', text: 'New text.' }));
    await submit(root);
    expect(texts(root)).toContain('The consent text has changed. Please review it and confirm to save.');
    expect(texts(root)).toContain('New text.');
    await submit(root);
    expect(mockPost.mock.calls[1][1]).toMatchObject({ mobile_consent_version: 'consent-v2', mobile_number: '+6591234567' });
  });

  it('a 422 "required" when the consent could not be read shows a label and reads the consent again', async () => {
    mockGet.mockRejectedValue(new Error('offline'));
    const root = await mount();
    fill(root, false);
    mockPost.mockRejectedValueOnce({ response: { status: 422, data: { detail: 'Mobile number is required' } } });
    serve(consent());
    await submit(root);
    expect(texts(root)).toContain('We could not load the mobile number form. Check your connection and try again.');
    expect(hasField(root)).toBe(true);
  });
});
