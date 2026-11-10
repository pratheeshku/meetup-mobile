/**
 * Complete your account (NE-01, AD-3): read-only email and name, the mobile number field, Continue calls complete-signup through the auth
 * context; success is handled by the context (signed in), a dead ticket (400) returns to Login, 422 and 409 keep the screen and the ticket.
 * Also: a Login or Register social sign-in answering `signup_required` navigates here.
 */
import React from 'react';
import { Alert, TextInput } from 'react-native';

import { AuthContext } from '../../auth/AuthContext';
import { apiClient } from '../../api/client';
import { act, pressableWithText, renderAsync, texts } from '../../test-utils/render';
import type { Instance } from '../../test-utils/render';
import { COUNTRIES } from '../../test-utils/mobileNumberFixtures';
import CompleteAccountScreen from '../CompleteAccountScreen';

jest.mock('../../api/client', () => ({ apiClient: { get: jest.fn(), post: jest.fn() } }));

const mockGet = apiClient.get as jest.Mock;
const replace = jest.fn();
const completeSignup = jest.fn();
const cancelPendingSignup = jest.fn();

const authValue = (over: Record<string, unknown> = {}) =>
  ({ pendingSignup: { email: 'ann@example.com', display_name: 'Ann Lee' }, completeSignup, cancelPendingSignup, ...over }) as never;

const mount = (value = authValue()): Promise<Instance> =>
  renderAsync(
    <AuthContext.Provider value={value}>
      <CompleteAccountScreen {...({ navigation: { replace }, route: {} } as unknown as React.ComponentProps<typeof CompleteAccountScreen>)} />
    </AuthContext.Provider>,
  );

const numberInput = (root: Instance): Instance => root.findAllByType(TextInput).find(i => i.props.placeholder === 'Mobile number') as Instance;
const enter = (root: Instance, value: string): void => {
  act(() => numberInput(root).props.onChangeText(value));
};
const press = async (root: Instance): Promise<void> => {
  await act(async () => pressableWithText(root, 'Continue').props.onPress());
};

beforeEach(() => {
  jest.clearAllMocks();
  completeSignup.mockReset().mockResolvedValue(undefined);
  mockGet.mockReset().mockImplementation((url: string) =>
    Promise.resolve({ data: url.includes('country-codes') ? COUNTRIES : { version: 'consent-v1', text: 'We may call you.', phone_required: true, whatsapp_otp_enabled: false } }),
  );
  jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
});

it('shows the email and name read-only, the number field and the consent text', async () => {
  const root = await mount();
  const email = root.findAllByType(TextInput).find(i => i.props.testID === 'complete-account-email') as Instance;
  const name = root.findAllByType(TextInput).find(i => i.props.testID === 'complete-account-name') as Instance;
  expect([email.props.value, email.props.editable]).toEqual(['ann@example.com', false]);
  expect([name.props.value, name.props.editable]).toEqual(['Ann Lee', false]);
  expect(texts(root)).toEqual(expect.arrayContaining(['Complete your account', 'We may call you.', 'Continue']));
});

it('Continue with no number, or an impossible one, makes no request', async () => {
  const root = await mount();
  await press(root);
  expect(texts(root)).toContain('Enter your mobile number.');
  enter(root, '12');
  await press(root);
  expect(texts(root)).toContain('Enter a valid mobile number.');
  expect(completeSignup).not.toHaveBeenCalled();
});

it('Continue sends the E.164 number and the consent version through the auth context', async () => {
  const root = await mount();
  enter(root, '91234567');
  await press(root);
  expect(completeSignup).toHaveBeenCalledWith('+6591234567', 'consent-v1');
  expect(replace).not.toHaveBeenCalled();
});

it('a 400 (invalid, expired or used ticket) drops the ticket, shows the label and returns to Login', async () => {
  completeSignup.mockRejectedValue({ response: { status: 400, data: { detail: 'sign in again' } } });
  const root = await mount();
  enter(root, '91234567');
  await press(root);
  expect(cancelPendingSignup).toHaveBeenCalled();
  expect(Alert.alert).toHaveBeenCalledWith('Your sign-in has expired. Please sign in again.');
  expect(replace).toHaveBeenCalledWith('Login');
});

it('a 422 shows the invalid label and stays; the ticket is kept', async () => {
  completeSignup.mockRejectedValue({ response: { status: 422, data: { detail: 'Invalid mobile number format' } } });
  const root = await mount();
  enter(root, '91234567');
  await press(root);
  expect(texts(root)).toContain('Enter a valid mobile number.');
  expect(replace).not.toHaveBeenCalled();
  expect(cancelPendingSignup).not.toHaveBeenCalled();
});

it('a 409 consent_version_stale reads the consent again and the next Continue sends the new version', async () => {
  completeSignup.mockRejectedValueOnce({ response: { status: 409, data: { detail: { code: 'consent_version_stale', current_version: 'consent-v2' } } } });
  const root = await mount();
  enter(root, '91234567');
  mockGet.mockImplementation((url: string) =>
    Promise.resolve({ data: url.includes('country-codes') ? COUNTRIES : { version: 'consent-v2', text: 'New text.', phone_required: true, whatsapp_otp_enabled: false } }),
  );
  await press(root);
  expect(texts(root)).toContain('New text.');
  await press(root);
  expect(completeSignup).toHaveBeenLastCalledWith('+6591234567', 'consent-v2');
});

it('with nothing pending (app reopened) it returns to Login', async () => {
  await mount(authValue({ pendingSignup: null }));
  expect(replace).toHaveBeenCalledWith('Login');
});
