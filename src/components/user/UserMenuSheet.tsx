/**
 * The user menu and the details view (DES-MEETUP-ADDENDUM-user-details-menu.md AD-4; board
 * docs/mockups/user-menu/ M1-M8). Pure presentation: all state comes from `useUserMenu`.
 *
 * - Menu (M1, M2, M4, M6): bottom sheet, person header, "View Details" first, then only the
 *   actions the server allowed (destructive in the error tone), a loading row while the card loads.
 * - Details (M3, M3b, M7, M8): "Details" title and "Close", 88 px picture, display name, nickname
 *   or the "No nickname" label in muted text.
 * - Confirmation (M5): centred dialog with Cancel and Yes.
 * - Notices (M6): the hook's notice shows as a toast, above the sheet while it is open.
 */
import React from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import type { ActionIconKey, UserMenuApi } from '../../hooks/useUserMenu';
import { useT } from '../../labels/LabelsContext';
import { colors, groupView, radius, sizes, spacing, typography } from '../../theme/tokens';
import { OwnerIcon } from '../icons/ActionIcons';
import { PersonMinusIcon, ShieldMinusIcon, ShieldPlusIcon } from '../icons/GroupViewIcons';
import { InfoIcon } from '../icons/HomeV2Icons';
import ScreenContainer from '../ScreenContainer';
import Toast from '../Toast';
import UserAvatar from '../UserAvatar';

const HEADER_AVATAR_SIZE = 40;
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

  const header = (
    <View style={styles.personHeader}>
      <UserAvatar imageUrl={photoUrl} name={displayName} size={HEADER_AVATAR_SIZE} fallback="initials" />
      <Text style={styles.headerName} numberOfLines={1}>
        {displayName}
      </Text>
    </View>
  );

  const menuBody = (
    <>
      <View style={styles.grabber} />
      {header}
      <Pressable
        style={({ pressed }) => [styles.row, pressed ? styles.rowPressed : null]}
        onPress={menu.showDetails}
        accessibilityRole="button"
        accessibilityLabel={t('mob.user_menu.view_details')}
        testID="user-menu-view-details"
      >
        <View style={styles.iconBox}>
          <InfoIcon size={ICON_SIZE} color={groupView.textSecondary} />
        </View>
        <Text style={styles.rowText}>{t('mob.user_menu.view_details')}</Text>
      </Pressable>
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
    </>
  );

  const detailsBody = (
    <View testID="user-menu-details">
      <View style={styles.detailsHeader}>
        <Text style={styles.detailsTitle} accessibilityRole="header">
          {t('mob.user_menu.details_title')}
        </Text>
        <Pressable
          onPress={menu.close}
          style={styles.closeTarget}
          accessibilityRole="button"
          accessibilityLabel={t('mob.user_menu.close')}
          testID="user-menu-close"
        >
          <Text style={styles.closeText}>{t('mob.user_menu.close')}</Text>
        </Pressable>
      </View>
      <View style={styles.detailsIdentity}>
        <UserAvatar imageUrl={photoUrl} name={displayName} size={sizes.avatar} fallback="initials" />
        <Text style={styles.detailsName} numberOfLines={2}>
          {displayName}
        </Text>
        {nickname ? (
          <Text style={styles.detailsNickname} numberOfLines={1}>
            {nickname}
          </Text>
        ) : nickname === null ? (
          <Text style={[styles.detailsNickname, styles.detailsNoNickname]} numberOfLines={1}>
            {t('mob.user_menu.no_nickname')}
          </Text>
        ) : null}
      </View>
    </View>
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
              {menu.mode === 'details' ? detailsBody : menuBody}
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
  personHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  headerName: { ...typography.bodyBold, color: colors.textPrimary, marginLeft: spacing.md, flexShrink: 1 },
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
  detailsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: spacing.md,
  },
  detailsTitle: { ...typography.h3, color: colors.textPrimary },
  closeTarget: {
    minWidth: sizes.touchTarget,
    minHeight: sizes.touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  closeText: { ...typography.caption, color: groupView.textSecondary },
  detailsIdentity: {
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
  },
  detailsName: {
    ...typography.h2,
    color: colors.textPrimary,
    marginTop: spacing.md,
    textAlign: 'center',
  },
  detailsNickname: {
    ...typography.body,
    color: groupView.textSecondary,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  detailsNoNickname: { fontStyle: 'italic', color: colors.textMuted },
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
