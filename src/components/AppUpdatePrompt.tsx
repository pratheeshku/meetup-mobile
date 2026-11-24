/**
 * Optional "New version available" prompt (DES-MEETUP-ADDENDUM-app-update-prompt AU-01, 4.3; no board, OI-1: the
 * app's existing centred dialog pattern). Update opens the store page and leaves the prompt up; Later closes it and
 * the hook records the time and the dismissed build (AD-7). Android back acts as Later. Theme tokens only.
 */
import React from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';

import type { UpdatePlatform } from '../api/versionPolicy';
import { perfLog } from '../diagnostics/perfLog';
import { useT } from '../labels/LabelsContext';
import { colors, radius, spacing, typography } from '../theme/tokens';
import { openUpdateLink } from '../utils/openUpdateLink';
import Button from './Button';

export default function AppUpdatePrompt({
  visible,
  platform,
  storeUrl,
  onLater,
}: {
  visible: boolean;
  platform: UpdatePlatform;
  storeUrl: string | null;
  onLater: () => void;
}): React.JSX.Element {
  const t = useT();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onLater}>
      <View style={styles.scrim}>
        <View style={styles.card} accessibilityViewIsModal testID="app-update-prompt">
          <Text style={styles.title} accessibilityRole="header">
            {t('mob.app_update.title')}
          </Text>
          <Text style={styles.body}>{t('mob.app_update.message')}</Text>
          <Button
            label={t('mob.app_update.action')}
            onPress={() => {
              perfLog('update_prompt_update_tapped');
              return openUpdateLink(platform, storeUrl);
            }}
            style={styles.button}
          />
          <Button label={t('mob.app_update.later')} variant="secondary" onPress={onLater} style={styles.button} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: colors.scrim, justifyContent: 'center', padding: spacing.lg },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, alignItems: 'center' },
  title: { ...typography.h3, color: colors.textPrimary, textAlign: 'center' },
  body: { ...typography.body, color: colors.textSecondary, marginTop: spacing.sm, marginBottom: spacing.sm, textAlign: 'center' },
  button: { alignSelf: 'stretch', marginTop: spacing.sm },
});
