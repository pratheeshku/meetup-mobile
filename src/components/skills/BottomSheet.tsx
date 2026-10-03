/**
 * Bottom sheet on RN core `Modal` (same approach as `ShareActionSheet`; no new
 * dependency). Android hardware Back fires `onRequestClose`; tapping the
 * backdrop closes too. The bottom padding adds the iOS home-indicator inset
 * when a `SafeAreaProvider` is present (0 otherwise). No keyboard involved.
 */
import React, { useContext } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';

import { colors, radius, spacing } from '../../theme/tokens';

interface BottomSheetProps {
  onClose: () => void;
  /** Accessibility label of the backdrop's close target. */
  closeLabel: string;
  children: React.ReactNode;
}

export default function BottomSheet({ onClose, closeLabel, children }: BottomSheetProps): React.JSX.Element {
  const insets = useContext(SafeAreaInsetsContext);
  return (
    <Modal transparent visible animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={closeLabel}
          onPress={onClose}
          style={[StyleSheet.absoluteFill, styles.backdrop]}
        />
        <View style={styles.sheet}>
          <ScrollView
            contentContainerStyle={[styles.content, { paddingBottom: spacing.lg + (insets?.bottom ?? 0) }]}
          >
            {children}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { backgroundColor: colors.scrim },
  sheet: {
    maxHeight: '90%',
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
  },
  content: { paddingTop: spacing.lg, paddingHorizontal: spacing.lg },
});
