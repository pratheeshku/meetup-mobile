/**
 * The greyed skeleton preview a locked tab opens (AD-T5, TE-07; boards TV2MobOpenLockFixtures,
 * TV2MobClosedLockFixtures, TV2MobLiveLockResults, TV2MobPlayerView). No data for the locked content is sent or shown:
 * grey blocks only, and a card with the lock glyph and the unlock message from the label system. The server's
 * `unlocks` code picks the message.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useT } from '../../../labels/LabelsContext';
import { dash } from '../../../theme/dashboardTheme';
import { borderWidth, colors, radius, shadows, spacing, typography } from '../../../theme/tokens';
import { unlockLabelKey } from '../../../utils/tournamentExperience';
import { LockIcon } from '../../icons/ActionIcons';

const LOCK_CIRCLE = 44;

export default function LockedPreview({ unlocks }: { unlocks: string | null | undefined }): React.JSX.Element {
  const t = useT();
  return (
    <View style={styles.panel} testID="tournament-locked-preview">
      <View style={styles.skeleton} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <View style={styles.pillRow}>
          <View style={[styles.block, styles.pill]} />
          <View style={[styles.block, styles.pill]} />
        </View>
        <View style={[styles.block, styles.line]} />
        <View style={[styles.block, styles.lineShort]} />
        <View style={[styles.block, styles.line]} />
      </View>
      <View style={styles.card}>
        <View style={styles.lockCircle}>
          <LockIcon size={20} color={colors.textMuted} />
        </View>
        <Text style={styles.title} accessibilityRole="header">
          {t('mob.tournament.tabs.locked_title')}
        </Text>
        <Text style={styles.message} testID="tournament-locked-message">
          {t(unlockLabelKey(unlocks))}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    marginHorizontal: spacing.md,
    padding: spacing.sm + 4,
    backgroundColor: dash.page,
    borderWidth: borderWidth.medium,
    borderColor: dash.panelBorder,
    borderRadius: radius.lg,
    minHeight: 320,
  },
  skeleton: { opacity: 0.6 },
  pillRow: { flexDirection: 'row', marginBottom: spacing.md },
  block: { backgroundColor: dash.skeleton, borderRadius: radius.md },
  pill: { width: 84, height: 28, borderRadius: radius.full, marginRight: spacing.sm },
  line: { height: 56, marginBottom: spacing.sm + 4 },
  lineShort: { height: 56, width: '70%', marginBottom: spacing.sm + 4 },
  card: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    top: 90,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    alignItems: 'center',
    ...shadows.card,
  },
  lockCircle: {
    width: LOCK_CIRCLE,
    height: LOCK_CIRCLE,
    borderRadius: LOCK_CIRCLE / 2,
    backgroundColor: colors.track,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  title: { ...typography.h3, color: dash.text, textAlign: 'center' },
  message: { ...typography.body, color: dash.textMuted, textAlign: 'center', marginTop: spacing.xs },
});
