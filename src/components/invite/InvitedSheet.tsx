/**
 * Invited bottom sheet (DES-MEETUP-ADDENDUM-game-view-redesign GV-3, AD-2; board
 * docs/design/game-view-redesign/popups, B).
 *
 * Groups first (from the game or tournament payload, visible to any viewer), then "People · by
 * response" grouped Accepted, Declined, Pending from the organizer-only responses listing
 * (GV-P1). `people` is null for a viewer who may not read it: the sheet then shows the groups only.
 * A person row opens the combined user pop-up, hosted inside this sheet so the two modals stack in
 * the right order.
 *
 * Source tags: only what the data carries is shown (an email invite reads "email", a decline keeps
 * its existing "Invited / Public / Joined" tag). Per-person "via <group>" / "individual" is not in
 * any payload the app reads; see docs/reports/gv-mobile-report.md (blocked item).
 */
import React from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useUserMenu } from '../../hooks/useUserMenu';
import { useT } from '../../labels/LabelsContext';
import { colors, radius, sizes, spacing, typography } from '../../theme/tokens';
import type { ResponsePerson } from '../../types/event';
import type { UserBadge, UserMenuContext } from '../../types/userMenu';
import type { InvitedPeople } from '../../utils/responseGroups';
import { CrossIcon } from '../icons/ActionIcons';
import PersonNames from '../PersonNames';
import ScreenContainer from '../ScreenContainer';
import UserAvatar from '../UserAvatar';
import UserMenuSheet from '../user/UserMenuSheet';
import UserPressable from '../user/UserPressable';

export interface InvitedGroup {
  key: string;
  name: string;
}

interface InvitedSheetProps {
  visible: boolean;
  onClose: () => void;
  groups: readonly InvitedGroup[];
  people: InvitedPeople | null;
  /** Source of each invitation (organizer/committee); null = no source tags. */
  invitations?: Array<{
    invitee_user_id?: string | null;
    source_group_id?: string | null;
    invited_email?: string | null;
  }> | null;
  menuContext: UserMenuContext;
  currentUserId?: string | null;
  /** Called after a pop-up action ran, so the host refetches. */
  onChanged?: () => void;
  nicknames?: Record<string, string | null | undefined>;
}

const GROUP_TILE = 34;
const PERSON_AVATAR = 30;

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return '?';
  }
  return (
    parts.length === 1 ? parts[0].slice(0, 2) : parts[0][0] + parts[1][0]
  ).toUpperCase();
}

export default function InvitedSheet({
  visible,
  onClose,
  groups,
  people,
  invitations = null,
  menuContext,
  currentUserId,
  onChanged,
  nicknames,
}: InvitedSheetProps): React.JSX.Element {
  const t = useT();
  const menu = useUserMenu({ context: menuContext, currentUserId, onChanged });

  const bySourceUser = new Map<string, NonNullable<typeof invitations>[number]>();
  invitations?.forEach(i => {
    if (i.invitee_user_id) {
      bySourceUser.set(i.invitee_user_id, i);
    }
  });

  const sections: Array<{
    key: 'accepted' | 'declined' | 'pending';
    title: string;
    items: ResponsePerson[];
    tone: UserBadge['tone'];
  }> = people
    ? [
        {
          key: 'accepted',
          title: t('mob.respond.section.accepted'),
          items: people.accepted,
          tone: 'accepted',
        },
        {
          key: 'declined',
          title: t('mob.respond.section.declined'),
          items: people.declined,
          tone: 'declined',
        },
        {
          key: 'pending',
          title: t('mob.respond.section.pending'),
          items: people.pending,
          tone: 'pending',
        },
      ]
    : [];

  /** GV-3 source tag from the invitation row; null when none matched (for example a direct join). */
  const sourceTag = (person: ResponsePerson): string | null => {
    const inv = person.user_id ? bySourceUser.get(person.user_id) : undefined;
    if (!inv) {
      return null;
    }
    if (inv.source_group_id) {
      // Best effort: only groups the payload names are resolved, otherwise the name stays blank.
      const group = groups.find(g => g.key === inv.source_group_id)?.name ?? '';
      return t('mob.gv.via_group', { group });
    }
    return inv.invited_email ? t('mob.gv.via_email') : t('mob.gv.via_individual');
  };

  const renderPerson = (
    section: (typeof sections)[number],
    person: ResponsePerson,
    index: number,
  ): React.JSX.Element => {
    const name = person.display_name || person.email || '';
    const emailOnly =
      section.key === 'pending' && !person.user_id && Boolean(person.email);
    const nickname = person.user_id
      ? nicknames?.[person.user_id] ?? null
      : null;
    const tag = emailOnly
      ? t('mob.gv.via_email')
      : section.key === 'declined' && person.via === 'invitation'
      ? t('mob.respond.via.invitation')
      : section.key === 'declined' && person.via === 'public'
      ? t('mob.respond.via.public')
      : section.key === 'declined' && person.via === 'joined'
      ? t('mob.respond.via.joined')
      : sourceTag(person);
    const body = (
      <>
        <UserAvatar
          imageUrl={person.photo_url}
          name={name}
          size={PERSON_AVATAR}
          fallback="initials"
        />
        <View style={styles.personText}>
          <PersonNames
            displayName={name}
            nickname={nickname}
            nameStyle={styles.personName}
          />
        </View>
      </>
    );
    return (
      <View
        key={person.user_id ?? person.email ?? `${section.key}-${index}`}
        style={styles.personRow}
        testID={`invited-${section.key}-row-${index}`}
      >
        {emailOnly ? (
          <View style={styles.personPress}>{body}</View>
        ) : (
          <UserPressable
            person={{
              userId: person.user_id ?? null,
              displayName: name,
              nickname: nickname ?? undefined,
              photoUrl: person.photo_url ?? null,
              badge: { label: section.title, tone: section.tone },
            }}
            menu={menu}
            style={styles.personPress}
            testID={`invited-person-${person.user_id ?? index}`}
          >
            {body}
          </UserPressable>
        )}
        {tag ? (
          <Text style={styles.tag} numberOfLines={1}>
            {tag}
          </Text>
        ) : null}
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={t('mob.common.close')}
        />
        <ScreenContainer edges="bottom" fill={false} style={styles.sheetSafe}>
          <View style={styles.sheet} testID="invited-sheet">
            <View style={styles.grabber} />
            <View style={styles.headerRow}>
              <Text style={styles.caption} accessibilityRole="header">
                {t('mob.gv.invited_title')}
              </Text>
              <Pressable
                onPress={onClose}
                style={styles.closeTarget}
                accessibilityRole="button"
                accessibilityLabel={t('mob.common.close')}
                testID="invited-sheet-close"
              >
                <CrossIcon size={18} color={colors.textSecondary} />
              </Pressable>
            </View>
            <ScrollView style={styles.body}>
              {groups.length > 0 ? (
                <View testID="invited-groups">
                  <Text style={styles.sectionTitle}>
                    {t('mob.gv.groups_count', { count: groups.length })}
                  </Text>
                  {groups.map(group => (
                    <View
                      key={group.key}
                      style={styles.groupRow}
                      testID={`invited-group-${group.key}`}
                    >
                      <View style={styles.groupTile}>
                        <Text style={styles.groupTileText}>
                          {initialsOf(group.name)}
                        </Text>
                      </View>
                      <Text style={styles.groupName} numberOfLines={1}>
                        {group.name}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : null}
              {people ? (
                <View
                  testID="invited-people"
                  style={groups.length > 0 ? styles.peopleDivider : null}
                >
                  <Text style={styles.sectionTitle}>
                    {t('mob.gv.people_by_response')}
                  </Text>
                  {sections.map(section => (
                    <View
                      key={section.key}
                      testID={`invited-section-${section.key}`}
                    >
                      <View style={styles.responseHeader}>
                        <Text
                          style={[
                            styles.responseTitle,
                            TONE_TEXT[section.tone],
                          ]}
                        >
                          {section.title}
                        </Text>
                        <View
                          style={[styles.countBadge, TONE_BG[section.tone]]}
                        >
                          <Text
                            style={[styles.countText, TONE_TEXT[section.tone]]}
                          >
                            {section.items.length}
                          </Text>
                        </View>
                      </View>
                      {section.items.map((person, index) =>
                        renderPerson(section, person, index),
                      )}
                    </View>
                  ))}
                </View>
              ) : null}
            </ScrollView>
          </View>
        </ScreenContainer>
        <UserMenuSheet menu={menu} />
      </View>
    </Modal>
  );
}

const TONE_BG = {
  accepted: { backgroundColor: colors.successLight },
  declined: { backgroundColor: colors.errorLight },
  pending: { backgroundColor: colors.track },
  organizer: { backgroundColor: colors.ownerChipBg },
  neutral: { backgroundColor: colors.track },
} as const;
const TONE_TEXT = {
  accepted: { color: colors.successDark },
  declined: { color: colors.error },
  pending: { color: colors.textSecondary },
  organizer: { color: colors.ownerChipText },
  neutral: { color: colors.textSecondary },
} as const;

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: colors.scrim,
    justifyContent: 'flex-end',
  },
  sheetSafe: { backgroundColor: colors.surface },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    maxHeight: '90%',
  },
  grabber: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: spacing.xs,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  caption: {
    ...typography.label,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  closeTarget: {
    width: sizes.touchTarget,
    height: sizes.touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flexGrow: 0 },
  sectionTitle: {
    ...typography.label,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  groupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: sizes.touchTarget,
  },
  groupTile: {
    width: GROUP_TILE,
    height: GROUP_TILE,
    borderRadius: radius.md,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm + 2,
  },
  groupTileText: {
    ...typography.caption,
    fontWeight: '700',
    color: colors.primaryDark,
  },
  groupName: { ...typography.bodyBold, color: colors.textPrimary, flex: 1 },
  peopleDivider: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
  },
  responseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
    marginBottom: spacing.xs,
  },
  responseTitle: { ...typography.caption, fontWeight: '700' },
  countBadge: {
    borderRadius: radius.full,
    paddingHorizontal: spacing.xs + 3,
    marginLeft: spacing.sm,
  },
  countText: { ...typography.caption, fontWeight: '700' },
  personRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: sizes.controlSmall + 4,
  },
  personPress: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 0,
  },
  personText: { flex: 1, minWidth: 0, marginLeft: spacing.sm + 2 },
  personName: { ...typography.body, color: colors.textPrimary },
  tag: {
    ...typography.caption,
    color: colors.textSecondary,
    marginLeft: spacing.sm,
    maxWidth: 120,
  },
});
