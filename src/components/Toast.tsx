/**
 * In-app feedback toast/snackbar (DES-MEETUP-MOBILE-ADDENDUM-shareable-links Decision 5).
 *
 * Provides transient visual confirmation (e.g. "Link copied to clipboard")
 * matching the app's token styling, with automatic fade-out and accessibility support.
 */
import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';

import { colors, radius, shadows, spacing, typography } from '../theme/tokens';

export interface ToastProps {
  message: string | null;
  onDismiss: () => void;
  duration?: number;
}

export default function Toast({
  message,
  onDismiss,
  duration = 2500,
}: ToastProps): React.JSX.Element | null {
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!message) {
      return;
    }

    Animated.timing(opacity, {
      toValue: 1,
      duration: 180,
      useNativeDriver: true,
    }).start();

    const timer = setTimeout(() => {
      Animated.timing(opacity, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }).start(() => {
        onDismiss();
      });
    }, duration);

    return () => {
      clearTimeout(timer);
    };
  }, [message, duration, onDismiss, opacity]);

  if (!message) {
    return null;
  }

  return (
    <Animated.View
      style={[styles.container, { opacity }]}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      pointerEvents="none"
    >
      <View style={styles.content}>
        <Text style={styles.text}>{message}</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: spacing.xxl,
    left: spacing.lg,
    right: spacing.lg,
    alignItems: 'center',
    zIndex: 9999,
  },
  content: {
    backgroundColor: colors.textPrimary,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    ...shadows.card,
  },
  text: {
    ...typography.caption,
    color: colors.white,
    fontWeight: '500',
    textAlign: 'center',
  },
});
