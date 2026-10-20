/**
 * Shared user avatar (DES-MEETUP-FEEDBACK-001): the image when `imageUrl` is a
 * usable https URL, otherwise a placeholder showing the first letter of the
 * name. A failed image load falls back to the placeholder too — no error is
 * surfaced and nothing (name, nickname, URL) is logged. Used by the suggestion
 * cards, the Added list and every user-search result list.
 */
import React, { useEffect, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

import { perfImageError, perfImageLoad, perfImageLoadStart } from '../diagnostics/perfLog';
import { colors, groupView, typography } from '../theme/tokens';
import { PersonIcon } from './icons/GroupViewIcons';
import { toHttpsUrl } from '../utils/httpsUrl';

interface UserAvatarProps {
  imageUrl?: string | null;
  name?: string | null;
  size?: number;
  accessibilityLabel?: string;
  /** When set, image load timing is recorded for this screen. Diagnostics only. */
  perfScreen?: string;
  perfType?: string;
  /**
   * Fallback style when there is no usable picture: `letter` (default) is one letter on the
   * brand colour; `initials` is up to two initials on a coloured circle picked from the name.
   */
  fallback?: 'letter' | 'initials' | 'person';
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function paletteColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash += name.charCodeAt(i);
  return groupView.avatarPalette[Math.abs(hash) % groupView.avatarPalette.length];
}

export default function UserAvatar({
  imageUrl,
  name,
  size = 48,
  accessibilityLabel,
  perfScreen,
  perfType = 'avatar',
  fallback = 'letter',
}: UserAvatarProps): React.JSX.Element {
  const [failed, setFailed] = useState(false);
  const url = toHttpsUrl(imageUrl);

  useEffect(() => {
    setFailed(false);
  }, [url]);

  const dimension = { width: size, height: size, borderRadius: size / 2 };
  const hasA11y = Boolean(accessibilityLabel);

  if (url !== null && !failed) {
    return (
      <Image
        source={{ uri: url }}
        style={dimension}
        onLoadStart={
          perfScreen ? () => perfImageLoadStart(perfScreen, url, perfType) : undefined
        }
        onLoad={
          perfScreen
            ? event =>
                perfImageLoad(
                  perfScreen,
                  url,
                  perfType,
                  event.nativeEvent.source.width,
                  event.nativeEvent.source.height,
                )
            : undefined
        }
        onError={() => {
          setFailed(true);
          if (perfScreen) {
            perfImageError(perfScreen, url, perfType);
          }
        }}
        accessible={hasA11y}
        accessibilityLabel={accessibilityLabel}
        accessibilityRole={hasA11y ? 'image' : undefined}
        testID="user-avatar-image"
      />
    );
  }
  const initial = ((name ?? '').trim().charAt(0) || '?').toUpperCase();
  if (fallback === 'person') {
    // A person with no linked account (tournament registration without a user id).
    return (
      <View
        style={[styles.placeholder, dimension, { backgroundColor: colors.border }]}
        accessible={hasA11y}
        accessibilityLabel={accessibilityLabel}
        accessibilityRole={hasA11y ? 'image' : undefined}
        testID="user-avatar-placeholder"
      >
        <PersonIcon size={Math.round(size * 0.55)} color={colors.textMuted} />
      </View>
    );
  }
  if (fallback === 'initials') {
    return (
      <View
        style={[styles.placeholder, dimension, { backgroundColor: paletteColor(name ?? '') }]}
        accessible={hasA11y}
        accessibilityLabel={accessibilityLabel}
        accessibilityRole={hasA11y ? 'image' : undefined}
        testID="user-avatar-placeholder"
      >
        <Text style={[styles.initial, { fontSize: Math.round(size * 0.38), lineHeight: Math.round(size * 0.5) }]}>
          {getInitials(name ?? '')}
        </Text>
      </View>
    );
  }
  return (
    <View
      style={[styles.placeholder, dimension]}
      accessible={hasA11y}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole={hasA11y ? 'image' : undefined}
      testID="user-avatar-placeholder"
    >
      <Text
        style={[
          styles.initial,
          size < 32 ? { fontSize: Math.max(9, Math.round(size * 0.45)), lineHeight: Math.round(size * 0.55) } : null,
        ]}
      >
        {initial}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  placeholder: { backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  initial: { ...typography.bodyBold, color: colors.white },
});
