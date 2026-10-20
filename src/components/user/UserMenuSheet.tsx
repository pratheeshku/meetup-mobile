/**
 * The user menu and the View Details view (board: docs/mockups/user-menu/user-menu-board.png, M1-M6).
 *
 * One bottom sheet. Menu: handle, the person (40 px avatar + name), View Details first, then the
 * actions the server allowed. Details: title row, 88 px picture, display name, nickname (or the
 * `no_nickname` label). Confirmation: a centred dialog. Presentational only; `UserMenuHost`
 * drives it from `useUserMenuEngine`. It absorbs the old `MemberActionCard`.
 */
import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import type { UserMenuEngine } from '../../hooks/useUserMenuEngine';
import type { UserMenuAction } from '../../hooks/userMenuActions';
import type { UserMenuPerson } from '../../hooks/useUserMenu';
import { useT } from '../../labels/LabelsContext';
import { colors, radius, shadows, sizes, spacing, typography } from '../../theme/tokens';
import { InfoIcon } from '../icons/GroupViewIcons';
import PersonNames from '../PersonNames';
import Toast from '../Toast';
import UserAvatar from '../UserAvatar';

const HEADER_AVATAR_SIZE = 40;
const ROW_HEIGHT = 52;
const ICON_BOX = 24;
const ICON_SIZE = 22;

interface UserMenuSheetProps {
  engine: UserMenuEngine;
}

function avatarFor(person: UserMenuPerson, size: number): React.JSX.Element {
  return (
    <UserAvatar
      imageUrl={person.photoUrl}
      name={person.displayName}
      size={size}
      fallback={person.noUser ? 'person' : 'initials'}
    />
  );
}

function Row({
  label,
  icon,
  tone = 'default',
  onPress,
  testID,
}: {
  label: string;
  icon: React.ReactNode;
  tone?: 'default' | 'destructive';
  onPress: () => void;
  testID?: string;
}): React.JSX.Element {
  return (
    <Pressable
      style={({ pressed }) => [styles.row, pressed ? styles.rowPressed : null]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      testID={testID}
    >
      <View style={styles.iconBox}>{icon}</View>
      <Text style={[styles.rowText, tone === 'destructive' ? styles.rowTextDestructive : null]}>
        {label}
      </Text>
    </Pressable>
  );
}

function iconFor(action: UserMenuAction): React.ReactNode {
  const color = action.tone === 'destructive' ? colors.error : colors.textPrimary;
  return <action.Icon size={ICON_SIZE} color={color} />;
}

export default function UserMenuSheet({ engine }: UserMenuSheetProps): React.JSX.Element {
  const t = useT();
  const { person, view } = engine;
  const name = person?.displayName ?? '';
  const nicknameKnown = person?.nickname !== undefined;
  const hasNickname = Boolean(person?.nickname && person.nickname.trim());

  let body: React.ReactNode = null;
  if (person && view === 'menu') {
    body = (
      <View style={styles.sheet} testID="user-menu">
        <View style={styles.handle} />
        <View style={styles.person}>
          {avatarFor(person, HEADER_AVATAR_SIZE)}
          <Text style={styles.personName} numberOfLines={1}>
            {name}
          </Text>
        </View>
        <Row
          label={t('mob.user_menu.view_details')}
          icon={<InfoIcon size={ICON_SIZE} color={colors.textPrimary} />}
          onPress={engine.showDetails}
          testID="user-menu-view-details"
        />
        {engine.actions.map(action => (
          <Row
            key={action.key}
            label={t(action.labelKey)}
            icon={iconFor(action)}
            tone={action.tone}
            onPress={() => engine.chooseAction(action)}
            testID={`user-menu-action-${action.key}`}
          />
        ))}
      </View>
    );
  } else if (person && view === 'details') {
    body = (
      <View style={[styles.sheet, styles.detailsSheet]} testID="user-details">
        <View style={styles.detailsHeader}>
          <Text style={styles.detailsTitle} accessibilityRole="header">
            {t('mob.user_menu.details_title')}
          </Text>
          <Pressable
            onPress={engine.close}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={t('mob.user_menu.close')}
            testID="user-details-close"
          >
            <Text style={styles.closeText}>{t('mob.user_menu.close')}</Text>
          </Pressable>
        </View>
        <View style={styles.detailsBody}>
          {avatarFor(person, sizes.avatar)}
          <View style={styles.detailsNames}>
            <PersonNames displayName={name} nickname={person.nickname} large centered />
            {nicknameKnown && !hasNickname ? (
              <Text style={styles.noNickname} testID="user-details-no-nickname">
                {t('mob.user_menu.no_nickname')}
              </Text>
            ) : null}
          </View>
        </View>
      </View>
    );
  } else if (person && view === 'confirm' && engine.confirming) {
    const action = engine.confirming;
    const destructive = action.tone === 'destructive';
    body = (
      <View style={styles.dialogWrap} pointerEvents="box-none">
        <View style={styles.dialog} testID="user-menu-confirm">
          <Text style={styles.dialogTitle}>{t('mob.user_menu.confirm_title')}</Text>
          <Text style={styles.dialogBody}>{t(action.confirmBodyKey, { name })}</Text>
          <View style={styles.dialogActions}>
            <Pressable
              onPress={engine.cancelConfirm}
              disabled={engine.busy}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel={t('mob.user_menu.confirm_cancel')}
              testID="user-menu-confirm-cancel"
            >
              <Text style={styles.dialogCancel}>{t('mob.user_menu.confirm_cancel')}</Text>
            </Pressable>
            <Pressable
              onPress={engine.confirm}
              disabled={engine.busy}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel={t('mob.user_menu.confirm_yes')}
              testID="user-menu-confirm-yes"
            >
              <Text style={[styles.dialogYes, destructive ? styles.dialogYesDestructive : null]}>
                {t('mob.user_menu.confirm_yes')}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    );
  }

  return (
    <Modal visible={engine.visible} transparent animationType="fade" onRequestClose={engine.close}>
      <View style={styles.root}>
        <Pressable
          style={styles.scrim}
          onPress={view === 'confirm' ? engine.cancelConfirm : engine.close}
          accessibilityRole="button"
          accessibilityLabel={t('mob.user_menu.close')}
        />
        {body}
        <Toast message={engine.sheetMessage} onDismiss={engine.dismissSheetMessage} />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  scrim: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: colors.scrim },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingBottom: spacing.sm,
  },
  detailsSheet: { paddingBottom: spacing.lg },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  person: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: spacing.sm,
    paddingBottom: 12,
  },
  personName: { ...typography.bodyBold, color: colors.textPrimary, marginLeft: 12, flexShrink: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    height: ROW_HEIGHT,
    paddingHorizontal: 20,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  rowPressed: { backgroundColor: colors.primaryLight },
  iconBox: { width: ICON_BOX, height: ICON_BOX, alignItems: 'center', justifyContent: 'center' },
  rowText: { ...typography.button, fontWeight: '400', color: colors.textPrimary, marginLeft: 12 },
  rowTextDestructive: { color: colors.error },
  detailsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  detailsTitle: { ...typography.h3, color: colors.textPrimary },
  closeText: { fontSize: 14, fontWeight: '600', color: colors.textMuted },
  detailsBody: { alignItems: 'center', padding: 20 },
  detailsNames: { marginTop: spacing.md, alignSelf: 'stretch', alignItems: 'center' },
  noNickname: { ...typography.body, fontStyle: 'italic', color: colors.textMuted, marginTop: 2 },
  dialogWrap: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', paddingHorizontal: 24 },
  dialog: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 20,
    ...shadows.overlay,
  },
  dialogTitle: { ...typography.h3, color: colors.textPrimary },
  dialogBody: { ...typography.body, color: colors.textSecondary, marginTop: spacing.sm },
  dialogActions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 20 },
  dialogCancel: { ...typography.button, color: colors.textMuted, marginRight: spacing.md },
  dialogYes: { ...typography.button, color: colors.primary },
  dialogYesDestructive: { color: colors.error },
});
