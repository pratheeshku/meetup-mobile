/**
 * Organizer Responses block (DES-MEETUP-ADDENDUM-decline-response AD-5, DR-06; reordered and
 * extended by DES-MEETUP-ADDENDUM-game-view-redesign GV-4, GV-P1, AD-1, AD-3; board
 * docs/design/game-view-redesign/game-view and tournament-view).
 *
 * Header "Responses" with a right-aligned summary ("x of y joined" / "x of y registered").
 * Groups, most done first:
 * - game: Accepted (organizer first with the Organizer badge, Waitlisted badge), Declined, Pending;
 * - tournament: Registered, Accepted but not yet registered, Declined, Pending.
 * Every person with a user id is a `UserPressable` that opens the combined user pop-up (GV-6), which
 * carries the response/role badge. Without `menu` the rows are read-only, as before.
 *
 * Theme tokens only, fixed-size boxes for avatars, labels from mob.respond.* and mob.gv.*.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import Card from '../Card';
import PersonNames from '../PersonNames';
import UserAvatar from '../UserAvatar';
import UserPressable from '../user/UserPressable';
import type { UserMenuApi } from '../../hooks/useUserMenu';
import { useT } from '../../labels/LabelsContext';
import { colors, radius, spacing, typography } from '../../theme/tokens';
import type { ResponsePerson, ResponsesResponse } from '../../types/event';
import type { TournamentRegistration } from '../../types/tournament';
import type { UserBadge } from '../../types/userMenu';
import { groupGameResponses, groupTournamentResponses } from '../../utils/responseGroups';

type SectionKey = 'accepted' | 'registered' | 'accepted_not_registered' | 'declined' | 'pending';
type Tone = 'accepted' | 'registered' | 'declined' | 'pending';

interface ResponsesSectionProps {
  responses: ResponsesResponse | null;
  loading?: boolean;
  error?: string | null;
  /** `game` (default) or `tournament`; the tournament split needs `registrations`. */
  entity?: 'game' | 'tournament';
  /** Opens the combined user pop-up from a person row. */
  menu?: UserMenuApi;
  /** Right-aligned text of the header, for example "5 of 8 joined". */
  summary?: string;
  /** Game: this person is shown first with the Organizer badge. */
  organizerId?: string | null;
  /** Nicknames by user id (responses carry none); shown after the display name. */
  nicknames?: Record<string, string | null | undefined>;
  /** Tournament: the registrations the screen already loaded (AD-1). */
  registrations?: readonly TournamentRegistration[];
}

interface Section {
  key: SectionKey;
  title: string;
  total: number;
  items: ResponsePerson[];
  emptyText: string;
  tone: Tone;
}

export default function ResponsesSection({
  responses,
  loading = false,
  error = null,
  entity = 'game',
  menu,
  summary,
  organizerId = null,
  nicknames,
  registrations = [],
}: ResponsesSectionProps): React.JSX.Element | null {
  const t = useT();

  if (loading && !responses) {
    return null;
  }

  if (error && !responses) {
    return null;
  }

  if (
    !responses ||
    !responses.accepted ||
    typeof responses.accepted.total !== 'number' ||
    !Array.isArray(responses.accepted.items) ||
    !responses.pending ||
    typeof responses.pending.total !== 'number' ||
    !Array.isArray(responses.pending.items) ||
    // `declined` may be absent (viewer not allowed to see it); when present it must be well formed.
    (responses.declined != null &&
      (typeof responses.declined.total !== 'number' || !Array.isArray(responses.declined.items)))
  ) {
    return null;
  }

  const sections: Section[] = [];
  if (entity === 'tournament') {
    const groups = groupTournamentResponses(responses, registrations);
    sections.push(
      {
        key: 'registered',
        title: t('mob.gv.registered_section'),
        total: groups.registered.length,
        items: groups.registered,
        emptyText: t('mob.respond.empty.accepted'),
        tone: 'registered',
      },
      {
        key: 'accepted_not_registered',
        title: t('mob.gv.accepted_not_registered'),
        total: groups.acceptedNotRegistered.length,
        items: groups.acceptedNotRegistered,
        emptyText: t('mob.respond.empty.accepted'),
        tone: 'accepted',
      },
      ...(responses.declined
        ? [
            {
              key: 'declined' as const,
              title: t('mob.respond.section.declined'),
              total: responses.declined.total,
              items: groups.declined,
              emptyText: t('mob.respond.empty.declined'),
              tone: 'declined' as const,
            },
          ]
        : []),
      {
        key: 'pending',
        title: t('mob.respond.section.pending'),
        total: responses.pending.total,
        items: groups.pending,
        emptyText: t('mob.respond.empty.pending'),
        tone: 'pending',
      },
    );
  } else {
    const groups = groupGameResponses(responses, organizerId);
    sections.push(
      {
        key: 'accepted',
        title: t('mob.respond.section.accepted'),
        total: responses.accepted.total,
        items: groups.accepted,
        emptyText: t('mob.respond.empty.accepted'),
        tone: 'accepted',
      },
      ...(responses.declined
        ? [
            {
              key: 'declined' as const,
              title: t('mob.respond.section.declined'),
              total: responses.declined.total,
              items: groups.declined,
              emptyText: t('mob.respond.empty.declined'),
              tone: 'declined' as const,
            },
          ]
        : []),
      {
        key: 'pending',
        title: t('mob.respond.section.pending'),
        total: responses.pending.total,
        items: groups.pending,
        emptyText: t('mob.respond.empty.pending'),
        tone: 'pending',
      },
    );
  }

  const badgeFor = (section: Section, person: ResponsePerson): UserBadge => {
    if (section.key === 'accepted' && person.user_id && person.user_id === organizerId) {
      return { label: t('mob.game_detail.organizer'), tone: 'organizer' };
    }
    if (section.key === 'accepted' && person.waitlisted) {
      return { label: t('mob.respond.waitlisted'), tone: 'pending' };
    }
    return { label: section.title, tone: section.tone === 'registered' ? 'accepted' : section.tone };
  };

  const renderPerson = (section: Section, person: ResponsePerson, index: number): React.JSX.Element => {
    const name = person.display_name || person.email || '';
    const key = person.user_id ?? person.email ?? `${section.key}-${index}`;
    const nickname = person.user_id ? nicknames?.[person.user_id] ?? null : null;
    const isOrganizerRow =
      section.key === 'accepted' && Boolean(person.user_id) && person.user_id === organizerId;
    const viaLabel =
      section.key === 'declined'
        ? person.via === 'invitation'
          ? t('mob.respond.via.invitation')
          : person.via === 'public'
          ? t('mob.respond.via.public')
          : person.via === 'joined'
          ? t('mob.respond.via.joined')
          : null
        : null;
    const emailOnly = section.key === 'pending' && !person.user_id && Boolean(person.email);

    const identity = (
      <>
        <View style={styles.avatarBox}>
          <UserAvatar
            imageUrl={person.photo_url}
            name={name}
            size={36}
            fallback={menu ? 'initials' : 'letter'}
          />
        </View>
        <View style={styles.personText}>
          <PersonNames displayName={name} nickname={nickname} nameStyle={styles.personName} />
        </View>
      </>
    );

    return (
      <View key={key} style={styles.personRow} testID={`${section.key}-row-${index}`}>
        {menu && !emailOnly ? (
          <UserPressable
            person={{
              userId: person.user_id ?? null,
              displayName: name,
              nickname: nickname ?? undefined,
              photoUrl: person.photo_url ?? null,
              badge: badgeFor(section, person),
            }}
            menu={menu}
            style={styles.personPress}
            testID={`response-person-${person.user_id ?? key}`}
          >
            {identity}
          </UserPressable>
        ) : (
          <View style={styles.personPress}>{identity}</View>
        )}
        {isOrganizerRow ? (
          <View style={styles.organizerPill} testID={`organizer-tag-${index}`}>
            <Text style={styles.organizerText}>{t('mob.game_detail.organizer')}</Text>
          </View>
        ) : null}
        {section.key === 'accepted' && person.waitlisted ? (
          <View style={styles.waitlistedPill} testID={`waitlisted-tag-${index}`}>
            <Text style={styles.waitlistedText}>{t('mob.respond.waitlisted')}</Text>
          </View>
        ) : null}
        {viaLabel ? (
          <View style={styles.viaPill} testID={`via-tag-${index}`}>
            <Text style={styles.viaText}>{viaLabel}</Text>
          </View>
        ) : null}
        {emailOnly ? (
          <View style={styles.viaPill} testID={`email-tag-${index}`}>
            <Text style={styles.viaText}>{t('mob.gv.via_email')}</Text>
          </View>
        ) : null}
      </View>
    );
  };

  return (
    <Card style={styles.card} testID="organizer-responses-section">
      <View style={styles.headerRow}>
        <Text style={styles.title} accessibilityRole="header">
          {t('mob.respond.responses')}
        </Text>
        {summary ? (
          <Text style={styles.summary} testID="responses-summary">
            {summary}
          </Text>
        ) : null}
      </View>

      {sections.map((section, sectionIndex) => (
        <View key={section.key}>
          {sectionIndex > 0 ? <View style={styles.divider} /> : null}
          <View style={styles.section} testID={`responses-section-${section.key}`}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>{section.title}</Text>
              <View style={[styles.countBadge, COUNT_BG[section.tone]]}>
                <Text style={[styles.countText, COUNT_TEXT[section.tone]]}>{section.total}</Text>
              </View>
            </View>
            {section.items.length === 0 ? (
              <Text style={styles.emptyText}>{section.emptyText}</Text>
            ) : (
              section.items.map((person, index) => renderPerson(section, person, index))
            )}
          </View>
        </View>
      ))}
    </Card>
  );
}

const COUNT_BG = {
  accepted: { backgroundColor: colors.successLight },
  registered: { backgroundColor: colors.successLight },
  declined: { backgroundColor: colors.errorLight },
  pending: { backgroundColor: colors.track },
} as const;
const COUNT_TEXT = {
  accepted: { color: colors.successDark },
  registered: { color: colors.successDark },
  declined: { color: colors.error },
  pending: { color: colors.textSecondary },
} as const;

const styles = StyleSheet.create({
  card: {
    padding: spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  title: {
    ...typography.h3,
    color: colors.textPrimary,
  },
  summary: {
    ...typography.bodyBold,
    color: colors.successDark,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.sm,
  },
  section: {
    paddingVertical: spacing.xs,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  sectionTitle: {
    ...typography.label,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: colors.textSecondary,
  },
  countBadge: {
    borderRadius: radius.full,
    paddingHorizontal: spacing.xs + 2,
    paddingVertical: 2,
    minWidth: 20,
    alignItems: 'center',
    marginLeft: spacing.sm,
  },
  countText: {
    ...typography.caption,
    fontWeight: '700',
  },
  emptyText: {
    ...typography.caption,
    color: colors.textMuted,
    fontStyle: 'italic',
    paddingVertical: spacing.xs,
  },
  personRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
    paddingVertical: spacing.xs,
  },
  personPress: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 0,
  },
  avatarBox: {
    width: 36,
    height: 36,
    marginRight: spacing.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  personText: {
    flex: 1,
    minWidth: 0,
  },
  personName: {
    ...typography.body,
    color: colors.textPrimary,
  },
  organizerPill: {
    backgroundColor: colors.ownerChipBg,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    marginLeft: spacing.xs,
  },
  organizerText: {
    ...typography.caption,
    fontWeight: '700',
    color: colors.ownerChipText,
  },
  waitlistedPill: {
    backgroundColor: colors.ownerChipBg,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    marginLeft: spacing.xs,
  },
  waitlistedText: {
    ...typography.caption,
    fontWeight: '700',
    color: colors.ownerChipText,
  },
  viaPill: {
    backgroundColor: colors.track,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    marginLeft: spacing.xs,
  },
  viaText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
});
