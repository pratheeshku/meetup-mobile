/**
 * Shared user avatar (DES-MEETUP-FEEDBACK-001): the image when `imageUrl` is a
 * usable https URL, otherwise a placeholder showing the first letter of the
 * name. A failed image load falls back to the placeholder too — no error is
 * surfaced and nothing (name, nickname, URL) is logged. Used by the suggestion
 * cards, the Added list and every user-search result list.
 */
import React, { useEffect, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

import { colors, typography } from '../theme/tokens';
import { toHttpsUrl } from '../utils/httpsUrl';

interface UserAvatarProps {
  imageUrl?: string | null;
  name?: string | null;
  size?: number;
  accessibilityLabel?: string;
}

export default function UserAvatar({
  imageUrl,
  name,
  size = 48,
  accessibilityLabel,
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
        onError={() => setFailed(true)}
        accessible={hasA11y}
        accessibilityLabel={accessibilityLabel}
        accessibilityRole={hasA11y ? 'image' : undefined}
        testID="user-avatar-image"
      />
    );
  }
  const initial = ((name ?? '').trim().charAt(0) || '?').toUpperCase();
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
