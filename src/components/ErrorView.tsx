/**
 * Full-area error message with an optional Retry button. `onRetry` is
 * optional so a caller with nothing to retry can still show the message.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, spacing, typography } from '../theme/tokens';
import Button from './Button';

interface ErrorViewProps {
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
}

export default function ErrorView({
  message,
  onRetry,
  retryLabel = 'Retry',
}: ErrorViewProps): React.JSX.Element {
  return (
    <View style={styles.container}>
      <Text style={styles.message} accessibilityRole="alert">
        {message}
      </Text>
      {onRetry ? <Button label={retryLabel} onPress={onRetry} /> : null}
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
    color: colors.error,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
});
