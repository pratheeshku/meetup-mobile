import React from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { gradientTokens, radius, type GradientTokenKey } from '../theme/tokens';

export interface IconBadgeProps {
  color?: GradientTokenKey;
  size?: number;
  borderRadius?: number;
  style?: ViewStyle;
  children: React.ReactNode;
}

export default function IconBadge({
  color = 'blue',
  size = 48,
  borderRadius = radius.lg,
  style,
  children,
}: IconBadgeProps): React.JSX.Element {
  const gradient = gradientTokens[color] ?? gradientTokens.blue;
  const gradientId = `icon-badge-${color}`;

  return (
    <View style={[styles.container, { width: size, height: size, borderRadius }, style]}>
      <Svg style={StyleSheet.absoluteFill} width={size} height={size}>
        <Defs>
          <LinearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={gradient.start} />
            <Stop offset="1" stopColor={gradient.end} />
          </LinearGradient>
        </Defs>
        <Rect width={size} height={size} rx={borderRadius} fill={`url(#${gradientId})`} />
      </Svg>
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
