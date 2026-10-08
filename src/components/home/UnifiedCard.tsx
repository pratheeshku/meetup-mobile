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
import {
  ClockIcon,
  MapPinIcon,
  OwnerCrownIcon,
  PeopleGreenIcon,
} from '../icons/HomeV2Icons';
import { getRolePillColor, ROLE_BADGE_LABEL_KEY } from '../GroupCard';
import UserAvatar from '../UserAvatar';
import { useT } from '../../labels/LabelsContext';
import { dash, dashRadius } from '../../theme/dashboardTheme';
import { colors, radius, spacing, typography } from '../../theme/tokens';
import type { Event } from '../../types/event';
import type { Group, GroupRole } from '../../types/group';
import { formatRowDate } from '../../utils/formatGameTime';
import type { GameBadge } from '../../utils/gameLists';
import type { LabelKey } from '../../labels/fallbackLabels';

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
  countLabel: string | null;
  actionButtonLabel: string;
  onPress: () => void;
  accessibilityLabel: string;
  badge?: React.ReactNode;
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
  badge,
}: UnifiedCardProps): React.JSX.Element {
  const t = useT();
  const hasAvatars = (avatars && avatars.length > 0) || moreCount > 0;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed ? styles.pressed : null]}
    >
      <View style={styles.cardContent}>
        {/* (1) Left tile: date block or logo */}
        <View style={styles.leftTileContainer}>{leftTile}</View>

        {/* (2) Details column: badge (if present), title, details, and (3) avatars */}
        <View style={styles.infoCol}>
          {badge ? <View style={styles.badgeRow}>{badge}</View> : null}
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          <View style={styles.detailsContainer}>{details}</View>
          {hasAvatars ? (
            <View style={styles.avatarRow}>
              {avatars.slice(0, 4).map((person, idx) => (
                <View
                  key={idx}
                  style={[styles.avatarOverlap, { zIndex: 10 - idx }]}
                  accessible
                  accessibilityRole="image"
                  accessibilityLabel={person.display_name}
                >
                  <UserAvatar
                    imageUrl={person.photo_url}
                    name={person.display_name}
                    size={22}
                    accessibilityLabel={person.display_name}
                  />
                </View>
              ))}
              {moreCount > 0 ? (
                <View
                  style={styles.moreBadge}
                  accessible
                  accessibilityLabel={t('mob.home.more_avatars', { count: moreCount })}
                >
                  <Text style={styles.moreText}>+{moreCount}</Text>
                </View>
              ) : null}
            </View>
          ) : null}
        </View>

        {/* (4) Right-hand column: count and action button */}
        <View style={styles.rightCol}>
          {countLabel ? (
            <View style={styles.countContainer}>
              <PeopleGreenIcon size={14} />
              <Text style={styles.countText}>{countLabel}</Text>
            </View>
          ) : (
            <View />
          )}

          <View style={styles.actionBtn}>
            <Text style={styles.actionBtnText}>{actionButtonLabel}</Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

/** Date tile for Game Cards */
function DateBlock({ dateString }: { dateString: string }): React.JSX.Element {
  const date = new Date(dateString);
  const isValid = !isNaN(date.getTime());
  const weekday = isValid
    ? date.toLocaleDateString(undefined, { weekday: 'short' }).toUpperCase()
    : '—';
  const day = isValid ? String(date.getDate()) : '—';
  const month = isValid
    ? date.toLocaleDateString(undefined, { month: 'short' }).toUpperCase()
    : '—';

  return (
    <View style={styles.dateBlock} testID="date-block">
      <Text style={styles.dateWeekdayText}>{weekday}</Text>
      <Text style={styles.dateDayText}>{day}</Text>
      <Text style={styles.dateMonthText}>{month}</Text>
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

const GAME_BADGE_LABEL_KEY: Record<GameBadge, LabelKey> = {
  Hosting: 'mob.game_badge.hosting',
  Going: 'mob.game_badge.going',
  Waitlisted: 'mob.game_badge.waitlisted',
  Open: 'mob.game_badge.open',
};

export function GameStatusBadge({ badge }: { badge: GameBadge }): React.JSX.Element {
  const t = useT();
  const isOpen = badge === 'Open';
  return (
    <View style={[styles.statusPill, isOpen ? styles.statusOpen : null]}>
      <Text style={[styles.statusText, isOpen ? styles.statusOpenText : null]}>
        {t(GAME_BADGE_LABEL_KEY[badge])}
      </Text>
    </View>
  );
}

/** Game Card implementation using UnifiedCard */
export function UnifiedGameCard({
  event,
  onPress,
  badge,
}: {
  event: Event;
  onPress: () => void;
  badge?: GameBadge | null | React.ReactNode;
}): React.JSX.Element {
  const t = useT();

  const venue = event.venue_name || event.location || t('mob.home.card.location_tbc');
  const dateFormatted = formatRowDate(event.starts_at);
  const timeLine = event.sport ? `${dateFormatted} · ${event.sport}` : dateFormatted;

  const countLabel =
    event.capacity != null
      ? t('mob.game_row.going', {
          count: event.participant_count,
          capacity: event.capacity,
        })
      : t('mob.home.card.players_count_open', {
          count: event.participant_count,
        });

  const preview = event.players_preview ?? [];
  const more = Math.max(0, event.participant_count - preview.length);

  const badgeNode =
    typeof badge === 'string' ? (
      <GameStatusBadge badge={badge as GameBadge} />
    ) : (
      badge
    );

  return (
    <UnifiedCard
      leftTile={<DateBlock dateString={event.starts_at} />}
      title={event.title}
      details={
        <View>
          <View style={styles.detailRow}>
            <ClockIcon size={16} />
            <Text style={styles.metaText} numberOfLines={1}>
              {timeLine}
            </Text>
          </View>
          <View style={styles.detailRow}>
            <MapPinIcon size={16} />
            <Text style={styles.metaText} numberOfLines={1}>
              {venue}
            </Text>
          </View>
        </View>
      }
      avatars={preview}
      moreCount={more}
      countLabel={countLabel}
      actionButtonLabel={t('mob.home.view_game')}
      onPress={onPress}
      accessibilityLabel={`${event.title}, ${timeLine}, ${venue}, ${countLabel}`}
      badge={badgeNode}
    />
  );
}

/** Group Card implementation using UnifiedCard */
export function UnifiedGroupCard({
  group,
  onPress,
  currentUserId,
  showRolePill = false,
}: {
  group: Group;
  onPress: () => void;
  currentUserId?: string;
  showRolePill?: boolean;
}): React.JSX.Element {
  const t = useT();

  const isMine =
    group.current_user_role === 'owner' ||
    (Boolean(currentUserId) && Boolean(group.owner_id) && group.owner_id === currentUserId);

  const effectiveRole: GroupRole = isMine ? 'owner' : (group.current_user_role ?? 'member');
  const roleLabel = t(
    isMine
      ? 'mob.group_role.owner'
      : (ROLE_BADGE_LABEL_KEY[effectiveRole] ?? 'mob.group_role.member'),
  );
  const roleBg = getRolePillColor(effectiveRole);

  const ownerName =
    group.owner?.display_name ||
    group.owner?.nickname ||
    group.owner_nickname ||
    (isMine ? t('mob.group_card.owner_self') : t('mob.group_card.owner_fallback'));

  const ownerLine = `${t('mob.home.card.owner')}: ${ownerName}${isMine ? ` (${t('mob.home.card.you')})` : ''}`;

  const memberCount = group.member_count;
  const countLabel =
    memberCount !== null && memberCount !== undefined
      ? `${memberCount} ${t('mob.home.card.members')}`
      : null;

  const preview = group.members_preview ?? [];
  const more =
    memberCount !== null && memberCount !== undefined
      ? Math.max(0, memberCount - preview.length)
      : 0;

  return (
    <UnifiedCard
      leftTile={<GroupLogoBlock logoUrl={group.logo_url} />}
      badge={
        showRolePill && effectiveRole !== 'none' ? (
          <View style={[styles.rolePill, { backgroundColor: roleBg }]}>
            <Text style={styles.roleText}>{roleLabel}</Text>
          </View>
        ) : null
      }
      title={group.name}
      details={
        <View>
          <View style={styles.detailRow}>
            <OwnerCrownIcon size={16} />
            <Text style={styles.ownerText} numberOfLines={1}>
              {ownerLine}
            </Text>
          </View>
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
      accessibilityLabel={`${group.name}, ${ownerLine}${countLabel ? `, ${countLabel}` : ''}`}
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
  cardContent: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  leftTileContainer: {
    marginRight: spacing.sm + 2,
    flexShrink: 0,
  },
  infoCol: {
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
  },
  badgeRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  rolePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.full,
    alignSelf: 'flex-start',
  },
  roleText: {
    color: colors.white,
    fontSize: 11,
    fontWeight: '600',
  },
  title: {
    ...typography.bodyBold,
    color: colors.textPrimary,
    fontSize: 15,
  },
  rightCol: {
    flexShrink: 0,
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginLeft: spacing.sm,
    minHeight: 48,
  },
  countContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexShrink: 0,
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
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 2,
  },
  metaText: {
    ...typography.caption,
    color: colors.textSecondary,
    fontSize: 12,
    flexShrink: 1,
  },
  ownerText: {
    ...typography.caption,
    fontWeight: '700',
    color: colors.textSecondary,
    fontSize: 11,
    flexShrink: 1,
  },
  descriptionText: {
    ...typography.caption,
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 16,
    marginTop: 2,
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 7,
  },
  avatarOverlap: {
    marginRight: -8,
    borderWidth: 2,
    borderColor: '#ffffff',
    borderRadius: 13,
  },
  moreBadge: {
    backgroundColor: '#f1f5f9',
    borderColor: '#ffffff',
    borderWidth: 2,
    borderRadius: 12,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: -8,
    zIndex: 5,
  },
  moreText: {
    ...typography.caption,
    fontWeight: '700',
    fontSize: 10,
    color: colors.textSecondary,
  },
  actionBtn: {
    backgroundColor: '#E3ECFF',
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm + 4,
    paddingVertical: 5,
    marginTop: spacing.xs,
  },
  actionBtnText: {
    ...typography.caption,
    fontWeight: '700',
    color: '#1741B8',
    fontSize: 12,
  },
  dateBlock: {
    width: 48,
    height: 52,
    borderRadius: radius.md,
    backgroundColor: '#DDF3E8',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 2,
  },
  dateWeekdayText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#0A5A36',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  dateDayText: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0A5A36',
    lineHeight: 19,
  },
  dateMonthText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#0A5A36',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
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
  statusPill: {
    borderRadius: dashRadius.chip,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    backgroundColor: dash.page,
    borderWidth: 1,
    borderColor: dash.cardBorder,
    alignSelf: 'flex-start',
  },
  statusOpen: {
    backgroundColor: dash.white,
    borderColor: dash.brand,
  },
  statusText: {
    ...typography.label,
    color: dash.text,
  },
  statusOpenText: {
    color: dash.brand,
  },
});
