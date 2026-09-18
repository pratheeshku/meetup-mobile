/**
 * Home header: small muted greeting and a large bold "Ready to play,
 * <nickname>?" headline.
 *
 * Create Game no longer lives here — it is the raised center button in the
 * bottom tab bar (see `navigation/CreateTabButton`).
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, spacing, typography } from '../../theme/tokens';

interface GreetingHeaderProps {
  /** Signed-in user's nickname; the headline drops it when empty. */
  nickname?: string;
}

export default function GreetingHeader({ nickname }: GreetingHeaderProps): React.JSX.Element {
  const name = nickname?.trim();
  const headline = name ? `Ready to play, ${name}?` : 'Ready to play?';

  return (
    <View style={styles.row}>
      <View style={styles.textColumn}>
        <Text style={styles.greeting}>Good to see you 👋</Text>
        <Text style={styles.headline} accessibilityRole="header">
          {headline}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start' },
  textColumn: { flex: 1 },
  greeting: { ...typography.caption, color: colors.textMuted },
  headline: { ...typography.h1, color: colors.textPrimary, marginTop: spacing.xs },
});
