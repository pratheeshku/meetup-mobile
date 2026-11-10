/** WhatsApp code clients (Task 1.7 contract): paths, bodies, result mapping and the error reader. */
import { apiClient } from '../client';
import { readOtpFailure, sendPhoneOtp, verifyPhoneOtp } from '../phoneOtp';

jest.mock('../client', () => ({ apiClient: { post: jest.fn() } }));
const post = apiClient.post as jest.Mock;

beforeEach(() => post.mockReset());

it('send posts the number and returns challenge_id, expires_in and resend_after', async () => {
  post.mockResolvedValueOnce({ data: { challenge_id: 'c1', expires_in: 300, resend_after: 60, extra: 'x' } });
  await expect(sendPhoneOtp('+6591234567', { correlationId: 'k' })).resolves.toEqual({ challenge_id: 'c1', expires_in: 300, resend_after: 60 });
  expect(post).toHaveBeenCalledWith('/auth/phone/otp/send', { mobile_number: '+6591234567' }, { correlationId: 'k' });
});

it('verify posts challenge_id and the code and returns the proof', async () => {
  post.mockResolvedValueOnce({ data: { verified: true, phone_proof: 'p1', proof_expires_in: 900 } });
  await expect(verifyPhoneOtp('c1', '123456', { correlationId: 'k' })).resolves.toEqual({ phone_proof: 'p1', proof_expires_in: 900 });
  expect(post).toHaveBeenCalledWith('/auth/phone/otp/verify', { challenge_id: 'c1', code: '123456' }, { correlationId: 'k' });
});

it('verify without a proof is a failure, never a verified state', async () => {
  post.mockResolvedValueOnce({ data: { verified: true } });
  await expect(verifyPhoneOtp('c1', '123456')).rejects.toThrow();
});

describe('readOtpFailure', () => {
  it('reads status, code, retry_after_seconds and attempts_left from the body or from detail', () => {
    expect(readOtpFailure({ response: { status: 429, data: { code: 'otp_cooldown', retry_after_seconds: 41.2 } } })).toEqual({
      status: 429,
      code: 'otp_cooldown',
      retryAfterSeconds: 42,
      attemptsLeft: null,
    });
    expect(readOtpFailure({ response: { status: 400, data: { detail: { code: 'otp_invalid', attempts_left: 1 } } } })).toMatchObject({
      code: 'otp_invalid',
      attemptsLeft: 1,
    });
  });

  it('ignores an unknown code and a missing response', () => {
    expect(readOtpFailure({ response: { status: 400, data: { code: 'something_else' } } }).code).toBeNull();
    expect(readOtpFailure(new Error('x'))).toEqual({ status: null, code: null, retryAfterSeconds: null, attemptsLeft: null });
  });
});
