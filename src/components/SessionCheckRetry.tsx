/**
 * Splash shown when startup/resume could not confirm the session for a
 * transient reason. The refresh cookie and any stored access token are
 * still intact; Retry runs the check again. Copy is admin-managed labels,
 * with the bundled defaults so this renders at cold start before labels load.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { SessionCheckFailure } from '../auth/sessionRestore';
import { useT } from '../labels/LabelsContext';
import { colors, spacing, typography } from '../theme/tokens';
import Button from './Button';

const MESSAGE_KEYS = {
  network: 'mob.errors.network',
  server: 'mob.errors.server',
  rate_limit: 'mob.errors.rate_limit',
} as const;

interface SessionCheckRetryProps {
  failure: SessionCheckFailure;
  onRetry: () => void;
}

export default function SessionCheckRetry({
  failure,
  onRetry,
}: SessionCheckRetryProps): React.JSX.Element {
  const t = useT();
  const message = t(MESSAGE_KEYS[failure]);
  const retryLabel = t('mob.common.retry');

  return (
    <View style={styles.container} accessibilityRole="alert">
      <Text style={styles.message}>{message}</Text>
      <Button
        label={retryLabel}
        onPress={onRetry}
        accessibilityLabel={retryLabel}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    backgroundColor: colors.background,
  },
  message: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
});
