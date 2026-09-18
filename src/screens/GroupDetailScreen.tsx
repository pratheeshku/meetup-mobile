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
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { useAuth } from '../auth/AuthContext';
import { withCorrelationId } from '../api/correlationId';
import { getGroup, inviteMember, removeMember, updateMemberRole } from '../api/groups';
import type { GroupDetail, GroupMember, GroupMemberRole } from '../types/group';
import type { GroupsStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<GroupsStackParamList, 'GroupDetail'>;

const ROLE_OPTIONS: GroupMemberRole[] = ['member', 'admin'];

export default function GroupDetailScreen({ route, navigation }: Props): React.JSX.Element {
  const { groupId } = route.params;
  const { user } = useAuth();
  const currentUserId = user?.id;

  const [group, setGroup] = useState<GroupDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [isInviteFormOpen, setIsInviteFormOpen] = useState(false);
  const [inviteUserIdDraft, setInviteUserIdDraft] = useState('');
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
    setInviteUserIdDraft('');
    setIsInviteFormOpen(true);
  };

  const handleCancelInvite = (): void => {
    setIsInviteFormOpen(false);
    setInviteError(null);
  };

  const handleSendInvite = async (): Promise<void> => {
    if (!inviteUserIdDraft.trim()) {
      setInviteError('Enter a user ID.');
      return;
    }
    setInviteError(null);
    setIsInviting(true);
    try {
      await withCorrelationId(async correlationId => {
        await inviteMember(groupId, inviteUserIdDraft.trim(), { correlationId });
        setGroup(await getGroup(groupId, { correlationId }));
      });
      setIsInviteFormOpen(false);
      setInviteUserIdDraft('');
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
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (loadError || !group) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{loadError ?? 'Group not found.'}</Text>
        <Pressable style={styles.retryButton} onPress={loadGroup}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </Pressable>
      </View>
    );
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
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>{group.name}</Text>
      <Text style={styles.description}>{group.description}</Text>
      <Text style={styles.meta}>Owned by {group.owner_nickname}</Text>
      <Text style={styles.meta}>
        {group.member_count} {group.member_count === 1 ? 'member' : 'members'}
      </Text>

      <View style={styles.section}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Members</Text>
          {canInvite && !isInviteFormOpen ? (
            <Pressable onPress={handleOpenInviteForm}>
              <Text style={styles.editLink}>Invite</Text>
            </Pressable>
          ) : null}
        </View>

        {isInviteFormOpen ? (
          <View style={styles.editRow}>
            <TextInput
              style={styles.input}
              placeholder="User ID"
              value={inviteUserIdDraft}
              onChangeText={setInviteUserIdDraft}
              editable={!isInviting}
              autoCapitalize="none"
              autoFocus
            />
            {inviteError ? <Text style={styles.errorText}>{inviteError}</Text> : null}
            <View style={styles.editActionsRow}>
              <Pressable
                style={[styles.smallButton, isInviting && styles.buttonDisabled]}
                onPress={handleSendInvite}
                disabled={isInviting}
              >
                {isInviting ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.smallButtonText}>Send Invite</Text>
                )}
              </Pressable>
              <Pressable
                style={[styles.smallButtonSecondary, isInviting && styles.buttonDisabled]}
                onPress={handleCancelInvite}
                disabled={isInviting}
              >
                <Text style={styles.smallButtonSecondaryText}>Cancel</Text>
              </Pressable>
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
                <Text style={styles.memberRoleBadge}>{member.role}</Text>
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
                    <Pressable
                      style={[styles.smallButton, isSavingRole && styles.buttonDisabled]}
                      onPress={handleSaveRole}
                      disabled={isSavingRole}
                    >
                      {isSavingRole ? (
                        <ActivityIndicator color="#fff" size="small" />
                      ) : (
                        <Text style={styles.smallButtonText}>Save</Text>
                      )}
                    </Pressable>
                    <Pressable
                      style={[styles.smallButtonSecondary, isSavingRole && styles.buttonDisabled]}
                      onPress={handleCancelEditRole}
                      disabled={isSavingRole}
                    >
                      <Text style={styles.smallButtonSecondaryText}>Cancel</Text>
                    </Pressable>
                  </View>
                </View>
              ) : (
                <View style={styles.memberActionsRow}>
                  {showRoleControl ? (
                    <Pressable onPress={() => handleStartEditRole(member)}>
                      <Text style={styles.editLink}>Change Role</Text>
                    </Pressable>
                  ) : null}
                  {showRemoveControl ? (
                    <Pressable
                      onPress={() => handleRemoveMemberPress(member)}
                      disabled={removingUserId === member.user_id}
                    >
                      {removingUserId === member.user_id ? (
                        <ActivityIndicator size="small" color="#c0392b" />
                      ) : (
                        <Text style={styles.removeLink}>Remove</Text>
                      )}
                    </Pressable>
                  ) : null}
                </View>
              )}
            </View>
          );
        })}
      </View>

      {canLeave ? (
        <View style={styles.leaveSection}>
          {leaveError ? <Text style={styles.errorText}>{leaveError}</Text> : null}
          <Pressable
            style={[styles.leaveButton, isLeaving && styles.buttonDisabled]}
            onPress={handleLeaveGroupPress}
            disabled={isLeaving}
          >
            {isLeaving ? (
              <ActivityIndicator color="#c0392b" />
            ) : (
              <Text style={styles.leaveButtonText}>Leave Group</Text>
            )}
          </Pressable>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 8 },
  description: { fontSize: 15, color: '#222', marginBottom: 12 },
  meta: { fontSize: 15, color: '#444', marginBottom: 4 },
  section: { marginTop: 20 },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionTitle: { fontSize: 17, fontWeight: '700' },
  editLink: { color: '#2563eb', fontWeight: '600' },
  removeLink: { color: '#c0392b', fontWeight: '600' },
  memberRow: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  memberInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  memberNickname: { fontSize: 15, color: '#222' },
  memberRoleBadge: {
    fontSize: 12,
    fontWeight: '600',
    color: '#555',
    textTransform: 'capitalize',
  },
  memberActionsRow: { flexDirection: 'row', marginTop: 6 },
  editRow: { marginTop: 8, width: '100%' },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
    fontSize: 15,
  },
  editActionsRow: { flexDirection: 'row', marginTop: 4 },
  smallButton: {
    backgroundColor: '#2563eb',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginRight: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  smallButtonText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  smallButtonSecondary: {
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  smallButtonSecondaryText: { color: '#555', fontWeight: '600', fontSize: 14 },
  rolePickerRow: { flexDirection: 'row', marginBottom: 8 },
  roleOption: {
    borderWidth: 1,
    borderColor: '#2563eb',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginRight: 8,
  },
  roleOptionSelected: { backgroundColor: '#2563eb' },
  roleOptionText: { color: '#2563eb', fontWeight: '600', fontSize: 13, textTransform: 'capitalize' },
  roleOptionTextSelected: { color: '#fff' },
  buttonDisabled: { opacity: 0.6 },
  leaveSection: { marginTop: 32, borderTopWidth: 1, borderTopColor: '#eee', paddingTop: 16 },
  leaveButton: {
    borderWidth: 1,
    borderColor: '#c0392b',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
  },
  leaveButtonText: { color: '#c0392b', fontWeight: '600', fontSize: 16 },
  errorText: { fontSize: 14, color: '#c0392b', marginBottom: 8, textAlign: 'center' },
  retryButton: {
    backgroundColor: '#2563eb',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  retryButtonText: { color: '#fff', fontWeight: '600' },
});
