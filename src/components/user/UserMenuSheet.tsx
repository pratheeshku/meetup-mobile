/**
 * The combined user pop-up (DES-MEETUP-ADDENDUM-game-view-redesign AD-7, GV-6; boards
 * docs/design/game-view-redesign/popups). Pure presentation: all state comes from `useUserMenu`.
 *
 * - Sheet: identity on top (picture, display name, nickname or the "No nickname" label, and the
 *   response/role badge when the host row passes one), then a loading row while the card loads,
 *   then only the actions the server allowed (destructive in the error tone), then Close. There is
 *   no separate "View Details" step.
 * - Confirmation: centred dialog with Cancel and Yes.
 * - Notices: the hook's notice shows as a toast, above the sheet while it is open.
 */
import React from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import type { ActionIconKey, UserMenuApi } from '../../hooks/useUserMenu';
import { useT } from '../../labels/LabelsContext';
import { colors, groupView, radius, sizes, spacing, typography } from '../../theme/tokens';
import { OwnerIcon } from '../icons/ActionIcons';
import { PersonMinusIcon, ShieldMinusIcon, ShieldPlusIcon } from '../icons/GroupViewIcons';
import ScreenContainer from '../ScreenContainer';
import Toast from '../Toast';
import UserAvatar from '../UserAvatar';

const ICON_BOX = 28;
const ICON_SIZE = 24;
const GRABBER_WIDTH = 36;

function actionIcon(icon: ActionIconKey, color: string): React.JSX.Element {
  switch (icon) {
    case 'shield_plus':
      return <ShieldPlusIcon size={ICON_SIZE} color={color} />;
    case 'shield_minus':
      return <ShieldMinusIcon size={ICON_SIZE} color={color} />;
    case 'owner':
      return <OwnerIcon size={ICON_SIZE} color={color} />;
    default:
      return <PersonMinusIcon size={ICON_SIZE} color={color} />;
  }
}

const BADGE_BG = {
  accepted: { backgroundColor: colors.successLight },
  declined: { backgroundColor: colors.errorLight },
  pending: { backgroundColor: colors.track },
  organizer: { backgroundColor: colors.ownerChipBg },
  neutral: { backgroundColor: colors.track },
} as const;
const BADGE_TEXT = {
  accepted: { color: colors.successDark },
  declined: { color: colors.error },
  pending: { color: colors.textSecondary },
  organizer: { color: colors.ownerChipText },
  neutral: { color: colors.textSecondary },
} as const;

export default function UserMenuSheet({ menu }: { menu: UserMenuApi }): React.JSX.Element | null {
  const t = useT();
  const { person, card } = menu;

  if (!menu.isOpen) {
    // Notices (for example "Done") outlive the sheet.
    return menu.notice ? <Toast message={menu.notice} onDismiss={menu.clearNotice} /> : null;
  }
  if (!person) {
    return null;
  }

  // Once the card is in, its identity is the freshest; until then the row identity stands.
  const displayName = card?.display_name ?? person.displayName;
  const photoUrl = card ? card.photo_url : person.photoUrl;
  const nickname = card ? card.nickname : person.nickname;

  const badge = person.badge ?? null;

  const identity = (
    <View style={styles.identity} testID="user-menu-details">
      <UserAvatar imageUrl={photoUrl} name={displayName} size={sizes.avatar} fallback="initials" />
      <Text style={styles.identityName} numberOfLines={2}>
        {displayName}
      </Text>
      {nickname ? (
        <Text style={styles.identityNickname} numberOfLines={1}>
          {nickname}
        </Text>
      ) : nickname === null ? (
        <Text style={[styles.identityNickname, styles.identityNoNickname]} numberOfLines={1}>
          {t('mob.user_menu.no_nickname')}
        </Text>
      ) : null}
      {badge ? (
        <View style={[styles.badge, BADGE_BG[badge.tone]]} testID="user-menu-badge">
          <Text style={[styles.badgeText, BADGE_TEXT[badge.tone]]}>{badge.label}</Text>
        </View>
      ) : null}
    </View>
  );

  const sheetBody = (
    <>
      <View style={styles.grabber} />
      {identity}
      {menu.cardStatus === 'loading' ? (
        <View style={styles.loadingRow} testID="user-menu-loading">
          <ActivityIndicator size="small" color={colors.primary} />
        </View>
      ) : null}
      {menu.actions.map(action => {
        const destructive = action.tone === 'destructive';
        return (
          <Pressable
            key={action.key}
            style={({ pressed }) => [styles.row, pressed ? styles.rowPressed : null]}
            onPress={() => menu.runAction(action.key)}
            accessibilityRole="button"
            accessibilityLabel={action.label}
            testID={`user-menu-action-${action.key}`}
          >
            <View style={styles.iconBox}>
              {actionIcon(action.icon, destructive ? groupView.destructive : groupView.blue)}
            </View>
            <Text style={[styles.rowText, destructive ? styles.rowTextDestructive : styles.rowTextAction]}>
              {action.label}
            </Text>
          </Pressable>
        );
      })}
      <Pressable
        onPress={menu.close}
        style={styles.closeButton}
        accessibilityRole="button"
        accessibilityLabel={t('mob.user_menu.close')}
        testID="user-menu-close"
      >
        <Text style={styles.closeButtonText}>{t('mob.user_menu.close')}</Text>
      </Pressable>
    </>
  );

  const confirmBody = (
    <View style={styles.confirmWrap}>
      <View style={styles.confirmCard} accessibilityViewIsModal>
        <Text style={styles.confirmTitle}>{t('mob.user_menu.confirm_title')}</Text>
        <Text style={styles.confirmText}>{menu.confirmBody}</Text>
        <View style={styles.confirmButtons}>
          <Pressable
            onPress={menu.confirmCancel}
            disabled={menu.busy}
            style={styles.confirmButton}
            accessibilityRole="button"
            accessibilityLabel={t('mob.user_menu.confirm_cancel')}
            testID="user-menu-confirm-cancel"
          >
            <Text style={styles.confirmCancelText}>{t('mob.user_menu.confirm_cancel')}</Text>
          </Pressable>
          <Pressable
            onPress={menu.confirmYes}
            disabled={menu.busy}
            style={styles.confirmButton}
            accessibilityRole="button"
            accessibilityLabel={t('mob.user_menu.confirm_yes')}
            accessibilityState={{ disabled: menu.busy, busy: menu.busy }}
            testID="user-menu-confirm-yes"
          >
            <Text
              style={[
                styles.confirmYesText,
                menu.confirmAction?.tone === 'destructive' ? styles.rowTextDestructive : null,
              ]}
            >
              {t('mob.user_menu.confirm_yes')}
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );

  return (
    <Modal visible transparent animationType="fade" onRequestClose={menu.close}>
      <View style={styles.root}>
        <Pressable
          style={[StyleSheet.absoluteFill, styles.backdrop]}
          onPress={menu.mode === 'confirm' ? menu.confirmCancel : menu.close}
          accessibilityRole="button"
          accessibilityLabel={t('mob.user_menu.close')}
        />
        {menu.mode === 'confirm' ? (
          confirmBody
        ) : (
          <ScreenContainer edges="bottom" pointerEvents="box-none" style={styles.sheetHost}>
            <View
              style={styles.sheet}
              accessibilityViewIsModal
              accessibilityLabel={t('mob.user_menu.menu_a11y', { name: displayName })}
              testID="user-menu-sheet"
            >
              {sheetBody}
            </View>
          </ScreenContainer>
        )}
        <Toast message={menu.notice} onDismiss={menu.clearNotice} />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  backdrop: { backgroundColor: groupView.dim },
  sheetHost: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    overflow: 'hidden',
  },
  grabber: {
    alignSelf: 'center',
    width: GRABBER_WIDTH,
    height: 4,
    borderRadius: 2,
    backgroundColor: groupView.divider,
    marginTop: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: sizes.touchTarget,
    paddingHorizontal: spacing.md,
    borderTopWidth: 1,
    borderTopColor: groupView.divider,
  },
  rowPressed: { backgroundColor: groupView.sectionBg },
  iconBox: { width: ICON_BOX, height: ICON_BOX, alignItems: 'center', justifyContent: 'center' },
  rowText: { ...typography.body, color: colors.textPrimary, marginLeft: spacing.md, flexShrink: 1 },
  rowTextAction: { color: colors.textPrimary },
  rowTextDestructive: { color: groupView.destructive },
  loadingRow: {
    minHeight: sizes.controlSmall,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderTopWidth: 1,
    borderTopColor: groupView.divider,
  },
  identity: {
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
  },
  identityName: {
    ...typography.h2,
    color: colors.textPrimary,
    marginTop: spacing.md,
    textAlign: 'center',
  },
  identityNickname: {
    ...typography.body,
    color: groupView.textSecondary,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  identityNoNickname: { fontStyle: 'italic', color: colors.textMuted },
  badge: {
    marginTop: spacing.sm,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 2,
    borderRadius: radius.full,
  },
  badgeText: { ...typography.caption, fontWeight: '700' },
  closeButton: {
    minHeight: sizes.touchTarget,
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    marginBottom: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonText: { ...typography.bodyBold, color: colors.textPrimary },
  confirmWrap: { flex: 1, justifyContent: 'center', paddingHorizontal: spacing.lg },
  confirmCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  confirmTitle: { ...typography.h3, color: colors.textPrimary },
  confirmText: { ...typography.body, color: colors.textSecondary, marginTop: spacing.sm },
  confirmButtons: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: spacing.md },
  confirmButton: {
    minHeight: sizes.touchTarget,
    minWidth: sizes.touchTarget,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
  },
  confirmCancelText: { ...typography.bodyBold, color: groupView.textSecondary },
  confirmYesText: { ...typography.bodyBold, color: groupView.blue },
});
