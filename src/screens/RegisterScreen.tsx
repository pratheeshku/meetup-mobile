/**
 * Registration screen (DES-MEETUP-MOBILE.md §4.2; R-012;
 * DES-MEETUP-ADDENDUM-email-auth AD-5).
 *
 * Password lives only in this component's local state for the duration
 * of the active input session (R-111, P10). Exactly four fields are
 * sent: email, password, display_name, nickname. No mobile number field.
 */
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AxiosError } from 'axios';

import { signup } from '../auth/emailAuth';
import Button from '../components/Button';
import InlineError from '../components/InlineError';
import TextField from '../components/TextField';
import TextLink from '../components/TextLink';
import { colors, spacing, typography } from '../theme/tokens';
import { isNetworkError } from '../utils/networkError';
import type { AuthStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<AuthStackParamList, 'Register'>;

export default function RegisterScreen({ navigation }: Props): React.JSX.Element {
  const [nickname, setNickname] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isEmailRegistered, setIsEmailRegistered] = useState(false);
  const [networkError, setNetworkError] = useState<string | null>(null);

  const handleRegister = async (): Promise<void> => {
    setError(null);
    setIsEmailRegistered(false);
    setNetworkError(null);

    const trimmedNickname = nickname.trim();
    const trimmedDisplayName = displayName.trim();
    const trimmedEmail = email.trim();

    if (!trimmedNickname || !trimmedDisplayName || !trimmedEmail || !password) {
      setError('Fill in every field.');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    setIsSubmitting(true);
    try {
      await signup({
        email: trimmedEmail,
        password,
        display_name: trimmedDisplayName,
        nickname: trimmedNickname,
      });
      navigation.navigate('Verify', { email: trimmedEmail });
    } catch (err) {
      if (isNetworkError(err)) {
        setNetworkError('Unable to connect to server.');
        return;
      }

      const axiosErr = err as AxiosError<{ detail?: string | Array<{ msg?: string }> }>;
      const detail = axiosErr.response?.data?.detail;

      let detailString = '';
      if (typeof detail === 'string') {
        detailString = detail;
      } else if (Array.isArray(detail)) {
        detailString = detail.map(item => item.msg ?? '').join(' ');
      }

      if (detailString.includes('Email already registered')) {
        setError('Email already registered');
        setIsEmailRegistered(true);
      } else if (detailString.includes('Nickname already taken')) {
        setError('Nickname already taken');
      } else if (detailString.includes('Password must be at least 8 characters')) {
        setError('Password must be at least 8 characters long');
      } else if (detailString) {
        setError(detailString);
      } else {
        setError('Registration failed. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Register</Text>

      <TextField
        style={styles.input}
        placeholder="Nickname"
        autoCapitalize="none"
        value={nickname}
        onChangeText={setNickname}
        editable={!isSubmitting}
      />
      <TextField
        style={styles.input}
        placeholder="Display Name"
        value={displayName}
        onChangeText={setDisplayName}
        editable={!isSubmitting}
      />
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

      <View style={styles.passwordRow}>
        <TextField
          style={styles.passwordField}
          placeholder="Password"
          secureTextEntry={!showPassword}
          autoComplete="new-password"
          value={password}
          onChangeText={setPassword}
          editable={!isSubmitting}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
          onPress={() => setShowPassword(prev => !prev)}
          style={styles.showHideButton}
        >
          <Text style={styles.showHideText}>{showPassword ? 'Hide' : 'Show'}</Text>
        </Pressable>
      </View>

      {networkError ? (
        <InlineError
          message={networkError}
          onRetry={handleRegister}
          retryLabel="Retry"
        />
      ) : error ? (
        <Text style={styles.error}>{error}</Text>
      ) : null}

      {isEmailRegistered ? (
        <View style={styles.inlineActions}>
          <TextLink
            label="Sign in"
            onPress={() => navigation.navigate('Login')}
            style={styles.actionLink}
          />
          <TextLink
            label="Verify your email"
            onPress={() => navigation.navigate('Verify', { email: email.trim() })}
            style={styles.actionLink}
          />
        </View>
      ) : null}

      <Button
        label="Register"
        onPress={handleRegister}
        loading={isSubmitting}
        style={styles.button}
      />

      <TextLink
        label="Already have an account? Sign In"
        onPress={() => navigation.navigate('Login')}
        disabled={isSubmitting}
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
    marginBottom: spacing.lg,
    textAlign: 'center',
  },
  input: { marginBottom: spacing.md },
  passwordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  passwordField: {
    flex: 1,
    marginRight: spacing.sm,
  },
  showHideButton: {
    minHeight: 44,
    minWidth: 44,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
  },
  showHideText: {
    ...typography.bodyBold,
    color: colors.primary,
  },
  error: {
    ...typography.body,
    color: colors.error,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  inlineActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.lg,
    marginBottom: spacing.md,
  },
  actionLink: {
    minHeight: 44,
    justifyContent: 'center',
  },
  button: { marginBottom: spacing.md },
  link: { alignSelf: 'center', minHeight: 44, justifyContent: 'center' },
});
