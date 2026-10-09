import React, { useRef, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { withCorrelationId } from '../api/correlationId';
import {
  confirmDeletion,
  parseOwnsGroupsError,
  requestDeletion,
} from '../api/profile';
import { useAuth } from '../auth/AuthContext';
import Button from '../components/Button';
import KeyboardAwareScreen from '../components/KeyboardAwareScreen';
import { useT } from '../labels/LabelsContext';
import type { ProfileStackParamList } from '../navigation/types';
import { borderWidth, colors, radius, spacing, typography } from '../theme/tokens';
import { getApiErrorMessage } from '../utils/apiError';

type Props = NativeStackScreenProps<ProfileStackParamList, 'AccountDeletionCode'>;

function maskEmail(email?: string, fallback = 'your email'): string {
  if (!email || !email.includes('@')) {
    return fallback;
  }
  const [local, domain] = email.split('@');
  if (local.length <= 1) {
    return `${local}***@${domain}`;
  }
  return `${local[0]}***@${domain}`;
}

export default function AccountDeletionCodeScreen({ navigation }: Props): React.JSX.Element {
  const { signOut, user } = useAuth();
  const t = useT();

  const [code, setCode] = useState('');
  const [isConfirming, setIsConfirming] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  const inputRef = useRef<TextInput>(null);

  const handleResendCode = async (): Promise<void> => {
    setErrorMessage(null);
    setInfoMessage(null);
    setIsResending(true);
    try {
      await withCorrelationId(async correlationId => {
        await requestDeletion({ correlationId });
      });
      setInfoMessage(t('mob.account_delete.resend_success'));
    } catch (e: any) {
      const status = e?.response?.status;
      if (status === 429) {
        setErrorMessage(getApiErrorMessage(e, t('mob.account_delete.rate_limited')));
        return;
      }
      const ownedGroups = parseOwnsGroupsError(e);
      if (ownedGroups && ownedGroups.length > 0) {
        navigation.replace('AccountDeletionBlocked', { groups: ownedGroups });
        return;
      }
      setErrorMessage(getApiErrorMessage(e, t('mob.account_delete.resend_error')));
    } finally {
      setIsResending(false);
    }
  };

  const handleConfirmDeletion = async (): Promise<void> => {
    const trimmed = code.trim();
    if (!trimmed || trimmed.length !== 6) {
      setErrorMessage(t('mob.account_delete.code_required'));
      return;
    }

    setErrorMessage(null);
    setInfoMessage(null);
    setIsConfirming(true);
    try {
      await withCorrelationId(async correlationId => {
        await confirmDeletion(trimmed, { correlationId });
      });
      // 200 -> done: log out
      await signOut();
    } catch (e: any) {
      setIsConfirming(false);
      const status = e?.response?.status;
      if (status === 400) {
        setErrorMessage(t('mob.account_delete.code_invalid'));
        return;
      }
      if (status === 429) {
        setErrorMessage(getApiErrorMessage(e, t('mob.account_delete.rate_limited')));
        return;
      }
      const ownedGroups = parseOwnsGroupsError(e);
      if (ownedGroups && ownedGroups.length > 0) {
        navigation.replace('AccountDeletionBlocked', { groups: ownedGroups });
        return;
      }
      setErrorMessage(getApiErrorMessage(e, t('mob.profile.delete_start_error')));
    }
  };

  const digits = code.split('');
  const maskedUserEmail = maskEmail(user?.email, t('mob.account_delete.email_fallback'));

  return (
    <KeyboardAwareScreen contentContainerStyle={styles.container}>
      <View style={styles.content}>
        <View style={styles.warningBox}>
          <Text style={styles.warningTitle}>{t('mob.account_delete.otp_banner_title')}</Text>
          <Text style={styles.warningParagraph}>{t('mob.account_delete.otp_banner_p1')}</Text>
          <Text style={styles.warningParagraph}>{t('mob.account_delete.otp_banner_p2')}</Text>
          <Text style={styles.warningParagraph}>{t('mob.account_delete.otp_banner_p3')}</Text>
        </View>

        <Text style={styles.heading}>{t('mob.account_delete.otp_title')}</Text>
        <Text style={styles.subtitle}>
          {t('mob.account_delete.otp_subtitle', { email: maskedUserEmail })}
        </Text>

        {infoMessage ? <Text style={styles.infoText}>{infoMessage}</Text> : null}
        {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

        <Pressable
          style={styles.otpContainer}
          onPress={() => inputRef.current?.focus()}
          accessibilityRole="button"
          accessibilityLabel={t('mob.account_delete.code_placeholder')}
        >
          {Array.from({ length: 6 }).map((_, index) => {
            const digit = digits[index] || '';
            const isCurrent = index === digits.length;

            return (
              <View
                key={index}
                style={[
                  styles.otpBox,
                  isCurrent && styles.otpBoxActive,
                  Boolean(digit) && styles.otpBoxFilled,
                ]}
              >
                <Text style={styles.otpDigit}>{digit || (isCurrent ? '|' : '')}</Text>
              </View>
            );
          })}
        </Pressable>

        <TextInput
          ref={inputRef}
          value={code}
          onChangeText={text => setCode(text.replace(/[^0-9]/g, '').slice(0, 6))}
          keyboardType="number-pad"
          maxLength={6}
          editable={!isConfirming}
          style={styles.hiddenInput}
          autoFocus
        />

        <View style={styles.resendRow}>
          <Text style={styles.resendPromptText}>{t('mob.account_delete.resend_prompt_ready')}</Text>
          <Pressable
            onPress={handleResendCode}
            disabled={isResending || isConfirming}
            accessibilityRole="button"
            accessibilityLabel={t('mob.account_delete.resend_code')}
          >
            <Text style={styles.resendLinkText}>{t('mob.account_delete.resend_code')}</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.footerSection}>
        <Button
          label={t('mob.account_delete.delete_my_account')}
          variant="destructive"
          onPress={handleConfirmDeletion}
          loading={isConfirming}
          disabled={code.trim().length !== 6 || isConfirming}
          style={styles.deleteButton}
        />
        <Button
          label={t('mob.account_delete.keep_my_account')}
          variant="secondary"
          onPress={() => navigation.goBack()}
          disabled={isConfirming}
          style={styles.keepButton}
        />
      </View>
    </KeyboardAwareScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.md,
    flexGrow: 1,
    justifyContent: 'space-between',
  },
  content: {
    flex: 1,
  },
  warningBox: {
    backgroundColor: colors.errorLight,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  warningTitle: {
    ...typography.bodyBold,
    color: colors.error,
    marginBottom: spacing.xs,
  },
  warningParagraph: {
    ...typography.caption,
    color: colors.textPrimary,
    lineHeight: 18,
    marginTop: spacing.xs,
  },
  heading: {
    ...typography.h2,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
    lineHeight: 20,
  },
  infoText: {
    ...typography.body,
    color: colors.success,
    marginBottom: spacing.sm,
  },
  errorText: {
    ...typography.body,
    color: colors.error,
    marginBottom: spacing.sm,
  },
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  otpBox: {
    width: 48,
    height: 56,
    borderRadius: radius.md,
    borderWidth: borderWidth.thin,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  otpBoxActive: {
    borderColor: colors.primary,
    borderWidth: borderWidth.thick,
  },
  otpBoxFilled: {
    borderColor: colors.border,
  },
  otpDigit: {
    ...typography.h2,
    color: colors.textPrimary,
  },
  hiddenInput: {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0,
  },
  resendRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.xl,
  },
  resendPromptText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  resendLinkText: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '600',
  },
  footerSection: {
    marginTop: 'auto',
    paddingTop: spacing.md,
    gap: spacing.sm,
  },
  deleteButton: {
    width: '100%',
  },
  keepButton: {
    width: '100%',
  },
});
