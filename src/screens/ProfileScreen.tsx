/**
 * Profile screen (Phase 2 revamp, Main.png).
 *
 * Visual hierarchy:
 * - Top cover banner with semi-transparent Edit Profile and Settings buttons
 * - Centered overlapping avatar (88x88) with display name & @nickname
 * - 3-column stats strip (Played, Hosted, Groups) with IconBadge
 * - Skills card with sport icon and colored level pills
 * - My groups card with squircle logos/initials and "View all" link
 * - Recent games card with sport icon, date/time, venue and "View all" link
 * - Outlined Log out button with confirmation dialog
 */
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import FastImage from '@d11/react-native-fast-image';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';

import { useAuth } from '../auth/AuthContext';
import {
  getProfile,
  getProfileSummary,
  type ProfileSummary,
} from '../api/profile';
import { getMyGroups } from '../api/groups';
import type { Group } from '../types/group';
import { getCachedBanners, type BannerFallback } from '../api/home';
import { BannerBackground, SportIcon } from '../components/icons/DashboardIcons';
import { sportPalette } from '../sports/style';
import { useSportVisual } from '../sports/catalog';
import { EditIcon } from '../components/icons/ActionIcons';
import {
  ClockIcon,
  DoorIcon,
  GearIcon,
  PeopleIcon,
  PinIcon,
  StarIcon,
  TrophyIcon,
} from '../components/icons/SharedIcons';
import IconBadge from '../components/IconBadge';
import ErrorView from '../components/ErrorView';
import LoadingView from '../components/LoadingView';
import { useSportDisplayName } from '../utils/labels';
import { getDisplayName } from '../utils/displayName';
import { useT } from '../labels/LabelsContext';
import {
  borderWidth,
  colors,
  radius,
  spacing,
  typography,
} from '../theme/tokens';
import type { SkillLevelValue, UserProfile } from '../types/user';
import type { LabelKey } from '../labels/fallbackLabels';
import type { ProfileStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<ProfileStackParamList, 'ProfileHome'>;

function getInitials(name?: string | null): string {
  if (!name) return '??';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '??';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function formatRecentGameDate(isoString: string): string {
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return '';
    const weekday = d.toLocaleDateString(undefined, { weekday: 'short' });
    const day = d.getDate();
    const month = d.toLocaleDateString(undefined, { month: 'short' });
    const time = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
    return `${weekday} ${day} ${month}, ${time}`;
  } catch {
    return '';
  }
}

const GROUP_BADGE_COLORS = [
  colors.primary,
  colors.success,
  colors.warning,
  colors.accentPurple,
];

const LEVEL_LABEL_KEY: Record<SkillLevelValue, LabelKey> = {
  beginner: 'skill_level.beginner',
  intermediate: 'skill_level.intermediate',
  expert: 'skill_level.expert',
};

function getLevelTextColor(level?: string | null): string {
  const normalized = level?.trim().toLowerCase();
  if (normalized === 'beginner') return colors.warning;
  if (normalized === 'intermediate') return colors.primary;
  if (normalized === 'expert') return colors.accentPurple;
  return colors.textPrimary;
}

function getLevelBgColor(level?: string | null): string {
  const normalized = level?.trim().toLowerCase();
  if (normalized === 'beginner') return colors.warningLight;
  if (normalized === 'intermediate') return colors.primaryLight;
  if (normalized === 'expert') return colors.avatarTint5;
  return colors.avatarTint1;
}

function SkillTileItem({
  sport,
  level,
}: {
  sport: string;
  level: string;
}): React.JSX.Element {
  const t = useT();
  const sportName = useSportDisplayName(sport);
  const visual = useSportVisual(sport);
  const palette = sportPalette(visual.color);
  const textColor = getLevelTextColor(level);
  const bgColor = getLevelBgColor(level);
  const normalized = level.trim().toLowerCase() as SkillLevelValue;
  const labelKey = LEVEL_LABEL_KEY[normalized];
  const levelText = labelKey ? t(labelKey) : level;

  return (
    <View style={[styles.skillTile, { backgroundColor: bgColor }]}>
      <View style={[styles.skillIconCircle, { backgroundColor: palette.chip }]}>
        <SportIcon iconKey={visual.iconKey} size={20} />
      </View>
      <View style={styles.skillTextCol}>
        <Text numberOfLines={1} style={styles.skillSportName}>
          {sportName}
        </Text>
        <Text style={[styles.skillLevelText, { color: textColor }]}>
          {levelText}
        </Text>
      </View>
    </View>
  );
}

function GameSportMark({ sport }: { sport: string }): React.JSX.Element {
  const visual = useSportVisual(sport);
  const palette = sportPalette(visual.color);
  return (
    <View style={[styles.gameSportIconCircle, { backgroundColor: palette.chip }]}>
      <SportIcon iconKey={visual.iconKey} size={20} />
    </View>
  );
}

export default function ProfileScreen({ navigation }: Props): React.JSX.Element {
  const { signOut } = useAuth();
  const t = useT();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileSummary, setProfileSummary] = useState<ProfileSummary | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [bannerFallback, setBannerFallback] = useState<BannerFallback | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isSigningOut, setIsSigningOut] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setLoadError(null);
      const [profileData, summaryData, myGroupsData, bannerData] = await Promise.all([
        getProfile(),
        getProfileSummary().catch(() => ({
          games_played: 0,
          games_hosted: 0,
          groups_count: 0,
          recent_games: [],
        })),
        getMyGroups().catch(() => ({ items: [], total: 0 })),
        getCachedBanners().catch(() => null),
      ]);
      setProfile(profileData);
      setProfileSummary(summaryData);
      setGroups(myGroupsData.items ?? []);
      if (bannerData?.fallback) {
        setBannerFallback(bannerData.fallback);
      }
    } catch {
      setLoadError(t('mob.profile.load_error'));
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData]),
  );

  const handleSignOut = async (): Promise<void> => {
    try {
      setIsSigningOut(true);
      await signOut();
    } catch {
      setIsSigningOut(false);
      Alert.alert(t('mob.profile.sign_out'), t('mob.profile.sign_out_error'));
    }
  };

  const handleLogoutPress = (): void => {
    Alert.alert(
      t('mob.profile.logout_confirm_title'),
      t('mob.profile.logout_confirm_body'),
      [
        { text: t('mob.common.cancel'), style: 'cancel' },
        { text: t('mob.profile.logout'), style: 'destructive', onPress: handleSignOut },
      ],
    );
  };

  if (isLoading) {
    return <LoadingView />;
  }

  if (loadError || !profile) {
    return <ErrorView message={loadError ?? t('mob.profile.not_found')} onRetry={loadData} />;
  }

  const initials = getInitials(getDisplayName(profile));
  const coverUrl = profile.cover_url || bannerFallback?.image_url;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      {/* Cover banner */}
      <View style={styles.bannerContainer}>
        {coverUrl ? (
          <Image source={{ uri: coverUrl }} style={styles.bannerImage} resizeMode="cover" />
        ) : (
          <View style={styles.bannerFallback}>
            <BannerBackground width="100%" height="100%" />
          </View>
        )}
      </View>

      {/* Identity */}
      <View style={styles.identityContainer}>
        <View style={styles.avatarBorder}>
          {profile.avatar_url ? (
            <FastImage source={{ uri: profile.avatar_url }} style={styles.avatarImage} />
          ) : (
            <View style={styles.avatarInitials}>
              <Text style={styles.avatarInitialsText}>{initials}</Text>
            </View>
          )}
        </View>

        <Text style={styles.displayName}>{getDisplayName(profile)}</Text>
        <Text style={styles.nickname}>@{profile.nickname}</Text>
      </View>

      {/* Main cards */}
      <View style={styles.cardsContainer}>
        {/* Stats strip */}
        <View style={styles.statsCard}>
          <View style={styles.statColumn}>
            <IconBadge color="blue" size={36} borderRadius={18}>
              <TrophyIcon size={18} />
            </IconBadge>
            <Text style={[styles.statNumber, { color: colors.primary }]}>
              {profileSummary?.games_played ?? 0}
            </Text>
            <Text style={styles.statLabel}>{t('mob.profile.stat_played')}</Text>
          </View>

          <View style={styles.statDivider} />

          <View style={styles.statColumn}>
            <IconBadge color="amber" size={36} borderRadius={18}>
              <StarIcon size={18} />
            </IconBadge>
            <Text style={[styles.statNumber, { color: colors.warning }]}>
              {profileSummary?.games_hosted ?? 0}
            </Text>
            <Text style={styles.statLabel}>{t('mob.profile.stat_hosted')}</Text>
          </View>

          <View style={styles.statDivider} />

          <View style={styles.statColumn}>
            <IconBadge color="green" size={36} borderRadius={18}>
              <PeopleIcon size={18} />
            </IconBadge>
            <Text style={[styles.statNumber, { color: colors.success }]}>
              {profileSummary?.groups_count ?? groups.length}
            </Text>
            <Text style={styles.statLabel}>{t('mob.profile.stat_groups')}</Text>
          </View>
        </View>

        {/* Skills card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('mob.profile.skills')}</Text>
          {profile.skill_levels && profile.skill_levels.length > 0 ? (
            <View style={styles.skillsGrid}>
              {profile.skill_levels.map(skill => (
                <SkillTileItem
                  key={skill.sport}
                  sport={skill.sport}
                  level={skill.skill_level}
                />
              ))}
            </View>
          ) : (
            <Text style={styles.emptyText}>{t('mob.profile.no_skills')}</Text>
          )}
        </View>

        {/* My groups card */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardTitle}>{t('mob.profile.my_groups')}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('mob.dashboard.view_all')}
              onPress={() => (navigation.getParent() as any)?.navigate('Groups', { screen: 'GroupsList' })}
            >
              <Text style={styles.viewAllLink}>{t('mob.dashboard.view_all')}</Text>
            </Pressable>
          </View>

          {groups.length > 0 ? (
            <View style={styles.groupsRow}>
              {groups.slice(0, 3).map((group, idx) => (
                <Pressable
                  key={group.id}
                  style={styles.groupItem}
                  onPress={() =>
                    (navigation.getParent() as any)?.navigate('Groups', {
                      screen: 'GroupDetail',
                      params: { groupId: group.id },
                    })
                  }
                  accessibilityRole="button"
                  accessibilityLabel={group.name}
                >
                  {group.logo_url ? (
                    <Image source={{ uri: group.logo_url }} style={styles.groupLogo} resizeMode="cover" />
                  ) : (
                    <View
                      style={[
                        styles.groupLogoInitials,
                        { backgroundColor: GROUP_BADGE_COLORS[idx % GROUP_BADGE_COLORS.length] },
                      ]}
                    >
                      <Text style={styles.groupInitialsText}>{getInitials(group.name)}</Text>
                    </View>
                  )}
                  <Text numberOfLines={2} style={styles.groupName}>
                    {group.name}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : (
            <Text style={styles.emptyText}>{t('mob.profile.no_groups')}</Text>
          )}
        </View>

        {/* Recent games card */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardTitle}>{t('mob.profile.recent_games')}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('mob.dashboard.view_all')}
              onPress={() =>
                (navigation.getParent() as any)?.navigate('Tournaments', {
                  screen: 'TournamentsList',
                  params: { scope: 'mine' },
                })
              }
            >
              <Text style={styles.viewAllLink}>{t('mob.dashboard.view_all')}</Text>
            </Pressable>
          </View>

          {profileSummary?.recent_games && profileSummary.recent_games.length > 0 ? (
            <View style={styles.recentGamesList}>
              {profileSummary.recent_games.map((game, idx) => (
                <View key={game.id}>
                  {idx > 0 ? <View style={styles.gameDivider} /> : null}
                  <Pressable
                    style={styles.gameRow}
                    onPress={() =>
                      (navigation.getParent() as any)?.navigate('Home', {
                        screen: 'EventDetail',
                        params: { eventId: game.id },
                      })
                    }
                    accessibilityRole="button"
                    accessibilityLabel={game.title}
                  >
                    <GameSportMark sport={game.sport} />
                    <View style={styles.gameDetailsCol}>
                      <Text numberOfLines={1} style={styles.gameTitle}>
                        {game.title}
                      </Text>
                      <View style={styles.gameMetaRow}>
                        <ClockIcon size={14} />
                        <Text style={styles.gameMetaText}>
                          {formatRecentGameDate(game.starts_at)}
                        </Text>
                        <PinIcon size={14} />
                        <Text numberOfLines={1} style={styles.gameMetaText}>
                          {game.venue_name}
                        </Text>
                      </View>
                    </View>
                  </Pressable>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.emptyText}>{t('mob.profile.no_recent_games')}</Text>
          )}
        </View>

        {/* Action buttons (Edit Profile and Settings) */}
        <View style={styles.actionRow}>
          <Pressable
            style={styles.actionButton}
            onPress={() => navigation.navigate('EditProfile')}
            accessibilityRole="button"
            accessibilityLabel={t('mob.profile.edit_profile')}
          >
            <EditIcon size={18} color={colors.textPrimary} />
            <Text style={styles.actionButtonText}>{t('mob.profile.edit_profile')}</Text>
          </Pressable>
          <Pressable
            style={styles.actionButton}
            onPress={() => navigation.navigate('Settings')}
            accessibilityRole="button"
            accessibilityLabel={t('mob.profile.settings')}
          >
            <GearIcon size={18} />
            <Text style={styles.actionButtonText}>{t('mob.profile.settings')}</Text>
          </Pressable>
        </View>

        {/* Log out button */}
        <Pressable
          style={styles.logoutButton}
          onPress={handleLogoutPress}
          disabled={isSigningOut}
          accessibilityRole="button"
          accessibilityLabel={t('mob.profile.logout')}
        >
          {isSigningOut ? (
            <ActivityIndicator size="small" color={colors.error} />
          ) : (
            <>
              <DoorIcon size={20} />
              <Text style={styles.logoutButtonText}>{t('mob.profile.logout')}</Text>
            </>
          )}
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    paddingBottom: spacing.xxl + spacing.lg,
  },
  bannerContainer: {
    height: 160,
    backgroundColor: colors.primary,
    position: 'relative',
    overflow: 'hidden',
  },
  bannerImage: {
    width: '100%',
    height: '100%',
  },
  bannerFallback: {
    width: '100%',
    height: '100%',
    backgroundColor: colors.primary,
  },
  actionRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: 14,
    backgroundColor: colors.surface,
    borderWidth: borderWidth.thin,
    borderColor: colors.border,
    borderRadius: radius.lg,
  },
  actionButtonText: {
    ...typography.button,
    color: colors.textPrimary,
  },
  identityContainer: {
    alignItems: 'center',
    marginTop: -44,
    marginBottom: spacing.md,
  },
  avatarBorder: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 3,
    borderColor: colors.surface,
    backgroundColor: colors.surface,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImage: {
    width: 82,
    height: 82,
    borderRadius: 41,
  },
  avatarInitials: {
    width: 82,
    height: 82,
    borderRadius: 41,
    backgroundColor: colors.avatarTint1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitialsText: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.avatarTintText1,
  },
  displayName: {
    ...typography.h2,
    color: colors.textPrimary,
    marginTop: spacing.sm,
  },
  nickname: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: 2,
  },
  cardsContainer: {
    paddingHorizontal: spacing.md,
    gap: spacing.md,
  },
  statsCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: borderWidth.thin,
    borderColor: colors.border,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
  },
  statColumn: {
    flex: 1,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 20,
    fontWeight: '700',
    marginTop: 6,
  },
  statLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  statDivider: {
    width: borderWidth.thin,
    height: 48,
    backgroundColor: colors.border,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: borderWidth.thin,
    borderColor: colors.border,
    padding: spacing.md,
  },
  cardTitle: {
    ...typography.h3,
    color: colors.textPrimary,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  viewAllLink: {
    ...typography.label,
    color: colors.primary,
  },
  skillsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  skillTile: {
    flexGrow: 1,
    flexBasis: '45%',
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.md,
    padding: spacing.sm,
    gap: spacing.sm,
  },
  skillIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skillTextCol: {
    flex: 1,
  },
  skillSportName: {
    ...typography.bodyBold,
    color: colors.textPrimary,
    fontSize: 14,
  },
  skillLevelText: {
    ...typography.caption,
    fontWeight: '600',
    marginTop: 1,
  },
  groupsRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.xs,
  },
  groupItem: {
    alignItems: 'center',
    width: 72,
  },
  groupLogo: {
    width: 56,
    height: 56,
    borderRadius: radius.lg,
  },
  groupLogoInitials: {
    width: 56,
    height: 56,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupInitialsText: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.white,
  },
  groupName: {
    ...typography.label,
    color: colors.textPrimary,
    textAlign: 'center',
    marginTop: 6,
  },
  recentGamesList: {
    marginTop: spacing.xs,
  },
  gameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  gameDivider: {
    height: borderWidth.thin,
    backgroundColor: colors.border,
    marginVertical: spacing.xs,
  },
  gameSportIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.avatarTint1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gameDetailsCol: {
    flex: 1,
  },
  gameTitle: {
    ...typography.bodyBold,
    color: colors.textPrimary,
  },
  gameMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: 3,
  },
  gameMetaText: {
    ...typography.caption,
    color: colors.textSecondary,
    marginRight: spacing.xs,
  },
  logoutButton: {
    borderWidth: 1.5,
    borderColor: colors.error,
    borderRadius: radius.full,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    marginTop: spacing.xs,
  },
  logoutButtonText: {
    ...typography.button,
    color: colors.error,
  },
  emptyText: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
});
