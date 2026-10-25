/**
 * "Invite type" row of the Details card (DES-MEETUP-ADDENDUM-game-view-redesign GV-3, AD-2; board
 * docs/design/game-view-redesign/game-view). Replaces the old visibility + group line.
 *
 * Value: `Public` on a public game (not tappable), otherwise `Groups (n)` from the payload. The
 * individual-players count is not shown: no payload the app reads says which invitations were
 * individual rather than group-sourced (blocked item, see the report). A viewer who may read the
 * responses (organizer, committee) gets the Invited sheet with the people as well; any other
 * viewer's sheet lists the groups only. A non-public row with nothing to show is left out.
 */
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useT } from '../../labels/LabelsContext';
import { colors, radius, sizes, spacing, typography } from '../../theme/tokens';
import type { ResponsesResponse } from '../../types/event';
import type { UserMenuContext } from '../../types/userMenu';
import { invitedPeople } from '../../utils/responseGroups';
import { ChevronRightIcon } from '../icons/ActionIcons';
import { PeopleIcon } from '../icons/SharedIcons';
import InvitedSheet, { type InvitedGroup } from './InvitedSheet';

/** The invitation fields the row reads (`GET …/invitations`, organizer/committee only). */
export type InviteSourceRow = {
  invitee_user_id?: string | null;
  source_group_id?: string | null;
  invited_email?: string | null;
};

interface InviteTypeRowProps {
  isPublic: boolean;
  groups: readonly InvitedGroup[];
  /** The organizer-only responses listing; null when the viewer cannot read it. */
  responses: ResponsesResponse | null;
  /** Invitations the viewer may read; null for anyone else. */
  invitations?: InviteSourceRow[] | null;
  organizerId?: string | null;
  menuContext: UserMenuContext;
  currentUserId?: string | null;
  onChanged?: () => void;
  nicknames?: Record<string, string | null | undefined>;
}

const ICON_BOX = 32;

/**
 * Invite-type line of a tournament LIST row (DES-MEETUP-ADDENDUM-tournament-registration AD-7): `Public`, the group name (first name and
 * "+n" for several), or `Invite only`. A group line opens the same Invited sheet as the detail row, groups only; it fetches nothing on its own
 * (no per-row requests). Public and Invite only are plain text. Renders nothing when the visibility is unknown.
 */
export function ListInviteTypeRow({
  visibility,
  groups,
  menuContext,
}: {
  visibility: 'public' | 'group' | 'invite' | undefined;
  groups: readonly InvitedGroup[];
  menuContext: UserMenuContext;
}): React.JSX.Element | null {
  const t = useT();
  const [open, setOpen] = useState(false);
  if (!visibility) {
    return null;
  }
  const hasGroups = visibility === 'group' && groups.length > 0;
  const value =
    visibility === 'public'
      ? t('mob.gv.invite_type_public')
      : hasGroups
      ? groups.length > 1
        ? `${groups[0].name} ${t('mob.reg.groups_more', { count: groups.length - 1 })}`
        : groups[0].name
      : t('mob.reg.invite_only');
  const content = (
    <>
      <View style={styles.iconBox}>
        <PeopleIcon size={18} />
      </View>
      <Text style={[styles.value, styles.listValue, hasGroups ? null : styles.valuePlain]} numberOfLines={1}>
        {value}
      </Text>
      {hasGroups ? <ChevronRightIcon size={18} color={colors.textMuted} /> : null}
    </>
  );
  if (!hasGroups) {
    return (
      <View style={styles.row} testID="list-invite-type">
        {content}
      </View>
    );
  }
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${t('mob.gv.invite_type')}: ${value}`}
        onPress={() => setOpen(true)}
        style={({ pressed }) => [styles.row, pressed ? styles.pressed : null]}
        testID="list-invite-type"
      >
        {content}
      </Pressable>
      {open ? (
        <InvitedSheet visible onClose={() => setOpen(false)} groups={groups} people={null} menuContext={menuContext} />
      ) : null}
    </>
  );
}

export default function InviteTypeRow({
  isPublic,
  groups,
  responses,
  invitations = null,
  organizerId,
  menuContext,
  currentUserId,
  onChanged,
  nicknames,
}: InviteTypeRowProps): React.JSX.Element | null {
  const t = useT();
  const [open, setOpen] = useState(false);

  const people = responses ? invitedPeople(responses, organizerId) : null;
  const hasPeople = Boolean(people);

  const playersCount = invitations?.filter(i => !i.source_group_id).length ?? 0;

  let value: string | null = null;
  if (isPublic) {
    value = t('mob.gv.invite_type_public');
  } else if (groups.length > 0 && invitations && playersCount > 0) {
    value = `${t('mob.gv.groups_count', { count: groups.length })} · ${t('mob.gv.players_count', {
      count: playersCount,
    })}`;
  } else if (groups.length > 0) {
    value = t('mob.gv.groups_count', { count: groups.length });
  } else if (hasPeople) {
    value = t('mob.gv.tab_players');
  }
  if (!value) {
    return null;
  }

  const content = (
    <>
      <View style={styles.iconBox}>
        <PeopleIcon size={18} />
      </View>
      <Text style={styles.label}>{t('mob.gv.invite_type')}</Text>
      <Text
        style={[styles.value, isPublic ? styles.valuePlain : null]}
        numberOfLines={2}
      >
        {value}
      </Text>
      {isPublic ? null : (
        <ChevronRightIcon size={18} color={colors.textMuted} />
      )}
    </>
  );

  if (isPublic) {
    return (
      <View style={styles.row} testID="invite-type-row">
        {content}
      </View>
    );
  }

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${t('mob.gv.invite_type')}: ${value}`}
        onPress={() => setOpen(true)}
        style={({ pressed }) => [styles.row, pressed ? styles.pressed : null]}
        testID="invite-type-row"
      >
        {content}
      </Pressable>
      <InvitedSheet
        visible={open}
        onClose={() => setOpen(false)}
        groups={groups}
        people={people}
        invitations={invitations}
        menuContext={menuContext}
        currentUserId={currentUserId}
        onChanged={onChanged}
        nicknames={nicknames}
      />
    </>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: sizes.touchTarget,
    paddingVertical: spacing.xs,
  },
  pressed: { opacity: 0.8 },
  iconBox: {
    width: ICON_BOX,
    height: ICON_BOX,
    borderRadius: radius.md,
    backgroundColor: colors.success,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  label: {
    ...typography.caption,
    color: colors.textMuted,
    marginRight: spacing.md,
  },
  value: {
    ...typography.bodyBold,
    color: colors.primary,
    flex: 1,
    textAlign: 'right',
    marginRight: spacing.sm,
  },
  valuePlain: { color: colors.textPrimary, marginRight: 0 },
  listValue: { textAlign: 'left' },
});
