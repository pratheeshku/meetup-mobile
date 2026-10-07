/**
 * Hamburger drawer menu (Shuttlr Home v2).
 *
 * Menu hierarchy:
 * Home
 * Groups > Groups, Tournament teams
 * Games > Games, Tournaments
 * About > About, Privacy Policy, Terms and Conditions, Help
 *
 * - About items open their https URL in the system browser; hide an item when its URL is empty.
 * - Drawer content: avatar, name, View profile, close button, coloured section icons,
 *   count badges (groups, games), WIP pill on Tournament teams and Tournaments,
 *   "Play together" footer. Tapping the dark area closes it. Logout and Settings stay in Profile.
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { HomeMenuResponse } from '../../api/home';
import UserAvatar from '../UserAvatar';
import { GamesIcon, GroupsIcon, HomeIcon } from '../icons/DashboardIcons';
import {
  ChevronDownIcon,
  ChevronUpIcon,
  CloseIcon,
  ExternalLinkIcon,
  InfoIcon,
} from '../icons/HomeV2Icons';
import { useT } from '../../labels/LabelsContext';
import { dash } from '../../theme/dashboardTheme';
import { colors, radius, spacing, typography } from '../../theme/tokens';
import type { UserProfile } from '../../types/user';
import { getDisplayName } from '../../utils/displayName';
import { toHttpsUrl } from '../../utils/httpsUrl';

export type DrawerActiveItem =
  | 'home'
  | 'groups'
  | 'tournament_teams'
  | 'games'
  | 'tournaments'
  | null;

export type DrawerSection = 'groups' | 'games' | 'about' | null;

/**
 * Screen-to-item mapping per requirement B5:
 * - Groups screens (list, detail, create, invite) mark Groups
 * - Tournament teams screens mark Tournament teams
 * - Games screens (list, detail, create, my games) mark Games
 * - Tournament screens mark Tournaments
 * - Home screens mark Home
 * - Any other screen (e.g. Profile) marks nothing and collapses all sections
 */
export function resolveDrawerActive(screenName?: string): {
  activeItem: DrawerActiveItem;
  activeSection: DrawerSection;
} {
  const normalized = (screenName || 'Home').trim();

  // Home
  if (normalized === 'Home' || normalized === 'EventsList') {
    return { activeItem: 'home', activeSection: null };
  }

  // Groups screens (list, detail, create) -> mark Groups
  if (
    normalized === 'Groups' ||
    normalized === 'GroupsList' ||
    normalized === 'GroupDetail' ||
    normalized === 'CreateGroup' ||
    normalized === 'InviteMembers'
  ) {
    return { activeItem: 'groups', activeSection: 'groups' };
  }

  // Tournament teams screens -> mark Tournament teams
  if (
    normalized === 'TournamentTeams' ||
    normalized === 'TournamentTeamsScreen'
  ) {
    return { activeItem: 'tournament_teams', activeSection: 'groups' };
  }

  // Games screens (list, detail, create, my games) -> mark Games
  if (
    normalized === 'Games' ||
    normalized === 'GamesList' ||
    normalized === 'EventDetail' ||
    normalized === 'CreateGame' ||
    normalized === 'MyGames'
  ) {
    return { activeItem: 'games', activeSection: 'games' };
  }

  // Tournament screens -> mark Tournaments
  if (
    normalized === 'Tournaments' ||
    normalized === 'TournamentsList' ||
    normalized === 'TournamentDetail'
  ) {
    return { activeItem: 'tournaments', activeSection: 'games' };
  }

  // Any other screen (e.g. Profile, ProfileHome, NotificationPreferences) marks nothing
  return { activeItem: null, activeSection: null };
}

const SECTION_CONFIG = {
  groups: {
    activeFill: '#E3F6EC',
    activeText: '#0A5A36',
    sectionColor: '#0F7B4F',
    subItemActiveTint: '#E3F6EC',
    guideColor: 'rgba(15, 123, 79, 0.4)',
  },
  games: {
    activeFill: '#FFF1E3',
    activeText: '#7A3500',
    sectionColor: '#E8772E',
    subItemActiveTint: '#FFF1E3',
    guideColor: 'rgba(232, 119, 46, 0.4)',
  },
  about: {
    activeFill: '#EEEBFF',
    activeText: '#3F3496',
    sectionColor: '#6B5CE0',
    subItemActiveTint: '#EEEBFF',
    guideColor: 'rgba(107, 92, 224, 0.4)',
  },
} as const;

export interface DrawerMenuProps {
  visible: boolean;
  onClose: () => void;
  user: UserProfile | null;
  avatarUrl?: string | null;
  menuData?: HomeMenuResponse | null;
  currentScreen?: string;
  onNavigateHome: () => void;
  onNavigateGroups: () => void;
  onNavigateTournamentTeams: () => void;
  onNavigateGames: () => void;
  onNavigateTournaments: () => void;
  onNavigateProfile: () => void;
}

export default function DrawerMenu({
  visible,
  onClose,
  user,
  avatarUrl,
  menuData,
  currentScreen = 'Home',
  onNavigateHome,
  onNavigateGroups,
  onNavigateTournamentTeams,
  onNavigateGames,
  onNavigateTournaments,
  onNavigateProfile,
}: DrawerMenuProps): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const t = useT();

  const displayName = getDisplayName(user);

  // Active state hierarchy
  const { activeItem, activeSection } = resolveDrawerActive(currentScreen);

  // Section expansion state: only the section containing current screen is expanded;
  // others collapsed. Choice lasts until screen changes.
  const [expandedSections, setExpandedSections] = useState<Record<'groups' | 'games' | 'about', boolean>>(() => ({
    groups: activeSection === 'groups',
    games: activeSection === 'games',
    about: activeSection === 'about',
  }));

  const prevScreenRef = useRef(currentScreen);
  useEffect(() => {
    if (prevScreenRef.current !== currentScreen) {
      prevScreenRef.current = currentScreen;
      setExpandedSections({
        groups: activeSection === 'groups',
        games: activeSection === 'games',
        about: activeSection === 'about',
      });
    }
  }, [currentScreen, activeSection]);

  const toggleSection = (section: 'groups' | 'games' | 'about') => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  // Groups and Games badges from GET /home/menu; hide at 0
  const groupsBadgeCount = menuData?.active_groups ?? 0;
  const gamesBadgeCount = menuData?.upcoming_games ?? 0;

  // URLs for About section: re-check https scheme; empty/null hides item
  const aboutUrl = toHttpsUrl(menuData?.links?.about_url);
  const privacyUrl = toHttpsUrl(menuData?.links?.privacy_url);
  const termsUrl = toHttpsUrl(menuData?.links?.terms_url);
  const helpUrl = toHttpsUrl(menuData?.links?.help_url);
  const showAboutSection = Boolean(aboutUrl || privacyUrl || termsUrl || helpUrl);

  const openUrl = async (url: string | null) => {
    const safeUrl = toHttpsUrl(url);
    if (!safeUrl) return;
    try {
      await Linking.openURL(safeUrl);
    } catch {
      // Ignored
    }
  };

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.modalRoot}>
        {/* Dark backdrop tap closes drawer */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('mob.menu.close_a11y')}
          onPress={onClose}
          style={styles.backdrop}
        />

        {/* Drawer panel */}
        <View style={[styles.drawer, { paddingTop: insets.top, paddingBottom: insets.bottom || spacing.md }]}>
          {/* Header: avatar, name, View profile, close button */}
          <View style={styles.header}>
            <View style={styles.userRow}>
              <UserAvatar imageUrl={avatarUrl} name={displayName} size={44} />
              <View style={styles.userInfo}>
                <Text style={styles.userName} numberOfLines={1}>
                  {displayName}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('mob.menu.view_profile')}
                  onPress={() => {
                    onClose();
                    onNavigateProfile();
                  }}
                  style={({ pressed }) => [styles.profileLink, pressed ? styles.pressed : null]}
                >
                  <Text style={styles.profileLinkText}>{t('mob.menu.view_profile')}</Text>
                </Pressable>
              </View>
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('mob.menu.close_a11y')}
              onPress={onClose}
              style={({ pressed }) => [styles.closeBtn, pressed ? styles.pressed : null]}
            >
              <CloseIcon size={18} color={colors.textSecondary} />
            </Pressable>
          </View>

          <View style={styles.divider} />

          {/* Navigation items */}
          <ScrollView style={styles.scrollArea} contentContainerStyle={styles.scrollContent}>
            {/* Home: active Home item keeps its current tint and border */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('mob.menu.home')}
              accessibilityState={{ selected: activeItem === 'home' }}
              onPress={() => {
                onClose();
                onNavigateHome();
              }}
              style={({ pressed }) => [
                styles.itemRow,
                activeItem === 'home' ? styles.itemRowActive : styles.itemRowInactive,
                pressed ? styles.pressed : null,
              ]}
            >
              <View style={[styles.iconWrap, styles.homeIconWrap]}>
                <HomeIcon size={20} />
              </View>
              <Text
                style={[
                  styles.itemText,
                  activeItem === 'home' && styles.itemTextActive,
                ]}
              >
                {t('mob.menu.home')}
              </Text>
            </Pressable>

            {/* Groups Section Header */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('mob.menu.groups_heading')}
              accessibilityState={{ expanded: Boolean(expandedSections.groups) }}
              onPress={() => toggleSection('groups')}
              style={({ pressed }) => [
                styles.sectionHeaderRow,
                activeSection === 'groups' && styles.sectionHeaderActiveGroups,
                pressed ? styles.pressed : null,
              ]}
            >
              <View style={styles.sectionHeaderLeft}>
                <View style={[styles.sectionIconWrap, styles.groupsIconWrap]}>
                  <GroupsIcon size={18} />
                </View>
                <Text
                  style={[
                    styles.sectionTitle,
                    activeSection === 'groups' && styles.sectionTitleActiveGroups,
                  ]}
                >
                  {t('mob.menu.groups_heading')}
                </Text>
              </View>
              {expandedSections.groups ? (
                <ChevronUpIcon
                  size={14}
                  color={activeSection === 'groups' ? '#0A5A36' : '#6B7280'}
                />
              ) : (
                <ChevronDownIcon
                  size={14}
                  color={activeSection === 'groups' ? '#0A5A36' : '#6B7280'}
                />
              )}
            </Pressable>

            {/* Groups Sub-items under 2px vertical guide line */}
            {expandedSections.groups ? (
              <View
                style={[
                  styles.subItemsContainer,
                  { borderLeftColor: SECTION_CONFIG.groups.guideColor },
                ]}
              >
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('mob.menu.groups')}
                  accessibilityState={{ selected: activeItem === 'groups' }}
                  onPress={() => {
                    onClose();
                    onNavigateGroups();
                  }}
                  style={({ pressed }) => [
                    styles.subItemRow,
                    activeItem === 'groups' && {
                      backgroundColor: SECTION_CONFIG.groups.subItemActiveTint,
                      borderLeftColor: SECTION_CONFIG.groups.sectionColor,
                    },
                    pressed ? styles.pressed : null,
                  ]}
                >
                  <Text
                    style={[
                      styles.subItemText,
                      activeItem === 'groups' && styles.subItemTextActiveBold,
                    ]}
                  >
                    {t('mob.menu.groups')}
                  </Text>
                  {groupsBadgeCount > 0 ? (
                    <View style={styles.countBadge}>
                      <Text style={styles.countText}>{groupsBadgeCount}</Text>
                    </View>
                  ) : null}
                </Pressable>

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('mob.menu.tournament_teams')}
                  accessibilityState={{ selected: activeItem === 'tournament_teams' }}
                  onPress={() => {
                    onClose();
                    onNavigateTournamentTeams();
                  }}
                  style={({ pressed }) => [
                    styles.subItemRow,
                    activeItem === 'tournament_teams' && {
                      backgroundColor: SECTION_CONFIG.groups.subItemActiveTint,
                      borderLeftColor: SECTION_CONFIG.groups.sectionColor,
                    },
                    pressed ? styles.pressed : null,
                  ]}
                >
                  <Text
                    style={[
                      styles.subItemText,
                      activeItem === 'tournament_teams' && styles.subItemTextActiveBold,
                    ]}
                  >
                    {t('mob.menu.tournament_teams')}
                  </Text>
                  <View style={styles.wipPill}>
                    <Text style={styles.wipPillText}>{t('mob.wip.pill')}</Text>
                  </View>
                </Pressable>
              </View>
            ) : null}

            {/* Games Section Header */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('mob.menu.games_heading')}
              accessibilityState={{ expanded: Boolean(expandedSections.games) }}
              onPress={() => toggleSection('games')}
              style={({ pressed }) => [
                styles.sectionHeaderRow,
                activeSection === 'games' && styles.sectionHeaderActiveGames,
                pressed ? styles.pressed : null,
              ]}
            >
              <View style={styles.sectionHeaderLeft}>
                <View style={[styles.sectionIconWrap, styles.gamesIconWrap]}>
                  <GamesIcon size={18} />
                </View>
                <Text
                  style={[
                    styles.sectionTitle,
                    activeSection === 'games' && styles.sectionTitleActiveGames,
                  ]}
                >
                  {t('mob.menu.games_heading')}
                </Text>
              </View>
              {expandedSections.games ? (
                <ChevronUpIcon
                  size={14}
                  color={activeSection === 'games' ? '#7A3500' : '#6B7280'}
                />
              ) : (
                <ChevronDownIcon
                  size={14}
                  color={activeSection === 'games' ? '#7A3500' : '#6B7280'}
                />
              )}
            </Pressable>

            {/* Games Sub-items under 2px vertical guide line */}
            {expandedSections.games ? (
              <View
                style={[
                  styles.subItemsContainer,
                  { borderLeftColor: SECTION_CONFIG.games.guideColor },
                ]}
              >
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('mob.menu.games')}
                  accessibilityState={{ selected: activeItem === 'games' }}
                  onPress={() => {
                    onClose();
                    onNavigateGames();
                  }}
                  style={({ pressed }) => [
                    styles.subItemRow,
                    activeItem === 'games' && {
                      backgroundColor: SECTION_CONFIG.games.subItemActiveTint,
                      borderLeftColor: SECTION_CONFIG.games.sectionColor,
                    },
                    pressed ? styles.pressed : null,
                  ]}
                >
                  <Text
                    style={[
                      styles.subItemText,
                      activeItem === 'games' && styles.subItemTextActiveBold,
                    ]}
                  >
                    {t('mob.menu.games')}
                  </Text>
                  {gamesBadgeCount > 0 ? (
                    <View style={styles.countBadge}>
                      <Text style={styles.countText}>{gamesBadgeCount}</Text>
                    </View>
                  ) : null}
                </Pressable>

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('mob.menu.tournaments')}
                  accessibilityState={{ selected: activeItem === 'tournaments' }}
                  onPress={() => {
                    onClose();
                    onNavigateTournaments();
                  }}
                  style={({ pressed }) => [
                    styles.subItemRow,
                    activeItem === 'tournaments' && {
                      backgroundColor: SECTION_CONFIG.games.subItemActiveTint,
                      borderLeftColor: SECTION_CONFIG.games.sectionColor,
                    },
                    pressed ? styles.pressed : null,
                  ]}
                >
                  <Text
                    style={[
                      styles.subItemText,
                      activeItem === 'tournaments' && styles.subItemTextActiveBold,
                    ]}
                  >
                    {t('mob.menu.tournaments')}
                  </Text>
                  <View style={styles.wipPill}>
                    <Text style={styles.wipPillText}>{t('mob.wip.pill')}</Text>
                  </View>
                </Pressable>
              </View>
            ) : null}

            {/* About Section: hidden when all four URLs are empty */}
            {showAboutSection ? (
              <>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('mob.menu.about_heading')}
                  accessibilityState={{ expanded: Boolean(expandedSections.about) }}
                  onPress={() => toggleSection('about')}
                  style={({ pressed }) => [
                    styles.sectionHeaderRow,
                    activeSection === 'about' && styles.sectionHeaderActiveAbout,
                    pressed ? styles.pressed : null,
                  ]}
                >
                  <View style={styles.sectionHeaderLeft}>
                    <View style={[styles.sectionIconWrap, styles.aboutIconWrap]}>
                      <InfoIcon
                        size={16}
                        color={activeSection === 'about' ? '#3F3496' : '#6B5CE0'}
                      />
                    </View>
                    <Text
                      style={[
                        styles.sectionTitle,
                        activeSection === 'about' && styles.sectionTitleActiveAbout,
                      ]}
                    >
                      {t('mob.menu.about_heading')}
                    </Text>
                  </View>
                  {expandedSections.about ? (
                    <ChevronUpIcon
                      size={14}
                      color={activeSection === 'about' ? '#3F3496' : '#6B7280'}
                    />
                  ) : (
                    <ChevronDownIcon
                      size={14}
                      color={activeSection === 'about' ? '#3F3496' : '#6B7280'}
                    />
                  )}
                </Pressable>

                {/* About Sub-items under 2px vertical guide line; external links never active */}
                {expandedSections.about ? (
                  <View
                    style={[
                      styles.subItemsContainer,
                      { borderLeftColor: SECTION_CONFIG.about.guideColor },
                    ]}
                  >
                    {aboutUrl ? (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={t('mob.menu.about')}
                        onPress={() => {
                          onClose();
                          openUrl(aboutUrl);
                        }}
                        style={({ pressed }) => [styles.subItemRow, pressed ? styles.pressed : null]}
                      >
                        <Text style={styles.subItemText}>{t('mob.menu.about')}</Text>
                        <ExternalLinkIcon size={14} color="#9CA3AF" />
                      </Pressable>
                    ) : null}

                    {privacyUrl ? (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={t('mob.menu.privacy')}
                        onPress={() => {
                          onClose();
                          openUrl(privacyUrl);
                        }}
                        style={({ pressed }) => [styles.subItemRow, pressed ? styles.pressed : null]}
                      >
                        <Text style={styles.subItemText}>{t('mob.menu.privacy')}</Text>
                        <ExternalLinkIcon size={14} color="#9CA3AF" />
                      </Pressable>
                    ) : null}

                    {termsUrl ? (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={t('mob.menu.terms')}
                        onPress={() => {
                          onClose();
                          openUrl(termsUrl);
                        }}
                        style={({ pressed }) => [styles.subItemRow, pressed ? styles.pressed : null]}
                      >
                        <Text style={styles.subItemText}>{t('mob.menu.terms')}</Text>
                        <ExternalLinkIcon size={14} color="#9CA3AF" />
                      </Pressable>
                    ) : null}

                    {helpUrl ? (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={t('mob.menu.help')}
                        onPress={() => {
                          onClose();
                          openUrl(helpUrl);
                        }}
                        style={({ pressed }) => [styles.subItemRow, pressed ? styles.pressed : null]}
                      >
                        <Text style={styles.subItemText}>{t('mob.menu.help')}</Text>
                        <ExternalLinkIcon size={14} color="#9CA3AF" />
                      </Pressable>
                    ) : null}
                  </View>
                ) : null}
              </>
            ) : null}
          </ScrollView>

          {/* Footer: "Play together" */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>{t('mob.menu.play_together')}</Text>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    flexDirection: 'row',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  drawer: {
    width: '80%',
    maxWidth: 320,
    backgroundColor: colors.surface,
    height: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  userInfo: {
    marginLeft: spacing.sm + 2,
    flex: 1,
  },
  userName: {
    ...typography.bodyBold,
    color: colors.textPrimary,
  },
  profileLink: {
    marginTop: 2,
  },
  profileLinkText: {
    ...typography.caption,
    color: dash.brand,
    fontWeight: '600',
  },
  closeBtn: {
    padding: spacing.xs,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginHorizontal: spacing.md,
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
  },
  itemRowActive: {
    backgroundColor: '#EEF3FF',
    borderWidth: 1,
    borderColor: '#1D4ED8',
  },
  itemRowInactive: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm + 2,
  },
  homeIconWrap: {
    backgroundColor: '#e0e7ff',
  },
  groupsIconWrap: {
    backgroundColor: '#ecfdf5',
  },
  gamesIconWrap: {
    backgroundColor: '#eff6ff',
  },
  aboutIconWrap: {
    backgroundColor: '#f3f4f6',
  },
  itemText: {
    ...typography.bodyBold,
    color: colors.textPrimary,
  },
  itemTextActive: {
    color: '#1741B8',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.md,
    marginBottom: spacing.xs,
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  sectionHeaderActiveGroups: {
    backgroundColor: '#E3F6EC',
  },
  sectionHeaderActiveGames: {
    backgroundColor: '#FFF1E3',
  },
  sectionHeaderActiveAbout: {
    backgroundColor: '#EEEBFF',
  },
  sectionIconWrap: {
    width: 26,
    height: 26,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  sectionTitle: {
    ...typography.caption,
    fontWeight: '700',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  sectionTitleActiveGroups: {
    color: '#0A5A36',
  },
  sectionTitleActiveGames: {
    color: '#7A3500',
  },
  sectionTitleActiveAbout: {
    color: '#3F3496',
  },
  subItemsContainer: {
    borderLeftWidth: 2,
    marginLeft: spacing.md + 4,
    paddingLeft: spacing.xs,
    marginTop: 2,
    marginBottom: spacing.xs,
  },
  subItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    paddingLeft: spacing.sm,
    paddingRight: spacing.sm,
    borderLeftWidth: 3,
    borderLeftColor: 'transparent',
    borderTopRightRadius: radius.md,
    borderBottomRightRadius: radius.md,
  },
  subItemText: {
    fontSize: 13,
    fontWeight: '400',
    color: '#5B6785',
  },
  subItemTextActiveBold: {
    fontWeight: '700',
    color: colors.textPrimary,
  },
  countBadge: {
    backgroundColor: '#eff6ff',
    borderColor: '#bfdbfe',
    borderWidth: 1,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 1,
  },
  countText: {
    ...typography.caption,
    fontWeight: '700',
    color: dash.brand,
    fontSize: 11,
  },
  wipPill: {
    backgroundColor: '#fef3c7',
    borderColor: '#fde68a',
    borderWidth: 1,
    borderRadius: radius.full,
    paddingHorizontal: spacing.xs + 3,
    paddingVertical: 1,
  },
  wipPillText: {
    ...typography.caption,
    fontWeight: '700',
    color: '#d97706',
    fontSize: 10,
    letterSpacing: 0.5,
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
  },
  footerText: {
    ...typography.caption,
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  pressed: {
    opacity: 0.7,
  },
});
