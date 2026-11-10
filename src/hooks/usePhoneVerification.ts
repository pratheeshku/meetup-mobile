/**
 * The WhatsApp code step of sign-up (nov10-enhancements NE-01a, AD-4; backend Task 1.7), shared by Register and Complete your account.
 *
 *   begin(e164)  -> send a code. `code`: show the step. `skip`: the server has no verification (404), carry on as without it.
 *                   `error`: a label for the form (cooldown, rate limit, invalid number, ...).
 *   verify()     -> check the 6 digits; on success the proof is kept in memory and `onVerified(proof)` runs (the screen then signs up).
 *   resend()     -> a new code, with the countdown from `resend_after` (or the server's `retry_after_seconds`).
 *   leaveStep()  -> back to the form, keeping a good proof (a failed sign-up retries without a new code).
 *   back()/clearProof() -> drop the proof too.
 *
 * The `phone_proof` lives in a ref and a timer only: never state, storage, Keychain, route params or logs; it is dropped on use, on going back, on
 * expiry (`proof_expires_in`) and on unmount. The number and the code are never logged and never put in a message. One correlation id per tap.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

import { withCorrelationId } from '../api/correlationId';
import { readOtpFailure, sendPhoneOtp, verifyPhoneOtp } from '../api/phoneOtp';
import { useT } from '../labels/LabelsContext';
import {
  isNetworkError,
  isRateLimitError,
  isServerError,
  NETWORK_ERROR_MESSAGE,
  RATE_LIMIT_MESSAGE,
  SERVER_ERROR_MESSAGE,
} from '../utils/networkError';

export type BeginResult = { kind: 'code' } | { kind: 'skip' } | { kind: 'error'; message: string };

export interface PhoneVerification {
  /** The code step is showing. */
  step: boolean;
  /** The number the code went to (E.164), for the step's highlighted line. */
  target: string;
  code: string;
  setCode: (value: string) => void;
  cooldown: number;
  isVerifying: boolean;
  isResending: boolean;
  error: string | null;
  info: string | null;
  retryError: string | null;
  retryAction: (() => Promise<void>) | null;
  focusSignal: number;
  begin: (e164: string) => Promise<BeginResult>;
  verify: () => Promise<void>;
  resend: () => Promise<void>;
  leaveStep: () => void;
  back: () => void;
  /** The proof for exactly this number, or null (none, another number, or expired). */
  proofFor: (e164: string) => string | null;
  clearProof: () => void;
}

export function usePhoneVerification(onVerified: (proof: string) => void): PhoneVerification {
  const t = useT();
  const tRef = useRef(t);
  tRef.current = t;
  const onVerifiedRef = useRef(onVerified);
  onVerifiedRef.current = onVerified;

  const [step, setStep] = useState(false);
  const [target, setTarget] = useState('');
  const [code, setCode] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [retryError, setRetryError] = useState<string | null>(null);
  const [retryAction, setRetryAction] = useState<(() => Promise<void>) | null>(null);
  const [focusSignal, setFocusSignal] = useState(0);

  const challengeRef = useRef<string | null>(null);
  const numberRef = useRef<string | null>(null);
  const proofRef = useRef<{ number: string; proof: string } | null>(null);
  const expiryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (expiryTimer.current) {
        clearTimeout(expiryTimer.current);
      }
      proofRef.current = null;
      challengeRef.current = null;
      numberRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (cooldown <= 0) {
      return undefined;
    }
    const timer = setInterval(() => setCooldown(previous => (previous <= 1 ? 0 : previous - 1)), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const clearProof = useCallback(() => {
    if (expiryTimer.current) {
      clearTimeout(expiryTimer.current);
      expiryTimer.current = null;
    }
    proofRef.current = null;
  }, []);

  const resetMessages = (): void => {
    setError(null);
    setInfo(null);
    setRetryError(null);
    setRetryAction(null);
  };

  /** A send failure as a label (before and during the step). */
  const sendFailureLabel = (failure: unknown): string => {
    const label = tRef.current;
    const read = readOtpFailure(failure);
    if (isNetworkError(failure)) {
      return label(NETWORK_ERROR_MESSAGE);
    }
    if (read.status === 422) {
      return label('mob.mobile_number.invalid');
    }
    if (read.code === 'otp_cooldown') {
      return label('mob.otp.cooldown', { seconds: read.retryAfterSeconds ?? 60 });
    }
    if (read.code === 'otp_rate_limited') {
      return label('mob.otp.rate_limited');
    }
    if (isRateLimitError(failure)) {
      return label(RATE_LIMIT_MESSAGE);
    }
    if (read.code === 'otp_send_failed' || read.status === 503) {
      return label('mob.otp.send_failed');
    }
    if (isServerError(failure)) {
      return label(SERVER_ERROR_MESSAGE);
    }
    return label('mob.otp.send_failed');
  };

  const begin = useCallback(async (e164: string): Promise<BeginResult> => {
    try {
      const challenge = await withCorrelationId(correlationId => sendPhoneOtp(e164, { correlationId }));
      if (!mounted.current) {
        return { kind: 'skip' };
      }
      challengeRef.current = challenge.challenge_id;
      numberRef.current = e164;
      setTarget(e164);
      setCode('');
      setError(null);
      setInfo(null);
      setRetryError(null);
      setRetryAction(null);
      setCooldown(challenge.resend_after);
      setStep(true);
      return { kind: 'code' };
    } catch (failure) {
      // 404: verification does not exist on this server: carry on without the step.
      if (readOtpFailure(failure).status === 404) {
        return { kind: 'skip' };
      }
      return { kind: 'error', message: sendFailureLabel(failure) };
    }
  }, []);

  const verify = useCallback(async (): Promise<void> => {
    resetMessages();
    const trimmed = code.trim();
    if (!/^\d{6}$/.test(trimmed) || !challengeRef.current) {
      setError(tRef.current('mob.otp.bad_code'));
      setFocusSignal(value => value + 1);
      return;
    }
    const challengeId = challengeRef.current;
    setIsVerifying(true);
    try {
      const result = await withCorrelationId(correlationId => verifyPhoneOtp(challengeId, trimmed, { correlationId }));
      if (!mounted.current) {
        return;
      }
      const number = numberRef.current;
      if (number) {
        clearProof();
        proofRef.current = { number, proof: result.phone_proof };
        if (result.proof_expires_in > 0) {
          expiryTimer.current = setTimeout(() => {
            proofRef.current = null;
            expiryTimer.current = null;
          }, result.proof_expires_in * 1000);
        }
      }
      challengeRef.current = null;
      onVerifiedRef.current(result.phone_proof);
    } catch (failure) {
      if (!mounted.current) {
        return;
      }
      const read = readOtpFailure(failure);
      const label = tRef.current;
      if (isNetworkError(failure)) {
        setRetryError(label(NETWORK_ERROR_MESSAGE));
        setRetryAction(() => verify);
      } else if (read.code === 'otp_invalid') {
        setError(read.attemptsLeft !== null ? label('mob.otp.invalid_left', { count: read.attemptsLeft }) : label('mob.otp.invalid'));
        setCode('');
        setFocusSignal(value => value + 1);
      } else if (read.code === 'otp_expired') {
        setError(label('mob.otp.expired'));
        setCode('');
        challengeRef.current = null;
      } else if (read.code === 'otp_attempts_exceeded') {
        setError(label('mob.otp.attempts_exceeded'));
        setCode('');
        challengeRef.current = null;
      } else if (isRateLimitError(failure)) {
        setError(label(RATE_LIMIT_MESSAGE));
      } else if (isServerError(failure)) {
        setRetryError(label(SERVER_ERROR_MESSAGE));
        setRetryAction(() => verify);
      } else {
        setError(label('mob.otp.verify_failed'));
      }
    } finally {
      if (mounted.current) {
        setIsVerifying(false);
      }
    }
  }, [code, clearProof]);

  const resend = useCallback(async (): Promise<void> => {
    const number = numberRef.current;
    if (!number || cooldown > 0 || isResending) {
      return;
    }
    resetMessages();
    setIsResending(true);
    try {
      const challenge = await withCorrelationId(correlationId => sendPhoneOtp(number, { correlationId }));
      if (!mounted.current) {
        return;
      }
      challengeRef.current = challenge.challenge_id;
      setCode('');
      setCooldown(challenge.resend_after);
      setInfo(tRef.current('mob.otp.resent'));
    } catch (failure) {
      if (!mounted.current) {
        return;
      }
      const read = readOtpFailure(failure);
      if (read.code === 'otp_cooldown' && read.retryAfterSeconds) {
        setCooldown(read.retryAfterSeconds);
      }
      if (isNetworkError(failure) || isServerError(failure)) {
        setRetryError(sendFailureLabel(failure));
        setRetryAction(() => resend);
      } else {
        setError(sendFailureLabel(failure));
      }
    } finally {
      if (mounted.current) {
        setIsResending(false);
      }
    }
  }, [cooldown, isResending]);

  const leaveStep = useCallback(() => {
    setStep(false);
    setCode('');
    setError(null);
    setInfo(null);
    setRetryError(null);
    setRetryAction(null);
  }, []);

  const back = useCallback(() => {
    clearProof();
    challengeRef.current = null;
    leaveStep();
  }, [clearProof, leaveStep]);

  const proofFor = useCallback((e164: string): string | null => {
    const held = proofRef.current;
    return held && held.number === e164 ? held.proof : null;
  }, []);

  return {
    step,
    target,
    code,
    setCode,
    cooldown,
    isVerifying,
    isResending,
    error,
    info,
    retryError,
    retryAction,
    focusSignal,
    begin,
    verify,
    resend,
    leaveStep,
    back,
    proofFor,
    clearProof,
  };
}
