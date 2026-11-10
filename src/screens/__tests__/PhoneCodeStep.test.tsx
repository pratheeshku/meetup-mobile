/**
 * WhatsApp code step in Register and Complete your account (Task 1.7 contract; NE-01a, AD-4): shown only on `phone_verification`; send 404 carries
 * on as before; wrong code with attempts left; the resend countdown; the proof goes to signup / complete-signup and is held in memory only;
 * the number, the code and the proof are never logged.
 */
import React from 'react';
import { TextInput } from 'react-native';

import { AuthContext } from '../../auth/AuthContext';
import { apiClient } from '../../api/client';
import { act, pressableWithText, renderAsync, texts } from '../../test-utils/render';
import type { Instance } from '../../test-utils/render';
import { COUNTRIES } from '../../test-utils/mobileNumberFixtures';
import CompleteAccountScreen from '../CompleteAccountScreen';
import RegisterScreen from '../RegisterScreen';

jest.mock('../../../config/appConfig.json', () => ({
  __esModule: true,
  default: { ...jest.requireActual('../../../config/appConfig.json'), termsOfUseUrl: '' },
}));
jest.mock('../../api/client', () => ({ apiClient: { post: jest.fn(), get: jest.fn() } }));

const mockPost = apiClient.post as jest.Mock;
const mockGet = apiClient.get as jest.Mock;
const navigate = jest.fn();
const replace = jest.fn();
const NUMBER = '91234567';
const E164 = '+6591234567';
const CODE = '482913';
const PROOF = 'PROOF-SECRET-xyz';
const CHALLENGE = { challenge_id: 'ch-1', expires_in: 300, resend_after: 60 };

const serveConsent = (over: Record<string, unknown> = {}) =>
  mockGet.mockImplementation((url: string) =>
    Promise.resolve({
      data: url.includes('country-codes')
        ? COUNTRIES
        : { version: 'consent-v1', text: 'We may call you.', phone_required: true, whatsapp_otp_enabled: true, phone_verification: true, ...over },
    }),
  );

/** Routes the POSTs by path; each can be overridden per test. */
const routes: Record<string, jest.Mock> = {};
const route = (path: string): jest.Mock => (routes[path] ??= jest.fn());
beforeEach(() => {
  jest.clearAllMocks();
  Object.keys(routes).forEach(key => delete routes[key]);
  route('/auth/phone/otp/send').mockResolvedValue({ data: CHALLENGE });
  route('/auth/phone/otp/verify').mockResolvedValue({ data: { verified: true, phone_proof: PROOF, proof_expires_in: 900 } });
  route('/auth/signup').mockResolvedValue({ data: {} });
  mockPost.mockImplementation((path: string, body: unknown) => (routes[path] ? routes[path](body) : Promise.reject(new Error(`unrouted ${path}`))));
  serveConsent();
});

let logs: jest.SpyInstance[];
beforeEach(() => {
  logs = (['log', 'info', 'warn', 'error', 'debug'] as const).map(level => jest.spyOn(console, level).mockImplementation(() => undefined));
});
afterEach(() => {
  logs.forEach(spy => spy.mockRestore());
  jest.useRealTimers();
});

const failure = (status: number, data: Record<string, unknown> = {}) => Promise.reject({ response: { status, data } });
const input = (root: Instance, placeholder: string): Instance => root.findAllByType(TextInput).find(i => i.props.placeholder === placeholder) as Instance;
const press = async (root: Instance, label: string): Promise<void> => {
  await act(async () => pressableWithText(root, label).props.onPress());
};
const posts = (path: string): unknown[][] => mockPost.mock.calls.filter(call => call[0] === path);

describe('Register', () => {
  const mount = (): Promise<Instance> =>
    renderAsync(<RegisterScreen {...({ navigation: { navigate }, route: {} } as unknown as React.ComponentProps<typeof RegisterScreen>)} />);
  const fill = (root: Instance): void => {
    act(() => {
      input(root, 'Nickname').props.onChangeText('ann');
      input(root, 'Display Name').props.onChangeText('Ann Lee');
      input(root, 'Email').props.onChangeText('ann@example.com');
      input(root, 'Password').props.onChangeText('password123');
      input(root, 'Mobile number').props.onChangeText(NUMBER);
    });
  };
  const enterCode = (root: Instance, code = CODE): void => {
    act(() => input(root, '6-digit code').props.onChangeText(code));
  };
  const toCodeStep = async (): Promise<Instance> => {
    const root = await mount();
    fill(root);
    await press(root, 'Register');
    return root;
  };

  it('phone_verification off: no code step, no send, sign-up exactly as in Task 3.4', async () => {
    serveConsent({ phone_verification: false });
    const root = await mount();
    fill(root);
    await press(root, 'Register');
    expect(posts('/auth/phone/otp/send')).toHaveLength(0);
    const body = posts('/auth/signup')[0][1] as Record<string, unknown>;
    expect(body).toMatchObject({ mobile_number: E164, mobile_consent_version: 'consent-v1' });
    expect(body).not.toHaveProperty('mobile_verification');
    expect(navigate).toHaveBeenCalledWith('Verify', { email: 'ann@example.com' });
  });

  it('whatsapp_otp_enabled alone never shows the step', async () => {
    serveConsent({ phone_verification: false, whatsapp_otp_enabled: true });
    const root = await mount();
    fill(root);
    await press(root, 'Register');
    expect(posts('/auth/phone/otp/send')).toHaveLength(0);
    expect(texts(root)).not.toContain('Verify your number');
  });

  it('phone_verification on: sends a code to the E.164 number and shows the step before any sign-up', async () => {
    const root = await toCodeStep();
    expect(posts('/auth/phone/otp/send')[0][1]).toEqual({ mobile_number: E164 });
    expect(texts(root).map(text => text.trim())).toEqual(
      expect.arrayContaining(['Verify your number', 'Enter the 6-digit code we sent on WhatsApp to', E164, 'Resend code (60s)']),
    );
    expect(posts('/auth/signup')).toHaveLength(0);
  });

  it('send 404 (no verification on this server): signs up without a proof, no step', async () => {
    route('/auth/phone/otp/send').mockImplementation(() => failure(404, { detail: 'Not Found' }));
    const root = await toCodeStep();
    expect(texts(root)).not.toContain('Verify your number');
    const body = posts('/auth/signup')[0][1] as Record<string, unknown>;
    expect(body).toMatchObject({ mobile_number: E164 });
    expect(body).not.toHaveProperty('mobile_verification');
  });

  it('a good code verifies with challenge_id and the 6 digits, then signs up with mobile_verification', async () => {
    const root = await toCodeStep();
    enterCode(root);
    await press(root, 'Verify');
    expect(posts('/auth/phone/otp/verify')[0][1]).toEqual({ challenge_id: 'ch-1', code: CODE });
    expect(posts('/auth/signup')[0][1]).toMatchObject({ mobile_number: E164, mobile_consent_version: 'consent-v1', mobile_verification: PROOF });
    expect(navigate).toHaveBeenCalledWith('Verify', { email: 'ann@example.com' });
  });

  it('a short code makes no request', async () => {
    const root = await toCodeStep();
    enterCode(root, '123');
    await press(root, 'Verify');
    expect(posts('/auth/phone/otp/verify')).toHaveLength(0);
    expect(texts(root)).toContain('Enter the 6-digit code.');
  });

  it('a wrong code shows the attempts left from the server', async () => {
    route('/auth/phone/otp/verify').mockImplementation(() => failure(400, { code: 'otp_invalid', attempts_left: 2 }));
    const root = await toCodeStep();
    enterCode(root);
    await press(root, 'Verify');
    expect(texts(root)).toContain('That code is not right. Attempts left: 2.');
    expect(posts('/auth/signup')).toHaveLength(0);
  });

  it.each([
    ['otp_invalid', 'That code is not right. Check it and try again.'],
    ['otp_expired', 'That code has expired. Ask for a new one.'],
    ['otp_attempts_exceeded', 'Too many wrong codes. Ask for a new one.'],
  ])('verify 400 %s shows its label, not server text', async (code, label) => {
    route('/auth/phone/otp/verify').mockImplementation(() => failure(400, { code, detail: 'server words' }));
    const root = await toCodeStep();
    enterCode(root);
    await press(root, 'Verify');
    expect(texts(root)).toContain(label);
    expect(texts(root)).not.toContain('server words');
  });

  it('the Resend button counts down from resend_after and resends only at zero', async () => {
    jest.useFakeTimers();
    const root = await toCodeStep();
    expect(texts(root)).toContain('Resend code (60s)');
    await act(async () => {
      jest.advanceTimersByTime(5000);
    });
    expect(texts(root)).toContain('Resend code (55s)');
    expect(pressableWithText(root, 'Resend code (55s)').props.disabled).toBe(true);
    await act(async () => {
      jest.advanceTimersByTime(55000);
    });
    expect(texts(root)).toContain('Resend code');
    route('/auth/phone/otp/send').mockResolvedValue({ data: { challenge_id: 'ch-2', expires_in: 300, resend_after: 30 } });
    await press(root, 'Resend code');
    expect(posts('/auth/phone/otp/send')).toHaveLength(2);
    expect(texts(root)).toEqual(expect.arrayContaining(['Resend code (30s)', 'We sent a new code on WhatsApp.']));
    // The new code is checked against the new challenge.
    enterCode(root);
    await press(root, 'Verify');
    expect((posts('/auth/phone/otp/verify')[0][1] as { challenge_id: string }).challenge_id).toBe('ch-2');
  });

  it('send 429 otp_cooldown shows the seconds; a plain 429 and otp_rate_limited and 503 show their labels', async () => {
    route('/auth/phone/otp/send').mockImplementationOnce(() => failure(429, { code: 'otp_cooldown', retry_after_seconds: 42 }));
    const root = await toCodeStep();
    expect(texts(root)).toContain('Please wait 42 seconds before asking for another code.');
    expect(texts(root)).not.toContain('Verify your number');
    route('/auth/phone/otp/send').mockImplementationOnce(() => failure(429, { code: 'otp_rate_limited', retry_after_seconds: 900 }));
    await press(root, 'Register');
    expect(texts(root)).toContain('Too many codes asked for. Please try again later.');
    route('/auth/phone/otp/send').mockImplementationOnce(() => failure(429, { error: 'rate limit' }));
    await press(root, 'Register');
    expect(texts(root)).toContain('Too many attempts. Try again in a minute.');
    route('/auth/phone/otp/send').mockImplementationOnce(() => failure(503, { code: 'otp_send_failed' }));
    await press(root, 'Register');
    expect(texts(root)).toContain('We could not send the code. Please try again.');
  });

  it('Back drops the code step and the proof: the next Register asks for a new code', async () => {
    const root = await toCodeStep();
    enterCode(root);
    route('/auth/signup').mockImplementationOnce(() => failure(409, { detail: 'x' }));
    await press(root, 'Verify');
    // Sign-up failed after a good code: back on the form; a retry reuses the proof (no new send).
    expect(texts(root)).not.toContain('Verify your number');
    await press(root, 'Register');
    expect(posts('/auth/phone/otp/send')).toHaveLength(1);
    expect((posts('/auth/signup')[1][1] as Record<string, unknown>).mobile_verification).toBe(PROOF);
  });

  it('going Back from the code step drops the proof (a later Register sends a new code)', async () => {
    const root = await toCodeStep();
    await press(root, 'Back');
    expect(texts(root)).not.toContain('Verify your number');
    await press(root, 'Register');
    expect(posts('/auth/phone/otp/send')).toHaveLength(2);
  });

  it('editing the number drops the proof', async () => {
    const root = await toCodeStep();
    enterCode(root);
    route('/auth/signup').mockImplementationOnce(() => failure(500, {}));
    await press(root, 'Verify');
    act(() => input(root, 'Mobile number').props.onChangeText('81234567'));
    await press(root, 'Register');
    expect(posts('/auth/phone/otp/send')).toHaveLength(2);
  });

  it('a 422 "verification is required" on sign-up drops the proof and asks for a new code next time', async () => {
    const root = await toCodeStep();
    enterCode(root);
    route('/auth/signup').mockImplementationOnce(() => failure(422, { detail: 'Mobile number verification is required' }));
    await press(root, 'Verify');
    expect(texts(root)).toContain('Verify your mobile number to continue.');
    await press(root, 'Register');
    expect(posts('/auth/phone/otp/send')).toHaveLength(2);
  });

  it('never logs the number, the code or the proof', async () => {
    const root = await toCodeStep();
    enterCode(root);
    await press(root, 'Verify');
    const logged = JSON.stringify(logs.flatMap(spy => spy.mock.calls));
    [NUMBER, CODE, PROOF].forEach(secret => expect(logged).not.toContain(secret));
  });
});

describe('Complete your account', () => {
  const completeSignup = jest.fn();
  const cancelPendingSignup = jest.fn();
  const mount = (): Promise<Instance> =>
    renderAsync(
      <AuthContext.Provider value={{ pendingSignup: { email: 'ann@example.com', display_name: 'Ann Lee' }, completeSignup, cancelPendingSignup } as never}>
        <CompleteAccountScreen {...({ navigation: { replace }, route: {} } as unknown as React.ComponentProps<typeof CompleteAccountScreen>)} />
      </AuthContext.Provider>,
    );
  const enter = (root: Instance): void => {
    act(() => input(root, 'Mobile number').props.onChangeText(NUMBER));
  };

  beforeEach(() => {
    completeSignup.mockReset().mockResolvedValue(undefined);
  });

  it('phone_verification off: Continue behaves as in Task 3.4 (two arguments, no send)', async () => {
    serveConsent({ phone_verification: false });
    const root = await mount();
    enter(root);
    await press(root, 'Continue');
    expect(posts('/auth/phone/otp/send')).toHaveLength(0);
    expect(completeSignup).toHaveBeenCalledWith(E164, 'consent-v1');
  });

  it('send 404: carries on without the step', async () => {
    route('/auth/phone/otp/send').mockImplementation(() => failure(404, {}));
    const root = await mount();
    enter(root);
    await press(root, 'Continue');
    expect(completeSignup).toHaveBeenCalledWith(E164, 'consent-v1');
  });

  it('shows the code step, then complete-signup carries the proof', async () => {
    const root = await mount();
    enter(root);
    await press(root, 'Continue');
    expect(texts(root)).toContain('Verify your number');
    expect(completeSignup).not.toHaveBeenCalled();
    act(() => input(root, '6-digit code').props.onChangeText(CODE));
    await press(root, 'Verify');
    expect(completeSignup).toHaveBeenCalledWith(E164, 'consent-v1', PROOF);
  });

  it('a 422 "verification is required" keeps the ticket, drops the proof and asks for a new code', async () => {
    const root = await mount();
    enter(root);
    await press(root, 'Continue');
    act(() => input(root, '6-digit code').props.onChangeText(CODE));
    completeSignup.mockRejectedValueOnce({ response: { status: 422, data: { detail: 'Mobile number verification is required' } } });
    await press(root, 'Verify');
    expect(texts(root)).toContain('Verify your mobile number to continue.');
    expect(cancelPendingSignup).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
    await press(root, 'Continue');
    expect(posts('/auth/phone/otp/send')).toHaveLength(2);
  });

  it('never logs the number, the code or the proof', async () => {
    const root = await mount();
    enter(root);
    await press(root, 'Continue');
    act(() => input(root, '6-digit code').props.onChangeText(CODE));
    await press(root, 'Verify');
    const logged = JSON.stringify(logs.flatMap(spy => spy.mock.calls));
    [NUMBER, CODE, PROOF].forEach(secret => expect(logged).not.toContain(secret));
  });
});
