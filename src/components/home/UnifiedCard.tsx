/**
 * Unified Card Component (Shuttlr Home v2).
 *
 * Requirements:
 * - Game cards and group cards share one layout:
 *   - Left tile (date block, or group logo)
 *   - Title
 *   - Details (Game: date/time, venue, sport; Group: "Owner: <display_name>", Description max 2 lines)
 *   - Avatars with +N (show member and player photos when photo_url exists, otherwise initials)
 *   - Group with no logo shows default group icon
 *   - Count on the right (Game: x/y going; Group: x members)
 *   - View game / View group button
 */
import React, { useState } from 'react';
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { GroupsIcon } from '../icons/DashboardIcons';
import UserAvatar from '../UserAvatar';
import { useT } from '../../labels/LabelsContext';
import { dash, dashRadius } from '../../theme/dashboardTheme';
import { colors, radius, spacing, typography } from '../../theme/tokens';
import type { Event } from '../../types/event';
import type { Group } from '../../types/group';
import { formatRowDate } from '../../utils/formatGameTime';

interface AvatarItem {
  display_name: string;
  photo_url: string | null;
}

interface UnifiedCardProps {
  leftTile: React.ReactNode;
  title: string;
  details: React.ReactNode;
  avatars: AvatarItem[];
  moreCount: number;
  countLabel: string;
  actionButtonLabel: string;
  onPress: () => void;
  accessibilityLabel: string;
}

export function UnifiedCard({
  leftTile,
  title,
  details,
  avatars,
  moreCount,
  countLabel,
  actionButtonLabel,
  onPress,
  accessibilityLabel,
}: UnifiedCardProps): React.JSX.Element {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed ? styles.pressed : null]}
    >
      {/* Top row: Left tile, Title + Details, Count on right */}
      <View style={styles.topRow}>
        <View style={styles.leftTileContainer}>{leftTile}</View>

        <View style={styles.infoCol}>
          <View style={styles.titleCountRow}>
            <Text style={styles.title} numberOfLines={1}>
              {title}
            </Text>
            {countLabel ? <Text style={styles.countText}>{countLabel}</Text> : null}
          </View>
          <View style={styles.detailsContainer}>{details}</View>
        </View>
      </View>

      {/* Bottom row: Avatars with +N on left, Action button on right */}
      <View style={styles.bottomRow}>
        <View style={styles.avatarRow}>
          {avatars.slice(0, 4).map((person, idx) => (
            <View
              key={idx}
              style={[styles.avatarOverlap, { zIndex: 10 - idx }]}
            >
              <UserAvatar
                imageUrl={person.photo_url}
                name={person.display_name}
                size={24}
              />
            </View>
          ))}
          {moreCount > 0 ? (
            <View style={[styles.moreBadge, { zIndex: 5 }]}>
              <Text style={styles.moreText}>+{moreCount}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.actionBtn}>
          <Text style={styles.actionBtnText}>{actionButtonLabel}</Text>
        </View>
      </View>
    </Pressable>
  );
}

/** Date tile for Game Cards */
function DateBlock({ dateString }: { dateString: string }): React.JSX.Element {
  const date = new Date(dateString);
  const isValid = !isNaN(date.getTime());
  const month = isValid
    ? date.toLocaleDateString(undefined, { month: 'short' }).toUpperCase()
    : '—';
  const day = isValid ? date.getDate() : '—';

  return (
    <View style={styles.dateBlock} testID="date-block">
      <View style={styles.dateMonthHeader}>
        <Text style={styles.dateMonthText}>{month}</Text>
      </View>
      <View style={styles.dateDayBody}>
        <Text style={styles.dateDayText}>{day}</Text>
      </View>
    </View>
  );
}

/** Logo tile for Group Cards */
function GroupLogoBlock({ logoUrl }: { logoUrl: string | null | undefined }): React.JSX.Element {
  const [loadFailed, setLoadFailed] = useState(false);

  if (logoUrl && !loadFailed) {
    return (
      <View style={styles.groupLogoContainer}>
        <Image
          source={{ uri: logoUrl }}
          style={styles.groupLogoImage}
          onError={() => setLoadFailed(true)}
          resizeMode="cover"
        />
      </View>
    );
  }

  return (
    <View style={styles.groupLogoFallback}>
      <GroupsIcon size={24} />
    </View>
  );
}

/** Game Card implementation using UnifiedCard */
export function UnifiedGameCard({
  event,
  onPress,
}: {
  event: Event;
  onPress: () => void;
}): React.JSX.Element {
  const t = useT();

  const venue = event.venue_name || event.location || '';
  const dateLine = [formatRowDate(event.starts_at), venue, event.sport]
    .filter(Boolean)
    .join(' · ');

  const going = t('mob.game_row.going', {
    count: event.participant_count,
    capacity: event.capacity,
  });

  const preview = event.players_preview ?? [];
  const more = Math.max(0, event.participant_count - preview.length);

  return (
    <UnifiedCard
      leftTile={<DateBlock dateString={event.starts_at} />}
      title={event.title}
      details={<Text style={styles.metaText} numberOfLines={1}>{dateLine}</Text>}
      avatars={preview}
      moreCount={more}
      countLabel={going}
      actionButtonLabel={t('mob.home.view_game')}
      onPress={onPress}
      accessibilityLabel={`${event.title}, ${dateLine}, ${going}`}
    />
  );
}

/** Group Card implementation using UnifiedCard */
export function UnifiedGroupCard({
  group,
  onPress,
}: {
  group: Group;
  onPress: () => void;
}): React.JSX.Element {
  const t = useT();

  const ownerName =
    group.owner?.display_name ||
    group.owner?.nickname ||
    group.owner_nickname ||
    (group.current_user_role === 'owner' ? t('mob.group_card.owner_self') : t('mob.group_card.owner_fallback'));
  const ownerLine = t('mob.home.owner_label', { name: ownerName });

  const memberCount = group.member_count ?? 1;
  const countLabel = t(
    memberCount === 1 ? 'mob.home.members_one' : 'mob.home.members_other',
    { count: memberCount },
  );

  const preview = group.members_preview ?? [];
  const more = Math.max(0, memberCount - preview.length);

  return (
    <UnifiedCard
      leftTile={<GroupLogoBlock logoUrl={group.logo_url} />}
      title={group.name}
      details={
        <View>
          <Text style={styles.ownerText} numberOfLines={1}>{ownerLine}</Text>
          {group.description ? (
            <Text style={styles.descriptionText} numberOfLines={2}>
              {group.description}
            </Text>
          ) : null}
        </View>
      }
      avatars={preview}
      moreCount={more}
      countLabel={countLabel}
      actionButtonLabel={t('mob.home.view_group')}
      onPress={onPress}
      accessibilityLabel={`${group.name}, ${ownerLine}, ${countLabel}`}
    />
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    borderRadius: dashRadius.card,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: spacing.md,
    marginBottom: spacing.sm + 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  pressed: {
    opacity: 0.88,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  leftTileContainer: {
    marginRight: spacing.sm + 2,
  },
  infoCol: {
    flex: 1,
  },
  titleCountRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  title: {
    ...typography.bodyBold,
    color: colors.textPrimary,
    fontSize: 15,
    flex: 1,
    paddingRight: spacing.xs,
  },
  countText: {
    ...typography.caption,
    fontWeight: '700',
    color: dash.brand,
    fontSize: 12,
  },
  detailsContainer: {
    marginTop: 3,
  },
  metaText: {
    ...typography.caption,
    color: colors.textSecondary,
    fontSize: 12,
  },
  ownerText: {
    ...typography.caption,
    fontWeight: '700',
    color: colors.textSecondary,
    fontSize: 11,
  },
  descriptionText: {
    ...typography.caption,
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 16,
    marginTop: 2,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm + 4,
    paddingTop: spacing.xs,
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarOverlap: {
    marginRight: -6,
    borderWidth: 1.5,
    borderColor: '#ffffff',
    borderRadius: 12,
  },
  moreBadge: {
    backgroundColor: '#f1f5f9',
    borderColor: '#ffffff',
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 4,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moreText: {
    ...typography.caption,
    fontWeight: '700',
    fontSize: 10,
    color: colors.textSecondary,
  },
  actionBtn: {
    backgroundColor: '#eff6ff',
    borderColor: '#bfdbfe',
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm + 4,
    paddingVertical: 5,
  },
  actionBtnText: {
    ...typography.caption,
    fontWeight: '700',
    color: dash.brand,
    fontSize: 12,
  },
  dateBlock: {
    width: 48,
    height: 52,
    borderRadius: radius.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#ffffff',
  },
  dateMonthHeader: {
    backgroundColor: dash.brand,
    alignItems: 'center',
    paddingVertical: 1,
  },
  dateMonthText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  dateDayBody: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateDayText: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  groupLogoContainer: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  groupLogoImage: {
    width: '100%',
    height: '100%',
  },
  groupLogoFallback: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
});
