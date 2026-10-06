/**
 * Create Game Card (Shuttlr Home v2).
 *
 * Requirements:
 * - Create Game card stays visible on both tabs.
 * - Text from labels (Create Game card text).
 * - Navigates to CreateGame.
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useT } from '../../labels/LabelsContext';
import { dash, dashRadius } from '../../theme/dashboardTheme';
import { colors, radius, spacing, typography } from '../../theme/tokens';

interface CreateGameCardProps {
  onPress: () => void;
}

export default function CreateGameCard({ onPress }: CreateGameCardProps): React.JSX.Element {
  const t = useT();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${t('mob.home.create_game_card_title')}, ${t('mob.home.create_game_card_desc')}`}
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed ? styles.pressed : null]}
      testID="create-game-card"
    >
      <View style={styles.leftCol}>
        <View style={styles.plusCircle}>
          <Text style={styles.plusIcon}>+</Text>
        </View>
      </View>

      <View style={styles.contentCol}>
        <Text style={styles.title}>{t('mob.home.create_game_card_title')}</Text>
        <Text style={styles.description}>{t('mob.home.create_game_card_desc')}</Text>
      </View>

      <View style={styles.actionBtn}>
        <Text style={styles.actionBtnText}>{t('mob.home.create_game_button')}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#f8fafc',
    borderRadius: dashRadius.card,
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    borderStyle: 'dashed',
    padding: spacing.md,
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    marginBottom: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
  },
  pressed: {
    opacity: 0.8,
  },
  leftCol: {
    marginRight: spacing.sm + 2,
  },
  plusCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: dash.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  plusIcon: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 22,
  },
  contentCol: {
    flex: 1,
    paddingRight: spacing.sm,
  },
  title: {
    ...typography.bodyBold,
    color: colors.textPrimary,
    fontSize: 14,
  },
  description: {
    ...typography.caption,
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  actionBtn: {
    backgroundColor: dash.brand,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.md,
  },
  actionBtnText: {
    ...typography.caption,
    fontWeight: '700',
    color: '#ffffff',
    fontSize: 12,
  },
});
