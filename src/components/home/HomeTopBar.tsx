/**
 * Home top bar and greeting.
 *
 * - Top bar: hamburger, wordmark and tagline, bell with unread dot, profile photo.
 * - Greeting on the left.
 * - Sport selector at top right below the profile photo (multi-select, filters
 *   content, defaults to sports the user has a skill level for).
 */
import React from 'react';
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import appConfig from '../../../config/appConfig.json';
import { SportIcon, AllSportsIcon } from '../icons/DashboardIcons';
import { BellGoldIcon } from '../icons/HomeV2Icons';
import UserAvatar from '../UserAvatar';
import { useT } from '../../labels/LabelsContext';
import { dash, dashRadius } from '../../theme/dashboardTheme';
import { colors, spacing, typography } from '../../theme/tokens';
import type { SportOption } from '../../utils/gameLists';

const WORDMARK_ASSET = require('../../assets/gameonsg-wordmark.png');

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
      {/* Row 1: hamburger, wordmark, bell, profile */}
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

        {/* Center: Brand (GameOn SG Wordmark) centred between hamburger and bell */}
        <View style={styles.brandCenter} pointerEvents="none">
          <Image
            testID="home-app-icon"
            accessibilityLabel={appConfig.appName}
            source={WORDMARK_ASSET}
            style={styles.brandWordmark}
            resizeMode="contain"
          />
          <Text
            style={styles.brandTagline}
            numberOfLines={1}
            allowFontScaling={false}
            adjustsFontSizeToFit
            minimumFontScale={0.8}
          >
            {t('mob.brand.tagline')}
          </Text>
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
            <BellGoldIcon size={24} />
            {hasUnread ? <View style={styles.unreadDot} testID="bell-unread-dot" /> : null}
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('mob.dashboard.profile_a11y')}
            onPress={onProfilePress}
            style={({ pressed }) => [styles.avatarTouch, pressed ? styles.pressed : null]}
          >
            <UserAvatar imageUrl={photoUrl} name={trimmed} size={36} perfScreen="HomeScreen" />
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

        {/* Sport selector (icon-only chips) */}
        <View style={styles.sportSelectorContainer}>
          {isLoadingSports ? (
            <View style={styles.sportLoading}>
              <Text style={styles.sportLoadingText}>{t('mob.dashboard.sports_loading')}...</Text>
            </View>
          ) : (
            <View style={styles.chipsContainer}>
              {/* "All" chip */}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('mob.dashboard.sports_all')}
                accessibilityState={{ selected: selectedSports.length === 0 }}
                onPress={() => onToggleSport(null)}
                style={({ pressed }) => [
                  styles.chip,
                  selectedSports.length === 0 ? styles.chipSelected : styles.chipIdle,
                  pressed ? styles.pressed : null,
                ]}
              >
                <AllSportsIcon size={20} />
              </Pressable>

              {/* Individual sports (up to 4) */}
              {sportOptions.slice(0, 4).map(option => {
                const isSelected = selectedSports.includes(option.key);
                return (
                  <Pressable
                    key={option.key}
                    accessibilityRole="button"
                    accessibilityLabel={option.label}
                    accessibilityState={{ selected: isSelected }}
                    onPress={() => onToggleSport(option.key)}
                    style={({ pressed }) => [
                      styles.chip,
                      isSelected ? styles.chipSelected : styles.chipIdle,
                      pressed ? styles.pressed : null,
                    ]}
                  >
                    <SportIcon iconKey={option.icon_key} size={20} />
                  </Pressable>
                );
              })}
            </View>
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
    minHeight: 48,
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
    flexShrink: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xs,
  },
  brandWordmark: {
    height: 40,
    width: 107,
  },
  brandTagline: {
    width: 107,
    marginTop: 2,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.5,
    color: dash.text,
    textAlign: 'center',
  },
  topRight: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
    gap: spacing.sm,
  },
  bellTouch: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  unreadDot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: '#E24B4A',
    borderWidth: 2,
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
    alignItems: 'flex-end',
  },
  chipsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#DCE3F0',
    borderRadius: 18,
    padding: 3,
    gap: 2,
  },
  chip: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipIdle: {
    backgroundColor: 'transparent',
  },
  chipSelected: {
    backgroundColor: '#EEF3FF',
    borderWidth: 2,
    borderColor: '#1D4ED8',
  },
  sportLoading: {
    height: 36,
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
