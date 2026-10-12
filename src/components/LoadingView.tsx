/**
 * Full-area centred loading indicator with an optional message.
 * Sets its own background so it renders correctly even outside the
 * navigation container (e.g. the auth-restore gate in `RootNavigator`).
 */
import React from 'react';
import { ActivityIndicator, Image, StyleSheet, Text, View } from 'react-native';

import { colors, spacing, typography } from '../theme/tokens';
import { useT } from '../labels/LabelsContext';

const FULL_LOGO = require('../assets/gameonsg-logo-full.png');

interface LoadingViewProps {
  message?: string;
  showLogo?: boolean;
}

export default function LoadingView({ message, showLogo = false }: LoadingViewProps): React.JSX.Element {
  const t = useT();
  return (
    <View
      style={styles.container}
      accessibilityRole="progressbar"
      accessibilityLabel={message ?? t('mob.common.loading')}
    >
      {showLogo ? (
        <View style={styles.logoContainer}>
          <Image
            source={FULL_LOGO}
            style={styles.logo}
            resizeMode="contain"
            accessibilityLabel={t('mob.brand.name')}
          />
        </View>
      ) : null}
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
  logoContainer: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  logo: {
    width: 250,
    height: 120,
  },
  message: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.md,
    textAlign: 'center',
  },
});
