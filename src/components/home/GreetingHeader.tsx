/**
 * Home header: small muted greeting and a large bold "Ready to play,
 * <name>?" headline. The name is the user's display name (see
 * `utils/displayName`), resolved by the caller.
 *
 * Create Game no longer lives here — it is the raised center button in the
 * bottom tab bar (see `navigation/CreateTabButton`).
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, spacing, typography } from '../../theme/tokens';

interface GreetingHeaderProps {
  /** Signed-in user's display name; the headline drops it when empty. */
  name?: string;
}

export default function GreetingHeader({ name }: GreetingHeaderProps): React.JSX.Element {
  const trimmed = name?.trim();
  const headline = trimmed ? `Ready to play, ${trimmed}?` : 'Ready to play?';

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
