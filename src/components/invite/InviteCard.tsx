/**
 * "Invite" card of the organizer view (DES-MEETUP-ADDENDUM-game-view-redesign GV-5; board
 * docs/design/game-view-redesign/game-view). Two entries, "Invite groups" and "Invite players", each
 * opening the invite picker. Replaces the old invite entry buttons in place; any extra action
 * (the Share button) is passed as `footer` and keeps its behaviour.
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useT } from '../../labels/LabelsContext';
import {
  borderWidth,
  colors,
  groupView,
  radius,
  sizes,
  spacing,
  typography,
} from '../../theme/tokens';
import Card from '../Card';
import { ChevronRightIcon, PlusIcon } from '../icons/ActionIcons';

interface InviteCardProps {
  onInviteGroups?: () => void;
  onInvitePlayers?: () => void;
  footer?: React.ReactNode;
}

const CIRCLE = 32;

function Entry({
  label,
  onPress,
  testID,
}: {
  label: string;
  onPress: () => void;
  testID: string;
}): React.JSX.Element {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.entry, pressed ? styles.pressed : null]}
      testID={testID}
    >
      <View style={styles.circle}>
        <PlusIcon size={18} color={groupView.blue} />
      </View>
      <Text style={styles.entryText}>{label}</Text>
      <ChevronRightIcon size={18} color={colors.textMuted} />
    </Pressable>
  );
}

export default function InviteCard({
  onInviteGroups,
  onInvitePlayers,
  footer,
}: InviteCardProps): React.JSX.Element {
  const t = useT();
  return (
    <Card style={styles.card} testID="invite-card">
      <Text style={styles.title} accessibilityRole="header">
        {t('mob.gv.invite_title')}
      </Text>
      <Text style={styles.hint}>{t('mob.gv.invite_hint')}</Text>
      {onInviteGroups ? (
        <Entry
          label={t('mob.gv.invite_groups')}
          onPress={onInviteGroups}
          testID="invite-group-entry"
        />
      ) : null}
      {onInvitePlayers ? (
        <Entry
          label={t('mob.gv.invite_players')}
          onPress={onInvitePlayers}
          testID="invite-player-entry"
        />
      ) : null}
      {footer}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { padding: spacing.md },
  title: { ...typography.h3, color: colors.textPrimary },
  hint: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
  },
  entry: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: sizes.touchTarget,
    paddingHorizontal: spacing.sm,
    marginBottom: spacing.sm,
    borderRadius: radius.md,
    borderWidth: borderWidth.thin,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  pressed: { opacity: 0.8 },
  circle: {
    width: CIRCLE,
    height: CIRCLE,
    borderRadius: CIRCLE / 2,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  entryText: { ...typography.bodyBold, color: colors.textPrimary, flex: 1 },
});
