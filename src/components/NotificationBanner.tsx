/**
 * In-app foreground notification banner (DES-MEETUP-MOBILE.md §3.6, §4.8;
 * R-073). See `notificationBannerStore.ts`'s file header for the recorded
 * deviation from §3.6's `notifee` decision — this is the "simple
 * state-based banner component" the task brief calls for instead.
 *
 * Mounted once, near the root (`RootNavigator`), so it can render above
 * whatever screen is currently active — a foreground push can arrive on
 * any screen, not just the one that happened to trigger it.
 *
 * Never renders/logs anything beyond `title`/`body` already present in
 * the payload (R-111) — no token or auth data flows through this
 * component.
 */
import React, { useEffect, useRef, useSyncExternalStore } from 'react';
import {
  Animated,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  dismissBanner,
  getBannerState,
  subscribeToBanner,
} from '../notifications/notificationBannerStore';
import {
  resolveNotificationTarget,
  navigateToNotificationTarget,
} from '../notifications/notificationRouting';
import { colors, radius, shadows, spacing, typography } from '../theme/tokens';

const AUTO_DISMISS_MS = 4000;
// A swipe of at least this many px (in any horizontal or upward direction)
// counts as a manual dismiss gesture.
const SWIPE_DISMISS_THRESHOLD = 40;

export default function NotificationBanner(): React.JSX.Element | null {
  const banner = useSyncExternalStore(subscribeToBanner, getBannerState);
  const insets = useSafeAreaInsets();
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const pan = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_evt, gesture) =>
        Math.abs(gesture.dx) > 5 || gesture.dy < -5,
      onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], {
        useNativeDriver: false,
      }),
      onPanResponderRelease: (_evt, gesture) => {
        if (
          Math.abs(gesture.dx) > SWIPE_DISMISS_THRESHOLD ||
          gesture.dy < -SWIPE_DISMISS_THRESHOLD
        ) {
          dismissBanner();
        } else {
          Animated.spring(pan, {
            toValue: { x: 0, y: 0 },
            useNativeDriver: false,
          }).start();
        }
      },
    }),
  ).current;

  useEffect(() => {
    if (dismissTimer.current) {
      clearTimeout(dismissTimer.current);
      dismissTimer.current = null;
    }
    // Reset any in-flight swipe offset whenever a new banner arrives (or
    // the previous one is dismissed) so the next banner starts centred.
    pan.setValue({ x: 0, y: 0 });

    if (banner) {
      dismissTimer.current = setTimeout(() => {
        dismissBanner();
      }, AUTO_DISMISS_MS);
    }

    return () => {
      if (dismissTimer.current) {
        clearTimeout(dismissTimer.current);
        dismissTimer.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [banner]);

  if (!banner) {
    return null;
  }

  const handlePress = (): void => {
    const target = resolveNotificationTarget(
      banner.notification_type,
      banner.entity_id,
    );
    dismissBanner();
    navigateToNotificationTarget(target);
  };

  return (
    <Animated.View
      style={[
        styles.container,
        { top: insets.top, transform: pan.getTranslateTransform() },
      ]}
      {...panResponder.panHandlers}
    >
      <Pressable
        style={styles.pressable}
        onPress={handlePress}
        accessibilityRole="button"
      >
        <Text style={styles.title} numberOfLines={1}>
          {banner.title}
        </Text>
        <Text style={styles.body} numberOfLines={2}>
          {banner.body}
        </Text>
      </Pressable>
      <Pressable
        style={styles.dismissButton}
        onPress={dismissBanner}
        accessibilityRole="button"
        accessibilityLabel="Dismiss notification"
        hitSlop={spacing.md}
      >
        <Text style={styles.dismissText}>✕</Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    zIndex: 1000,
    backgroundColor: colors.textPrimary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    ...shadows.overlay,
  },
  pressable: { flex: 1, marginRight: spacing.sm },
  title: { ...typography.bodyBold, color: colors.white, marginBottom: spacing.xs },
  body: { ...typography.caption, color: colors.primaryLight },
  dismissButton: { padding: spacing.xs },
  dismissText: { ...typography.button, color: colors.primaryLight },
});
