/**
 * Share action sheet modal (DES-MEETUP-MOBILE-ADDENDUM-shareable-links §4).
 *
 * Provides three share actions for event organizers and group admins:
 * 1. Generic native share sheet (`Share.share`)
 * 2. WhatsApp direct share (`whatsapp://` with `https://wa.me/` fallback)
 * 3. Copy link to clipboard
 *
 * Implemented using React Native core `Modal` + `Pressable` (same architecture
 * as `CreateMenu.tsx`), fully accessible and requiring zero third-party dependencies.
 */
import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import Button from './Button';
import { colors, radius, sizes, spacing, typography } from '../theme/tokens';

export interface ShareActionSheetProps {
  visible: boolean;
  title?: string;
  onShareGeneric: () => void;
  onShareWhatsApp: () => void;
  onCopyLink: () => void;
  onClose: () => void;
}

export default function ShareActionSheet({
  visible,
  title = 'Share',
  onShareGeneric,
  onShareWhatsApp,
  onCopyLink,
  onClose,
}: ShareActionSheetProps): React.JSX.Element {
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
          accessibilityLabel="Close share menu"
          onPress={onClose}
          style={[StyleSheet.absoluteFill, styles.backdrop]}
        />
        <View style={styles.sheet}>
          <Text style={styles.title} accessibilityRole="header">
            {title}
          </Text>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Share via WhatsApp"
            onPress={onShareWhatsApp}
            style={({ pressed }) => [styles.row, pressed ? styles.pressed : null]}
          >
            <Text style={styles.emoji} accessibilityElementsHidden importantForAccessibility="no">
              💬
            </Text>
            <View style={styles.textContainer}>
              <Text style={styles.rowLabel}>Share via WhatsApp</Text>
              <Text style={styles.rowSubLabel}>Send invite message directly</Text>
            </View>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Share via other apps"
            onPress={onShareGeneric}
            style={({ pressed }) => [styles.row, pressed ? styles.pressed : null]}
          >
            <Text style={styles.emoji} accessibilityElementsHidden importantForAccessibility="no">
              📤
            </Text>
            <View style={styles.textContainer}>
              <Text style={styles.rowLabel}>Share via other apps</Text>
              <Text style={styles.rowSubLabel}>Open system share sheet</Text>
            </View>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Copy Link"
            onPress={onCopyLink}
            style={({ pressed }) => [styles.row, pressed ? styles.pressed : null]}
          >
            <Text style={styles.emoji} accessibilityElementsHidden importantForAccessibility="no">
              🔗
            </Text>
            <View style={styles.textContainer}>
              <Text style={styles.rowLabel}>Copy Link</Text>
              <Text style={styles.rowSubLabel}>Copy link to clipboard</Text>
            </View>
          </Pressable>

          <Button label="Close" variant="secondary" onPress={onClose} style={styles.close} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
    paddingHorizontal: spacing.lg,
  },
  title: {
    ...typography.h3,
    color: colors.textPrimary,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    minHeight: sizes.touchTarget,
  },
  pressed: {
    backgroundColor: colors.background,
  },
  emoji: {
    fontSize: 24,
    marginRight: spacing.md,
  },
  textContainer: {
    flex: 1,
  },
  rowLabel: {
    ...typography.body,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  rowSubLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  close: {
    marginTop: spacing.md,
  },
});
