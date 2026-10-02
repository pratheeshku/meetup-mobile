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
import { StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { resendVerification, verifyEmail } from '../auth/emailAuth';
import Button from '../components/Button';
import InlineError from '../components/InlineError';
import TextField from '../components/TextField';
import TextLink from '../components/TextLink';
import { colors, spacing, typography } from '../theme/tokens';
import {
  isNetworkError,
  isRateLimitError,
  isServerError,
  NETWORK_ERROR_MESSAGE,
  RATE_LIMIT_MESSAGE,
  SERVER_ERROR_MESSAGE,
} from '../utils/networkError';
import type { AuthStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<AuthStackParamList, 'Verify'>;

export default function VerifyScreen({ navigation, route }: Props): React.JSX.Element {
  const { email, explanation } = route.params;

  const [code, setCode] = useState('');
  const [cooldown, setCooldown] = useState(0);
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
      setError("That code didn't work. Check it or request a new one.");
      return;
    }

    setIsVerifying(true);
    try {
      await verifyEmail(email, trimmedCode);
      navigation.navigate('Login', { successMessage: 'Email verified. Sign in.' });
    } catch (err) {
      if (isNetworkError(err)) {
        setRetryError(NETWORK_ERROR_MESSAGE);
        setRetryAction(() => handleVerify);
      } else if (isRateLimitError(err)) {
        setError(RATE_LIMIT_MESSAGE);
      } else if (isServerError(err)) {
        setRetryError(SERVER_ERROR_MESSAGE);
        setRetryAction(() => handleVerify);
      } else {
        // Every other failure comes back as 400 "Verification failed"
        setError("That code didn't work. Check it or request a new one.");
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
      setInfoMessage('Verification code resent.');
    } catch (err) {
      if (isNetworkError(err)) {
        setRetryError(NETWORK_ERROR_MESSAGE);
        setRetryAction(() => handleResend);
      } else if (isRateLimitError(err)) {
        setError(RATE_LIMIT_MESSAGE);
      } else if (isServerError(err)) {
        setRetryError(SERVER_ERROR_MESSAGE);
        setRetryAction(() => handleResend);
      } else {
        setError('Failed to resend verification code. Please try again.');
      }
      // Note: Cooldown does NOT start on failure (§7)
    } finally {
      setIsResending(false);
    }
  };

  const resendDisabled = cooldown > 0 || isResending || isVerifying;
  const resendLabel = cooldown > 0 ? `Resend (${cooldown}s)` : 'Resend';

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Verify Email</Text>

      {explanation ? <Text style={styles.explanation}>{explanation}</Text> : null}

      <Text style={styles.instructions}>
        Enter the 6-digit code sent to{'\n'}
        <Text style={styles.emailHighlight}>{email}</Text>
      </Text>

      <TextField
        style={styles.input}
        placeholder="6-digit code"
        autoCapitalize="none"
        keyboardType="number-pad"
        maxLength={6}
        value={code}
        onChangeText={setCode}
        editable={!isVerifying && !isResending}
      />

      {retryError && retryAction ? (
        <InlineError
          message={retryError}
          onRetry={retryAction}
          retryLabel="Retry"
        />
      ) : error ? (
        <Text style={styles.error}>{error}</Text>
      ) : null}

      {infoMessage ? <Text style={styles.info}>{infoMessage}</Text> : null}

      <Button
        label="Verify"
        onPress={handleVerify}
        loading={isVerifying}
        disabled={isResending}
        style={styles.button}
      />

      <Button
        label={resendLabel}
        variant="secondary"
        onPress={handleResend}
        loading={isResending}
        disabled={resendDisabled}
        style={styles.button}
      />

      <TextLink
        label="Back"
        onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Login'))}
        disabled={isVerifying || isResending}
        style={styles.link}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: spacing.lg },
  title: {
    ...typography.h1,
    color: colors.textPrimary,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  explanation: {
    ...typography.body,
    color: colors.textPrimary,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  instructions: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
    textAlign: 'center',
  },
  emailHighlight: {
    ...typography.bodyBold,
    color: colors.textPrimary,
  },
  input: { marginBottom: spacing.md, textAlign: 'center', letterSpacing: 4 },
  error: {
    ...typography.body,
    color: colors.error,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  info: {
    ...typography.body,
    color: colors.success,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  button: { marginBottom: spacing.md },
  link: { alignSelf: 'center', minHeight: 44, justifyContent: 'center' },
});
