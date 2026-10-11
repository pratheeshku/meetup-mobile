/**
 * First-run step 2: notification preferences (only when NOTIFICATION_STEP is
 * ENABLED). Embeds the SAME `NotificationPreferencesList` the Settings screen
 * uses (addendum D11). Toggles save immediately, so Save just advances;
 * a device-permission banner shows only when the permission is not granted
 * and never re-prompts.
 */
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { spacing } from '../../theme/tokens';
import NotificationPreferencesList from '../NotificationPreferencesList';
import StepFooter from './StepFooter';

export default function NotificationsStep({
  onDone,
}: {
  onDone: (outcome: 'saved' | 'skipped') => void;
}): React.JSX.Element {
  return (
    <View style={styles.container}>
      <NotificationPreferencesList showPermissionBanner />
      <View style={styles.footer}>
        <StepFooter onSave={() => onDone('saved')} onSkip={() => onDone('skipped')} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  footer: { paddingHorizontal: spacing.md, paddingBottom: spacing.md },
});
