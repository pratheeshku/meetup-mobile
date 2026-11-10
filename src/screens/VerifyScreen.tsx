/**
 * Verification screen (DES-MEETUP-ADDENDUM-email-auth AD-5).
 *
 * Shows the email, a 6-digit input, Verify, Resend (with 60-second cooldown),
 * and Back. Never logs codes or tokens (R-111, P10).
 *
 * Error handling:
 * - 429: "Too many attempts. Try again in a minute." (inline error, no cooldown on resend)
 * - 5xx: "Something went wrong. Try again." with Retry button (no cooldown on resend)
 * - Network error: "Unable to connect to server." with Retry button (no cooldown on resend)
 * - Other failure: "That code didn't work. Check it or request a new one." on verify;
 *   "Failed to resend verification code. Please try again." on resend.
 */
import React, { useEffect, useState } from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { resendVerification, verifyEmail } from '../auth/emailAuth';
import VerificationCodeForm from '../components/auth/VerificationCodeForm';
import {
  isNetworkError,
  isRateLimitError,
  isServerError,
  NETWORK_ERROR_MESSAGE,
  RATE_LIMIT_MESSAGE,
  SERVER_ERROR_MESSAGE,
} from '../utils/networkError';
import type { AuthStackParamList } from '../navigation/types';
import { useT } from '../labels/LabelsContext';
import { showCompletion } from '../navigation/showCompletion';

type Props = NativeStackScreenProps<AuthStackParamList, 'Verify'>;

export default function VerifyScreen({ navigation, route }: Props): React.JSX.Element {
  const { email, explanation } = route.params;
  const t = useT();

  const [code, setCode] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const [focusSignal, setFocusSignal] = useState(0);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [retryError, setRetryError] = useState<string | null>(null);
  const [retryAction, setRetryAction] = useState<(() => Promise<void>) | null>(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown(prev => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const handleVerify = async (): Promise<void> => {
    setError(null);
    setInfoMessage(null);
    setRetryError(null);
    setRetryAction(null);

    const trimmedCode = code.trim();
    if (!trimmedCode || trimmedCode.length !== 6) {
      setError(t('mob.verify.bad_code'));
      setFocusSignal(value => value + 1);
      return;
    }

    setIsVerifying(true);
    try {
      await verifyEmail(email, trimmedCode);
      showCompletion({
        flow: 'account_created',
        rows: [
          { label: t('mob.done.f_email'), value: email },
          { label: t('mob.done.f_status'), value: t('mob.done.v_verified') },
        ],
        primary: 'signin',
      });
    } catch (err) {
      if (isNetworkError(err)) {
        setRetryError(t(NETWORK_ERROR_MESSAGE));
        setRetryAction(() => handleVerify);
      } else if (isRateLimitError(err)) {
        setError(t(RATE_LIMIT_MESSAGE));
      } else if (isServerError(err)) {
        setRetryError(t(SERVER_ERROR_MESSAGE));
        setRetryAction(() => handleVerify);
      } else {
        // Every other failure comes back as 400 "Verification failed"
        setError(t('mob.verify.bad_code'));
      }
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResend = async (): Promise<void> => {
    if (cooldown > 0 || isResending) return;

    setError(null);
    setInfoMessage(null);
    setRetryError(null);
    setRetryAction(null);

    setIsResending(true);
    try {
      await resendVerification(email);
      setCooldown(60);
      setInfoMessage(t('mob.verify.resent'));
    } catch (err) {
      if (isNetworkError(err)) {
        setRetryError(t(NETWORK_ERROR_MESSAGE));
        setRetryAction(() => handleResend);
      } else if (isRateLimitError(err)) {
        setError(t(RATE_LIMIT_MESSAGE));
      } else if (isServerError(err)) {
        setRetryError(t(SERVER_ERROR_MESSAGE));
        setRetryAction(() => handleResend);
      } else {
        setError(t('mob.verify.resend_failed'));
      }
      // Note: Cooldown does NOT start on failure (§7)
    } finally {
      setIsResending(false);
    }
  };

  const resendDisabled = cooldown > 0 || isResending || isVerifying;
  const resendLabel =
    cooldown > 0 ? t('mob.verify.resend_cooldown', { seconds: cooldown }) : t('mob.verify.resend');

  return (
    <VerificationCodeForm
      title={t('mob.verify.title')}
      explanation={explanation}
      instructions={t('mob.verify.instructions')}
      target={email}
      codePlaceholder={t('mob.verify.code_placeholder')}
      code={code}
      onChangeCode={setCode}
      verifyLabel={t('mob.verify.submit')}
      onVerify={handleVerify}
      isVerifying={isVerifying}
      resendLabel={resendLabel}
      onResend={handleResend}
      isResending={isResending}
      resendDisabled={resendDisabled}
      backLabel={t('mob.common.back')}
      onBack={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Login'))}
      retryLabel={t('mob.common.retry')}
      error={error}
      info={infoMessage}
      retryError={retryError}
      retryAction={retryAction}
      focusSignal={focusSignal}
    />
  );
}
