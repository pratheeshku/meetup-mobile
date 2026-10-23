/** Board TournDiscard: leaving the wizard throws the answers away (BP-12: no server draft), so ask first. */
import React from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';

import { useT } from '../../../labels/LabelsContext';
import { colors, radius, spacing, typography } from '../../../theme/tokens';
import Button from '../../Button';
import IconBadge from '../../IconBadge';
import { WarningIcon } from '../../icons/ActionIcons';

const BADGE = 48;

export default function DiscardDialog({
  visible,
  onDiscard,
  onKeep,
}: {
  visible: boolean;
  onDiscard: () => void;
  onKeep: () => void;
}): React.JSX.Element {
  const t = useT();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onKeep}>
      <View style={styles.scrim}>
        <View style={styles.card} accessibilityViewIsModal testID="tw-discard-dialog">
          <IconBadge size={BADGE} color="amber">
            <WarningIcon size={26} color={colors.white} />
          </IconBadge>
          <Text style={styles.title} accessibilityRole="header">
            {t('mob.tw.discard_title')}
          </Text>
          <Text style={styles.body}>{t('mob.tw.discard_body')}</Text>
          <Button label={t('mob.tw.discard')} variant="destructive" onPress={onDiscard} style={styles.button} />
          <Button label={t('mob.tw.keep_editing')} variant="secondary" onPress={onKeep} style={styles.button} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: colors.scrim, justifyContent: 'center', padding: spacing.lg },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, alignItems: 'center' },
  title: { ...typography.h3, color: colors.textPrimary, marginTop: spacing.md, textAlign: 'center' },
  body: { ...typography.body, color: colors.textSecondary, marginTop: spacing.sm, textAlign: 'center' },
  button: { alignSelf: 'stretch', marginTop: spacing.sm },
});
