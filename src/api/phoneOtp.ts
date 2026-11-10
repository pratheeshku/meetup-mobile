/**
 * WhatsApp code for the mobile number at sign-up (DES-MEETUP-ADDENDUM-nov10-enhancements NE-01a, AD-4; backend Task 1.7). Unauthenticated calls.
 * - `POST /auth/phone/otp/send {mobile_number}` -> `{challenge_id, expires_in, resend_after}`
 * - `POST /auth/phone/otp/verify {challenge_id, code}` -> `{verified, phone_proof, proof_expires_in}`
 * The number, the code and the proof are PII / secrets: nothing here logs them, and the error reader never returns them.
 */
import { apiClient } from './client';

interface RequestOptions {
  correlationId?: string;
}

export interface OtpChallenge {
  challenge_id: string;
  expires_in: number;
  /** Seconds before another code may be asked for. */
  resend_after: number;
}

export interface OtpProof {
  phone_proof: string;
  /** Seconds the proof stays good. */
  proof_expires_in: number;
}

export async function sendPhoneOtp(mobileNumber: string, options?: RequestOptions): Promise<OtpChallenge> {
  const { data } = await apiClient.post<OtpChallenge>(
    '/auth/phone/otp/send',
    { mobile_number: mobileNumber },
    { correlationId: options?.correlationId },
  );
  return { challenge_id: data.challenge_id, expires_in: data.expires_in, resend_after: data.resend_after };
}

export async function verifyPhoneOtp(challengeId: string, code: string, options?: RequestOptions): Promise<OtpProof> {
  const { data } = await apiClient.post<OtpProof & { verified?: boolean }>(
    '/auth/phone/otp/verify',
    { challenge_id: challengeId, code },
    { correlationId: options?.correlationId },
  );
  if (data.verified === false || typeof data.phone_proof !== 'string' || !data.phone_proof) {
    throw new Error('not verified');
  }
  return { phone_proof: data.phone_proof, proof_expires_in: data.proof_expires_in };
}

export type OtpErrorCode = 'otp_invalid' | 'otp_expired' | 'otp_attempts_exceeded' | 'otp_cooldown' | 'otp_rate_limited' | 'otp_send_failed';

export interface OtpFailure {
  status: number | null;
  /** The server's code, when it sent a known one. */
  code: OtpErrorCode | null;
  retryAfterSeconds: number | null;
  attemptsLeft: number | null;
}

const KNOWN: ReadonlySet<string> = new Set(['otp_invalid', 'otp_expired', 'otp_attempts_exceeded', 'otp_cooldown', 'otp_rate_limited', 'otp_send_failed']);

/** Reads status and code only (the body may carry `code` at the top or under `detail`); never reads or returns a submitted value. */
export function readOtpFailure(error: unknown): OtpFailure {
  const response = (error as { response?: { status?: number; data?: Record<string, unknown> } } | null)?.response;
  const body = response?.data ?? {};
  const detail = body.detail && typeof body.detail === 'object' ? (body.detail as Record<string, unknown>) : {};
  const pick = (key: string): unknown => (key in body ? body[key] : detail[key]);
  const code = pick('code');
  const retry = pick('retry_after_seconds');
  const left = pick('attempts_left');
  return {
    status: typeof response?.status === 'number' ? response.status : null,
    code: typeof code === 'string' && KNOWN.has(code) ? (code as OtpErrorCode) : null,
    retryAfterSeconds: typeof retry === 'number' && retry > 0 ? Math.ceil(retry) : null,
    attemptsLeft: typeof left === 'number' && left >= 0 ? left : null,
  };
}
