/**
 * Long-press member card (docs/mockups/group-view/2-long-press-member.png):
 * the screen is dimmed and a centred card shows the member's large picture,
 * display name and nickname. Actions are optional — a card with no actions is
 * the plain "details" card. Who may see which action is decided by the caller
 * (UX only; the backend stays the authority).
 */
import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { useT } from '../../labels/LabelsContext';
import { colors, groupView, sizes, spacing, typography } from '../../theme/tokens';
import PersonNames from '../PersonNames';
import UserAvatar from '../UserAvatar';

export interface MemberAction {
  key: string;
  label: string;
  tone: 'default' | 'destructive';
  icon: React.ReactNode;
  onPress: () => void;
}

interface MemberActionCardProps {
  visible: boolean;
  displayName: string;
  nickname: string | null;
  photoUrl: string | null;
  actions: MemberAction[];
  onClose: () => void;
}

const CARD_AVATAR_SIZE = 96;

export default function MemberActionCard({
  visible,
  displayName,
  nickname,
  photoUrl,
  actions,
  onClose,
}: MemberActionCardProps): React.JSX.Element {
  const t = useT();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        style={styles.backdrop}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel={t('mob.common.close')}
      >
        {/* Swallow taps on the card itself so only the dimmed area dismisses. */}
        <Pressable
          style={styles.card}
          onPress={() => undefined}
          accessible={false}
          accessibilityLabel={t('mob.group_detail.member_card_a11y', { name: displayName })}
        >
          <View style={styles.identity}>
            <UserAvatar imageUrl={photoUrl} name={displayName} size={CARD_AVATAR_SIZE} fallback="initials" />
            <View style={styles.names}>
              <PersonNames displayName={displayName} nickname={nickname} large centered />
            </View>
          </View>
          {actions.map(action => (
            <Pressable
              key={action.key}
              style={({ pressed }) => [styles.action, pressed ? styles.actionPressed : null]}
              onPress={action.onPress}
              accessibilityRole="button"
              accessibilityLabel={action.label}
            >
              <View style={styles.actionIcon}>{action.icon}</View>
              <Text
                style={[styles.actionText, action.tone === 'destructive' ? styles.actionTextDestructive : null]}
              >
                {action.label}
              </Text>
            </Pressable>
          ))}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: groupView.dim,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 28,
    overflow: 'hidden',
  },
  identity: {
    alignItems: 'center',
    paddingTop: spacing.lg,
    paddingBottom: spacing.lg,
    paddingHorizontal: spacing.md,
  },
  names: { marginTop: spacing.md, alignSelf: 'stretch', alignItems: 'center' },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: sizes.touchTarget + 8,
    paddingHorizontal: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: groupView.divider,
  },
  actionPressed: { backgroundColor: groupView.sectionBg },
  actionIcon: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  actionText: { ...typography.h3, fontWeight: '600', color: groupView.blue, marginLeft: spacing.md },
  actionTextDestructive: { color: groupView.destructive },
});

