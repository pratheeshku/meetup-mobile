/**
 * Invite picker (DES-MEETUP-ADDENDUM-game-view-redesign GV-5, AD-4; board
 * docs/design/game-view-redesign/invite-picker). One screen-sized modal for games and tournaments.
 *
 * Tabs Groups | Players. Search, staged "Selected" rows with "−", result rows grouped Selected /
 * Available / Already in this game (GV-P1), "+" stages and "−" unstages (44px+ targets), ONE
 * "Send n invites" button. Groups, players and typed emails all stage into one list; sending loops
 * the host's existing invite calls per staged entry under one correlation id (AD-4). A failed entry
 * stays staged and is reported by name; entries that succeeded stand and are cleared.
 *
 * Built from the existing GroupInviteList, UserSearchPicker and AddRemoveControl; no new search.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { withCorrelationId } from '../../api/correlationId';
import { getMyGroups } from '../../api/groups';
import { useUserMenu } from '../../hooks/useUserMenu';
import { useT } from '../../labels/LabelsContext';
import {
  colors,
  groupView,
  radius,
  sizes,
  spacing,
  typography,
} from '../../theme/tokens';
import type { Group } from '../../types/group';
import type { UserSearchResult } from '../../types/user';
import AddRemoveControl, { GroupInviteList } from '../AddRemoveControl';
import Button from '../Button';
import { BackArrowIcon } from '../icons/ActionIcons';
import KeyboardAwareScreen from '../KeyboardAwareScreen';
import PersonNames from '../PersonNames';
import ScreenContainer from '../ScreenContainer';
import SegmentedSwitch from '../SegmentedSwitch';
import UserAvatar from '../UserAvatar';
import UserMenuSheet from '../user/UserMenuSheet';
import UserPressable from '../user/UserPressable';
import UserSearchPicker, { type AlreadyInPerson } from '../UserSearchPicker';

export type InviteTab = 'groups' | 'players';

export interface InviteSenders {
  /** One call per staged group; resolve = invited. */
  group: (groupId: string, correlationId: string) => Promise<unknown>;
  user: (userId: string, correlationId: string) => Promise<unknown>;
  email: (email: string, correlationId: string) => Promise<unknown>;
}

export interface InviteSendResult {
  sent: number;
  failedNames: string[];
  /** Groups whose invite call answered with an empty list: everyone in them was already invited. */
  noNewGroups: string[];
}

interface InvitePickerProps {
  visible: boolean;
  onClose: () => void;
  /** Game or tournament name, for the header. */
  title: string;
  initialTab: InviteTab;
  /** False when the viewer may invite individuals only (tournament `my_invite_access`). */
  allowGroups: boolean;
  senders: InviteSenders;
  /** Search exclusion for games (`excludeEventId`); tournaments pass none. */
  excludeEventId?: string;
  /** People already in the game, shown last with a status chip. */
  alreadyInPeople?: readonly AlreadyInPerson[];
  alreadyInHeading: string;
  /** Groups already shared with the game. */
  alreadyInGroupIds?: readonly string[];
  alreadyInGroupLabel: string;
  /** Extra server text for one failed entry (for example "invitations are closed"). */
  failureDetail?: (error: unknown) => string | null;
  /** After a send with at least one success: the host refetches and may show a notice. */
  onSent: (result: InviteSendResult) => void;
}

type StagedGroup = { id: string; name: string };
type StagedEmail = { email: string };

const AVATAR = 40;

export default function InvitePicker({
  visible,
  onClose,
  title,
  initialTab,
  allowGroups,
  senders,
  excludeEventId,
  alreadyInPeople,
  alreadyInHeading,
  alreadyInGroupIds,
  alreadyInGroupLabel,
  failureDetail,
  onSent,
}: InvitePickerProps): React.JSX.Element {
  const t = useT();
  const menu = useUserMenu({ context: { type: 'none' } });
  const [tab, setTab] = useState<InviteTab>(
    allowGroups ? initialTab : 'players',
  );
  const [groups, setGroups] = useState<Group[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [groupsLoaded, setGroupsLoaded] = useState(false);
  const [stagedGroups, setStagedGroups] = useState<StagedGroup[]>([]);
  const [stagedUsers, setStagedUsers] = useState<UserSearchResult[]>([]);
  const [stagedEmails, setStagedEmails] = useState<StagedEmail[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Each open starts clean on the entry the organizer chose.
  useEffect(() => {
    if (visible) {
      setTab(allowGroups ? initialTab : 'players');
      setStagedGroups([]);
      setStagedUsers([]);
      setStagedEmails([]);
      setError(null);
    }
  }, [visible, initialTab, allowGroups]);

  const loadGroups = useCallback(async (): Promise<void> => {
    setGroupsLoading(true);
    try {
      const res = await getMyGroups();
      setGroups(res.items);
    } catch {
      setGroups([]);
    } finally {
      setGroupsLoading(false);
      setGroupsLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (
      visible &&
      allowGroups &&
      tab === 'groups' &&
      !groupsLoaded &&
      !groupsLoading
    ) {
      loadGroups();
    }
  }, [visible, allowGroups, tab, groupsLoaded, groupsLoading, loadGroups]);

  const total = stagedGroups.length + stagedUsers.length + stagedEmails.length;

  const toggleGroup = (groupId: string): void => {
    setStagedGroups(prev =>
      prev.some(group => group.id === groupId)
        ? prev.filter(group => group.id !== groupId)
        : [
            ...prev,
            {
              id: groupId,
              name: groups.find(group => group.id === groupId)?.name ?? groupId,
            },
          ],
    );
  };

  const stageUser = (user: UserSearchResult): void => {
    setStagedUsers(prev =>
      prev.some(item => item.id === user.id) ? prev : [...prev, user],
    );
  };
  const unstageUser = (user: UserSearchResult): void => {
    setStagedUsers(prev => prev.filter(item => item.id !== user.id));
  };
  const stageEmail = (email: string): void => {
    setStagedEmails(prev =>
      prev.some(item => item.email.toLowerCase() === email.toLowerCase())
        ? prev
        : [...prev, { email }],
    );
  };

  const send = async (): Promise<void> => {
    if (total === 0 || submitting) {
      return;
    }
    setError(null);
    setSubmitting(true);
    const failedNames: string[] = [];
    let detail: string | null = null;
    let sent = 0;
    const noNewGroups: string[] = [];
    const doneGroups = new Set<string>();
    const doneUsers = new Set<string>();
    const doneEmails = new Set<string>();
    const note = (e: unknown): void => {
      if (detail === null && failureDetail) {
        detail = failureDetail(e);
      }
    };
    try {
      // One logical action, one correlation id (not one per HTTP call).
      await withCorrelationId(async correlationId => {
        for (const group of stagedGroups) {
          try {
            const invited = await senders.group(group.id, correlationId);
            doneGroups.add(group.id);
            sent += 1;
            if (Array.isArray(invited) && invited.length === 0) {
              noNewGroups.push(group.name);
            }
          } catch (e) {
            failedNames.push(group.name);
            note(e);
          }
        }
        for (const user of stagedUsers) {
          try {
            await senders.user(user.id, correlationId);
            doneUsers.add(user.id);
            sent += 1;
          } catch (e) {
            failedNames.push(user.display_name || user.nickname);
            note(e);
          }
        }
        for (const entry of stagedEmails) {
          try {
            await senders.email(entry.email, correlationId);
            doneEmails.add(entry.email);
            sent += 1;
          } catch (e) {
            failedNames.push(entry.email);
            note(e);
          }
        }
      });
    } finally {
      setSubmitting(false);
    }
    setStagedGroups(prev => prev.filter(group => !doneGroups.has(group.id)));
    setStagedUsers(prev => prev.filter(user => !doneUsers.has(user.id)));
    setStagedEmails(prev => prev.filter(entry => !doneEmails.has(entry.email)));
    if (failedNames.length > 0) {
      const base = t('mob.gv.invites_failed', {
        names: failedNames.join(', '),
      });
      setError(detail ? `${base} ${detail}` : base);
    }
    if (sent > 0) {
      onSent({ sent, failedNames, noNewGroups });
    }
  };

  const selectedStagedHeading = (
    <Text style={styles.heading} accessibilityRole="header">
      {t('mob.gv.selected')}
    </Text>
  );

  const stagedPlayers =
    stagedUsers.length + stagedEmails.length > 0 ? (
      <View testID="invite-picker-selected">
        {selectedStagedHeading}
        {stagedUsers.map(user => (
          <View
            key={user.id}
            style={styles.stagedRow}
            testID="invite-picker-selected-row"
          >
            <UserPressable
              person={{
                userId: user.id,
                displayName: user.display_name,
                nickname: user.nickname ?? null,
                photoUrl: user.image_url,
              }}
              menu={menu}
              tap="none"
              style={styles.stagedPerson}
            >
              <UserAvatar
                imageUrl={user.image_url}
                name={user.display_name}
                size={AVATAR}
                fallback="initials"
              />
              <View style={styles.stagedText}>
                <PersonNames
                  displayName={user.display_name}
                  nickname={user.nickname}
                />
              </View>
            </UserPressable>
            <AddRemoveControl
              mode="staged"
              staged
              name={user.display_name}
              onStage={noop}
              onUnstage={() => unstageUser(user)}
              disabled={submitting}
              testID={`invite-unstage-${user.id}`}
            />
          </View>
        ))}
        {stagedEmails.map(entry => (
          <View
            key={entry.email}
            style={styles.stagedRow}
            testID="invite-picker-selected-row"
          >
            <View style={styles.stagedPerson}>
              <View style={styles.emailAvatar}>
                <Text style={styles.emailAvatarText}>@</Text>
              </View>
              <View style={styles.stagedText}>
                <Text style={styles.emailText} numberOfLines={1}>
                  {entry.email}
                </Text>
              </View>
            </View>
            <AddRemoveControl
              mode="staged"
              staged
              name={entry.email}
              onStage={noop}
              onUnstage={() =>
                setStagedEmails(prev =>
                  prev.filter(item => item.email !== entry.email),
                )
              }
              disabled={submitting}
              testID={`invite-unstage-email-${entry.email}`}
            />
          </View>
        ))}
      </View>
    ) : null;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.screen} testID="invite-picker">
        <ScreenContainer edges="top" fill={false} style={styles.headerSafe}>
          <View style={styles.header}>
            <Pressable
              onPress={onClose}
              style={styles.backButton}
              accessibilityRole="button"
              accessibilityLabel={t('mob.game_detail.back')}
              testID="invite-picker-back"
            >
              <BackArrowIcon size={20} color={colors.white} />
            </Pressable>
            <Text
              style={styles.headerTitle}
              numberOfLines={1}
              accessibilityRole="header"
            >
              {t('mob.gv.picker_title', { title })}
            </Text>
          </View>
        </ScreenContainer>

        <KeyboardAwareScreen contentContainerStyle={styles.content}>
          {allowGroups ? (
            <View style={styles.tabs}>
              <SegmentedSwitch
                options={[
                  {
                    value: 'groups' as InviteTab,
                    label: t('mob.gv.tab_groups'),
                  },
                  {
                    value: 'players' as InviteTab,
                    label: t('mob.gv.tab_players'),
                  },
                ]}
                value={tab}
                onChange={setTab}
              />
            </View>
          ) : null}

          {tab === 'groups' && allowGroups ? (
            <View testID="invite-picker-groups">
              {groupsLoading ? (
                <Text style={styles.hint}>
                  {t('mob.game_detail.groups_loading')}
                </Text>
              ) : groups.length === 0 ? (
                <Text style={styles.hint}>
                  {t('mob.create_game.no_groups')}
                </Text>
              ) : (
                <GroupInviteList
                  groups={groups}
                  selectedIds={stagedGroups.map(group => group.id)}
                  onToggle={toggleGroup}
                  disabled={submitting}
                  alreadyIds={alreadyInGroupIds}
                  alreadyLabel={alreadyInGroupLabel}
                  sectionLabels={{
                    selected: t('mob.gv.selected'),
                    available: t('mob.gv.available'),
                    alreadyIn: alreadyInHeading,
                  }}
                />
              )}
            </View>
          ) : (
            <View testID="invite-picker-players">
              <UserSearchPicker
                variant="invite"
                selectionMode="staged"
                onSelect={stageUser}
                onUnstage={unstageUser}
                onSelectEmail={stageEmail}
                stagedUserIds={stagedUsers.map(user => user.id)}
                excludeUserIds={stagedUsers.map(user => user.id)}
                excludeEventId={excludeEventId}
                entityLabel={t('mob.user_search.entity_player')}
                placeholder={t('mob.user_search.placeholder')}
                disabled={submitting}
                belowInput={stagedPlayers}
                availableHeading={t('mob.gv.available')}
                alreadyIn={
                  alreadyInPeople && alreadyInPeople.length > 0
                    ? { heading: alreadyInHeading, people: alreadyInPeople }
                    : undefined
                }
              />
            </View>
          )}

          {error ? (
            <Text
              style={styles.errorText}
              accessibilityRole="alert"
              testID="invite-picker-error"
            >
              {error}
            </Text>
          ) : null}
        </KeyboardAwareScreen>

        <ScreenContainer edges="bottom" fill={false} style={styles.footerSafe}>
          <View style={styles.footer}>
            <Button
              label={t('mob.gv.send_invites', { count: total })}
              variant="cta"
              onPress={send}
              loading={submitting}
              disabled={total === 0 || submitting}
              testID="invite-picker-send"
            />
          </View>
        </ScreenContainer>
        <UserMenuSheet menu={menu} />
      </View>
    </Modal>
  );
}

/** A staged selection is already added: its control only offers "−". */
const noop = (): void => undefined;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  headerSafe: { backgroundColor: colors.primary },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: sizes.appHeader,
    paddingHorizontal: spacing.md,
  },
  backButton: {
    width: sizes.touchTarget,
    height: sizes.touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -spacing.sm,
  },
  headerTitle: {
    ...typography.h3,
    color: colors.white,
    flex: 1,
    marginLeft: spacing.xs,
  },
  content: { padding: spacing.md, paddingBottom: spacing.xl },
  tabs: { marginBottom: spacing.md },
  hint: {
    ...typography.body,
    color: colors.textSecondary,
    paddingVertical: spacing.sm,
  },
  heading: {
    ...typography.label,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: groupView.textSecondary,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  },
  stagedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: sizes.touchTarget + 8,
  },
  stagedPerson: { flexDirection: 'row', alignItems: 'center', flexShrink: 1 },
  stagedText: { flexShrink: 1, marginLeft: spacing.md },
  emailAvatar: {
    width: AVATAR,
    height: AVATAR,
    borderRadius: AVATAR / 2,
    backgroundColor: colors.track,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emailAvatarText: { ...typography.bodyBold, color: colors.textSecondary },
  emailText: { ...typography.bodyBold, color: colors.textPrimary },
  errorText: {
    ...typography.body,
    color: colors.error,
    backgroundColor: colors.errorLight,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  footerSafe: { backgroundColor: colors.surface },
  footer: {
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
});
