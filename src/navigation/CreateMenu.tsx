/**
 * Create menu opened by the center "+" button: Game / Group.
 *
 * Create Flow Amendment (DES-MEETUP-MOBILE.md §4.3, architect-approved
 * 2026-09-22): "Create Tournament" removed as a separate entry —
 * tournament creation moved into the Create Game screen's Casual/
 * Tournament toggle (`CreateGameScreen.tsx`).
 *
 * Presentational only (core `Modal` + `View`, no dependency): the caller owns
 * `visible` and what each choice does. Dismissing — backdrop tap, the Close
 * button, or the Android back button (`onRequestClose`) — calls `onClose`
 * and never `onSelect`.
 *
 * The backdrop is a sibling of the sheet, not its parent, so a tap on the
 * sheet's non-pressable padding is swallowed by the sheet instead of falling
 * through to the backdrop and closing the menu.
 */
import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import Button from '../components/Button';
import { colors, opacity, radius, shadows, sizes, spacing, typography } from '../theme/tokens';

export type CreateTarget = 'game' | 'group';

export const CREATE_MENU_ITEMS: ReadonlyArray<{ target: CreateTarget; emoji: string; label: string }> = [
  { target: 'game', emoji: '🎮', label: 'Create Game' },
  { target: 'group', emoji: '👥', label: 'Create Group' },
];

interface CreateMenuProps {
  visible: boolean;
  onSelect: (target: CreateTarget) => void;
  onClose: () => void;
}

export default function CreateMenu({ visible, onSelect, onClose }: CreateMenuProps): React.JSX.Element {
  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.root}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close create menu"
          onPress={onClose}
          style={[StyleSheet.absoluteFill, styles.backdrop]}
        />
        <View style={styles.sheet}>
          <Text style={styles.title} accessibilityRole="header">
            Create
          </Text>
          {CREATE_MENU_ITEMS.map(item => (
            <Pressable
              key={item.target}
              accessibilityRole="button"
              accessibilityLabel={item.label}
              onPress={() => onSelect(item.target)}
              style={({ pressed }) => [styles.row, pressed ? styles.pressed : null]}
            >
              <Text style={styles.emoji} accessibilityElementsHidden importantForAccessibility="no">
                {item.emoji}
              </Text>
              <Text style={styles.rowLabel}>{item.label}</Text>
            </Pressable>
          ))}
          <Button label="Close" variant="secondary" onPress={onClose} style={styles.close} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { backgroundColor: colors.scrim },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing.md,
    paddingBottom: spacing.lg,
    ...shadows.overlay,
  },
  title: { ...typography.h3, color: colors.textPrimary, marginBottom: spacing.sm },
  row: {
    minHeight: sizes.touchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  pressed: { opacity: opacity.pressed },
  emoji: { ...typography.h2, width: spacing.xl, textAlign: 'center', marginRight: spacing.md },
  rowLabel: { ...typography.bodyBold, color: colors.textPrimary },
  close: { marginTop: spacing.sm },
});
