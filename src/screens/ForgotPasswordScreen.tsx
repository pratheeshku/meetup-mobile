/**
 * Forgot password screen (DES-MEETUP-ADDENDUM-email-auth AD-5).
 *
 * Requests a reset link via POST /auth/reset-password-request.
 * Generic outcome: always displays the identical message for any non-network
 * response to prevent user enumeration. The link opens in the phone's browser.
 */
import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { requestPasswordReset } from '../auth/emailAuth';
import Button from '../components/Button';
import InlineError from '../components/InlineError';
import TextField from '../components/TextField';
import TextLink from '../components/TextLink';
import { colors, spacing, typography } from '../theme/tokens';
import { isNetworkError } from '../utils/networkError';
import type { AuthStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<AuthStackParamList, 'ForgotPassword'>;

export default function ForgotPasswordScreen({ navigation, route }: Props): React.JSX.Element {
  const [email, setEmail] = useState(route.params?.email ?? '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [networkError, setNetworkError] = useState<string | null>(null);
  const [clientError, setClientError] = useState<string | null>(null);

  const handleSubmit = async (): Promise<void> => {
    setClientError(null);
    setNetworkError(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setClientError('Enter your email.');
      return;
    }

    setIsSubmitting(true);
    try {
      await requestPasswordReset(trimmedEmail);
      setSubmitted(true);
    } catch (err) {
      if (isNetworkError(err)) {
        setNetworkError('Unable to connect to server.');
      } else {
        // Generic response: show the same message for success, failure,
        // and server errors that are not network errors (AD-5, P9).
        setSubmitted(true);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Forgot Password</Text>

      {submitted ? (
        <View style={styles.confirmationContainer}>
          <Text style={styles.confirmationText}>
            If an account exists for that email, we've sent a reset link. Open it on this phone.
          </Text>
          <Button
            label="Back to sign in"
            onPress={() => navigation.navigate('Login')}
            style={styles.button}
          />
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

          {clientError ? <Text style={styles.error}>{clientError}</Text> : null}

          {networkError ? (
            <InlineError
              message={networkError}
              onRetry={handleSubmit}
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
