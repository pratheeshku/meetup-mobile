/**
 * Forgot password screen (DES-MEETUP-ADDENDUM-email-auth AD-5, AD-7).
 *
 * Requests a reset link via POST /auth/reset-password-request.
 * - 200 without a "code" field, and any 4xx other than 429: keep the generic message
 *   and Back to sign in to prevent email enumeration.
 * - 200 with code "oauth_only": displays the backend detail message, Continue with Google
 *   (reusing the login screen's handler), and Back to sign in.
 * - 429 on this screen: show "Too many attempts. Try again in a minute." as an inline error;
 *   do not show the "link sent" text.
 * - 5xx on this screen: show "Something went wrong. Try again." with a Retry button;
 *   do not show the "link sent" text.
 * - Network error: show "Unable to connect to server." with a Retry button;
 *   do not show the "link sent" text.
 */
import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { useAuth } from '../auth/AuthContext';
import { GoogleSignInCancelledError } from '../auth/googleAuth';
import { requestPasswordReset } from '../auth/emailAuth';
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

type Props = NativeStackScreenProps<AuthStackParamList, 'ForgotPassword'>;

const DEFAULT_OAUTH_ONLY_MESSAGE =
  'This account signs in with Google, so it has no password. Use Continue with Google to sign in.';

export default function ForgotPasswordScreen({ navigation, route }: Props): React.JSX.Element {
  const { signInWithGoogle } = useAuth();

  const [email, setEmail] = useState(route.params?.email ?? '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [isOAuthOnly, setIsOAuthOnly] = useState(false);
  const [oauthOnlyMessage, setOAuthOnlyMessage] = useState(DEFAULT_OAUTH_ONLY_MESSAGE);
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [retryError, setRetryError] = useState<string | null>(null);
  const [retryAction, setRetryAction] = useState<(() => Promise<void>) | null>(null);
  const [googleError, setGoogleError] = useState<string | null>(null);

  const handleSubmit = async (): Promise<void> => {
    setInlineError(null);
    setRetryError(null);
    setRetryAction(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setInlineError('Enter your email.');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await requestPasswordReset(trimmedEmail);
      if (response?.code === 'oauth_only') {
        setIsOAuthOnly(true);
        if (response.detail) {
          setOAuthOnlyMessage(response.detail);
        }
      } else {
        setIsOAuthOnly(false);
      }
      setSubmitted(true);
    } catch (err) {
      if (isNetworkError(err)) {
        setRetryError(NETWORK_ERROR_MESSAGE);
        setRetryAction(() => handleSubmit);
      } else if (isRateLimitError(err)) {
        setInlineError(RATE_LIMIT_MESSAGE);
      } else if (isServerError(err)) {
        setRetryError(SERVER_ERROR_MESSAGE);
        setRetryAction(() => handleSubmit);
      } else {
        // Any 4xx other than 429: keep generic message and Back to sign in (email enumeration safe)
        setIsOAuthOnly(false);
        setSubmitted(true);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleSignIn = async (): Promise<void> => {
    setGoogleError(null);
    setRetryError(null);
    setRetryAction(null);
    setIsGoogleSubmitting(true);
    try {
      await signInWithGoogle();
    } catch (err) {
      if (!(err instanceof GoogleSignInCancelledError)) {
        if (isNetworkError(err)) {
          setRetryError(NETWORK_ERROR_MESSAGE);
          setRetryAction(() => handleGoogleSignIn);
        } else if (isRateLimitError(err)) {
          setGoogleError(RATE_LIMIT_MESSAGE);
        } else if (isServerError(err)) {
          setRetryError(SERVER_ERROR_MESSAGE);
          setRetryAction(() => handleGoogleSignIn);
        } else {
          setGoogleError('Google sign-in failed. Please try again.');
        }
      }
    } finally {
      setIsGoogleSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Forgot Password</Text>

      {submitted ? (
        <View style={styles.confirmationContainer}>
          {isOAuthOnly ? (
            <>
              <Text style={styles.confirmationText}>{oauthOnlyMessage}</Text>

              {googleError ? <Text style={styles.error}>{googleError}</Text> : null}

              {retryError && retryAction ? (
                <InlineError
                  message={retryError}
                  onRetry={retryAction}
                  retryLabel="Retry"
                />
              ) : null}

              <Button
                label="Continue with Google"
                onPress={handleGoogleSignIn}
                loading={isGoogleSubmitting}
                style={styles.button}
              />

              <Button
                label="Back to sign in"
                variant="secondary"
                onPress={() => navigation.navigate('Login')}
                disabled={isGoogleSubmitting}
                style={styles.button}
              />
            </>
          ) : (
            <>
              <Text style={styles.confirmationText}>
                If an account exists for that email, we've sent a reset link. Open it on this phone.
              </Text>
              <Button
                label="Back to sign in"
                onPress={() => navigation.navigate('Login')}
                style={styles.button}
              />
            </>
          )}
        </View>
      ) : (
        <>
          <Text style={styles.instructions}>
            Enter your email to receive a password reset link.
          </Text>

          <TextField
            style={styles.input}
            placeholder="Email"
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
            editable={!isSubmitting}
          />

          {inlineError ? <Text style={styles.error}>{inlineError}</Text> : null}

          {retryError && retryAction ? (
            <InlineError
              message={retryError}
              onRetry={retryAction}
              retryLabel="Retry"
            />
          ) : null}

          <Button
            label="Submit"
            onPress={handleSubmit}
            loading={isSubmitting}
            style={styles.button}
          />

          <TextLink
            label="Back to sign in"
            onPress={() => navigation.navigate('Login')}
            disabled={isSubmitting}
            style={styles.link}
          />
        </>
      )}
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
  instructions: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
    textAlign: 'center',
  },
  confirmationContainer: {
    alignItems: 'center',
  },
  confirmationText: {
    ...typography.body,
    color: colors.textPrimary,
    marginBottom: spacing.lg,
    textAlign: 'center',
  },
  input: { marginBottom: spacing.md },
  error: {
    ...typography.body,
    color: colors.error,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  button: { marginBottom: spacing.md, width: '100%' },
  link: { alignSelf: 'center', minHeight: 44, justifyContent: 'center' },
});
