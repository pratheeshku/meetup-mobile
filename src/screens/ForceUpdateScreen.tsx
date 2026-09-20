/**
 * Blocking "Update required" screen (force-update gate; approved deviation).
 *
 * Deliberately has no dismiss control and no navigation, and swallows the
 * Android hardware back button, so nothing behind it can be reached. The only
 * action is "Update", which opens the Play Store page.
 *
 * `storeUrl` comes from the backend and is untrusted: it is opened only if it
 * passes `resolveStoreUrl` (https + host exactly play.google.com); otherwise
 * the Play page for this app is opened instead.
 */
import React, { useEffect } from 'react';
import { BackHandler, Linking, StyleSheet, Text, View } from 'react-native';

import Button from '../components/Button';
import { colors, spacing, typography } from '../theme/tokens';
import { PLAY_STORE_FALLBACK_URL, resolveStoreUrl } from '../utils/playStoreUrl';
import { describeError } from '../utils/logSafeError';

interface ForceUpdateScreenProps {
  /** The backend's `store_url`, unvalidated. */
  storeUrl: string | null;
}

async function openStore(storeUrl: string | null): Promise<void> {
  const target = resolveStoreUrl(storeUrl);
  try {
    await Linking.openURL(target);
    return;
  } catch (error) {
    console.log('[update] opening the store page failed', describeError(error));
  }
  if (target === PLAY_STORE_FALLBACK_URL) {
    return;
  }
  try {
    await Linking.openURL(PLAY_STORE_FALLBACK_URL);
  } catch (error) {
    console.log('[update] opening the fallback store page failed', describeError(error));
  }
}

export default function ForceUpdateScreen({ storeUrl }: ForceUpdateScreenProps): React.JSX.Element {
  useEffect(() => {
    // Returning true consumes the press: back neither navigates nor exits.
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => subscription.remove();
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title} accessibilityRole="header">
        Update required
      </Text>
      <Text style={styles.message}>Please update Shuttlr to continue.</Text>
      <Button label="Update" onPress={() => openStore(storeUrl)} style={styles.button} />
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
