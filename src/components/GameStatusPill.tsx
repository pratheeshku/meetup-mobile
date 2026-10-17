/**
 * Display-status pill (active / cancelled / completed) for game rows and the
 * game detail header. Cancelled and completed use a muted style.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useT } from '../labels/LabelsContext';
import type { LabelKey } from '../labels/fallbackLabels';
import { colors, radius, spacing, typography } from '../theme/tokens';
import type { GameDisplayStatus } from '../types/event';

const LABEL_KEY: Record<GameDisplayStatus, LabelKey> = {
  active: 'mob.game_status.active',
  cancelled: 'mob.game_status.cancelled',
  completed: 'mob.game_status.completed',
};

export default function GameStatusPill({ status }: { status: GameDisplayStatus }): React.JSX.Element {
  const t = useT();
  const muted = status !== 'active';
  return (
    <View
      testID={`game-status-pill-${status}`}
      style={[styles.pill, muted ? styles.pillMuted : styles.pillActive]}
    >
      <Text style={[styles.text, muted ? styles.textMuted : styles.textActive]}>{t(LABEL_KEY[status])}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    alignSelf: 'flex-start',
  },
  pillActive: { backgroundColor: colors.successLight },
  pillMuted: { backgroundColor: colors.track },
  text: { ...typography.label },
  textActive: { color: colors.successDark },
  textMuted: { color: colors.textMuted },
});
