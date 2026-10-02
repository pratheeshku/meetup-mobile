/**
 * Group Detail screen (DES-MEETUP-MOBILE.md §4.4, §7.3; R-030, R-031).
 *
 * Role/permission gating here is UX-only (§3.10, §5.3, R-017/R-082) —
 * every gated action still calls its endpoint normally and the backend
 * remains the sole authority; a stale `current_user_role` can briefly
 * show an affordance that then fails server-side, which §3.10 itself
 * accepts as a trade-off. "Last-owner removal rejected server-side"
 * (§4.4) is likewise left to the backend — no client-side pre-check
 * beyond the UX gates below.
 *
 * Deviation from the task brief (recorded in the Implementation
 * Report): the brief's Step 4 says "Change member role button (owner
 * only...)", but §4.4 explicitly states "Role management — owner/admin
 * only." Followed the design document over the brief's narrower wording
 * per this project's established fidelity rule (design is the
 * non-negotiable source of truth on behavioral conflicts).
 *
 * Proposed Assumption: role-change and remove controls are also hidden
 * on the owner's own member row (in addition to hiding them on the
 * viewer's own row) — demoting/removing the owner isn't meaningful
 * without an ownership-transfer flow, which is explicitly out of scope
 * for this task, and §4.4 separately notes last-owner removal is
 * rejected server-side regardless.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { useAuth } from '../auth/AuthContext';
import { withCorrelationId } from '../api/correlationId';
import {
  createGroupInvitation,
  getGroup,
  inviteMember,
  removeMember,
  updateMemberRole,
} from '../api/groups';
import Badge from '../components/Badge';
import type { BadgeVariant } from '../components/Badge';
import Button from '../components/Button';
import KeyboardAwareScreen from '../components/KeyboardAwareScreen';
import Card from '../components/Card';
import ErrorView from '../components/ErrorView';
import LoadingView from '../components/LoadingView';
import ShareActionSheet from '../components/ShareActionSheet';
import TextLink from '../components/TextLink';
import Toast from '../components/Toast';
import UserSearchPicker from '../components/UserSearchPicker';
import {
  composeShareMessage,
  copyLinkToClipboard,
  shareGeneric,
  shareToWhatsApp,
} from '../utils/shareLink';
import { borderWidth, colors, radius, sizes, spacing, typography } from '../theme/tokens';
import type { GroupDetail, GroupMember, GroupMemberRole } from '../types/group';
import type { UserSearchResult } from '../types/user';
import type { GroupsStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<GroupsStackParamList, 'GroupDetail'>;

const ROLE_OPTIONS: GroupMemberRole[] = ['member', 'admin'];

const ROLE_BADGE_VARIANT: Record<GroupMemberRole, BadgeVariant> = {
  owner: 'primary',
  admin: 'primary',
  member: 'neutral',
};

function formatRoleLabel(role: GroupMemberRole): string {
  return role.charAt(0).toUpperCase() + role.slice(1);
}

export default function GroupDetailScreen({ route, navigation }: Props): React.JSX.Element {
  const { groupId } = route.params;
  const { user } = useAuth();
  const currentUserId = user?.id;

  const [group, setGroup] = useState<GroupDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [isInviteFormOpen, setIsInviteFormOpen] = useState(false);
  const [selectedInviteUsers, setSelectedInviteUsers] = useState<UserSearchResult[]>([]);
  const [selectedInviteEmail, setSelectedInviteEmail] = useState<string | null>(null);
  const [isInviting, setIsInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);

  const [editingRoleUserId, setEditingRoleUserId] = useState<string | null>(null);
  const [roleDraft, setRoleDraft] = useState<GroupMemberRole>('member');
  const [isSavingRole, setIsSavingRole] = useState(false);
  const [roleError, setRoleError] = useState<string | null>(null);

  const [removingUserId, setRemovingUserId] = useState<string | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);

  const [isLeaving, setIsLeaving] = useState(false);
  const [leaveError, setLeaveError] = useState<string | null>(null);

  const [isCreatingInvite, setIsCreatingInvite] = useState(false);
  const [inviteLinkError, setInviteLinkError] = useState<string | null>(null);
  const [shareSheetVisible, setShareSheetVisible] = useState(false);
  const [groupInviteUrl, setGroupInviteUrl] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const handleShareGroupInvite = async (): Promise<void> => {
    setInviteLinkError(null);
    setIsCreatingInvite(true);
    try {
      const res = await withCorrelationId(async correlationId => {
        return await createGroupInvitation(groupId, { correlationId });
      });
      setGroupInviteUrl(res.invitation_url);
      setShareSheetVisible(true);
    } catch {
      setInviteLinkError('Could not generate group invite link. Please try again.');
    } finally {
      setIsCreatingInvite(false);
    }
  };

  const handleCloseShareSheet = (): void => {
    setShareSheetVisible(false);
  };

  const handleShareGeneric = async (): Promise<void> => {
    if (!group || !groupInviteUrl) {
      return;
    }
    const inviterName = user?.display_name || user?.nickname || 'Someone';
    const message = composeShareMessage(inviterName, group.name, groupInviteUrl);
    await shareGeneric({ message, url: groupInviteUrl });
  };

  const handleShareWhatsApp = async (): Promise<void> => {
    if (!group || !groupInviteUrl) {
      return;
    }
    const inviterName = user?.display_name || user?.nickname || 'Someone';
    const message = composeShareMessage(inviterName, group.name, groupInviteUrl);
    await shareToWhatsApp(message);
  };

  const handleCopyLink = (): void => {
    if (!groupInviteUrl) {
      return;
    }
    copyLinkToClipboard(groupInviteUrl);
    setShareSheetVisible(false);
    setToastMessage('Link copied to clipboard');
  };

  const loadGroup = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const data = await getGroup(groupId);
      setGroup(data);
    } catch {
      setLoadError('Could not load this group. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [groupId]);

  useEffect(() => {
    loadGroup();
  }, [loadGroup]);

  const handleOpenInviteForm = (): void => {
    setInviteError(null);
    setSelectedInviteUsers([]);
    setSelectedInviteEmail(null);
    setIsInviteFormOpen(true);
  };

  const handleCancelInvite = (): void => {
    setIsInviteFormOpen(false);
    setInviteError(null);
    setSelectedInviteUsers([]);
    setSelectedInviteEmail(null);
  };

  const handleSelectUser = (selected: UserSearchResult): void => {
    setSelectedInviteEmail(null);
    setSelectedInviteUsers(prev => {
      if (prev.some(u => u.id === selected.id)) {
        return prev;
      }
      return [...prev, selected];
    });
  };

  const handleSelectEmail = (email: string): void => {
    setSelectedInviteUsers([]);
    setSelectedInviteEmail(email);
  };

  const handleRemoveUser = (userId: string): void => {
    setSelectedInviteUsers(prev => prev.filter(u => u.id !== userId));
  };

  const handleRemoveEmail = (): void => {
    setSelectedInviteEmail(null);
  };

  const handleSendInvite = async (): Promise<void> => {
    if (selectedInviteUsers.length === 0 && !selectedInviteEmail) {
      setInviteError('Search for and choose a user or email to invite.');
      return;
    }
    setInviteError(null);
    setIsInviting(true);
    try {
      await withCorrelationId(async correlationId => {
        if (selectedInviteEmail) {
          await createGroupInvitation(groupId, { invitedEmail: selectedInviteEmail, correlationId });
        } else {
          for (const invitee of selectedInviteUsers) {
            await inviteMember(groupId, invitee.id, { correlationId });
          }
        }
        setGroup(await getGroup(groupId, { correlationId }));
      });
      setIsInviteFormOpen(false);
      setSelectedInviteUsers([]);
      setSelectedInviteEmail(null);
    } catch {
      setInviteError('Could not send the invite. Please try again.');
    } finally {
      setIsInviting(false);
    }
  };

  const handleStartEditRole = (member: GroupMember): void => {
    setRoleError(null);
    setRoleDraft(member.role === 'admin' ? 'admin' : 'member');
    setEditingRoleUserId(member.user_id);
  };

  const handleCancelEditRole = (): void => {
    setEditingRoleUserId(null);
    setRoleError(null);
  };

  const handleSaveRole = async (): Promise<void> => {
    if (!editingRoleUserId) {
      return;
    }
    setRoleError(null);
    setIsSavingRole(true);
    try {
      await withCorrelationId(async correlationId => {
        await updateMemberRole(groupId, editingRoleUserId, roleDraft, { correlationId });
        setGroup(await getGroup(groupId, { correlationId }));
      });
      setEditingRoleUserId(null);
    } catch {
      setRoleError('Could not update this member’s role. Please try again.');
    } finally {
      setIsSavingRole(false);
    }
  };

  const handleRemoveMember = async (userId: string): Promise<void> => {
    setRemoveError(null);
    setRemovingUserId(userId);
    try {
      await withCorrelationId(async correlationId => {
        await removeMember(groupId, userId, { correlationId });
        setGroup(await getGroup(groupId, { correlationId }));
      });
    } catch {
      setRemoveError('Could not remove this member. Please try again.');
    } finally {
      setRemovingUserId(null);
    }
  };

  const handleRemoveMemberPress = (member: GroupMember): void => {
    Alert.alert('Remove Member', `Remove ${member.nickname} from this group?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => handleRemoveMember(member.user_id),
      },
    ]);
  };

  const handleLeaveGroup = async (): Promise<void> => {
    if (!currentUserId) {
      return;
    }
    setLeaveError(null);
    setIsLeaving(true);
    try {
      await removeMember(groupId, currentUserId);
      navigation.goBack();
    } catch {
      setLeaveError('Could not leave the group. Please try again.');
      setIsLeaving(false);
    }
  };

  const handleLeaveGroupPress = (): void => {
    Alert.alert('Leave Group', 'Are you sure you want to leave this group?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Leave', style: 'destructive', onPress: handleLeaveGroup },
    ]);
  };

  if (isLoading) {
    return <LoadingView />;
  }

  if (loadError || !group) {
    return <ErrorView message={loadError ?? 'Group not found.'} onRetry={loadGroup} />;
  }

  // Full-contract-audit fix (2026-09-18, see
  // docs/reports/AUDIT-API-CONTRACTS-2026-09-18.md): the real backend's
  // `GroupResponse` has no `current_user_role` field, and `api/groups.ts`
  // cannot derive one (no access to the signed-in user's id). Computed
  // here instead, from `group.members` (now correctly populated by
  // `getGroup()`) plus `currentUserId` (already read above via
  // `useAuth()`) — the same data this screen already uses for `isSelf`
  // below.
  const currentUserRole = group.members.find(m => m.user_id === currentUserId)?.role ?? 'none';

  const canInvite = currentUserRole === 'owner' || currentUserRole === 'admin';
  // §4.4: "Role management — owner/admin only" (design overrides the
  // brief's narrower "owner only" wording — see the file-level comment).
  const canChangeRoles = currentUserRole === 'owner' || currentUserRole === 'admin';
  const canRemoveMembers = currentUserRole === 'owner' || currentUserRole === 'admin';
  const canLeave = currentUserRole !== 'owner' && currentUserRole !== 'none';

  return (
    <KeyboardAwareScreen contentContainerStyle={styles.container}>
      <Card style={styles.infoCard}>
        <Text style={styles.title}>{group.name}</Text>
        <Text style={styles.description}>{group.description}</Text>
        <Text style={styles.meta}>Owned by {group.owner_nickname}</Text>
        <Text style={styles.meta}>
          {group.member_count} {group.member_count === 1 ? 'member' : 'members'}
        </Text>
        {canInvite ? (
          <Button
            label="Share Group Invite"
            variant="secondary"
            size="sm"
            onPress={handleShareGroupInvite}
            loading={isCreatingInvite}
            accessibilityLabel="Share Group Invite"
            style={styles.shareGroupBtn}
          />
        ) : null}
        {inviteLinkError ? <Text style={styles.errorText}>{inviteLinkError}</Text> : null}
      </Card>

      <Card>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Members</Text>
          {canInvite && !isInviteFormOpen ? (
            <View style={styles.headerLinksRow}>
              <TextLink
                label="Share Link"
                accessibilityLabel="Share Group Link"
                onPress={handleShareGroupInvite}
                disabled={isCreatingInvite}
              />
              <TextLink label="Invite" onPress={handleOpenInviteForm} />
            </View>
          ) : null}
        </View>

        {isInviteFormOpen ? (
          <View style={styles.editRow}>
            {selectedInviteEmail ? (
              <View style={styles.selectedInviteRow}>
                <Text style={styles.selectedInviteText}>
                  Invite by email: {selectedInviteEmail}
                </Text>
                <TextLink
                  label="Change"
                  accessibilityLabel={`Remove ${selectedInviteEmail}`}
                  onPress={handleRemoveEmail}
                  disabled={isInviting}
                />
              </View>
            ) : null}
            {selectedInviteUsers.map(invitee => (
              <View key={invitee.id} style={styles.selectedInviteRow}>
                <Text style={styles.selectedInviteText}>
                  {invitee.nickname} ({invitee.display_name})
                </Text>
                <TextLink
                  label={selectedInviteUsers.length === 1 ? 'Change' : 'Remove'}
                  accessibilityLabel={`Remove ${invitee.nickname}`}
                  onPress={() => handleRemoveUser(invitee.id)}
                  disabled={isInviting}
                />
              </View>
            ))}
            {!selectedInviteEmail ? (
              <UserSearchPicker
                onSelect={handleSelectUser}
                onSelectEmail={handleSelectEmail}
                entityLabel="member"
                excludeGroupId={groupId}
                disabled={isInviting}
              />
            ) : null}
            {inviteError ? <Text style={styles.errorText}>{inviteError}</Text> : null}
            <View style={styles.editActionsRow}>
              <Button
                label="Send Invite"
                size="sm"
                onPress={handleSendInvite}
                loading={isInviting}
                disabled={selectedInviteUsers.length === 0 && !selectedInviteEmail}
                style={styles.actionSpacing}
              />
              <Button
                label="Cancel"
                size="sm"
                variant="secondary"
                onPress={handleCancelInvite}
                disabled={isInviting}
              />
            </View>
          </View>
        ) : null}

        {removeError ? <Text style={styles.errorText}>{removeError}</Text> : null}

        {group.members.map(member => {
          const isSelf = member.user_id === currentUserId;
          const isMemberOwner = member.role === 'owner';
          const showRoleControl = canChangeRoles && !isSelf && !isMemberOwner;
          const showRemoveControl = canRemoveMembers && !isSelf && !isMemberOwner;
          const isEditingThisRole = editingRoleUserId === member.user_id;

          return (
            <View key={member.user_id} style={styles.memberRow}>
              <View style={styles.memberInfo}>
                <Text style={styles.memberNickname}>{member.nickname}</Text>
                <Badge
                  label={formatRoleLabel(member.role)}
                  variant={ROLE_BADGE_VARIANT[member.role]}
                />
              </View>

              {isEditingThisRole ? (
                <View style={styles.editRow}>
                  <View style={styles.rolePickerRow}>
                    {ROLE_OPTIONS.map(option => (
                      <Pressable
                        key={option}
                        style={[
                          styles.roleOption,
                          roleDraft === option && styles.roleOptionSelected,
                        ]}
                        onPress={() => setRoleDraft(option)}
                        disabled={isSavingRole}
                      >
                        <Text
                          style={[
                            styles.roleOptionText,
                            roleDraft === option && styles.roleOptionTextSelected,
                          ]}
                        >
                          {option}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                  {roleError ? <Text style={styles.errorText}>{roleError}</Text> : null}
                  <View style={styles.editActionsRow}>
                    <Button
                      label="Save"
                      size="sm"
                      onPress={handleSaveRole}
                      loading={isSavingRole}
                      style={styles.actionSpacing}
                    />
                    <Button
                      label="Cancel"
                      size="sm"
                      variant="secondary"
                      onPress={handleCancelEditRole}
                      disabled={isSavingRole}
                    />
                  </View>
                </View>
              ) : (
                <View style={styles.memberActionsRow}>
                  {showRoleControl ? (
                    <TextLink
                      label="Change Role"
                      onPress={() => handleStartEditRole(member)}
                      style={styles.linkSpacing}
                    />
                  ) : null}
                  {showRemoveControl ? (
                    <TextLink
                      label="Remove"
                      tone="destructive"
                      onPress={() => handleRemoveMemberPress(member)}
                      loading={removingUserId === member.user_id}
                    />
                  ) : null}
                </View>
              )}
            </View>
          );
        })}
      </Card>

      {canLeave ? (
        <View style={styles.leaveSection}>
          {leaveError ? <Text style={styles.errorText}>{leaveError}</Text> : null}
          <Button
            label="Leave Group"
            variant="destructive"
            onPress={handleLeaveGroupPress}
            loading={isLeaving}
          />
        </View>
      ) : null}
      <ShareActionSheet
        visible={shareSheetVisible}
        title="Share Group Invite"
        onShareGeneric={handleShareGeneric}
        onShareWhatsApp={handleShareWhatsApp}
        onCopyLink={handleCopyLink}
        onClose={handleCloseShareSheet}
      />

      <Toast message={toastMessage} onDismiss={() => setToastMessage(null)} />
    </KeyboardAwareScreen>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.md },
  infoCard: { marginBottom: spacing.md },
  shareGroupBtn: {
    marginTop: spacing.md,
    alignSelf: 'flex-start',
  },
  title: { ...typography.h2, color: colors.textPrimary, marginBottom: spacing.sm },
  description: { ...typography.body, color: colors.textPrimary, marginBottom: spacing.md },
  meta: { ...typography.body, color: colors.textSecondary, marginBottom: spacing.xs },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  headerLinksRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  sectionTitle: { ...typography.h3, color: colors.textPrimary },
  memberRow: {
    paddingVertical: spacing.sm,
    borderBottomWidth: borderWidth.thin,
    borderBottomColor: colors.border,
  },
  memberInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  memberNickname: { ...typography.body, color: colors.textPrimary },
  memberActionsRow: { flexDirection: 'row', marginTop: spacing.sm },
  linkSpacing: { marginRight: spacing.md },
  editRow: { marginTop: spacing.sm, width: '100%' },
  selectedInviteRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  selectedInviteText: { ...typography.body, color: colors.textPrimary, flexShrink: 1 },
  editActionsRow: { flexDirection: 'row', marginTop: spacing.xs },
  actionSpacing: { marginRight: spacing.sm },
  rolePickerRow: { flexDirection: 'row', marginBottom: spacing.sm },
  roleOption: {
    minHeight: sizes.controlSmall,
    justifyContent: 'center',
    borderWidth: borderWidth.thin,
    borderColor: colors.primary,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    marginRight: spacing.sm,
  },
  roleOptionSelected: { backgroundColor: colors.primary },
  roleOptionText: {
    ...typography.bodyBold,
    color: colors.primary,
    textTransform: 'capitalize',
  },
  roleOptionTextSelected: { color: colors.white },
  leaveSection: {
    marginTop: spacing.xl,
    borderTopWidth: borderWidth.thin,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
  },
  errorText: {
    ...typography.body,
    color: colors.error,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
});
