/**
 * Sign In screen (DES-MEETUP-MOBILE.md §4.2; R-010, R-012;
 * DES-MEETUP-ADDENDUM-email-auth AD-5).
 *
 * Password lives only in this component's local state for the duration
 * of the active input session — never lifted into context, storage, or
 * logs (R-111, P10).
 *
 * Error handling:
 * - 429: "Too many attempts. Try again in a minute." (inline error)
 * - 5xx: "Something went wrong. Try again." with Retry button
 * - Network error: "Unable to connect to server." with Retry button
 * - 403 {"detail": "Email not verified"}: routes to Verify screen with email and explanation
 * - 401 or other 4xx: "Invalid email or password."
 */
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { GoogleSigninButton } from '@react-native-google-signin/google-signin';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AxiosError } from 'axios';

import { useAuth } from '../auth/AuthContext';
import { GoogleSignInCancelledError } from '../auth/googleAuth';
import { isGoogleSignInAvailable } from '../auth/googleSupport';
import { SESSION_EXPIRED_MESSAGE } from '../auth/messages';
import Button from '../components/Button';
import InlineError from '../components/InlineError';
import KeyboardAwareScreen from '../components/KeyboardAwareScreen';
import TextField from '../components/TextField';
import TextLink from '../components/TextLink';
import { useFieldChain } from '../hooks/useFieldChain';
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
import { useT } from '../labels/LabelsContext';

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;

export default function LoginScreen({ navigation, route }: Props): React.JSX.Element {
  const { signInWithGoogle, signInWithEmail, sessionExpired } = useAuth();
  const t = useT();

  const [email, setEmail] = useState(route?.params?.email ?? '');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryError, setRetryError] = useState<string | null>(null);
  const [retryAction, setRetryAction] = useState<(() => Promise<void>) | null>(null);

  useEffect(() => {
    if (route?.params?.email) {
      setEmail(route.params.email);
    }
  }, [route?.params?.email]);

  const chain = useFieldChain(['email', 'password']);

  const handleGoogleSignIn = async (): Promise<void> => {
    setError(null);
    setRetryError(null);
    setRetryAction(null);
    setIsSubmitting(true);
    try {
      await signInWithGoogle();
    } catch (err) {
      if (!(err instanceof GoogleSignInCancelledError)) {
        if (isNetworkError(err)) {
          setRetryError(t(NETWORK_ERROR_MESSAGE));
          setRetryAction(() => handleGoogleSignIn);
        } else if (isRateLimitError(err)) {
          setError(t(RATE_LIMIT_MESSAGE));
        } else if (isServerError(err)) {
          setRetryError(t(SERVER_ERROR_MESSAGE));
          setRetryAction(() => handleGoogleSignIn);
        } else {
          setError(t('mob.login.google_failed'));
        }
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEmailSignIn = async (): Promise<void> => {
    setError(null);
    setRetryError(null);
    setRetryAction(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setError(t('mob.login.missing_fields'));
      chain.focus(trimmedEmail ? 'password' : 'email');
      return;
    }

    setIsSubmitting(true);
    try {
      await signInWithEmail(trimmedEmail, password);
    } catch (err) {
      if (isNetworkError(err)) {
        setRetryError(t(NETWORK_ERROR_MESSAGE));
        setRetryAction(() => handleEmailSignIn);
        return;
      }

      if (isRateLimitError(err)) {
        setError(t(RATE_LIMIT_MESSAGE));
        return;
      }

      if (isServerError(err)) {
        setRetryError(t(SERVER_ERROR_MESSAGE));
        setRetryAction(() => handleEmailSignIn);
        return;
      }

      const axiosErr = err as AxiosError<{ detail?: string }>;
      const status = axiosErr.response?.status;
      const detail = axiosErr.response?.data?.detail;

      if (status === 403 && typeof detail === 'string' && detail.includes('Email not verified')) {
        navigation.navigate('Verify', {
          email: trimmedEmail,
          explanation: t('mob.login.verify_first'),
        });
        return;
      }

      if (status === 401) {
        setError(t('mob.login.invalid_credentials'));
        return;
      }

      // Enumeration-safe (§4.2): never reveal whether the email or the
      // password was the incorrect part.
      setError(t('mob.login.invalid_credentials'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const successMessage = route?.params?.successMessage;

  return (
    <KeyboardAwareScreen contentContainerStyle={styles.container}>
      <Text style={styles.title}>{t('mob.login.title')}</Text>

      {successMessage ? <Text style={styles.success}>{successMessage}</Text> : null}
      {sessionExpired ? <Text style={styles.notice}>{t(SESSION_EXPIRED_MESSAGE)}</Text> : null}

      {isGoogleSignInAvailable() ? (
        <GoogleSigninButton
          size={GoogleSigninButton.Size.Wide}
          color={GoogleSigninButton.Color.Dark}
          style={styles.googleButton}
          disabled={isSubmitting}
          onPress={handleGoogleSignIn}
        />
      ) : null}

      <TextField
        style={styles.input}
        {...chain.props('email')}
        placeholder={t('mob.auth.email_placeholder')}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
        editable={!isSubmitting}
      />
      <TextField
        style={styles.input}
        {...chain.props('password')}
        placeholder={t('mob.auth.password_placeholder')}
        secureTextEntry
        autoComplete="password"
        value={password}
        onChangeText={setPassword}
        editable={!isSubmitting}
      />

      <View style={styles.forgotPasswordRow}>
        <TextLink
          label={t('mob.login.forgot_password')}
          onPress={() =>
            navigation.navigate('ForgotPassword', {
              email: email.trim() || undefined,
            })
          }
          disabled={isSubmitting}
          style={styles.forgotPasswordLink}
        />
      </View>

      {retryError && retryAction ? (
        <InlineError
          message={retryError}
          onRetry={retryAction}
          retryLabel={t('mob.common.retry')}
        />
      ) : error ? (
        <Text style={styles.error}>{error}</Text>
      ) : null}

      <Button
        label={t('mob.login.submit')}
        onPress={handleEmailSignIn}
        loading={isSubmitting}
        style={styles.button}
      />

      <TextLink
        label={t('mob.login.register_link')}
        onPress={() => navigation.navigate('Register')}
        disabled={isSubmitting}
        style={styles.link}
      />
    </KeyboardAwareScreen>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, justifyContent: 'center', padding: spacing.lg },
  title: {
    ...typography.h1,
    color: colors.textPrimary,
    marginBottom: spacing.lg,
    textAlign: 'center',
  },
  success: {
    ...typography.body,
    color: colors.success,
    marginBottom: spacing.lg,
    textAlign: 'center',
  },
  notice: {
    ...typography.body,
    color: colors.textPrimary,
    marginBottom: spacing.lg,
    textAlign: 'center',
  },
  googleButton: { alignSelf: 'center', marginBottom: spacing.lg },
  input: { marginBottom: spacing.md },
  forgotPasswordRow: {
    alignItems: 'flex-end',
    marginBottom: spacing.md,
  },
  forgotPasswordLink: {
    minHeight: 44,
    justifyContent: 'center',
  },
  error: {
    ...typography.body,
    color: colors.error,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  button: { marginBottom: spacing.md },
  link: { alignSelf: 'center', minHeight: 44, justifyContent: 'center' },
});
