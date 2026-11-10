/**
 * The 6-digit code screen body shared by the email verification (`VerifyScreen`, email-auth AD-5) and the WhatsApp code step of sign-up
 * (nov10-enhancements NE-01a, AD-4): title, optional explanation, instructions with the highlighted target (email address or phone), the code
 * input, inline error / retry / info, Verify, a Resend button with a countdown, and Back. Presentational only: the caller owns the state and the
 * wording. Never logs the code (R-111, P10).
 */
import React, { useEffect } from 'react';
import { StyleSheet, Text } from 'react-native';

import { useFieldChain } from '../../hooks/useFieldChain';
import { colors, spacing, typography } from '../../theme/tokens';
import Button from '../Button';
import InlineError from '../InlineError';
import KeyboardAwareScreen from '../KeyboardAwareScreen';
import ScreenContainer from '../ScreenContainer';
import TextField from '../TextField';
import TextLink from '../TextLink';

interface Props {
  title: string;
  explanation?: string | null;
  instructions: string;
  /** The email address or the phone number the code went to, shown highlighted under the instructions. */
  target: string;
  codePlaceholder: string;
  code: string;
  onChangeCode: (code: string) => void;
  verifyLabel: string;
  onVerify: () => void;
  isVerifying: boolean;
  resendLabel: string;
  onResend: () => void;
  isResending: boolean;
  resendDisabled: boolean;
  backLabel: string;
  onBack: () => void;
  retryLabel: string;
  error: string | null;
  info: string | null;
  retryError: string | null;
  retryAction: (() => Promise<void>) | null;
  /** A new non-zero value moves focus to the code field (a short or empty code). */
  focusSignal?: number;
}

export default function VerificationCodeForm(props: Props): React.JSX.Element {
  const chain = useFieldChain(['code']);
  const { isVerifying, isResending, focusSignal } = props;
  useEffect(() => {
    if (focusSignal) {
      chain.focus('code');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusSignal]);
  return (
    <ScreenContainer edges="bottom">
      <KeyboardAwareScreen contentContainerStyle={styles.container}>
        <Text style={styles.title}>{props.title}</Text>

        {props.explanation ? <Text style={styles.explanation}>{props.explanation}</Text> : null}

        <Text style={styles.instructions}>
          {props.instructions}
          {'\n'}
          <Text style={styles.emailHighlight}>{props.target}</Text>
        </Text>

        <TextField
          style={styles.input}
          {...chain.props('code')}
          placeholder={props.codePlaceholder}
          autoCapitalize="none"
          keyboardType="number-pad"
          textContentType="oneTimeCode"
          maxLength={6}
          value={props.code}
          onChangeText={props.onChangeCode}
          editable={!isVerifying && !isResending}
        />

        {props.retryError && props.retryAction ? (
          <InlineError message={props.retryError} onRetry={props.retryAction} retryLabel={props.retryLabel} />
        ) : props.error ? (
          <Text style={styles.error}>{props.error}</Text>
        ) : null}

        {props.info ? <Text style={styles.info}>{props.info}</Text> : null}

        <Button label={props.verifyLabel} onPress={props.onVerify} loading={isVerifying} disabled={isResending} style={styles.button} />

        <Button
          label={props.resendLabel}
          variant="secondary"
          onPress={props.onResend}
          loading={isResending}
          disabled={props.resendDisabled}
          style={styles.button}
        />

        <TextLink label={props.backLabel} onPress={props.onBack} disabled={isVerifying || isResending} style={styles.link} />
      </KeyboardAwareScreen>
    </ScreenContainer>
  );
}

export type { Props as VerificationCodeFormProps };

const styles = StyleSheet.create({
  container: { flexGrow: 1, justifyContent: 'center', padding: spacing.lg },
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
