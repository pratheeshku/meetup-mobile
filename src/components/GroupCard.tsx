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

export interface GroupCardProps {
  group: Group;
  onPress: () => void;
}

export const ROLE_BADGE_LABEL: Record<GroupRole, string> = {
  owner: 'Owner',
  admin: 'Admin',
  member: 'Member',
  none: 'None',
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

export default function GroupCard({ group, onPress }: GroupCardProps): React.JSX.Element {
  const roleLabel = ROLE_BADGE_LABEL[group.current_user_role] ?? 'Member';
  const roleBg = getRolePillColor(group.current_user_role);

  const memberText =
    group.member_count !== undefined
      ? `${group.member_count} ${group.member_count === 1 ? 'member' : 'members'}`
      : '';

  return (
    <Card style={styles.card} onPress={onPress}>
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

      {/* Row 3: Description (1 line, textMuted; if empty, fall back to blank) */}
      {group.description ? (
        <Text style={styles.description} numberOfLines={1}>
          {group.description}
        </Text>
      ) : null}

      {/* Row 4: Member count & Action link */}
      <View style={styles.bottomRow}>
        <Text style={styles.memberCount}>{memberText}</Text>
        <Text style={styles.actionLink}>View →</Text>
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
  memberCount: {
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
