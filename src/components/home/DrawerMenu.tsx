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
import React from 'react';
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

import appConfig from '../../../config/appConfig.json';
import UserAvatar from '../UserAvatar';
import { GamesIcon, GroupsIcon, HomeIcon } from '../icons/DashboardIcons';
import { useLabels, useT } from '../../labels/LabelsContext';
import { dash, dashRadius } from '../../theme/dashboardTheme';
import { colors, radius, spacing, typography } from '../../theme/tokens';
import type { UserProfile } from '../../types/user';
import { getDisplayName } from '../../utils/displayName';
import { toHttpsUrl } from '../../utils/httpsUrl';

interface DrawerMenuProps {
  visible: boolean;
  onClose: () => void;
  user: UserProfile | null;
  avatarUrl?: string | null;
  groupsCount?: number | null;
  gamesCount?: number | null;
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
  groupsCount,
  gamesCount,
  onNavigateHome,
  onNavigateGroups,
  onNavigateTournamentTeams,
  onNavigateGames,
  onNavigateTournaments,
  onNavigateProfile,
}: DrawerMenuProps): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const t = useT();
  const labels = useLabels();

  const displayName = getDisplayName(user);

  // URLs for About section: check both labels and appConfig
  const aboutUrl = toHttpsUrl(labels['mob.menu.about_url'] || (appConfig as Record<string, unknown>).aboutUrl as string || '');
  const privacyUrl = toHttpsUrl(labels['mob.menu.privacy_url'] || appConfig.privacyPolicyUrl || '');
  const termsUrl = toHttpsUrl(labels['mob.menu.terms_url'] || appConfig.termsOfUseUrl || '');
  const helpUrl = toHttpsUrl(
    labels['mob.menu.help_url'] ||
      ((appConfig as Record<string, unknown>).helpUrl as string) ||
      (appConfig.supportContact?.startsWith('https://') ? appConfig.supportContact : '') ||
      '',
  );

  const openUrl = async (url: string | null) => {
    if (!url) return;
    try {
      await Linking.openURL(url);
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
              <Text style={styles.closeIcon}>✕</Text>
            </Pressable>
          </View>

          <View style={styles.divider} />

          {/* Navigation items */}
          <ScrollView style={styles.scrollArea} contentContainerStyle={styles.scrollContent}>
            {/* Home */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('mob.menu.home')}
              onPress={() => {
                onClose();
                onNavigateHome();
              }}
              style={({ pressed }) => [styles.itemRow, pressed ? styles.pressed : null]}
            >
              <View style={[styles.iconWrap, { backgroundColor: '#e0e7ff' }]}>
                <HomeIcon size={20} />
              </View>
              <Text style={styles.itemText}>{t('mob.menu.home')}</Text>
            </Pressable>

            {/* Groups Section */}
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionIconWrap, { backgroundColor: '#ecfdf5' }]}>
                <GroupsIcon size={18} />
              </View>
              <Text style={styles.sectionTitle}>{t('mob.menu.groups_heading')}</Text>
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('mob.menu.groups')}
              onPress={() => {
                onClose();
                onNavigateGroups();
              }}
              style={({ pressed }) => [styles.subItemRow, pressed ? styles.pressed : null]}
            >
              <Text style={styles.subItemText}>{t('mob.menu.groups')}</Text>
              {groupsCount !== undefined && groupsCount !== null ? (
                <View style={styles.countBadge}>
                  <Text style={styles.countText}>{groupsCount}</Text>
                </View>
              ) : null}
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('mob.menu.tournament_teams')}
              onPress={() => {
                onClose();
                onNavigateTournamentTeams();
              }}
              style={({ pressed }) => [styles.subItemRow, pressed ? styles.pressed : null]}
            >
              <Text style={styles.subItemText}>{t('mob.menu.tournament_teams')}</Text>
              <View style={styles.wipPill}>
                <Text style={styles.wipPillText}>{t('mob.wip.pill')}</Text>
              </View>
            </Pressable>

            {/* Games Section */}
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionIconWrap, { backgroundColor: '#eff6ff' }]}>
                <GamesIcon size={18} />
              </View>
              <Text style={styles.sectionTitle}>{t('mob.menu.games_heading')}</Text>
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('mob.menu.games')}
              onPress={() => {
                onClose();
                onNavigateGames();
              }}
              style={({ pressed }) => [styles.subItemRow, pressed ? styles.pressed : null]}
            >
              <Text style={styles.subItemText}>{t('mob.menu.games')}</Text>
              {gamesCount !== undefined && gamesCount !== null ? (
                <View style={styles.countBadge}>
                  <Text style={styles.countText}>{gamesCount}</Text>
                </View>
              ) : null}
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('mob.menu.tournaments')}
              onPress={() => {
                onClose();
                onNavigateTournaments();
              }}
              style={({ pressed }) => [styles.subItemRow, pressed ? styles.pressed : null]}
            >
              <Text style={styles.subItemText}>{t('mob.menu.tournaments')}</Text>
              <View style={styles.wipPill}>
                <Text style={styles.wipPillText}>{t('mob.wip.pill')}</Text>
              </View>
            </Pressable>

            {/* About Section */}
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionIconWrap, { backgroundColor: '#f3f4f6' }]}>
                <Text style={styles.infoIcon}>ℹ️</Text>
              </View>
              <Text style={styles.sectionTitle}>{t('mob.menu.about_heading')}</Text>
            </View>

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
                <Text style={styles.externalArrow}>↗</Text>
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
                <Text style={styles.externalArrow}>↗</Text>
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
                <Text style={styles.externalArrow}>↗</Text>
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
                <Text style={styles.externalArrow}>↗</Text>
              </Pressable>
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
  closeIcon: {
    fontSize: 18,
    color: colors.textSecondary,
    fontWeight: '600',
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
    paddingHorizontal: spacing.xs,
    borderRadius: radius.md,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm + 2,
  },
  itemText: {
    ...typography.bodyBold,
    color: colors.textPrimary,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.md,
    marginBottom: spacing.xs,
    paddingHorizontal: spacing.xs,
  },
  sectionIconWrap: {
    width: 26,
    height: 26,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  infoIcon: {
    fontSize: 14,
  },
  sectionTitle: {
    ...typography.caption,
    fontWeight: '700',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  subItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    paddingLeft: spacing.lg,
    paddingRight: spacing.xs,
    borderRadius: radius.md,
  },
  subItemText: {
    ...typography.body,
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
  externalArrow: {
    color: colors.textSecondary,
    fontSize: 14,
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
