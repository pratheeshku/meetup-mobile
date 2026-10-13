/**
 * Home banner (DES-MEETUP-ADDENDUM-dashboard.md §4, AD-3, AD-12, AD-13):
 * brand-blue, height 208 (plus the status-bar inset), bottom corners radius
 * 32, decorative SVG background (Appendix B).
 *
 * - Left (AD-17 brand block): a white pill with the GameOn SG wordmark and the
 *   tagline from `mob.brand.tagline`, non-interactive.
 * - Right: bell (44px target, red count badge hidden at zero) and the
 *   profile picture (48px circle, 2px white ring) — the uploaded photo,
 *   falling back to the letter avatar when there is none or it fails to load.
 * - Below: plain-text "Good to see you" (no emoji) and "Ready to play,
 *   {name}?".
 *
 * Never logs the name or photo URL (§8).
 */
import React, { useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import appConfig from '../../../config/appConfig.json';
import { BannerBackground } from '../icons/DashboardIcons';
import { dash, dashRadius, dashSize } from '../../theme/dashboardTheme';
import { spacing, typography } from '../../theme/tokens';
import { useT } from '../../labels/LabelsContext';

const WORDMARK = require('../../assets/gameonsg-wordmark.png');

const MAX_BADGE_COUNT = 99;

interface DashboardBannerProps {
  name: string;
  photoUrl: string | null | undefined;
  unreadCount: number;
  onBellPress: () => void;
  onAvatarPress: () => void;
}

export default function DashboardBanner({
  name,
  photoUrl,
  unreadCount,
  onBellPress,
  onAvatarPress,
}: DashboardBannerProps): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const t = useT();
  const [photoFailed, setPhotoFailed] = useState(false);
  // A new photo URL gets a fresh chance to load.
  useEffect(() => {
    setPhotoFailed(false);
  }, [photoUrl]);

  const trimmed = name.trim();
  const headline = trimmed
    ? t('mob.dashboard.headline_named', { name: trimmed })
    : t('mob.dashboard.headline');
  const hasUnread = unreadCount > 0;
  const badgeLabel = unreadCount > MAX_BADGE_COUNT ? `${MAX_BADGE_COUNT}+` : String(unreadCount);
  const showPhoto = Boolean(photoUrl) && !photoFailed;
  const initial = (trimmed.charAt(0) || '?').toUpperCase();

  return (
    <View
      testID="dashboard-banner"
      style={[styles.banner, { minHeight: dashSize.bannerHeight + insets.top, paddingTop: insets.top }]}
    >
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <BannerBackground width="100%" height="100%" />
      </View>

      <View style={styles.topRow}>
        <View
          style={styles.brandPill}
          testID="banner-brand-block"
          accessible
          accessibilityLabel={appConfig.appName}
          pointerEvents="none"
        >
          <Image
            testID="banner-app-icon"
            source={WORDMARK}
            style={styles.brandWordmark}
            resizeMode="contain"
          />
          <Text
            style={styles.brandTagline}
            numberOfLines={1}
            allowFontScaling={false}
          >
            {t('mob.brand.tagline')}
          </Text>
        </View>
        <View style={styles.topRight}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              hasUnread
                ? t('mob.dashboard.notifications_unread_a11y', { count: unreadCount })
                : t('mob.dashboard.notifications_a11y')
            }
            onPress={onBellPress}
            style={({ pressed }) => [styles.bell, pressed ? styles.pressed : null]}
          >
            <BellGlyph />
            {hasUnread ? (
              <View style={styles.badge} testID="notification-badge">
                <Text style={styles.badgeText}>{badgeLabel}</Text>
              </View>
            ) : null}
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('mob.dashboard.profile_a11y')}
            onPress={onAvatarPress}
            style={({ pressed }) => [styles.avatarTouch, pressed ? styles.pressed : null]}
          >
            <View style={styles.avatarRing}>
              {showPhoto ? (
                <Image
                  testID="banner-avatar-photo"
                  source={{ uri: photoUrl as string }}
                  style={styles.avatarImage}
                  onError={() => setPhotoFailed(true)}
                />
              ) : (
                <View style={styles.avatarFallback} testID="banner-avatar-letter">
                  <Text style={styles.avatarLetter}>{initial}</Text>
                </View>
              )}
            </View>
          </Pressable>
        </View>
      </View>

      <View style={styles.textBlock}>
        <Text style={styles.greeting}>{t('mob.dashboard.greeting')}</Text>
        <Text style={styles.headline} accessibilityRole="header" numberOfLines={1}>
          {headline}
        </Text>
      </View>
    </View>
  );
}

/** Simple bell drawn from views (no emoji, no extra icon module entry). */
function BellGlyph(): React.JSX.Element {
  return (
    <View
      style={styles.bellGlyph}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <View style={styles.bellBody} />
      <View style={styles.bellClapper} />
    </View>
  );
}

const AVATAR_OUTER = dashSize.avatar;

const styles = StyleSheet.create({
  banner: {
    backgroundColor: dash.brand,
    borderBottomLeftRadius: dashRadius.bannerBottom,
    borderBottomRightRadius: dashRadius.bannerBottom,
    overflow: 'hidden',
    paddingHorizontal: spacing.md,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.md,
  },
  brandPill: {
    flexShrink: 0,
    alignItems: 'center',
    backgroundColor: dash.white,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  brandWordmark: {
    width: 96,
    height: 36,
  },
  brandTagline: {
    alignSelf: 'center',
    flexShrink: 0,
    marginTop: 2,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1,
    color: dash.text,
    textAlign: 'center',
  },
  topRight: { flexDirection: 'row', alignItems: 'center', flexShrink: 0, gap: spacing.sm },
  pressed: { opacity: 0.8 },
  bell: {
    width: dashSize.touchTarget,
    height: dashSize.touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellGlyph: { alignItems: 'center' },
  bellBody: {
    width: 20,
    height: 20,
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
    borderBottomLeftRadius: 3,
    borderBottomRightRadius: 3,
    backgroundColor: dash.white,
  },
  bellClapper: {
    width: 8,
    height: 4,
    borderBottomLeftRadius: 4,
    borderBottomRightRadius: 4,
    backgroundColor: dash.white,
    marginTop: 1,
  },
  badge: {
    position: 'absolute',
    top: 2,
    right: 0,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: dashRadius.circle,
    backgroundColor: dash.badgeRed,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { ...typography.label, fontSize: 11, color: dash.white, lineHeight: 14 },
  avatarTouch: {
    width: AVATAR_OUTER,
    height: AVATAR_OUTER,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarRing: {
    width: AVATAR_OUTER,
    height: AVATAR_OUTER,
    borderRadius: AVATAR_OUTER / 2,
    borderWidth: dashSize.avatarRing,
    borderColor: dash.white,
    overflow: 'hidden',
    backgroundColor: dash.brandLight,
  },
  avatarImage: { width: '100%', height: '100%' },
  avatarFallback: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  avatarLetter: { ...typography.h3, color: dash.white },
  textBlock: { marginTop: spacing.md },
  greeting: { ...typography.body, color: dash.white, opacity: 0.9 },
  headline: { ...typography.h1, color: dash.white, marginTop: spacing.xs },
});
