import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, spacing, typography } from '../theme/tokens';
import { useT } from '../labels/LabelsContext';

export default function EditProfileScreen(): React.JSX.Element {
  const t = useT();
  return (
    <View style={styles.container}>
      <Text style={styles.text}>{t('mob.profile.edit_profile')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.md,
  },
  text: {
    ...typography.body,
    color: colors.textPrimary,
  },
});
