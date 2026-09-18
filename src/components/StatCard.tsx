/**
 * Dashboard stat tile (icon, title, one-line detail) built on `Card`, used
 * for the Home "My Games" / "My Groups" tiles. Pressable only when
 * `onPress` is supplied — a tile with no action renders as a plain,
 * non-interactive `Card` (no button role) so it never announces itself as
 * tappable when it isn't.
 */
import React from 'react';
import { StyleSheet, Text } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';

import { colors, spacing, typography } from '../theme/tokens';
import Card from './Card';

interface StatCardProps {
  /** Emoji shown above the title (decorative — the title carries meaning). */
  icon: string;
  title: string;
  subtitle: string;
  onPress?: () => void;
  /** Layout only (flex, margins). */
  style?: StyleProp<ViewStyle>;
}

export default function StatCard({
  icon,
  title,
  subtitle,
  onPress,
  style,
}: StatCardProps): React.JSX.Element {
  return (
    <Card
      onPress={onPress}
      style={style}
      accessibilityLabel={onPress ? `${title}, ${subtitle}` : undefined}
    >
      <Text style={styles.icon} accessibilityElementsHidden importantForAccessibility="no">
        {icon}
      </Text>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  icon: { ...typography.h1 },
  title: { ...typography.h3, color: colors.textPrimary, marginTop: spacing.sm },
  subtitle: { ...typography.caption, color: colors.textMuted, marginTop: spacing.xs },
});
