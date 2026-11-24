/**
 * Blocking "Update required" screen (DES-MEETUP-ADDENDUM-app-update-prompt AU-02, AD-8; Android and iOS).
 *
 * Deliberately has no dismiss control and no navigation, and swallows the
 * Android hardware back button, so nothing behind it can be reached. The only
 * action is "Update", which opens the store page.
 *
 * `storeUrl` comes from the backend and is untrusted: it is opened only if it
 * passes the platform allow-list (`openUpdateLink`, AD-10).
 */
import React, { useEffect } from 'react';
import { BackHandler, StyleSheet, Text, View } from 'react-native';

import Button from '../components/Button';
import ScreenContainer from '../components/ScreenContainer';
import { colors, spacing, typography } from '../theme/tokens';
import type { UpdatePlatform } from '../api/versionPolicy';
import { perfLog } from '../diagnostics/perfLog';
import { useT } from '../labels/LabelsContext';
import { openUpdateLink } from '../utils/openUpdateLink';

interface ForceUpdateScreenProps {
  /** The backend's store link, unvalidated. */
  storeUrl: string | null;
  platform?: UpdatePlatform;
}

export default function ForceUpdateScreen({
  storeUrl,
  platform = 'android',
}: ForceUpdateScreenProps): React.JSX.Element {
  const t = useT();
  useEffect(() => {
    // Returning true consumes the press: back neither navigates nor exits.
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => subscription.remove();
  }, []);

  return (
    <ScreenContainer edges="both" style={styles.container}>
    <View style={styles.container}>
      <Text style={styles.title} accessibilityRole="header">
        {t('mob.force_update.title')}
      </Text>
      <Text style={styles.message}>{t('mob.force_update.message')}</Text>
      <Button label={t('mob.force_update.action')} onPress={() => {
          perfLog('update_required_update_tapped');
          return openUpdateLink(platform, storeUrl);
        }} style={styles.button} />
    </View>
    </ScreenContainer>
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
  title: {
    ...typography.h1,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  message: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  button: { alignSelf: 'stretch' },
});
