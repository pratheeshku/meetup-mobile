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
import React, { useContext, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { AppleButton } from '@invertase/react-native-apple-authentication';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AxiosError } from 'axios';

import appConfig from '../../config/appConfig.json';
import { AuthContext } from '../auth/AuthContext';
import { AppleSignInCancelledError } from '../auth/appleAuth';
import { signup } from '../auth/emailAuth';
import { getTermsVersion } from '../auth/terms';
import SocialTermsNotice from '../components/auth/SocialTermsNotice';
import Button from '../components/Button';
import InlineError from '../components/InlineError';
import KeyboardAwareScreen from '../components/KeyboardAwareScreen';
import ScreenContainer from '../components/ScreenContainer';
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
import { useT } from '../labels/LabelsContext';

type Props = NativeStackScreenProps<AuthStackParamList, 'Register'>;

export default function RegisterScreen({ navigation }: Props): React.JSX.Element {
  const t = useT();
  const auth = useContext(AuthContext);
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

  const handleAppleSignIn = async (): Promise<void> => {
    if (!auth?.signInWithApple) {
      return;
    }
    setError(null);
    setRetryError(null);
    setRetryAction(null);
    setIsSubmitting(true);
    try {
      await auth.signInWithApple();
    } catch (err) {
      if (!(err instanceof AppleSignInCancelledError)) {
        setError(t('mob.auth.apple_failed'));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const privacyPolicyUrl = toHttpsUrl(appConfig.privacyPolicyUrl);
  // Terms agreement (email registration only): required only when a valid
  // terms URL is configured; with none, registration is unchanged. The
  // acceptance is not recorded server-side.
  const termsOfUseUrl = toHttpsUrl(appConfig.termsOfUseUrl);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const termsBlocking = termsOfUseUrl !== null && !agreedToTerms;

  const chain = useFieldChain(['nickname', 'displayName', 'email', 'password']);

  const agreeLabel = privacyPolicyUrl
    ? t('mob.register.agree_terms_privacy_a11y')
    : t('mob.register.agree_terms_a11y');

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
      setError(t('mob.register.fill_all'));
      chain.focus(
        !trimmedNickname ? 'nickname' : !trimmedDisplayName ? 'displayName' : !trimmedEmail ? 'email' : 'password',
      );
      return;
    }

    if (password.length < 8) {
      setError(t('mob.register.password_short'));
      chain.focus('password');
      return;
    }

    setIsSubmitting(true);
    try {
      const termsVersion = await getTermsVersion();
      await signup({
        email: trimmedEmail,
        password,
        display_name: trimmedDisplayName,
        nickname: trimmedNickname,
        terms_version: termsVersion,
      });
      navigation.navigate('Verify', { email: trimmedEmail });
    } catch (err) {
      if (isNetworkError(err)) {
        setRetryError(t(NETWORK_ERROR_MESSAGE));
        setRetryAction(() => handleRegister);
        return;
      }

      if (isRateLimitError(err)) {
        setError(t(RATE_LIMIT_MESSAGE));
        return;
      }

      if (isServerError(err)) {
        setRetryError(t(SERVER_ERROR_MESSAGE));
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
        setError(t('mob.register.email_taken'));
        setIsEmailRegistered(true);
      } else if (detailString.includes('Nickname already taken')) {
        setError(t('mob.register.nickname_taken'));
      } else if (detailString.includes('Password must be at least 8 characters')) {
        setError(t('mob.register.password_short'));
      } else if (detailString) {
        setError(detailString);
      } else {
        setError(t('mob.register.failed'));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ScreenContainer edges="bottom">
    <KeyboardAwareScreen contentContainerStyle={styles.container}>
      <Text style={styles.title}>{t('mob.register.title')}</Text>

      {Platform.OS === 'ios' ? (
        <>
          <AppleButton
            buttonStyle={AppleButton.Style.BLACK}
            buttonType={AppleButton.Type.CONTINUE}
            style={styles.appleButton}
            onPress={handleAppleSignIn}
          />
          <SocialTermsNotice />
        </>
      ) : null}

      <TextField
        style={styles.input}
        {...chain.props('nickname')}
        placeholder={t('mob.register.nickname_placeholder')}
        autoCapitalize="none"
        value={nickname}
        onChangeText={setNickname}
        editable={!isSubmitting}
      />
      <TextField
        style={styles.input}
        {...chain.props('displayName')}
        placeholder={t('mob.register.display_name_placeholder')}
        value={displayName}
        onChangeText={setDisplayName}
        editable={!isSubmitting}
      />
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

      <View style={styles.passwordRow}>
        <TextField
          style={styles.passwordField}
          {...chain.props('password')}
          placeholder={t('mob.auth.password_placeholder')}
          secureTextEntry={!showPassword}
          autoComplete="new-password"
          value={password}
          onChangeText={setPassword}
          editable={!isSubmitting}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={showPassword ? t('mob.register.hide_password') : t('mob.register.show_password')}
          onPress={() => setShowPassword(prev => !prev)}
          style={styles.showHideButton}
        >
          <Text style={styles.showHideText}>{showPassword ? t('mob.register.hide') : t('mob.register.show')}</Text>
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
            {t('mob.register.agree_prefix')}{' '}
            <Text
              style={styles.agreeLink}
              accessibilityRole="link"
              onPress={() => openLink(termsOfUseUrl, t('mob.errors.open_page_failed'))}
            >
              {t('mob.register.terms_link')}
            </Text>
            {privacyPolicyUrl ? (
              <>
                {' '}{t('mob.common.and')}{' '}
                <Text
                  style={styles.agreeLink}
                  accessibilityRole="link"
                  onPress={() => openLink(privacyPolicyUrl, t('mob.errors.open_page_failed'))}
                >
                  {t('mob.register.privacy_link')}
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
          retryLabel={t('mob.common.retry')}
        />
      ) : error ? (
        <Text style={styles.error}>{error}</Text>
      ) : null}

      {isEmailRegistered ? (
        <View style={styles.inlineActions}>
          <TextLink
            label={t('mob.register.sign_in')}
            onPress={() => navigation.navigate('Login')}
            style={styles.actionLink}
          />
          <TextLink
            label={t('mob.register.verify_email')}
            onPress={() => navigation.navigate('Verify', { email: email.trim() })}
            style={styles.actionLink}
          />
        </View>
      ) : null}

      <Button
        label={t('mob.register.submit')}
        onPress={handleRegister}
        loading={isSubmitting}
        disabled={termsBlocking}
        style={styles.button}
      />

      <TextLink
        label={t('mob.register.login_link')}
        onPress={() => navigation.navigate('Login')}
        disabled={isSubmitting}
        style={styles.link}
      />

      {privacyPolicyUrl ? (
        <TextLink
          label={t('mob.register.privacy_link')}
          onPress={() => openLink(privacyPolicyUrl, t('mob.errors.open_page_failed'))}
          disabled={isSubmitting}
          style={styles.link}
        />
      ) : null}
    </KeyboardAwareScreen>
    </ScreenContainer>
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
  appleButton: {
    width: '100%',
    maxWidth: 312,
    height: 48,
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  link: { alignSelf: 'center', minHeight: 44, justifyContent: 'center' },
});
