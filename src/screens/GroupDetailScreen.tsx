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
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
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
import { getCachedBanners, type BannerFallback } from '../api/home';
import { BannerBackground } from '../components/icons/DashboardIcons';
import {
  BackArrowIcon,
  EditIcon,
  LockIcon,
  TrashIcon,
} from '../components/icons/ActionIcons';
import DeleteGroupSheet from '../components/groups/DeleteGroupSheet';
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
import { useAppShare } from '../hooks/useAppShare';
import { goToDashboard } from '../navigation/goToDashboard';
import { showCompletion } from '../navigation/showCompletion';
import { dash } from '../theme/dashboardTheme';
import { borderWidth, colors, radius, sizes, spacing, typography } from '../theme/tokens';
import type { GroupDetail, GroupMember, GroupMemberRole } from '../types/group';
import type { UserSearchResult } from '../types/user';
import type { GroupsStackParamList } from '../navigation/types';
import { useT } from '../labels/LabelsContext';
import type { LabelKey } from '../labels/fallbackLabels';

type Props = NativeStackScreenProps<GroupsStackParamList, 'GroupDetail'>;

const ROLE_OPTIONS: GroupMemberRole[] = ['member', 'admin'];

const ROLE_LABEL_KEY: Record<GroupMemberRole, LabelKey> = {
  owner: 'mob.group_role.owner',
  admin: 'mob.group_role.admin',
  member: 'mob.group_role.member',
};

const ROLE_BADGE_VARIANT: Record<GroupMemberRole, BadgeVariant> = {
  owner: 'primary',
  admin: 'primary',
  member: 'neutral',
};

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export default function GroupDetailScreen({ navigation, route }: Props): React.JSX.Element {
  const { groupId } = route.params;
  const { user } = useAuth();
  const t = useT();
  const tRef = useRef(t);
  tRef.current = t;
  const currentUserId = user?.id;

  const [group, setGroup] = useState<GroupDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [bannerFallback, setBannerFallback] = useState<BannerFallback | null>(null);
  const [isDeleteSheetVisible, setIsDeleteSheetVisible] = useState(false);

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

  const share = useAppShare();

  const loadGroup = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const data = await getGroup(groupId);
      setGroup(data);
    } catch {
      setLoadError(tRef.current('mob.group_detail.load_error'));
    } finally {
      setIsLoading(false);
    }
  }, [groupId]);

  useFocusEffect(
    useCallback(() => {
      loadGroup();
    }, [loadGroup]),
  );

  useEffect(() => {
    getCachedBanners().then(cached => {
      if (cached?.fallback) {
        setBannerFallback(cached.fallback);
      }
    });
  }, []);

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
      setInviteError(t('mob.group_detail.invite_choose'));
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
      goToDashboard(t('mob.success.group_updated'));
    } catch {
      setInviteError(t('mob.group_detail.invite_error'));
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
      goToDashboard(t('mob.success.group_updated'));
    } catch {
      setRoleError(t('mob.group_detail.role_error'));
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
      goToDashboard(t('mob.success.group_updated'));
    } catch {
      setRemoveError(t('mob.group_detail.remove_error'));
    } finally {
      setRemovingUserId(null);
    }
  };

  const handleRemoveMemberPress = (member: GroupMember): void => {
    Alert.alert(
      t('mob.group_detail.remove_title'),
      t('mob.group_detail.remove_message', { name: member.nickname }),
      [
      { text: t('mob.common.cancel'), style: 'cancel' },
      {
        text: t('mob.common.remove'),
        style: 'destructive',
        onPress: () => handleRemoveMember(member.user_id),
      },
      ],
    );
  };

  const handleLeaveGroup = async (): Promise<void> => {
    if (!currentUserId) {
      return;
    }
    setLeaveError(null);
    setIsLeaving(true);
    try {
      await removeMember(groupId, currentUserId);
      showCompletion({
        flow: 'group_left',
        rows: [
          { label: t('mob.done.f_name'), value: group?.name ?? '' },
          { label: t('mob.done.f_status'), value: t('mob.done.v_left') },
        ],
        primary: 'groups',
      });
    } catch {
      setLeaveError(t('mob.group_detail.leave_error'));
      setIsLeaving(false);
    }
  };

  const handleLeaveGroupPress = (): void => {
    Alert.alert(t('mob.group_detail.leave_title'), t('mob.group_detail.leave_message'), [
      { text: t('mob.common.cancel'), style: 'cancel' },
      { text: t('mob.group_detail.leave_confirm'), style: 'destructive', onPress: handleLeaveGroup },
    ]);
  };

  if (isLoading) {
    return <LoadingView />;
  }

  if (loadError || !group) {
    return <ErrorView message={loadError ?? t('mob.group_detail.not_found')} onRetry={loadGroup} />;
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
  const isOwner = currentUserRole === 'owner' || group.owner_id === currentUserId;

  const canInvite = currentUserRole === 'owner' || currentUserRole === 'admin';
  // §4.4: "Role management — owner/admin only" (design overrides the
  // brief's narrower "owner only" wording — see the file-level comment).
  const canChangeRoles = currentUserRole === 'owner' || currentUserRole === 'admin';
  const canRemoveMembers = currentUserRole === 'owner' || currentUserRole === 'admin';
  const canLeave = !isOwner && currentUserRole !== 'none';

  return (
    <KeyboardAwareScreen contentContainerStyle={styles.container}>
      <View style={styles.headerCard}>
        {bannerFallback?.image_url ? (
          <Image
            source={{ uri: bannerFallback.image_url }}
            style={styles.headerBackground}
            resizeMode="cover"
            accessibilityLabel={t('mob.group_detail.banner_bg_alt')}
          />
        ) : (
          <View style={styles.headerBackgroundFallback}>
            <BannerBackground width="100%" height="100%" />
          </View>
        )}
        <View style={styles.headerScrim} />

        <View style={styles.headerContent}>
          <View style={styles.headerTopBar}>
            <Pressable
              onPress={() => navigation.goBack()}
              style={styles.headerCircularButton}
              accessibilityRole="button"
              accessibilityLabel={t('mob.common.back')}
            >
              <BackArrowIcon size={18} color={colors.white} />
            </Pressable>

            {isOwner ? (
              <View style={styles.headerActionRow}>
                <Pressable
                  onPress={() => navigation.navigate('EditGroup', { groupId })}
                  style={styles.headerCircularButton}
                  accessibilityRole="button"
                  accessibilityLabel={t('mob.group_detail.edit_group_a11y')}
                >
                  <EditIcon size={18} color={colors.white} />
                </Pressable>
                <Pressable
                  onPress={() => setIsDeleteSheetVisible(true)}
                  style={styles.headerCircularButton}
                  accessibilityRole="button"
                  accessibilityLabel={t('mob.group_detail.delete_group_a11y')}
                >
                  <TrashIcon size={18} color={colors.white} />
                </Pressable>
              </View>
            ) : <View style={styles.headerActionSpacer} />}
          </View>

          <View style={styles.headerIdentityCentered}>
            {group.logo_url ? (
              <Image source={{ uri: group.logo_url }} style={styles.groupLogo} resizeMode="cover" />
            ) : (
              <View style={styles.groupLogoInitials}>
                <Text style={styles.groupInitialsText}>
                  {getInitials(group.name)}
                </Text>
              </View>
            )}

            <Text style={styles.groupName}>{group.name}</Text>

            <View style={styles.groupMetaRow}>
              <Text style={styles.groupCounts}>
                {t('mob.group_detail.counts_line', {
                  group_members: t(
                    (group.member_count ?? group.members.length) === 1
                      ? 'mob.group_card.members_one'
                      : 'mob.group_card.members_other',
                    { count: group.member_count ?? group.members.length },
                  ),
                  games: t(
                    (group.upcoming_game_count ?? 0) === 1
                      ? 'mob.group_detail.upcoming_games_one'
                      : 'mob.group_detail.upcoming_games_other',
                    { count: group.upcoming_game_count ?? 0 },
                  ),
                })}
              </Text>
              <Text style={styles.metaDot}> · </Text>
              {isOwner ? (
                <View style={styles.ownerChip}>
                  <Text style={styles.ownerChipText}>{t('mob.group_detail.owner_chip')}</Text>
                </View>
              ) : (
                <View style={styles.memberChip}>
                  <Text style={styles.memberChipText}>{t('mob.group_detail.member_chip')}</Text>
                </View>
              )}
            </View>
          </View>
        </View>
      </View>

      <Card style={styles.infoCard}>
        {group.description ? <Text style={styles.description}>{group.description}</Text> : null}
        <Text style={styles.meta}>
          {t('mob.group_detail.owned_by', { name: group.owner_nickname ?? '' })}
        </Text>
        {canInvite ? (
          <Button
            label={t('mob.group_detail.share_button')}
            variant="secondary"
            size="sm"
            onPress={share.open}
            accessibilityLabel={t('mob.group_detail.share_button')}
            style={styles.shareGroupBtn}
          />
        ) : null}
      </Card>

      <Card>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>{t('mob.group_detail.members_title')}</Text>
          {canInvite && !isInviteFormOpen ? (
            <View style={styles.headerLinksRow}>
              <TextLink
                label={t('mob.group_detail.share_link')}
                accessibilityLabel={t('mob.group_detail.share_link_a11y')}
                onPress={share.open}
              />
              <TextLink label={t('mob.group_detail.invite')} onPress={handleOpenInviteForm} />
            </View>
          ) : null}
        </View>

        {isInviteFormOpen ? (
          <View style={styles.editRow}>
            {selectedInviteEmail ? (
              <View style={styles.selectedInviteRow}>
                <Text style={styles.selectedInviteText}>
                  {t('mob.group_detail.invite_by_email', { email: selectedInviteEmail })}
                </Text>
                <TextLink
                  label={t('mob.common.change')}
                  accessibilityLabel={t('mob.group_detail.remove_invitee_a11y', { name: selectedInviteEmail })}
                  onPress={handleRemoveEmail}
                  disabled={isInviting}
                />
              </View>
            ) : null}
            {selectedInviteUsers.map(invitee => (
              <View key={invitee.id} style={styles.selectedInviteRow}>
                <Text style={styles.selectedInviteText}>
                  {t('mob.group_detail.invitee_line', {
                    nickname: invitee.nickname,
                    name: invitee.display_name,
                  })}
                </Text>
                <TextLink
                  label={selectedInviteUsers.length === 1 ? t('mob.common.change') : t('mob.common.remove')}
                  accessibilityLabel={t('mob.group_detail.remove_invitee_a11y', { name: invitee.nickname })}
                  onPress={() => handleRemoveUser(invitee.id)}
                  disabled={isInviting}
                />
              </View>
            ))}
            {!selectedInviteEmail ? (
              <UserSearchPicker
                onSelect={handleSelectUser}
                onSelectEmail={handleSelectEmail}
                excludeGroupId={groupId}
                excludeUserIds={selectedInviteUsers.map(invitee => invitee.id)}
                suggestionContext="group_members"
                disabled={isInviting}
              />
            ) : null}
            {inviteError ? <Text style={styles.errorText}>{inviteError}</Text> : null}
            <View style={styles.editActionsRow}>
              <Button
                label={t('mob.group_detail.send_invite')}
                size="sm"
                onPress={handleSendInvite}
                loading={isInviting}
                disabled={selectedInviteUsers.length === 0 && !selectedInviteEmail}
                style={styles.actionSpacing}
              />
              <Button
                label={t('mob.common.cancel')}
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
                  label={t(ROLE_LABEL_KEY[member.role])}
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
                          {t(ROLE_LABEL_KEY[option])}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                  {roleError ? <Text style={styles.errorText}>{roleError}</Text> : null}
                  <View style={styles.editActionsRow}>
                    <Button
                      label={t('mob.common.save')}
                      size="sm"
                      onPress={handleSaveRole}
                      loading={isSavingRole}
                      style={styles.actionSpacing}
                    />
                    <Button
                      label={t('mob.common.cancel')}
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
                      label={t('mob.group_detail.change_role')}
                      onPress={() => handleStartEditRole(member)}
                      style={styles.linkSpacing}
                    />
                  ) : null}
                  {showRemoveControl ? (
                    <TextLink
                      label={t('mob.common.remove')}
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

      {!isOwner ? (
        <View style={styles.memberNoticeBanner}>
          <LockIcon size={16} color={colors.primary} />
          <Text style={styles.memberNoticeText}>{t('mob.group_detail.owner_only_note')}</Text>
        </View>
      ) : null}

      {canLeave ? (
        <View style={styles.leaveSection}>
          {leaveError ? <Text style={styles.errorText}>{leaveError}</Text> : null}
          <Button
            label={t('mob.group_detail.leave_button')}
            variant="destructive"
            onPress={handleLeaveGroupPress}
            loading={isLeaving}
          />
        </View>
      ) : null}
      <DeleteGroupSheet
        groupId={group.id}
        groupName={group.name}
        memberCount={group.member_count ?? group.members.length}
        visible={isDeleteSheetVisible}
        onClose={() => setIsDeleteSheetVisible(false)}
        onDeleted={() => {
          showCompletion({
            flow: 'group_deleted',
            rows: [
              { label: t('mob.done.f_name'), value: group.name },
              { label: t('mob.done.f_status'), value: t('mob.done.v_deleted') },
            ],
            primary: 'groups',
          });
        }}
      />
      <ShareActionSheet
        visible={share.sheetVisible}
        title={t('mob.group_detail.share_title')}
        onShareGeneric={share.shareViaSystem}
        onShareWhatsApp={share.shareViaWhatsApp}
        onCopyLink={share.copyLink}
        onClose={share.close}
      />

      <Toast message={share.toastMessage} onDismiss={share.clearToast} />
    </KeyboardAwareScreen>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.md },
  headerCard: {
    borderRadius: radius.lg,
    overflow: 'hidden',
    position: 'relative',
    marginBottom: spacing.md,
  },
  headerBackground: {
    ...StyleSheet.absoluteFill,
    width: '100%',
    height: '100%',
  },
  headerBackgroundFallback: {
    ...StyleSheet.absoluteFill,
    backgroundColor: dash.brand,
    overflow: 'hidden',
  },
  headerScrim: {
    ...StyleSheet.absoluteFill,
    backgroundColor: colors.scrim,
  },
  headerContent: {
    padding: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
  },
  headerTopBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  headerCircularButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.overlayWhite25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerActionSpacer: {
    width: 36,
    height: 36,
  },
  headerActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  headerIdentityCentered: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupLogo: {
    width: 88,
    height: 88,
    borderRadius: 24,
    borderWidth: 3,
    borderColor: colors.white,
  },
  groupLogoInitials: {
    width: 88,
    height: 88,
    borderRadius: 24,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: colors.white,
  },
  groupInitialsText: {
    fontSize: 32,
    fontWeight: '700',
    color: colors.primary,
  },
  groupName: {
    ...typography.h2,
    color: colors.white,
    textAlign: 'center',
    marginTop: spacing.sm,
    marginBottom: 4,
  },
  groupMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
  },
  groupCounts: {
    ...typography.caption,
    color: colors.white,
  },
  metaDot: {
    ...typography.caption,
    color: colors.white,
  },
  ownerChip: {
    backgroundColor: colors.ownerChipBg,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
    alignSelf: 'center',
  },
  ownerChipText: {
    ...typography.label,
    color: colors.ownerChipText,
    fontWeight: '700',
  },
  memberChip: {
    backgroundColor: colors.white,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
    alignSelf: 'center',
  },
  memberChipText: {
    ...typography.label,
    color: colors.primary,
    fontWeight: '700',
  },
  memberNoticeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primaryLight,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  memberNoticeText: {
    ...typography.caption,
    color: colors.textPrimary,
    marginLeft: spacing.sm,
    flex: 1,
  },
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
