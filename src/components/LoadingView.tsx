/**
 * Full-area centred loading indicator with an optional message.
 * Sets its own background so it renders correctly even outside the
 * navigation container (e.g. the auth-restore gate in `RootNavigator`).
 */
import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { colors, spacing, typography } from '../theme/tokens';

interface LoadingViewProps {
  message?: string;
}

export default function LoadingView({ message }: LoadingViewProps): React.JSX.Element {
  return (
    <View
      style={styles.container}
      accessibilityRole="progressbar"
      accessibilityLabel={message ?? 'Loading'}
    >
      <ActivityIndicator size="large" color={colors.primary} />
      {message ? <Text style={styles.message}>{message}</Text> : null}
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
    marginTop: spacing.md,
    textAlign: 'center',
  },
});
