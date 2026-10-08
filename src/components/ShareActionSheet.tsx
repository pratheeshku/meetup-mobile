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
import { LinkIcon } from './icons/SharedIcons';
import { colors, radius, sizes, spacing, typography } from '../theme/tokens';
import { useT } from '../labels/LabelsContext';
import { stripIconGlyphs } from '../utils/labels';

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
  title,
  onShareGeneric,
  onShareWhatsApp,
  onCopyLink,
  onClose,
}: ShareActionSheetProps): React.JSX.Element {
  const t = useT();
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
          accessibilityLabel={t('mob.share_sheet.close_a11y')}
          onPress={onClose}
          style={[StyleSheet.absoluteFill, styles.backdrop]}
        />
        <View style={styles.sheet}>
          <Text style={styles.title} accessibilityRole="header">
            {title ?? t('mob.share_sheet.title')}
          </Text>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('mob.share_sheet.whatsapp')}
            onPress={onShareWhatsApp}
            style={({ pressed }) => [styles.row, pressed ? styles.pressed : null]}
          >
            <Text style={styles.emoji} accessibilityElementsHidden importantForAccessibility="no" aria-hidden={true}>
              💬
            </Text>
            <View style={styles.textContainer}>
              <Text style={styles.rowLabel}>{stripIconGlyphs(t('mob.share_sheet.whatsapp'))}</Text>
              <Text style={styles.rowSubLabel}>{t('mob.share_sheet.whatsapp_hint')}</Text>
            </View>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('mob.share_sheet.other_apps')}
            onPress={onShareGeneric}
            style={({ pressed }) => [styles.row, pressed ? styles.pressed : null]}
          >
            <Text style={styles.emoji} accessibilityElementsHidden importantForAccessibility="no" aria-hidden={true}>
              📤
            </Text>
            <View style={styles.textContainer}>
              <Text style={styles.rowLabel}>{stripIconGlyphs(t('mob.share_sheet.other_apps'))}</Text>
              <Text style={styles.rowSubLabel}>{t('mob.share_sheet.other_apps_hint')}</Text>
            </View>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('mob.share_sheet.copy_link')}
            onPress={onCopyLink}
            style={({ pressed }) => [styles.row, pressed ? styles.pressed : null]}
          >
            <View
              style={styles.iconWrap}
              accessibilityElementsHidden
              importantForAccessibility="no"
              aria-hidden={true}
            >
              <LinkIcon size={24} />
            </View>
            <View style={styles.textContainer}>
              <Text style={styles.rowLabel}>{stripIconGlyphs(t('mob.share_sheet.copy_link'))}</Text>
              <Text style={styles.rowSubLabel}>{t('mob.share_sheet.copy_link_hint')}</Text>
            </View>
          </Pressable>

          <Button label={t('mob.common.close')} variant="secondary" onPress={onClose} style={styles.close} />
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
  iconWrap: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
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
