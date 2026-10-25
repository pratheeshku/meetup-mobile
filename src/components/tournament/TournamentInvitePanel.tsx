/**
 * Share + invite actions for Tournament Detail (tournament-lifecycle addendum
 * v1.2.2, AD-4; invite picker per DES-MEETUP-ADDENDUM-game-view-redesign GV-5). What shows comes
 * only from the server's `my_invite_access`:
 *   full        -> Invite groups, Invite players (user or email), Share
 *   individuals -> Invite players (user or email), Share
 *   none/absent -> nothing (this is also the whole feature while the flag is off)
 * Committee membership is never derived on the client; the server enforces
 * every rule. Group invite by a non-committee group owner/admin is out of scope
 * (OI-14). The entries open the shared invite picker, which loops the tournament invite calls per
 * staged entry (AD-4).
 *
 * Share is client-side only: the app link from `getShareUrl()` through
 * `useAppShare`; no tournament route is called and no tournament identity is
 * in the link. A 404 from an invite route (flag turned off) hides the invite
 * actions silently. Email addresses are never logged.
 */
import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  inviteEmailToTournament,
  inviteGroupToTournament,
  inviteUserToTournament,
} from '../../api/tournaments';
import { useAppShare } from '../../hooks/useAppShare';
import { useT } from '../../labels/LabelsContext';
import { borderWidth, colors, radius, sizes, spacing, typography } from '../../theme/tokens';
import type { ResponsesResponse, TournamentInviteAccess } from '../../types/tournament';
import { isInvitesClosed, readTournamentInviteError } from '../../utils/tournamentInviteError';
import { stripIconGlyphs } from '../../utils/labels';
import { LinkIcon } from '../icons/SharedIcons';
import InviteCard from '../invite/InviteCard';
import InvitePicker, { type InviteSendResult, type InviteTab } from '../invite/InvitePicker';
import ShareActionSheet from '../ShareActionSheet';
import Toast from '../Toast';
import type { AlreadyInPerson } from '../UserSearchPicker';

interface Props {
  tournamentId: string;
  access: TournamentInviteAccess | null | undefined;
  /** Tournament name, for the picker header. */
  title?: string;
  /** The responses listing (organizer/committee), for "already in this tournament". */
  responses?: ResponsesResponse | null;
  /** After at least one invite went out: the screen refetches. */
  onSent?: (result: InviteSendResult) => void;
}

export default function TournamentInvitePanel({
  tournamentId,
  access,
  title = '',
  responses = null,
  onSent,
}: Props): React.JSX.Element | null {
  const t = useT();
  const share = useAppShare();
  const [pickerTab, setPickerTab] = useState<InviteTab | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState(false);

  const canShare = access === 'full' || access === 'individuals';
  const canInviteGroup = access === 'full' && !unavailable;
  const canInviteUser = canShare && !unavailable;

  const senders = useMemo(
    () => ({
      group: (groupId: string, correlationId: string) =>
        inviteGroupToTournament(tournamentId, groupId, { correlationId }),
      user: (userId: string, correlationId: string) =>
        inviteUserToTournament(tournamentId, userId, { correlationId }),
      email: (email: string, correlationId: string) =>
        inviteEmailToTournament(tournamentId, email, { correlationId }),
    }),
    [tournamentId],
  );

  if (!canShare) {
    return null;
  }

  /** Server text for 4xx; 404 means the feature is off: hide the invite actions. */
  const failureDetail = (e: unknown): string | null => {
    const info = readTournamentInviteError(e);
    if (info.status === 404) {
      setUnavailable(true);
      setPickerTab(null);
      return null;
    }
    if (info.message) {
      return info.message;
    }
    return isInvitesClosed(info) ? t('mob.tournament.invites_closed') : null;
  };

  const alreadyInPeople: AlreadyInPerson[] = responses
    ? [
        ...responses.accepted.items.map(person => ({
          id: person.user_id ?? person.display_name,
          displayName: person.display_name,
          nickname: null,
          photoUrl: person.photo_url ?? null,
          statusLabel: t('mob.respond.via.joined'),
        })),
        ...(responses.pending?.items ?? []).map(person => ({
          id: person.user_id ?? person.email ?? person.display_name,
          displayName: person.display_name || person.email || '',
          nickname: null,
          photoUrl: person.photo_url ?? null,
          statusLabel: t('mob.respond.via.invitation'),
        })),
      ]
    : [];

  const handleSent = (result: InviteSendResult): void => {
    onSent?.(result);
    if (result.failedNames.length === 0) {
      setPickerTab(null);
      // A send that only touched groups with nobody new keeps the earlier "already invited" notice.
      setNotice(
        result.noNewGroups.length > 0 && result.noNewGroups.length === result.sent
          ? t('mob.tournament.invite_group_none_new')
          : t('mob.gv.invites_sent', { count: result.sent }),
      );
    }
  };

  return (
    <View>
      <InviteCard
        onInviteGroups={canInviteGroup ? () => setPickerTab('groups') : undefined}
        onInvitePlayers={canInviteUser ? () => setPickerTab('players') : undefined}
        footer={
          <ActionButton
            label={t('mob.game_detail.share')}
            icon={<LinkIcon size={18} />}
            onPress={share.open}
            last
          />
        }
      />

      <InvitePicker
        visible={pickerTab !== null}
        onClose={() => setPickerTab(null)}
        title={title}
        initialTab={pickerTab ?? 'players'}
        allowGroups={canInviteGroup}
        senders={senders}
        alreadyInPeople={alreadyInPeople}
        alreadyInHeading={t('mob.gv.already_in_tournament')}
        alreadyInGroupLabel={t('mob.respond.via.invitation')}
        failureDetail={failureDetail}
        onSent={handleSent}
      />
      <ShareActionSheet
        visible={share.sheetVisible}
        title={t('mob.game_detail.share_title')}
        onShareGeneric={share.shareViaSystem}
        onShareWhatsApp={share.shareViaWhatsApp}
        onCopyLink={share.copyLink}
        onClose={share.close}
      />
      <Toast message={share.toastMessage} onDismiss={share.clearToast} />
      <Toast message={notice} onDismiss={() => setNotice(null)} />
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
});
