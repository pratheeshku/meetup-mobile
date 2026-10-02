/**
 * Registration screen (DES-MEETUP-MOBILE.md §4.2; R-012;
 * DES-MEETUP-ADDENDUM-email-auth AD-5).
 *
 * Password lives only in this component's local state for the duration
 * of the active input session (R-111, P10). Exactly four fields are
 * sent: email, password, display_name, nickname. No mobile number field.
 *
 * Error handling:
 * - 429: "Too many attempts. Try again in a minute." (inline error)
 * - 5xx: "Something went wrong. Try again." with Retry button
 * - Network error: "Unable to connect to server." with Retry button
 * - 400 errors: inline mappings for duplicate email/nickname and password length.
 */
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AxiosError } from 'axios';

import appConfig from '../../config/appConfig.json';
import { signup } from '../auth/emailAuth';
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
import { toHttpsUrl } from '../utils/httpsUrl';
import { openLink } from '../utils/openLink';
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
  const [retryError, setRetryError] = useState<string | null>(null);
  const [retryAction, setRetryAction] = useState<(() => Promise<void>) | null>(null);

  const privacyPolicyUrl = toHttpsUrl(appConfig.privacyPolicyUrl);
  // Terms agreement (email registration only): required only when a valid
  // terms URL is configured; with none, registration is unchanged. The
  // acceptance is not recorded server-side.
  const termsOfUseUrl = toHttpsUrl(appConfig.termsOfUseUrl);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const termsBlocking = termsOfUseUrl !== null && !agreedToTerms;

  const chain = useFieldChain(['nickname', 'displayName', 'email', 'password']);

  const agreeLabel = privacyPolicyUrl
    ? 'I agree to the Terms of Use and Privacy Policy'
    : 'I agree to the Terms of Use';

  const handleRegister = async (): Promise<void> => {
    if (termsBlocking) {
      return;
    }
    setError(null);
    setIsEmailRegistered(false);
    setRetryError(null);
    setRetryAction(null);

    const trimmedNickname = nickname.trim();
    const trimmedDisplayName = displayName.trim();
    const trimmedEmail = email.trim();

    if (!trimmedNickname || !trimmedDisplayName || !trimmedEmail || !password) {
      setError('Fill in every field.');
      chain.focus(
        !trimmedNickname ? 'nickname' : !trimmedDisplayName ? 'displayName' : !trimmedEmail ? 'email' : 'password',
      );
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      chain.focus('password');
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
        setRetryError(NETWORK_ERROR_MESSAGE);
        setRetryAction(() => handleRegister);
        return;
      }

      if (isRateLimitError(err)) {
        setError(RATE_LIMIT_MESSAGE);
        return;
      }

      if (isServerError(err)) {
        setRetryError(SERVER_ERROR_MESSAGE);
        setRetryAction(() => handleRegister);
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
    <KeyboardAwareScreen contentContainerStyle={styles.container}>
      <Text style={styles.title}>Register</Text>

      <TextField
        style={styles.input}
        {...chain.props('nickname')}
        placeholder="Nickname"
        autoCapitalize="none"
        value={nickname}
        onChangeText={setNickname}
        editable={!isSubmitting}
      />
      <TextField
        style={styles.input}
        {...chain.props('displayName')}
        placeholder="Display Name"
        value={displayName}
        onChangeText={setDisplayName}
        editable={!isSubmitting}
      />
      <TextField
        style={styles.input}
        {...chain.props('email')}
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
          {...chain.props('password')}
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

      {termsOfUseUrl ? (
        <View style={styles.agreeRow}>
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: agreedToTerms, disabled: isSubmitting }}
            accessibilityLabel={agreeLabel}
            onPress={() => setAgreedToTerms(previous => !previous)}
            disabled={isSubmitting}
            style={styles.checkboxTarget}
          >
            <View style={[styles.checkbox, agreedToTerms ? styles.checkboxChecked : null]}>
              {agreedToTerms ? <Text style={styles.checkMark}>{'\u2713'}</Text> : null}
            </View>
          </Pressable>
          <Text style={styles.agreeText}>
            I agree to the{' '}
            <Text
              style={styles.agreeLink}
              accessibilityRole="link"
              onPress={() => openLink(termsOfUseUrl, 'Could not open the page')}
            >
              Terms of Use
            </Text>
            {privacyPolicyUrl ? (
              <>
                {' '}and{' '}
                <Text
                  style={styles.agreeLink}
                  accessibilityRole="link"
                  onPress={() => openLink(privacyPolicyUrl, 'Could not open the page')}
                >
                  Privacy Policy
                </Text>
              </>
            ) : null}
          </Text>
        </View>
      ) : null}

      {retryError && retryAction ? (
        <InlineError
          message={retryError}
          onRetry={retryAction}
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
        disabled={termsBlocking}
        style={styles.button}
      />

      <TextLink
        label="Already have an account? Sign In"
        onPress={() => navigation.navigate('Login')}
        disabled={isSubmitting}
        style={styles.link}
      />

      {privacyPolicyUrl ? (
        <TextLink
          label="Privacy Policy"
          onPress={() => openLink(privacyPolicyUrl, 'Could not open the page')}
          disabled={isSubmitting}
          style={styles.link}
        />
      ) : null}
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
  agreeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  checkboxTarget: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderColor: colors.textSecondary,
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.surface,
  },
  checkboxChecked: { backgroundColor: colors.primary, borderColor: colors.primary },
  checkMark: { color: colors.surface, fontWeight: '700', fontSize: 16, lineHeight: 18 },
  agreeText: { ...typography.body, color: colors.textPrimary, flex: 1, marginLeft: spacing.xs },
  agreeLink: { color: colors.primary, textDecorationLine: 'underline' },
  button: { marginBottom: spacing.md },
  link: { alignSelf: 'center', minHeight: 44, justifyContent: 'center' },
});
