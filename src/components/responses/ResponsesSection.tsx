/**
 * Organizer Responses Section (DES-MEETUP-ADDENDUM-decline-response AD-5, DR-06).
 *
 * Displays three response sections for the organizer:
 * - Accepted (going and waitlisted participants, waitlisted flagged)
 * - Pending (unanswered invitations; unclaimed email invites show email)
 * - Declined (invitee, public or joined declines with source tag)
 *
 * Theme tokens only, fixed-size boxes for avatars, labels from mob.respond.*.
 * Read-only view: no actions within this section.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import Card from '../Card';
import UserAvatar from '../UserAvatar';
import { useT } from '../../labels/LabelsContext';
import { colors, radius, spacing, typography } from '../../theme/tokens';
import type { ResponsePerson, ResponsesResponse } from '../../types/event';

interface ResponsesSectionProps {
  responses: ResponsesResponse | null;
  loading?: boolean;
  error?: string | null;
}

export default function ResponsesSection({
  responses,
  loading = false,
  error = null,
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
    !responses.declined ||
    typeof responses.declined.total !== 'number' ||
    !Array.isArray(responses.declined.items)
  ) {
    return null;
  }

  const { accepted, pending, declined } = responses;

  return (
    <Card style={styles.card} testID="organizer-responses-section">
      <Text style={styles.title}>{t('mob.respond.responses')}</Text>

      {/* Accepted Section */}
      <View style={styles.section} testID="responses-section-accepted">
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>{t('mob.respond.section.accepted')}</Text>
          <View style={styles.countBadge}>
            <Text style={styles.countText}>{accepted.total}</Text>
          </View>
        </View>
        {accepted.items.length === 0 ? (
          <Text style={styles.emptyText}>{t('mob.respond.empty.accepted')}</Text>
        ) : (
          accepted.items.map((person: ResponsePerson, index: number) => {
            const key = person.user_id ?? `accepted-${index}`;
            return (
              <View key={key} style={styles.personRow} testID={`accepted-row-${index}`}>
                <View style={styles.avatarBox}>
                  <UserAvatar
                    imageUrl={person.photo_url}
                    name={person.display_name}
                    size={36}
                  />
                </View>
                <Text style={styles.personName} numberOfLines={1}>
                  {person.display_name}
                </Text>
                {person.waitlisted ? (
                  <View style={styles.waitlistedPill} testID={`waitlisted-tag-${index}`}>
                    <Text style={styles.waitlistedText}>{t('mob.respond.waitlisted')}</Text>
                  </View>
                ) : null}
              </View>
            );
          })
        )}
      </View>

      <View style={styles.divider} />

      {/* Pending Section */}
      <View style={styles.section} testID="responses-section-pending">
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>{t('mob.respond.section.pending')}</Text>
          <View style={styles.countBadge}>
            <Text style={styles.countText}>{pending.total}</Text>
          </View>
        </View>
        {pending.items.length === 0 ? (
          <Text style={styles.emptyText}>{t('mob.respond.empty.pending')}</Text>
        ) : (
          pending.items.map((person: ResponsePerson, index: number) => {
            const name = person.display_name || person.email || '';
            const key = person.user_id ?? person.email ?? `pending-${index}`;
            return (
              <View key={key} style={styles.personRow} testID={`pending-row-${index}`}>
                <View style={styles.avatarBox}>
                  <UserAvatar
                    imageUrl={person.photo_url}
                    name={name}
                    size={36}
                  />
                </View>
                <Text style={styles.personName} numberOfLines={1}>
                  {name}
                </Text>
              </View>
            );
          })
        )}
      </View>

      <View style={styles.divider} />

      {/* Declined Section */}
      <View style={styles.section} testID="responses-section-declined">
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>{t('mob.respond.section.declined')}</Text>
          <View style={styles.countBadge}>
            <Text style={styles.countText}>{declined.total}</Text>
          </View>
        </View>
        {declined.items.length === 0 ? (
          <Text style={styles.emptyText}>{t('mob.respond.empty.declined')}</Text>
        ) : (
          declined.items.map((person: ResponsePerson, index: number) => {
            const key = person.user_id ?? `declined-${index}`;
            const viaLabel =
              person.via === 'invitation'
                ? t('mob.respond.via.invitation')
                : person.via === 'public'
                ? t('mob.respond.via.public')
                : person.via === 'joined'
                ? t('mob.respond.via.joined')
                : null;
            return (
              <View key={key} style={styles.personRow} testID={`declined-row-${index}`}>
                <View style={styles.avatarBox}>
                  <UserAvatar
                    imageUrl={person.photo_url}
                    name={person.display_name}
                    size={36}
                  />
                </View>
                <Text style={styles.personName} numberOfLines={1}>
                  {person.display_name}
                </Text>
                {viaLabel ? (
                  <View style={styles.viaPill} testID={`via-tag-${index}`}>
                    <Text style={styles.viaText}>{viaLabel}</Text>
                  </View>
                ) : null}
              </View>
            );
          })
        )}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    padding: spacing.md,
  },
  title: {
    ...typography.h3,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
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
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  sectionTitle: {
    ...typography.bodyBold,
    color: colors.textPrimary,
  },
  countBadge: {
    backgroundColor: colors.track,
    borderRadius: radius.full,
    paddingHorizontal: spacing.xs + 2,
    paddingVertical: 2,
    minWidth: 20,
    alignItems: 'center',
  },
  countText: {
    ...typography.caption,
    fontWeight: '700',
    color: colors.textSecondary,
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
    paddingVertical: spacing.xs,
  },
  avatarBox: {
    width: 36,
    height: 36,
    marginRight: spacing.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  personName: {
    ...typography.body,
    color: colors.textPrimary,
    flex: 1,
  },
  waitlistedPill: {
    backgroundColor: colors.track,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    marginLeft: spacing.xs,
  },
  waitlistedText: {
    ...typography.caption,
    color: colors.textSecondary,
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
