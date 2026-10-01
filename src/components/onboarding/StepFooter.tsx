/** Save / Skip footer shared by every first-run step (each step has both). */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, spacing, typography } from '../../theme/tokens';
import Button from '../Button';

interface StepFooterProps {
  onSave: () => void;
  onSkip: () => void;
  saving?: boolean;
  /** Inline error from a failed save; Skip always stays available. */
  error?: string | null;
  saveLabel?: string;
}

export default function StepFooter({
  onSave,
  onSkip,
  saving = false,
  error,
  saveLabel = 'Save',
}: StepFooterProps): React.JSX.Element {
  return (
    <View style={styles.footer}>
      {error ? (
        <Text style={styles.error} accessibilityRole="alert">
          {error}
        </Text>
      ) : null}
      <Button label={saveLabel} onPress={onSave} loading={saving} />
      <Button label="Skip" variant="secondary" onPress={onSkip} disabled={saving} style={styles.skip} />
    </View>
  );
}

const styles = StyleSheet.create({
  footer: { marginTop: spacing.lg },
  error: { ...typography.body, color: colors.error, marginBottom: spacing.sm, textAlign: 'center' },
  skip: { marginTop: spacing.sm },
});
