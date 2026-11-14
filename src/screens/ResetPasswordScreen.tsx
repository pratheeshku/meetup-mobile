/**
 * Reset password screen (deep-links AD-7; email-auth AD-3). Opened by a `/l/reset#token=...` link.
 *
 * New password and confirmation; calls `POST /auth/reset-password-with-token`. The token comes only
 * from the link and lives in memory (`links/linkStore`): never in route params, logs, storage or
 * analytics, and dropped as soon as it is used or the screen is left. Every failure shows ONE message
 * with a way back to Forgot password. Success returns to Sign In with a confirmation; a device that
 * is signed in is signed out on success (the server has already ended every session).
 * Layout, components and tokens follow ForgotPasswordScreen and LoginScreen (design D-1: no board).
 */
import React, { useEffect, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NavigationProp, ParamListBase } from '@react-navigation/native';

const FULL_LOGO = require('../assets/gameonsg-logo-full.png');

import { useAuth } from '../auth/AuthContext';
import { resetPasswordWithToken } from '../auth/emailAuth';
import Button from '../components/Button';
import KeyboardAwareScreen from '../components/KeyboardAwareScreen';
import ScreenContainer from '../components/ScreenContainer';
import TextField from '../components/TextField';
import TextLink from '../components/TextLink';
import { useFieldChain } from '../hooks/useFieldChain';
import { useT } from '../labels/LabelsContext';
import { clearResetToken, getResetToken, setAuthLanding } from '../links/linkStore';
import { colors, spacing, typography } from '../theme/tokens';

/** Same rule as the server (email-auth AD-3) and the sign-up screen. */
export const RESET_PASSWORD_MIN_LENGTH = 8;

export default function ResetPasswordScreen(): React.JSX.Element {
  const navigation = useNavigation<NavigationProp<ParamListBase>>();
  const { user, signOut } = useAuth();
  const t = useT();

  // Read once from memory. A missing token (the app was restarted mid-way) is a failure like any other.
  const [token] = useState<string | null>(() => getResetToken());
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [failed, setFailed] = useState(token === null);

  const chain = useFieldChain(['password', 'confirmation']);

  // The token never outlives this screen.
  useEffect(() => clearResetToken, []);

  const handleSubmit = async (): Promise<void> => {
    setInlineError(null);
    if (token === null) {
      setFailed(true);
      return;
    }
    if (password.length < RESET_PASSWORD_MIN_LENGTH) {
      setInlineError(t('mob.reset.too_short'));
      chain.focus('password');
      return;
    }
    if (password !== confirmation) {
      setInlineError(t('mob.reset.mismatch'));
      chain.focus('confirmation');
      return;
    }

    setIsSubmitting(true);
    setFailed(false);
    try {
      await resetPasswordWithToken(token, password);
    } catch {
      // Every cause (unknown, used, expired, too short, rate limit, network) is the same single message.
      setFailed(true);
      setIsSubmitting(false);
      return;
    }
    clearResetToken();
    if (user) {
      // The server ended every session; end this device's too. The Sign In stack that replaces
      // this one starts at Login with the confirmation.
      setAuthLanding('reset_done');
      try {
        await signOut();
      } catch {
        // signOut always clears the local session; nothing more to do here.
      }
      return;
    }
    navigation.navigate('Login', { successMessage: t('mob.reset.success') });
  };

  const handleRequestNewLink = async (): Promise<void> => {
    clearResetToken();
    if (user) {
      // Forgot password lives in the Sign In stack: sign out and start there.
      setAuthLanding('forgot');
      try {
        await signOut();
      } catch {
        // see above
      }
      return;
    }
    navigation.navigate('ForgotPassword');
  };

  return (
    <ScreenContainer edges="bottom">
      <KeyboardAwareScreen contentContainerStyle={styles.container}>
        <View style={styles.logoContainer}>
          <Image
            source={FULL_LOGO}
            style={styles.logo}
            resizeMode="contain"
            accessibilityLabel={t('mob.brand.name')}
          />
        </View>
        <Text style={styles.title}>{t('mob.reset.title')}</Text>
        <Text style={styles.instructions}>{t('mob.reset.instructions')}</Text>

        <TextField
          style={styles.input}
          {...chain.props('password')}
          placeholder={t('mob.reset.new_password')}
          secureTextEntry
          autoCapitalize="none"
          autoComplete="new-password"
          value={password}
          onChangeText={setPassword}
          editable={!isSubmitting}
        />
        <TextField
          style={styles.input}
          {...chain.props('confirmation')}
          placeholder={t('mob.reset.confirm_password')}
          secureTextEntry
          autoCapitalize="none"
          autoComplete="new-password"
          value={confirmation}
          onChangeText={setConfirmation}
          editable={!isSubmitting}
        />

        {inlineError ? <Text style={styles.error}>{inlineError}</Text> : null}
        {failed ? (
          <View accessibilityRole="alert">
            <Text style={styles.error}>{t('mob.reset.failed')}</Text>
            <TextLink
              label={t('mob.reset.request_new_link')}
              onPress={handleRequestNewLink}
              disabled={isSubmitting}
              style={styles.link}
            />
          </View>
        ) : null}

        <Button
          label={t('mob.reset.submit')}
          onPress={handleSubmit}
          loading={isSubmitting}
          style={styles.button}
        />
      </KeyboardAwareScreen>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, justifyContent: 'center', padding: spacing.lg },
  logoContainer: { alignItems: 'center', marginBottom: spacing.lg },
  logo: { width: '70%', maxWidth: 280, height: 135 },
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
