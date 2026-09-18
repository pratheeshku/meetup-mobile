/**
 * App-wide top bar: "⚽ Meetup" branding on the left, notification bell on
 * the right (matching the live web app's header).
 *
 * Visual layer only — the caller owns navigation (`onNotificationsPress`)
 * and the unread count. There is no notifications-list screen or
 * unread-count API/state in this codebase yet (DES-MEETUP-MOBILE.md §4.8
 * lists only Notification Permission rationale + Notification
 * Preferences), so callers pass no `unreadCount` today and the badge stays
 * hidden; nothing here fabricates a count. The badge renders only for a
 * count > 0 and caps its label at "99+".
 *
 * Rendered as a custom native-stack header, where the status-bar inset is
 * not applied for us (Android edge-to-edge), so the top inset is added here
 * on top of the fixed content height.
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  borderWidth,
  colors,
  opacity,
  radius,
  sizes,
  spacing,
  typography,
} from '../theme/tokens';

interface AppHeaderProps {
  /** Unread notification count; the badge is hidden for 0 / undefined. */
  unreadCount?: number;
  onNotificationsPress: () => void;
}

const MAX_BADGE_COUNT = 99;

export default function AppHeader({
  unreadCount = 0,
  onNotificationsPress,
}: AppHeaderProps): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const hasUnread = unreadCount > 0;
  const badgeLabel = unreadCount > MAX_BADGE_COUNT ? `${MAX_BADGE_COUNT}+` : String(unreadCount);

  return (
    <View style={[styles.container, { paddingTop: insets.top, height: sizes.appHeader + insets.top }]}>
      <View style={styles.brand} accessibilityRole="header">
        <Text style={styles.logo} accessibilityElementsHidden importantForAccessibility="no">
          ⚽
        </Text>
        <Text style={styles.name}>Meetup</Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={hasUnread ? `Notifications, ${unreadCount} unread` : 'Notifications'}
        onPress={onNotificationsPress}
        hitSlop={spacing.sm}
        style={({ pressed }) => [styles.bell, pressed ? styles.pressed : null]}
      >
        <Text style={styles.bellIcon} accessibilityElementsHidden importantForAccessibility="no">
          🔔
        </Text>
        {hasUnread ? (
          <View style={styles.badge} testID="notification-badge">
            <Text style={styles.badgeText}>{badgeLabel}</Text>
          </View>
        ) : null}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: borderWidth.thin,
    borderBottomColor: colors.border,
  },
  brand: { flexDirection: 'row', alignItems: 'center' },
  logo: { ...typography.h2, marginRight: spacing.sm },
  name: { ...typography.h2, color: colors.textPrimary },
  bell: {
    width: sizes.touchTarget,
    height: sizes.touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: opacity.pressed },
  bellIcon: typography.h2,
  badge: {
    position: 'absolute',
    top: spacing.xs,
    right: spacing.xs,
    minWidth: sizes.notificationBadge,
    height: sizes.notificationBadge,
    paddingHorizontal: spacing.xs,
    borderRadius: radius.full,
    backgroundColor: colors.error,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { ...typography.label, color: colors.white, lineHeight: sizes.notificationBadge },
});
