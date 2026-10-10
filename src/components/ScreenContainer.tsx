/**
 * Screen inset wrapper. Pads only the edges asked for, using the safe-area
 * insets from the root SafeAreaProvider. Android 14 and below report 0, so
 * those screens stay put. No fixed status-bar height.
 */
import React from 'react';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

export type ScreenEdge = 'top' | 'bottom' | 'both';

interface ScreenContainerProps {
  edges: ScreenEdge;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** When false, the container hugs its content (bottom sheets). Default fills the parent. */
  fill?: boolean;
  pointerEvents?: 'box-none' | 'none' | 'box-only' | 'auto';
}

function toEdges(edges: ScreenEdge): Edge[] {
  if (edges === 'both') {
    return ['top', 'bottom'];
  }
  return [edges];
}

export default function ScreenContainer({
  edges,
  children,
  style,
  fill = true,
  pointerEvents,
}: ScreenContainerProps): React.JSX.Element {
  return (
    <SafeAreaView
      pointerEvents={pointerEvents}
      style={[fill ? styles.fill : null, style]}
      edges={toEdges(edges)}
    >
      {children}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
