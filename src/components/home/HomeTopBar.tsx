/**
 * Home Top Bar & Greeting Header (Shuttlr Home v2).
 *
 * Requirements:
 * - Top bar: hamburger, app icon + "Shuttlr", bell with unread dot, profile photo.
 * - Greeting on the left;
 * - The sport selector at top right BELOW the profile photo at reduced size
 *   (existing behaviour kept: multi-select, filters content, defaults to sports
 *   the user has a skill level for).
 * - App icon: shuttlr-icon.png (512x512 transparent PNG) at ~30px.
 */
import React from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SportIcon, AllSportsIcon } from '../icons/DashboardIcons';
import UserAvatar from '../UserAvatar';
import { useT } from '../../labels/LabelsContext';
import { dash, dashRadius } from '../../theme/dashboardTheme';
import { colors, radius, spacing, typography } from '../../theme/tokens';
import type { SportOption } from '../../utils/gameLists';
import { sportTileColor } from './GameRow';

const SHUTTLR_ICON = require('../../assets/shuttlr-icon.png');

interface HomeTopBarProps {
  name: string;
  photoUrl: string | null | undefined;
  unreadCount: number;
  onHamburgerPress: () => void;
  onBellPress: () => void;
  onProfilePress: () => void;
  // Sport filter props (reduced size)
  sportOptions: readonly SportOption[];
  selectedSports: readonly string[];
  onToggleSport: (key: string | null) => void;
  isLoadingSports?: boolean;
}

export default function HomeTopBar({
  name,
  photoUrl,
  unreadCount,
  onHamburgerPress,
  onBellPress,
  onProfilePress,
  sportOptions,
  selectedSports,
  onToggleSport,
  isLoadingSports = false,
}: HomeTopBarProps): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const t = useT();

  const trimmed = name.trim();
  const greetingPrefix = t('mob.home.greeting_prefix');
  const greetingLine = trimmed
    ? t('mob.home.greeting_line', { name: trimmed })
    : t('mob.dashboard.headline');

  const hasUnread = unreadCount > 0;

  return (
    <View style={[styles.root, { paddingTop: insets.top + spacing.xs }]}>
      {/* Row 1: Hamburger, App Icon + Shuttlr, Bell with dot, Profile Avatar */}
      <View style={styles.topRow}>
        {/* Left: Hamburger */}
        <View style={styles.topLeft}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('mob.menu.title')}
            onPress={onHamburgerPress}
            style={({ pressed }) => [styles.hamburgerTouch, pressed ? styles.pressed : null]}
          >
            <View style={styles.hamburgerIcon}>
              <View style={styles.hamburgerBar} />
              <View style={styles.hamburgerBar} />
              <View style={styles.hamburgerBar} />
            </View>
          </Pressable>
        </View>

        {/* Center: Brand (App Icon + Shuttlr) centred between hamburger and bell */}
        <View style={styles.brandCenter}>
          <Image
            testID="home-app-icon"
            source={SHUTTLR_ICON}
            style={styles.brandIcon}
            resizeMode="contain"
          />
          <Text style={styles.brandTitle}>{t('mob.brand.name')}</Text>
        </View>

        {/* Right: Bell & Profile */}
        <View style={styles.topRight}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              hasUnread
                ? t('mob.dashboard.notifications_unread_a11y', { count: unreadCount })
                : t('mob.dashboard.notifications_a11y')
            }
            onPress={onBellPress}
            style={({ pressed }) => [styles.bellTouch, pressed ? styles.pressed : null]}
          >
            <View style={styles.bellGlyph}>
              <View style={styles.bellBody} />
              <View style={styles.bellClapper} />
            </View>
            {hasUnread ? <View style={styles.unreadDot} testID="bell-unread-dot" /> : null}
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('mob.dashboard.profile_a11y')}
            onPress={onProfilePress}
            style={({ pressed }) => [styles.avatarTouch, pressed ? styles.pressed : null]}
          >
            <UserAvatar imageUrl={photoUrl} name={trimmed} size={36} />
          </Pressable>
        </View>
      </View>

      {/* Row 2: Greeting on the left; Sport selector at top right BELOW profile photo */}
      <View style={styles.subRow}>
        <View style={styles.greetingBlock}>
          <Text style={styles.greetingPrefix}>{greetingPrefix}</Text>
          <Text style={styles.greetingLine} numberOfLines={1}>
            {greetingLine}
          </Text>
        </View>

        {/* Sport selector (reduced size) */}
        <View style={styles.sportSelectorContainer}>
          {isLoadingSports ? (
            <View style={styles.sportLoading}>
              <Text style={styles.sportLoadingText}>{t('mob.dashboard.sports_loading')}...</Text>
            </View>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.compactChipsScroll}
            >
              {/* "All" chip */}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('mob.dashboard.sports_all')}
                accessibilityState={{ selected: selectedSports.length === 0 }}
                onPress={() => onToggleSport(null)}
                style={({ pressed }) => [
                  styles.compactChip,
                  selectedSports.length === 0 ? styles.compactChipSelected : styles.compactChipIdle,
                  pressed ? styles.pressed : null,
                ]}
              >
                <AllSportsIcon size={14} />
                <Text
                  style={[
                    styles.compactChipLabel,
                    selectedSports.length === 0 ? styles.compactChipLabelSelected : null,
                  ]}
                >
                  {t('mob.dashboard.sports_all')}
                </Text>
              </Pressable>

              {/* Individual sports */}
              {sportOptions.map(option => {
                const isSelected = selectedSports.includes(option.key);
                return (
                  <Pressable
                    key={option.key}
                    accessibilityRole="button"
                    accessibilityLabel={option.label}
                    accessibilityState={{ selected: isSelected }}
                    onPress={() => onToggleSport(option.key)}
                    style={({ pressed }) => [
                      styles.compactChip,
                      isSelected ? styles.compactChipSelected : styles.compactChipIdle,
                      pressed ? styles.pressed : null,
                    ]}
                  >
                    <View
                      style={[
                        styles.compactSportIconWrap,
                        { backgroundColor: sportTileColor(option.slug) },
                      ]}
                    >
                      <SportIcon slug={option.slug} size={12} />
                    </View>
                    <Text
                      style={[
                        styles.compactChipLabel,
                        isSelected ? styles.compactChipLabelSelected : null,
                      ]}
                      numberOfLines={1}
                    >
                      {option.label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: '#ffffff',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm + 4,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 48,
  },
  topLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  hamburgerTouch: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hamburgerIcon: {
    width: 20,
    height: 14,
    justifyContent: 'space-between',
  },
  hamburgerBar: {
    height: 2,
    backgroundColor: colors.textPrimary,
    borderRadius: 1,
    width: '100%',
  },
  brandCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandIcon: {
    width: 30,
    height: 30,
    marginRight: spacing.xs + 2,
  },
  brandTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: dash.brand,
    letterSpacing: -0.5,
  },
  topRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  bellTouch: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  bellGlyph: {
    alignItems: 'center',
  },
  bellBody: {
    width: 16,
    height: 16,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    borderBottomLeftRadius: 2,
    borderBottomRightRadius: 2,
    backgroundColor: colors.textPrimary,
  },
  bellClapper: {
    width: 6,
    height: 3,
    borderBottomLeftRadius: 3,
    borderBottomRightRadius: 3,
    backgroundColor: colors.textPrimary,
    marginTop: 1,
  },
  unreadDot: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ef4444',
    borderWidth: 1.5,
    borderColor: '#ffffff',
  },
  avatarTouch: {
    borderRadius: dashRadius.circle,
  },
  subRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  greetingBlock: {
    flex: 1,
    paddingRight: spacing.sm,
  },
  greetingPrefix: {
    ...typography.caption,
    color: colors.textSecondary,
    fontSize: 12,
  },
  greetingLine: {
    ...typography.h3,
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
    marginTop: 1,
  },
  sportSelectorContainer: {
    maxWidth: '55%',
    alignItems: 'flex-end',
  },
  compactChipsScroll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  compactChip: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 28,
    paddingHorizontal: 8,
    borderRadius: radius.full,
    borderWidth: 1,
  },
  compactChipIdle: {
    backgroundColor: '#f8fafc',
    borderColor: '#e2e8f0',
  },
  compactChipSelected: {
    backgroundColor: '#eff6ff',
    borderColor: dash.brand,
  },
  compactSportIconWrap: {
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 4,
  },
  compactChipLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    marginLeft: 4,
    fontWeight: '500',
  },
  compactChipLabelSelected: {
    color: dash.brand,
    fontWeight: '700',
  },
  sportLoading: {
    height: 28,
    justifyContent: 'center',
  },
  sportLoadingText: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  pressed: {
    opacity: 0.7,
  },
});
