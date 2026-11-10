/**
 * "Complete your account" (DES-MEETUP-ADDENDUM-nov10-enhancements NE-01, AD-3): the step after a NEW person's Google or Apple sign-in while the
 * admin flag `phone_required_enabled` is on. The server sent a single-use ticket and no session; this screen shows the email and name read-only,
 * asks for the mobile number with the consent text, and Continue calls `POST /auth/complete-signup`, then signs the person in like a normal login.
 *
 * The ticket is held in `AuthContext` memory only (never route params, storage or logs) and dropped when the person leaves, succeeds or gets a 400.
 * The number is PII: never logged, never echoed in an error. No board exists for this screen; it copies the Register layout from existing
 * tokens and components, for the owner to review. No OTP step: WhatsApp verification is not built.
 */
import React, { useContext, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AxiosError } from 'axios';

import { AuthContext } from '../auth/AuthContext';
import Button from '../components/Button';
import KeyboardAwareScreen from '../components/KeyboardAwareScreen';
import MobileNumberInput from '../components/MobileNumberInput';
import type { MobileNumberChange } from '../components/MobileNumberInput';
import ScreenContainer from '../components/ScreenContainer';
import TextField from '../components/TextField';
import TextLink from '../components/TextLink';
import { useMobileNumberConfig } from '../hooks/useMobileNumberConfig';
import { useT } from '../labels/LabelsContext';
import type { AuthStackParamList } from '../navigation/types';
import { colors, spacing, typography } from '../theme/tokens';
import { isNetworkError, isServerError, NETWORK_ERROR_MESSAGE, SERVER_ERROR_MESSAGE } from '../utils/networkError';

type Props = NativeStackScreenProps<AuthStackParamList, 'CompleteAccount'>;

export default function CompleteAccountScreen({ navigation }: Props): React.JSX.Element {
  const t = useT();
  const auth = useContext(AuthContext);
  const pending = auth?.pendingSignup ?? null;
  const [configKey, setConfigKey] = useState(0);
  const config = useMobileNumberConfig(configKey);
  const [mobile, setMobile] = useState<MobileNumberChange>({ e164: null, isEmpty: true });
  const [numberError, setNumberError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Set when this screen ends the sign-up itself (success or a dead ticket), so the "no pending sign-up" redirect does not also fire.
  const leaving = useRef(false);
  const cancel = auth?.cancelPendingSignup;

  // Nothing waiting (the app was reopened, or the ticket was dropped): back to Login.
  useEffect(() => {
    if (!pending && !leaving.current) {
      navigation.replace('Login');
    }
  }, [pending, navigation]);

  // Leaving the screen drops the ticket.
  useEffect(
    () => () => {
      cancel?.();
    },
    [cancel],
  );

  const handleContinue = async (): Promise<void> => {
    if (!auth || config.status !== 'ready' || isSubmitting) {
      return;
    }
    setError(null);
    setNumberError(null);
    // UX check only: the server decides (422).
    if (mobile.isEmpty) {
      setNumberError(t('mob.register.phone_required'));
      return;
    }
    if (mobile.e164 === null) {
      setNumberError(t('mob.mobile_number.invalid'));
      return;
    }
    setIsSubmitting(true);
    try {
      leaving.current = true;
      await auth.completeSignup(mobile.e164, config.consent.version);
      // Signed in: the app stack replaces this one.
    } catch (err) {
      leaving.current = false;
      const axiosErr = err as AxiosError<{ detail?: unknown }>;
      const status = axiosErr.response?.status;
      const detail = axiosErr.response?.data?.detail;
      if (status === 400) {
        // Invalid, expired or used ticket: the sign-in must start again.
        leaving.current = true;
        auth.cancelPendingSignup();
        Alert.alert(t('mob.complete_account.ticket_expired'));
        navigation.replace('Login');
      } else if (
        status === 409 &&
        typeof detail === 'object' &&
        detail !== null &&
        (detail as { code?: string }).code === 'consent_version_stale'
      ) {
        // The consent text changed: read it again; the person reviews it and continues again (the ticket is not used up).
        await config.reloadConsent();
        setNumberError(t('mob.mobile_number.reconfirm'));
      } else if (status === 422) {
        setNumberError(
          typeof detail === 'string' && detail.includes('required')
            ? t('mob.register.phone_required')
            : t('mob.mobile_number.invalid'),
        );
      } else if (isNetworkError(err)) {
        setError(t(NETWORK_ERROR_MESSAGE));
      } else if (isServerError(err)) {
        setError(t(SERVER_ERROR_MESSAGE));
      } else {
        setError(t('mob.complete_account.failed'));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const backToSignIn = (): void => {
    leaving.current = true;
    auth?.cancelPendingSignup();
    navigation.replace('Login');
  };

  return (
    <ScreenContainer edges="bottom">
      <KeyboardAwareScreen contentContainerStyle={styles.container}>
        <Text style={styles.title} accessibilityRole="header">
          {t('mob.complete_account.title')}
        </Text>
        <Text style={styles.intro}>{t('mob.complete_account.intro')}</Text>

        <TextField
          style={styles.input}
          value={pending?.display_name ?? ''}
          editable={false}
          accessibilityLabel={t('mob.complete_account.name_label')}
          testID="complete-account-name"
        />
        <TextField
          style={styles.input}
          value={pending?.email ?? ''}
          editable={false}
          accessibilityLabel={t('mob.complete_account.email_label')}
          testID="complete-account-email"
        />

        {config.status === 'loading' ? <ActivityIndicator color={colors.primary} style={styles.input} /> : null}
        {config.status === 'unavailable' ? (
          <View style={styles.input}>
            <Text style={styles.error}>{t('mob.complete_account.unavailable')}</Text>
            <Button label={t('mob.common.retry')} variant="secondary" onPress={() => setConfigKey(key => key + 1)} />
          </View>
        ) : null}
        {config.status === 'ready' ? (
          <View style={styles.input} testID="complete-account-mobile-number">
            <MobileNumberInput
              countries={config.countries}
              consentText={config.consent.text}
              onChange={next => {
                setMobile(next);
                setNumberError(null);
              }}
              error={numberError}
            />
          </View>
        ) : null}

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Button
          label={t('mob.complete_account.continue')}
          onPress={handleContinue}
          loading={isSubmitting}
          disabled={config.status !== 'ready'}
          style={styles.button}
          testID="complete-account-continue"
        />
        <TextLink
          label={t('mob.complete_account.back')}
          onPress={backToSignIn}
          disabled={isSubmitting}
          style={styles.link}
        />
      </KeyboardAwareScreen>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, justifyContent: 'center', padding: spacing.lg },
  title: { ...typography.h1, color: colors.textPrimary, marginBottom: spacing.sm, textAlign: 'center' },
  intro: { ...typography.body, color: colors.textSecondary, marginBottom: spacing.lg, textAlign: 'center' },
  input: { marginBottom: spacing.md },
  error: { ...typography.body, color: colors.error, marginBottom: spacing.md, textAlign: 'center' },
  button: { marginBottom: spacing.md },
  link: { alignSelf: 'center', minHeight: 44, justifyContent: 'center' },
});
