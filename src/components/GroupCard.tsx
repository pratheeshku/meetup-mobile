/**
 * Group card component matching the visual styling of EventCard:
 * - Row 1: Role pill (Owner/Admin/Member) with rounded/colored-bg/white-text
 * - Row 2: Group name (h3 / 700)
 * - Row 3: Description (1 line, textMuted, falls back to blank)
 * - Row 4: Member count on left, "View →" action link on right (accent / 700)
 *
 * No progress bar row (groups have no capacity/fill metric).
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { borderWidth, colors, radius, shadows, spacing, typography } from '../theme/tokens';
import type { Group, GroupRole } from '../types/group';
import Card from './Card';
import { useT } from '../labels/LabelsContext';
import type { LabelKey } from '../labels/fallbackLabels';

export interface GroupCardProps {
  group: Group;
  onPress: () => void;
  currentUserId?: string;
}

export const ROLE_BADGE_LABEL_KEY: Record<GroupRole, LabelKey> = {
  owner: 'mob.group_role.owner',
  admin: 'mob.group_role.admin',
  member: 'mob.group_role.member',
  none: 'mob.group_role.none',
};

export const ROLE_BADGE_VARIANT: Record<GroupRole, 'primary' | 'neutral'> = {
  owner: 'primary',
  admin: 'primary',
  member: 'neutral',
  none: 'neutral',
};

export const ROLE_PILL_BACKGROUND: Record<'primary' | 'neutral', string> = {
  primary: colors.primary,
  neutral: colors.textSecondary,
};

export function getRolePillColor(role: GroupRole): string {
  const variant = ROLE_BADGE_VARIANT[role] ?? 'neutral';
  return ROLE_PILL_BACKGROUND[variant] ?? colors.textSecondary;
}

export default function GroupCard({ group, onPress, currentUserId }: GroupCardProps): React.JSX.Element {
  const t = useT();
  const isOwner = Boolean(
    group.current_user_role === 'owner' ||
      (currentUserId && group.owner_id === currentUserId),
  );

  const roleLabel = t(
    isOwner
      ? 'mob.group_role.owner'
      : ROLE_BADGE_LABEL_KEY[group.current_user_role] ?? 'mob.group_role.member',
  );
  const roleBg = getRolePillColor(isOwner ? 'owner' : group.current_user_role);

  const ownerName = isOwner ? t('mob.group_card.owner_self') : group.owner_nickname || t('mob.group_card.owner_fallback');
  const ownerDisplay = t('mob.group_card.owner_line', { name: ownerName });

  const memberText =
    group.member_count !== undefined && group.member_count !== null
      ? t(group.member_count === 1 ? 'mob.group_card.members_one' : 'mob.group_card.members_other', {
          count: group.member_count,
        })
      : '';

  return (
    <Card style={styles.card} onPress={onPress} accessibilityLabel={group.name}>
      {/* Row 1: Role pill */}
      <View style={styles.topRow}>
        <View style={[styles.rolePill, { backgroundColor: roleBg }]}>
          <Text style={styles.roleText}>{roleLabel}</Text>
        </View>
      </View>

      {/* Row 2: Group name */}
      <Text style={styles.title} numberOfLines={1}>
        {group.name}
      </Text>

      {/* Row 3: Description (up to 2 lines, textMuted; if empty, fall back to blank) */}
      {group.description ? (
        <Text style={styles.description} numberOfLines={2}>
          {group.description}
        </Text>
      ) : null}

      {/* Row 4: Member count & Owner on left, Action link on right */}
      <View style={styles.bottomRow}>
        <View style={styles.metaContainer}>
          {memberText ? <Text style={styles.memberCount}>{memberText}</Text> : null}
          {memberText ? <Text style={styles.metaDot}> · </Text> : null}
          <Text style={styles.ownerText}>{ownerDisplay}</Text>
        </View>
        <Text style={styles.actionLink}>{t('mob.common.view_arrow')}</Text>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: borderWidth.thin,
    borderColor: colors.border,
    ...shadows.card,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  rolePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.full,
  },
  roleText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '600',
  },
  title: {
    ...typography.h3,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  description: {
    ...typography.caption,
    color: colors.textMuted,
    marginBottom: spacing.md,
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metaContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
    marginRight: spacing.sm,
  },
  memberCount: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  metaDot: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  ownerText: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  actionLink: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.accent,
  },
});
