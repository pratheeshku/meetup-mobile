/**
 * Share + invite actions for Tournament Detail (tournament-lifecycle addendum
 * v1.2.2, AD-4). What shows comes only from the server's `my_invite_access`:
 *   full        -> Invite Group, Invite Player (user or email), Share
 *   individuals -> Invite Player (user or email), Share
 *   none/absent -> nothing (this is also the whole feature while the flag is off)
 * Committee membership is never derived on the client; the server enforces
 * every rule. Group invite by a non-committee group owner/admin is out of scope
 * (OI-14). Pickers and flows mirror the game detail (`EventDetailScreen`).
 *
 * Share is client-side only: the app link from `getShareUrl()` through
 * `useAppShare`; no tournament route is called and no tournament identity is
 * in the link. A 404 from an invite route (flag turned off) hides the invite
 * actions silently. Email addresses are never logged.
 */
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { withCorrelationId } from '../../api/correlationId';
import { getMyGroups } from '../../api/groups';
import {
  inviteEmailToTournament,
  inviteGroupToTournament,
  inviteUserToTournament,
} from '../../api/tournaments';
import { useAppShare } from '../../hooks/useAppShare';
import { useT } from '../../labels/LabelsContext';
import { borderWidth, colors, radius, sizes, spacing, typography } from '../../theme/tokens';
import type { Group } from '../../types/group';
import type { TournamentInviteAccess } from '../../types/tournament';
import type { UserSearchResult } from '../../types/user';
import { isInvitesClosed, readTournamentInviteError } from '../../utils/tournamentInviteError';
import { stripIconGlyphs } from '../../utils/labels';
import Button from '../Button';
import Card from '../Card';
import { GroupsIcon, LinkIcon, PersonIcon } from '../icons/SharedIcons';
import OptionChips from '../OptionChips';
import ShareActionSheet from '../ShareActionSheet';
import TextLink from '../TextLink';
import Toast from '../Toast';
import PersonNames from '../PersonNames';
import UserAvatar from '../UserAvatar';
import UserSearchPicker from '../UserSearchPicker';

interface Props {
  tournamentId: string;
  access: TournamentInviteAccess | null | undefined;
}

type OpenForm = 'none' | 'group' | 'user';

export default function TournamentInvitePanel({ tournamentId, access }: Props): React.JSX.Element | null {
  const t = useT();
  const share = useAppShare();
  const [form, setForm] = useState<OpenForm>('none');
  const [unavailable, setUnavailable] = useState(false);

  const canShare = access === 'full' || access === 'individuals';
  const canInviteGroup = access === 'full' && !unavailable;
  const canInviteUser = canShare && !unavailable;

  // Group form
  const [myGroups, setMyGroups] = useState<Group[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [groupSubmitting, setGroupSubmitting] = useState(false);
  const [groupError, setGroupError] = useState<string | null>(null);
  const [groupSuccess, setGroupSuccess] = useState<string | null>(null);

  // Individual form (user search or email)
  const [pickedUser, setPickedUser] = useState<UserSearchResult | null>(null);
  const [pickedEmail, setPickedEmail] = useState<string | null>(null);
  const [userSubmitting, setUserSubmitting] = useState(false);
  const [userError, setUserError] = useState<string | null>(null);
  const [userSuccess, setUserSuccess] = useState<string | null>(null);

  if (!canShare) {
    return null;
  }

  /** Server text for 4xx; 404 means the feature is off: hide the invite actions. */
  const failureMessage = (e: unknown, fallback: string): string | null => {
    const info = readTournamentInviteError(e);
    if (info.status === 404) {
      setUnavailable(true);
      setForm('none');
      return null;
    }
    if (info.message) {
      return info.message;
    }
    return isInvitesClosed(info) ? t('mob.tournament.invites_closed') : fallback;
  };

  const openGroup = async (): Promise<void> => {
    setGroupError(null);
    setGroupSuccess(null);
    setSelectedGroupIds([]);
    setForm('group');
    if (myGroups.length === 0) {
      setGroupsLoading(true);
      try {
        const res = await getMyGroups();
        setMyGroups(res.items);
      } catch {
        setMyGroups([]);
      } finally {
        setGroupsLoading(false);
      }
    }
  };

  const openUser = (): void => {
    setUserError(null);
    setUserSuccess(null);
    setPickedUser(null);
    setPickedEmail(null);
    setForm('user');
  };

  const closeForm = (): void => setForm('none');

  const toggleGroup = (groupId: string): void => {
    setSelectedGroupIds(prev =>
      prev.includes(groupId) ? prev.filter(id => id !== groupId) : [...prev, groupId],
    );
  };

  const sendGroupInvites = async (): Promise<void> => {
    if (selectedGroupIds.length === 0) {
      setGroupError(t('mob.game_detail.invite_group_select'));
      return;
    }
    setGroupError(null);
    setGroupSuccess(null);
    setGroupSubmitting(true);
    try {
      await withCorrelationId(async correlationId => {
        let total = 0;
        for (const groupId of selectedGroupIds) {
          const invites = await inviteGroupToTournament(tournamentId, groupId, { correlationId });
          total += Array.isArray(invites) ? invites.length : 0;
        }
        setGroupSuccess(
          total === 0
            ? t('mob.tournament.invite_group_none_new')
            : t(
                total === 1
                  ? 'mob.game_detail.invite_group_sent_one'
                  : 'mob.game_detail.invite_group_sent_other',
                { count: total },
              ),
        );
      });
      setSelectedGroupIds([]);
    } catch (e) {
      setGroupError(failureMessage(e, t('mob.game_detail.invite_group_error')));
    } finally {
      setGroupSubmitting(false);
    }
  };

  const sendUserInvite = async (): Promise<void> => {
    if (!pickedUser && !pickedEmail) {
      setUserError(t('mob.game_detail.invite_choose'));
      return;
    }
    setUserError(null);
    setUserSuccess(null);
    setUserSubmitting(true);
    try {
      await withCorrelationId(async correlationId => {
        if (pickedEmail) {
          await inviteEmailToTournament(tournamentId, pickedEmail, { correlationId });
          setUserSuccess(t('mob.game_detail.invite_sent', { name: pickedEmail }));
          setPickedEmail(null);
        } else if (pickedUser) {
          await inviteUserToTournament(tournamentId, pickedUser.id, { correlationId });
          setUserSuccess(t('mob.game_detail.invite_sent', { name: pickedUser.nickname }));
          setPickedUser(null);
        }
      });
    } catch (e) {
      setUserError(failureMessage(e, t('mob.game_detail.invite_error')));
    } finally {
      setUserSubmitting(false);
    }
  };

  const showButtons = form === 'none';

  return (
    <View>
      {showButtons ? (
        <Card style={styles.card}>
          {canInviteGroup ? (
            <ActionButton
              label={t('mob.game_detail.invite_group')}
              icon={<GroupsIcon size={18} />}
              onPress={openGroup}
            />
          ) : null}
          {canInviteUser ? (
            <ActionButton
              label={t('mob.game_detail.invite_player')}
              icon={<PersonIcon size={18} />}
              onPress={openUser}
            />
          ) : null}
          <ActionButton
            label={t('mob.game_detail.share')}
            icon={<LinkIcon size={18} />}
            onPress={share.open}
            last
          />
        </Card>
      ) : null}

      {form === 'group' ? (
        <Card style={styles.card}>
          <Text style={styles.formTitle}>{t('mob.game_detail.invite_group')}</Text>
          <Text style={styles.formHint}>{t('mob.tournament.invite_group_hint')}</Text>
          {groupsLoading ? (
            <Text style={styles.formHint}>{t('mob.game_detail.groups_loading')}</Text>
          ) : myGroups.length === 0 ? (
            <Text style={styles.formHint}>{t('mob.create_game.no_groups')}</Text>
          ) : (
            <OptionChips
              options={myGroups.map(g => ({ value: g.id, label: g.name }))}
              value={selectedGroupIds}
              onChange={toggleGroup}
              disabled={groupSubmitting}
            />
          )}
          {groupError ? <Text style={styles.errorText}>{groupError}</Text> : null}
          {groupSuccess ? <Text style={styles.successText}>{groupSuccess}</Text> : null}
          <View style={styles.formButtonsRow}>
            <Button
              label={t('mob.game_detail.send_group_invite')}
              variant="primary"
              onPress={sendGroupInvites}
              loading={groupSubmitting}
              disabled={selectedGroupIds.length === 0 || groupSubmitting}
              style={styles.rowButton}
            />
            <Button
              label={t('mob.common.close')}
              variant="secondary"
              onPress={closeForm}
              disabled={groupSubmitting}
              style={styles.rowButton}
            />
          </View>
        </Card>
      ) : null}

      {form === 'user' ? (
        <Card style={styles.card}>
          <Text style={styles.formTitle}>{t('mob.game_detail.invite_player')}</Text>
          <Text style={styles.formHint}>{t('mob.tournament.invite_player_hint')}</Text>
          {pickedUser ? (
            <View style={styles.selectedRow}>
              <View style={styles.selectedNames}>
                <UserAvatar
                  imageUrl={pickedUser.image_url}
                  name={pickedUser.display_name}
                  size={36}
                  fallback="initials"
                />
                <View style={styles.selectedPerson}>
                  <PersonNames displayName={pickedUser.display_name} nickname={pickedUser.nickname} />
                </View>
              </View>
              <TextLink
                label={t('mob.common.change')}
                onPress={() => setPickedUser(null)}
                disabled={userSubmitting}
              />
            </View>
          ) : pickedEmail ? (
            <View style={styles.selectedRow}>
              <Text style={styles.selectedText}>
                {t('mob.group_detail.invite_by_email', { email: pickedEmail })}
              </Text>
              <TextLink
                label={t('mob.common.change')}
                onPress={() => setPickedEmail(null)}
                disabled={userSubmitting}
              />
            </View>
          ) : (
            <UserSearchPicker
              onSelect={setPickedUser}
              onSelectEmail={setPickedEmail}
              entityLabel={t('mob.user_search.entity_player')}
              disabled={userSubmitting}
            />
          )}
          {userError ? <Text style={styles.errorText}>{userError}</Text> : null}
          {userSuccess ? <Text style={styles.successText}>{userSuccess}</Text> : null}
          <View style={styles.formButtonsRow}>
            <Button
              label={t('mob.group_detail.send_invite')}
              variant="primary"
              onPress={sendUserInvite}
              loading={userSubmitting}
              disabled={(!pickedUser && !pickedEmail) || userSubmitting}
              style={styles.rowButton}
            />
            <Button
              label={t('mob.common.close')}
              variant="secondary"
              onPress={closeForm}
              disabled={userSubmitting}
              style={styles.rowButton}
            />
          </View>
        </Card>
      ) : null}

      <ShareActionSheet
        visible={share.sheetVisible}
        title={t('mob.game_detail.share_title')}
        onShareGeneric={share.shareViaSystem}
        onShareWhatsApp={share.shareViaWhatsApp}
        onCopyLink={share.copyLink}
        onClose={share.close}
      />
      <Toast message={share.toastMessage} onDismiss={share.clearToast} />
    </View>
  );
}

function ActionButton({
  label,
  icon,
  onPress,
  last = false,
}: {
  label: string;
  icon: React.ReactNode;
  onPress: () => void;
  last?: boolean;
}): React.JSX.Element {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={[styles.actionBtn, last ? styles.actionBtnLast : null]}
    >
      <View style={styles.actionBtnContent}>
        <View
          accessibilityElementsHidden
          importantForAccessibility="no"
          aria-hidden={true}
          style={styles.actionBtnIcon}
        >
          {icon}
        </View>
        <Text style={styles.actionBtnText}>{stripIconGlyphs(label)}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: spacing.md },
  actionBtn: {
    minHeight: sizes.touchTarget,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
    borderWidth: borderWidth.thin,
    backgroundColor: colors.surface,
    borderColor: colors.border,
  },
  actionBtnLast: { marginBottom: 0 },
  actionBtnContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  actionBtnIcon: {
    width: spacing.lg,
    height: spacing.lg,
    marginRight: spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnText: { ...typography.bodyBold, color: colors.textPrimary },
  formTitle: { ...typography.h3, color: colors.textPrimary, marginBottom: spacing.xs },
  formHint: { ...typography.body, color: colors.textSecondary, marginBottom: spacing.md },
  errorText: {
    ...typography.body,
    color: colors.error,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  successText: {
    ...typography.body,
    color: colors.success,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  formButtonsRow: { flexDirection: 'row', marginTop: spacing.md, gap: spacing.sm },
  rowButton: { flex: 1, marginBottom: 0 },
  selectedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: borderWidth.thin,
    borderColor: colors.border,
    marginBottom: spacing.sm,
  },
  selectedText: { ...typography.bodyBold, color: colors.textPrimary },
  selectedNames: { flexDirection: 'row', alignItems: 'center', flexShrink: 1 },
  selectedPerson: { flexShrink: 1, marginLeft: spacing.sm },
});
