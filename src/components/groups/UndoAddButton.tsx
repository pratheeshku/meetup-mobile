/**
 * "−" undo control for a person just added from an invite list (Group detail
 * invite panel, group-create invite step). Outlined destructive circle inside a
 * 44px touch target. The caller supplies the label (labels mechanism) and the
 * in-flight state; there is no confirmation, it is an undo.
 */
import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { groupView } from '../../theme/tokens';

interface UndoAddButtonProps {
  onPress: () => void;
  accessibilityLabel: string;
  busy?: boolean;
  disabled?: boolean;
}

const TARGET = 44;
const CIRCLE = 32;

export default function UndoAddButton({
  onPress,
  accessibilityLabel,
  busy = false,
  disabled = false,
}: UndoAddButtonProps): React.JSX.Element {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || busy}
      style={styles.target}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: disabled || busy, busy }}
      testID="undo-add-button"
    >
      <View style={styles.circle}>
        {busy ? (
          <ActivityIndicator size="small" color={groupView.destructive} />
        ) : (
          <Text style={styles.minus}>−</Text>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  target: { width: TARGET, height: TARGET, alignItems: 'center', justifyContent: 'center' },
  circle: {
    width: CIRCLE,
    height: CIRCLE,
    borderRadius: CIRCLE / 2,
    borderWidth: 1.5,
    borderColor: groupView.destructive,
    alignItems: 'center',
    justifyContent: 'center',
  },
  minus: { fontSize: 22, lineHeight: 26, color: groupView.destructive },
});
