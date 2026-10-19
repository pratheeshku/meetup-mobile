/**
 * Group Detail screen (DES-MEETUP-MOBILE.md §4.4, §7.3; R-030, R-031), rebuilt
 * WhatsApp group-info style from docs/mockups/group-view/ (1-group-view,
 * 2-long-press-member, 3-invite-search).
 *
 * Role/permission gating here is UX-only (§3.10, §5.3, R-017/R-082) —
 * every gated action still calls its endpoint normally and the backend
 * remains the sole authority. The gates are unchanged from the previous
 * screen: owner/admin may invite, change roles and remove other members
 * (never themselves, never the owner); only the owner sees "Make owner",
 * which reuses the existing `POST /groups/{id}/transfer-ownership` call.
 * "Last-owner removal rejected server-side" (§4.4) is left to the backend.
 *
 * Member order: owner, then admins, then everyone else, each alphabetical by
 * display name (case-insensitive, user id as the stable tiebreak).
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { useAuth } from '../auth/AuthContext';
import { withCorrelationId } from '../api/correlationId';
import {
  createGroupInvitation,
  getGroup,
  inviteMember,
  removeMember,
  transferGroupOwnership,
  updateMemberRole,
} from '../api/groups';
import { useRefetchOnFocus } from '../hooks/useRefetchOnFocus';
import { useUnavailableScreen } from '../hooks/useUnavailableScreen';
import { isNotFoundError } from '../utils/apiError';
import { getCachedBanners, type BannerFallback } from '../api/home';
import { OwnerIcon, TrashIcon } from '../components/icons/ActionIcons';
import {
  CheckMarkIcon,
  ChevronLeftIcon,
  LinkIcon,
  PencilLineIcon,
  PersonMinusIcon,
  ShieldMinusIcon,
  ShieldPlusIcon,
} from '../components/icons/GroupViewIcons';
import DeleteGroupSheet from '../components/groups/DeleteGroupSheet';
import MemberActionCard, { type MemberAction } from '../components/groups/MemberActionCard';
import { AddEntryButton } from '../components/AddRemoveControl';
import UndoAddButton from '../components/groups/UndoAddButton';
import UserAvatar from '../components/UserAvatar';
import Button from '../components/Button';
import KeyboardAwareScreen from '../components/KeyboardAwareScreen';
import ErrorView from '../components/ErrorView';
import LoadingView from '../components/LoadingView';
import PersonNames from '../components/PersonNames';
import ShareActionSheet from '../components/ShareActionSheet';
import Toast from '../components/Toast';
import UserSearchPicker from '../components/UserSearchPicker';
import { useAppShare } from '../hooks/useAppShare';
import { goToDashboard } from '../navigation/goToDashboard';
import { showCompletion } from '../navigation/showCompletion';
import { colors, groupView, sizes, spacing, typography } from '../theme/tokens';
import type { GroupDetail, GroupMember, GroupMemberRole } from '../types/group';
import type { UserSearchResult } from '../types/user';
import type { GroupsStackParamList } from '../navigation/types';
import { useT } from '../labels/LabelsContext';

const MEMBER_AVATAR_SIZE = 48;
const LOGO_SIZE = 96;
const LOGO_SIZE_COMPACT = 40;
const BUTTON_HEIGHT = 48;

type Props = NativeStackScreenProps<GroupsStackParamList, 'GroupDetail'>;

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

const ROLE_RANK: Record<GroupMemberRole, number> = { owner: 0, admin: 1, member: 2 };

/** Owner, then admins, then members; alphabetical (case-insensitive) within each; stable. */
export function sortMembers(members: GroupMember[]): GroupMember[] {
  return [...members].sort((a, b) => {
    const byRole = ROLE_RANK[a.role] - ROLE_RANK[b.role];
    if (byRole !== 0) return byRole;
    const an = a.display_name.toLowerCase();
    const bn = b.display_name.toLowerCase();
    if (an !== bn) return an < bn ? -1 : 1;
    return a.user_id < b.user_id ? -1 : a.user_id > b.user_id ? 1 : 0;
  });
}

export default function GroupDetailScreen({ navigation, route }: Props): React.JSX.Element {
  const { groupId } = route.params;
  const { user } = useAuth();
  const t = useT();
  const tRef = useRef(t);
  tRef.current = t;
  const insets = useSafeAreaInsets();
  const currentUserId = user?.id;

  const [group, setGroup] = useState<GroupDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [bannerFallback, setBannerFallback] = useState<BannerFallback | null>(null);
  const [isDeleteSheetVisible, setIsDeleteSheetVisible] = useState(false);

  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [addedUsers, setAddedUsers] = useState<UserSearchResult[]>([]);
  const [addedEmails, setAddedEmails] = useState<string[]>([]);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const inviteInFlight = useRef(false);
  const [undoingId, setUndoingId] = useState<string | null>(null);
  // Bumped after an undo so the invite list refetches and the person reappears with "+".
  const [searchRefresh, setSearchRefresh] = useState(0);

  const [cardMember, setCardMember] = useState<GroupMember | null>(null);
  const [memberError, setMemberError] = useState<string | null>(null);

  const [isLeaving, setIsLeaving] = useState(false);
  const [leaveError, setLeaveError] = useState<string | null>(null);

  const share = useAppShare();

  // `silent` refreshes in place (focus / foreground after the first load) instead of flashing
  // the loading view.
  const unavailable = useUnavailableScreen(navigation);
  const loadGroup = useCallback(
    async (silent: boolean = false) => {
      if (!silent) {
        setIsLoading(true);
        setLoadError(null);
      }
      try {
        const data = await getGroup(groupId);
        setGroup(data);
      } catch (error) {
        // 404 = gone or no longer visible to this user (AC-11): close with the neutral
        // message, once.
        if (isNotFoundError(error)) {
          unavailable.onNotFound();
        } else if (!silent) {
          setLoadError(tRef.current('mob.group_detail.load_error'));
        }
      } finally {
        if (!silent) {
          setIsLoading(false);
        }
      }
    },
    [groupId, unavailable],
  );

  // Fetch on every focus and app foreground (AC-10), including a push that opens a group already
  // on the stack.
  const loadedGroupIdRef = useRef<string | null>(null);
  useRefetchOnFocus(
    navigation,
    useCallback(() => {
      const silent = loadedGroupIdRef.current === groupId;
      if (!silent) {
        unavailable.reset();
      }
      loadedGroupIdRef.current = groupId;
      loadGroup(silent);
    }, [loadGroup, groupId, unavailable]),
    groupId,
  );

  useEffect(() => {
    getCachedBanners().then(cached => {
      if (cached?.fallback) {
        setBannerFallback(cached.fallback);
      }
    });
  }, []);

  const sortedMembers = useMemo(() => sortMembers(group?.members ?? []), [group?.members]);

  const handleOpenInvite = (): void => {
    setInviteError(null);
    setAddedUsers([]);
    setAddedEmails([]);
    setIsInviteOpen(true);
  };

  const handleCloseInvite = (): void => {
    setIsInviteOpen(false);
    setInviteError(null);
  };

  // Same calls as before (`POST /groups/{id}/members`, `POST /groups/invitations`); each "+" tap
  // sends that one invite, as on the group-create invite step. The promise rejects on failure so
  // the shared "+" control returns to "+" with the error label (AD-19); it resolves only once the
  // server confirmed.
  const handleAddUser = async (invitee: UserSearchResult): Promise<void> => {
    if (inviteInFlight.current) {
      throw new Error('invite busy');
    }
    inviteInFlight.current = true;
    setInviteError(null);
    try {
      await withCorrelationId(async correlationId => {
        await inviteMember(groupId, invitee.id, { correlationId });
      });
      setAddedUsers(current =>
        current.some(item => item.id === invitee.id) ? current : [...current, invitee],
      );
      loadGroup(true);
    } finally {
      inviteInFlight.current = false;
    }
  };

  // Undo of a mistaken "+": the existing `DELETE /groups/{id}/members/{user}` call, no confirmation.
  // Never the owner or the signed-in user. Email invites have no cancel endpoint, so no undo.
  const handleUndoUser = async (invitee: UserSearchResult): Promise<void> => {
    if (inviteInFlight.current || invitee.id === currentUserId || invitee.id === group?.owner_id) return;
    inviteInFlight.current = true;
    setUndoingId(invitee.id);
    setInviteError(null);
    try {
      await withCorrelationId(async correlationId => {
        await removeMember(groupId, invitee.id, { correlationId });
      });
      setAddedUsers(current => current.filter(item => item.id !== invitee.id));
      setSearchRefresh(tick => tick + 1);
      loadGroup(true);
    } catch {
      setInviteError(tRef.current('mob.group_detail.undo_error'));
    } finally {
      inviteInFlight.current = false;
      setUndoingId(null);
    }
  };

  const handleAddEmail = async (email: string): Promise<void> => {
    if (addedEmails.some(item => item.toLowerCase() === email.toLowerCase())) {
      return;
    }
    if (inviteInFlight.current) {
      throw new Error('invite busy');
    }
    inviteInFlight.current = true;
    setInviteError(null);
    try {
      await withCorrelationId(async correlationId => {
        await createGroupInvitation(groupId, { invitedEmail: email, correlationId });
      });
      setAddedEmails(current => [...current, email]);
    } finally {
      inviteInFlight.current = false;
    }
  };

  const handleChangeRole = async (member: GroupMember): Promise<void> => {
    const nextRole: GroupMemberRole = member.role === 'admin' ? 'member' : 'admin';
    setMemberError(null);
    try {
      await withCorrelationId(async correlationId => {
        await updateMemberRole(groupId, member.user_id, nextRole, { correlationId });
        setGroup(await getGroup(groupId, { correlationId }));
      });
      goToDashboard(t('mob.success.group_updated'));
    } catch {
      setMemberError(t('mob.group_detail.role_error'));
    }
  };

  const handleRemoveMember = async (userId: string): Promise<void> => {
    setMemberError(null);
    try {
      await withCorrelationId(async correlationId => {
        await removeMember(groupId, userId, { correlationId });
        setGroup(await getGroup(groupId, { correlationId }));
      });
      goToDashboard(t('mob.success.group_updated'));
    } catch {
      setMemberError(t('mob.group_detail.remove_error'));
    }
  };

  const handleRemoveMemberPress = (member: GroupMember): void => {
    Alert.alert(
      t('mob.group_detail.remove_title'),
      t('mob.group_detail.remove_message', { name: member.display_name }),
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

  const handleMakeOwner = async (member: GroupMember): Promise<void> => {
    setMemberError(null);
    try {
      await withCorrelationId(async correlationId => {
        await transferGroupOwnership(groupId, member.user_id, { correlationId });
        setGroup(await getGroup(groupId, { correlationId }));
      });
      goToDashboard(t('mob.group_transfer.success'));
    } catch {
      setMemberError(t('mob.group_transfer.error'));
    }
  };

  const handleMakeOwnerPress = (member: GroupMember): void => {
    Alert.alert(
      t('mob.group_transfer.confirm_prompt', { name: member.display_name }),
      t('mob.group_transfer.confirm_message'),
      [
        { text: t('mob.common.cancel'), style: 'cancel' },
        {
          text: t('mob.group_transfer.confirm_button'),
          onPress: () => handleMakeOwner(member),
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
      // The user's own action: any 404 after this closes the screen quietly (completion flow only).
      unavailable.markOwnAction();
      showCompletion({
        flow: 'group_left',
        rows: [
          { label: t('mob.done.f_name'), value: group?.name ?? '' },
          { label: t('mob.done.f_status'), value: t('mob.done.v_left') },
        ],
        primary: 'groups',
      });
    } catch (e) {
      if (isNotFoundError(e)) {
        unavailable.onNotFound();
      } else {
        setLeaveError(t('mob.group_detail.leave_error'));
      }
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
    return <ErrorView message={loadError ?? t('mob.group_detail.not_found')} onRetry={() => loadGroup(false)} />;
  }

  // Full-contract-audit fix (2026-09-18, see
  // docs/reports/AUDIT-API-CONTRACTS-2026-09-18.md): the real backend's
  // `GroupResponse` has no `current_user_role` field. Computed here from
  // `group.members` plus `currentUserId`.
  const currentUserRole = group.members.find(m => m.user_id === currentUserId)?.role ?? 'none';
  const isOwner = currentUserRole === 'owner' || group.owner_id === currentUserId;

  const canInvite = currentUserRole === 'owner' || currentUserRole === 'admin';
  // §4.4: "Role management — owner/admin only" (unchanged).
  const canChangeRoles = currentUserRole === 'owner' || currentUserRole === 'admin';
  const canRemoveMembers = currentUserRole === 'owner' || currentUserRole === 'admin';
  const canLeave = !isOwner && currentUserRole !== 'none';

  const memberCount = group.member_count ?? group.members.length;
  const countsLine = t('mob.group_detail.header_line', {
    group_members: t(memberCount === 1 ? 'mob.group_card.members_one' : 'mob.group_card.members_other', {
      count: memberCount,
    }),
    games: t(
      (group.upcoming_game_count ?? 0) === 1
        ? 'mob.group_detail.upcoming_games_one'
        : 'mob.group_detail.upcoming_games_other',
      { count: group.upcoming_game_count ?? 0 },
    ),
  });

  // Actions offered on the long-press card. Same gates as the old inline controls: never on
  // yourself, never on the owner; Make owner is owner-only.
  const buildActions = (member: GroupMember): MemberAction[] => {
    const actionable = member.user_id !== currentUserId && member.role !== 'owner';
    if (!actionable) {
      return [];
    }
    const actions: MemberAction[] = [];
    if (canChangeRoles) {
      const isAdmin = member.role === 'admin';
      actions.push({
        key: 'role',
        label: t(isAdmin ? 'mob.group_detail.action_demote' : 'mob.group_detail.action_make_admin'),
        tone: 'default',
        icon: isAdmin ? (
          <ShieldMinusIcon size={24} color={groupView.blue} />
        ) : (
          <ShieldPlusIcon size={24} color={groupView.blue} />
        ),
        onPress: () => {
          setCardMember(null);
          handleChangeRole(member);
        },
      });
    }
    if (isOwner) {
      actions.push({
        key: 'owner',
        label: t('mob.group_detail.action_make_owner'),
        tone: 'default',
        icon: <OwnerIcon size={24} color={groupView.blue} />,
        onPress: () => {
          setCardMember(null);
          handleMakeOwnerPress(member);
        },
      });
    }
    if (canRemoveMembers) {
      actions.push({
        key: 'remove',
        label: t('mob.group_detail.action_remove'),
        tone: 'destructive',
        icon: <PersonMinusIcon size={24} color={groupView.destructive} />,
        onPress: () => {
          setCardMember(null);
          handleRemoveMemberPress(member);
        },
      });
    }
    return actions;
  };

  const headerBackdrop = bannerFallback?.image_url ? (
    <>
      <Image
        source={{ uri: bannerFallback.image_url }}
        style={styles.headerBackground}
        resizeMode="cover"
        accessibilityLabel={t('mob.group_detail.banner_bg_alt')}
      />
      <View style={styles.headerScrim} />
    </>
  ) : null;

  const logo = group.logo_url ? (
    <Image
      source={{ uri: group.logo_url }}
      style={isInviteOpen ? styles.logoCompact : styles.logo}
      resizeMode="cover"
    />
  ) : (
    <View style={isInviteOpen ? styles.logoCompact : styles.logo}>
      <Text style={isInviteOpen ? styles.logoInitialsCompact : styles.logoInitials}>
        {getInitials(group.name)}
      </Text>
    </View>
  );

  const addedCount = addedUsers.length + addedEmails.length;
  const addedList =
    addedCount > 0 ? (
      <View>
        <Text style={styles.sectionHeading} accessibilityRole="header">
          {t('mob.group_detail.added_heading', { count: addedCount })}
        </Text>
        {addedUsers.map(invitee => (
          <View key={invitee.id} style={styles.personRow}>
            <UserAvatar
              imageUrl={invitee.image_url}
              name={invitee.display_name}
              size={MEMBER_AVATAR_SIZE}
              fallback="initials"
            />
            <View style={styles.personNames}>
              <PersonNames displayName={invitee.display_name} nickname={invitee.nickname} />
            </View>
            <View style={styles.addedChip}>
              <CheckMarkIcon size={16} color={groupView.addedChipText} />
              <Text style={styles.addedChipText}>{t('mob.group_detail.added_chip')}</Text>
            </View>
            {invitee.id !== currentUserId && invitee.id !== group.owner_id ? (
              <UndoAddButton
                onPress={() => handleUndoUser(invitee)}
                accessibilityLabel={t('mob.group_detail.undo_add_a11y')}
                busy={undoingId === invitee.id}
                disabled={undoingId !== null}
              />
            ) : null}
          </View>
        ))}
        {addedEmails.map(email => (
          <View key={email.toLowerCase()} style={styles.personRow}>
            <UserAvatar name={email} size={MEMBER_AVATAR_SIZE} fallback="initials" />
            <View style={styles.personNames}>
              <PersonNames displayName={email} />
            </View>
            <View style={styles.addedChip}>
              <CheckMarkIcon size={16} color={groupView.addedChipText} />
              <Text style={styles.addedChipText}>{t('mob.group_detail.added_chip')}</Text>
            </View>
          </View>
        ))}
        <View style={styles.sectionGap} />
      </View>
    ) : null;

  return (
    <KeyboardAwareScreen contentContainerStyle={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.xs }]}>
        {headerBackdrop}
        {isInviteOpen ? (
          <View style={styles.compactBar}>
            <Pressable
              onPress={handleCloseInvite}
              style={styles.iconButton}
              accessibilityRole="button"
              accessibilityLabel={t('mob.common.back')}
            >
              <ChevronLeftIcon size={26} color={colors.white} />
            </Pressable>
            {logo}
            <View style={styles.compactText}>
              <Text style={styles.compactName} numberOfLines={1}>
                {group.name}
              </Text>
              <Text style={styles.compactSubtitle} numberOfLines={1}>
                {t('mob.group_detail.invite_players_subtitle')}
              </Text>
            </View>
          </View>
        ) : (
          <>
            <View style={styles.topBar}>
              <Pressable
                onPress={() => navigation.goBack()}
                style={styles.iconButton}
                accessibilityRole="button"
                accessibilityLabel={t('mob.common.back')}
              >
                <ChevronLeftIcon size={26} color={colors.white} />
              </Pressable>
              {isOwner ? (
                <View style={styles.topBarActions}>
                  <Pressable
                    onPress={() => navigation.navigate('EditGroup', { groupId })}
                    style={styles.iconButton}
                    accessibilityRole="button"
                    accessibilityLabel={t('mob.group_detail.edit_group_a11y')}
                  >
                    <PencilLineIcon size={24} color={colors.white} />
                  </Pressable>
                  <Pressable
                    onPress={() => setIsDeleteSheetVisible(true)}
                    style={styles.iconButton}
                    accessibilityRole="button"
                    accessibilityLabel={t('mob.group_detail.delete_group_a11y')}
                  >
                    <TrashIcon size={22} color={colors.white} />
                  </Pressable>
                </View>
              ) : null}
            </View>

            <View style={styles.identity}>
              {logo}
              <Text style={styles.groupName}>{group.name}</Text>
              <Text style={styles.groupCounts}>{countsLine}</Text>
              {group.description ? <Text style={styles.description}>{group.description}</Text> : null}
            </View>
          </>
        )}
      </View>

      {canInvite ? (
        <View style={styles.buttonRow}>
          <Pressable
            onPress={share.open}
            style={({ pressed }) => [styles.shareButton, pressed ? styles.pressed : null]}
            accessibilityRole="button"
            accessibilityLabel={t('mob.group_detail.share_link_a11y')}
          >
            <LinkIcon size={22} color={groupView.blue} />
            <Text style={styles.shareButtonText}>{t('mob.group_detail.share_link_cta')}</Text>
          </Pressable>
          {isInviteOpen ? (
            <Pressable
              onPress={handleCloseInvite}
              style={({ pressed }) => [styles.plusSquare, pressed ? styles.pressed : null]}
              accessibilityRole="button"
              accessibilityLabel={t('mob.group_detail.invite_collapsed_a11y')}
            >
              <Text style={styles.plusSquareText}>+</Text>
            </Pressable>
          ) : (
            <AddEntryButton
              label={t('mob.group_detail.invite')}
              onPress={handleOpenInvite}
              testID="group-invite-entry"
            />
          )}
        </View>
      ) : null}

      {isInviteOpen ? (
        <View style={styles.invitePanel}>
          <UserSearchPicker
            variant="invite"
            selectionMode="immediate"
            onSelect={handleAddUser}
            onSelectEmail={handleAddEmail}
            excludeGroupId={groupId}
            excludeUserIds={addedUsers.map(invitee => invitee.id)}
            suggestionContext="players"
            entityLabel={t('mob.user_search.entity_player')}
            belowInput={addedList}
            refreshToken={searchRefresh}
          />
          {inviteError ? <Text style={styles.errorText}>{inviteError}</Text> : null}
        </View>
      ) : (
        <>
          {canInvite ? <View style={styles.sectionGap} /> : null}
          <View style={styles.membersHeader}>
            <Text style={styles.membersTitle} accessibilityRole="header">
              {t('mob.group_detail.members_title')}
            </Text>
            <Text style={styles.membersCount}>{memberCount}</Text>
          </View>

          {memberError ? <Text style={styles.errorText}>{memberError}</Text> : null}

          {sortedMembers.map(member => (
            <Pressable
              key={member.user_id}
              style={({ pressed }) => [styles.memberRow, pressed ? styles.memberRowPressed : null]}
              onLongPress={() => setCardMember(member)}
              delayLongPress={350}
              accessibilityRole="button"
              accessibilityLabel={
                member.role === 'member'
                  ? member.display_name
                  : `${member.display_name}, ${t(
                      member.role === 'owner' ? 'mob.group_role.owner' : 'mob.group_role.admin',
                    )}`
              }
              accessibilityHint={t('mob.group_detail.member_row_hint')}
            >
              <UserAvatar
                imageUrl={member.photo_url}
                name={member.display_name}
                size={MEMBER_AVATAR_SIZE}
                fallback="initials"
              />
              <View style={styles.personNames}>
                <PersonNames displayName={member.display_name} nickname={member.nickname} />
              </View>
              {member.role === 'owner' ? (
                <View style={[styles.roleChip, styles.ownerChip]}>
                  <Text style={[styles.roleChipText, styles.ownerChipText]}>
                    {t('mob.group_role.owner')}
                  </Text>
                </View>
              ) : member.role === 'admin' ? (
                <View style={[styles.roleChip, styles.adminChip]}>
                  <Text style={[styles.roleChipText, styles.adminChipText]}>
                    {t('mob.group_role.admin')}
                  </Text>
                </View>
              ) : null}
            </Pressable>
          ))}

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
        </>
      )}

      <MemberActionCard
        visible={cardMember !== null}
        displayName={cardMember?.display_name ?? ''}
        nickname={cardMember?.nickname ?? null}
        photoUrl={cardMember?.photo_url ?? null}
        actions={cardMember ? buildActions(cardMember) : []}
        onClose={() => setCardMember(null)}
      />
      <DeleteGroupSheet
        groupId={group.id}
        groupName={group.name}
        memberCount={memberCount}
        visible={isDeleteSheetVisible}
        onClose={() => setIsDeleteSheetVisible(false)}
        onNotFound={unavailable.onNotFound}
        onDeleted={() => {
          // The owner's own action: any 404 after this closes the screen quietly.
          unavailable.markOwnAction();
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
  container: { paddingBottom: spacing.xl, backgroundColor: colors.surface },
  header: {
    backgroundColor: groupView.navy,
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.lg,
    overflow: 'hidden',
  },
  headerBackground: { ...StyleSheet.absoluteFill, width: '100%', height: '100%' },
  headerScrim: { ...StyleSheet.absoluteFill, backgroundColor: groupView.navyScrim },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  topBarActions: { flexDirection: 'row', alignItems: 'center' },
  iconButton: {
    width: sizes.touchTarget,
    height: sizes.touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  identity: { alignItems: 'center', paddingHorizontal: spacing.md },
  logo: {
    width: LOGO_SIZE,
    height: LOGO_SIZE,
    borderRadius: LOGO_SIZE / 2,
    borderWidth: 3,
    borderColor: colors.white,
    backgroundColor: groupView.blue,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  logoInitials: { fontSize: 38, fontWeight: '700', color: colors.white },
  groupName: {
    ...typography.h2,
    color: colors.white,
    textAlign: 'center',
    marginTop: spacing.md,
  },
  groupCounts: {
    ...typography.body,
    color: groupView.onNavyMuted,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  description: {
    ...typography.body,
    color: groupView.onNavyMuted,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  compactBar: { flexDirection: 'row', alignItems: 'center', minHeight: sizes.touchTarget },
  logoCompact: {
    width: LOGO_SIZE_COMPACT,
    height: LOGO_SIZE_COMPACT,
    borderRadius: LOGO_SIZE_COMPACT / 2,
    borderWidth: 2,
    borderColor: colors.white,
    backgroundColor: groupView.blue,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  logoInitialsCompact: { fontSize: 15, fontWeight: '700', color: colors.white },
  compactText: { flex: 1, marginLeft: spacing.sm },
  compactName: { ...typography.h3, color: colors.white },
  compactSubtitle: { ...typography.caption, color: groupView.onNavyMuted },
  buttonRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  shareButton: {
    flex: 1,
    height: BUTTON_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: groupView.blue,
    backgroundColor: colors.surface,
  },
  shareButtonText: {
    ...typography.button,
    color: groupView.blue,
    marginLeft: spacing.sm,
  },
  plusSquare: {
    width: BUTTON_HEIGHT,
    height: BUTTON_HEIGHT,
    borderRadius: 14,
    backgroundColor: groupView.blue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  plusSquareText: { fontSize: 28, lineHeight: 32, color: colors.white },
  pressed: { opacity: 0.85 },
  sectionGap: { height: spacing.sm, backgroundColor: groupView.sectionBg },
  invitePanel: { paddingHorizontal: spacing.md },
  sectionHeading: {
    ...typography.label,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: groupView.textSecondary,
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
  },
  membersHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  membersTitle: { ...typography.h3, color: colors.textPrimary },
  membersCount: { ...typography.body, color: groupView.textSecondary },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 64,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: groupView.divider,
    backgroundColor: colors.surface,
  },
  memberRowPressed: { backgroundColor: groupView.sectionBg },
  personRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 64,
    paddingVertical: spacing.sm,
  },
  personNames: { flex: 1, minWidth: 0, marginLeft: spacing.md },
  roleChip: {
    marginLeft: spacing.sm,
    paddingHorizontal: spacing.md,
    minHeight: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleChipText: { ...typography.label, fontWeight: '700' },
  ownerChip: { backgroundColor: groupView.ownerChipBg },
  ownerChipText: { color: groupView.ownerChipText },
  adminChip: { backgroundColor: groupView.adminChipBg },
  adminChipText: { color: groupView.adminChipText },
  addedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: spacing.sm,
    paddingHorizontal: spacing.md,
    minHeight: 32,
    borderRadius: 16,
    backgroundColor: groupView.addedChipBg,
  },
  addedChipText: {
    ...typography.label,
    fontWeight: '700',
    color: groupView.addedChipText,
    marginLeft: spacing.xs,
  },
  leaveSection: {
    marginTop: spacing.xl,
    paddingHorizontal: spacing.md,
  },
  errorText: {
    ...typography.body,
    color: groupView.destructive,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
});
