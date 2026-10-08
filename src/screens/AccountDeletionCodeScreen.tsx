import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { withCorrelationId } from '../api/correlationId';
import {
  confirmDeletion,
  parseOwnsGroupsError,
  requestDeletion,
} from '../api/profile';
import { useAuth } from '../auth/AuthContext';
import Button from '../components/Button';
import Card from '../components/Card';
import KeyboardAwareScreen from '../components/KeyboardAwareScreen';
import TextField from '../components/TextField';
import TextLink from '../components/TextLink';
import { useT } from '../labels/LabelsContext';
import type { ProfileStackParamList } from '../navigation/types';
import { colors, spacing, typography } from '../theme/tokens';
import { getApiErrorMessage } from '../utils/apiError';

type Props = NativeStackScreenProps<ProfileStackParamList, 'AccountDeletionCode'>;

export default function AccountDeletionCodeScreen({ navigation }: Props): React.JSX.Element {
  const { signOut } = useAuth();
  const t = useT();

  const [code, setCode] = useState('');
  const [isConfirming, setIsConfirming] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  const handleResendCode = async (): Promise<void> => {
    setErrorMessage(null);
    setInfoMessage(null);
    setIsResending(true);
    try {
      await withCorrelationId(async correlationId => {
        await requestDeletion({ correlationId });
      });
      setInfoMessage(t('mob.account_delete.resend_success'));
    } catch (e) {
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
      const ownedGroups = parseOwnsGroupsError(e);
      if (ownedGroups && ownedGroups.length > 0) {
        navigation.replace('AccountDeletionBlocked', { groups: ownedGroups });
        return;
      }
      // Invalid code -> 400: generic message
      setErrorMessage(t('mob.account_delete.code_invalid'));
      setIsConfirming(false);
    }
  };

  return (
    <KeyboardAwareScreen contentContainerStyle={styles.container}>
      <Card style={styles.card}>
        <Text style={styles.heading}>{t('mob.account_delete.confirm_title')}</Text>
        <Text style={styles.instructions}>{t('mob.account_delete.code_prompt')}</Text>

        {infoMessage ? <Text style={styles.infoText}>{infoMessage}</Text> : null}
        {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

        <TextField
          placeholder={t('mob.account_delete.code_placeholder')}
          value={code}
          onChangeText={setCode}
          keyboardType="number-pad"
          maxLength={6}
          editable={!isConfirming}
          style={styles.codeInput}
          autoCapitalize="none"
          autoCorrect={false}
        />

        <View style={styles.resendRow}>
          <TextLink
            label={t('mob.account_delete.resend_code')}
            onPress={handleResendCode}
            disabled={isResending || isConfirming}
          />
        </View>

        <Button
          label={t('mob.account_delete.final_delete_button')}
          variant="destructive"
          onPress={handleConfirmDeletion}
          loading={isConfirming}
          disabled={code.trim().length !== 6 || isConfirming}
          style={styles.confirmButton}
        />
      </Card>
    </KeyboardAwareScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.md,
  },
  card: {
    padding: spacing.md,
  },
  heading: {
    ...typography.h2,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  instructions: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.md,
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
  codeInput: {
    textAlign: 'center',
    ...typography.h2,
    letterSpacing: 8,
    marginBottom: spacing.md,
  },
  resendRow: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  confirmButton: {
    width: '100%',
  },
});
