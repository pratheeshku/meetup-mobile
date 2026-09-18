/**
 * Home header: small muted greeting, large bold "Ready to play, <nickname>?"
 * headline, and a "+ Create Game" button at the top right.
 *
 * `onCreateGame` is optional and, when omitted, the button renders disabled
 * rather than as a tappable control that does nothing. Home passes a handler
 * that opens the placeholder `CreateGameScreen` (real event creation, DES
 * §4.3 "Create/Edit Event", is a later task).
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, spacing, typography } from '../../theme/tokens';
import Button from '../Button';

interface GreetingHeaderProps {
  /** Signed-in user's nickname; the headline drops it when empty. */
  nickname?: string;
  onCreateGame?: () => void;
}

const noop = (): void => {};

export default function GreetingHeader({
  nickname,
  onCreateGame,
}: GreetingHeaderProps): React.JSX.Element {
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
      <Button
        label="+ Create Game"
        size="sm"
        onPress={onCreateGame ?? noop}
        disabled={!onCreateGame}
        style={styles.button}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start' },
  textColumn: { flex: 1 },
  greeting: { ...typography.caption, color: colors.textMuted },
  headline: { ...typography.h1, color: colors.textPrimary, marginTop: spacing.xs },
  button: { marginLeft: spacing.md },
});
