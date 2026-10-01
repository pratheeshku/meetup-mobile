import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';

import { colors, spacing, typography } from '../theme/tokens';
import Button from './Button';

interface InlineErrorProps {
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
  style?: StyleProp<ViewStyle>;
}

export default function InlineError({
  message,
  onRetry,
  retryLabel = 'Retry',
  style,
}: InlineErrorProps): React.JSX.Element {
  return (
    <View style={[styles.container, style]} accessibilityRole="alert">
      <Text style={styles.message}>{message}</Text>
      {onRetry ? (
        <Button
          label={retryLabel}
          variant="secondary"
          size="md"
          onPress={onRetry}
          style={styles.retryButton}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: spacing.sm,
    alignItems: 'center',
    padding: spacing.xs,
  },
  message: {
    ...typography.body,
    color: colors.error,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  retryButton: {
    marginTop: spacing.xs,
  },
});
