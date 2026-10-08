import React from 'react';
import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { CheckIcon } from './icons/ActionIcons';
import { borderWidth, colors, opacity, radius, spacing, typography } from '../theme/tokens';

export interface SelectableCardProps {
  title: string;
  subtitle?: string;
  leading?: React.ReactNode;
  selected: boolean;
  onPress: () => void;
  disabled?: boolean;
  style?: ViewStyle;
  testID?: string;
  accessibilityLabel?: string;
}

export default function SelectableCard({
  title,
  subtitle,
  leading,
  selected,
  onPress,
  disabled = false,
  style,
  testID,
  accessibilityLabel,
}: SelectableCardProps): React.JSX.Element {
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="radio"
      accessibilityState={{ selected, disabled }}
      accessibilityLabel={accessibilityLabel ?? title}
      style={({ pressed }) => [
        styles.card,
        selected ? styles.cardSelected : styles.cardUnselected,
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
        style,
      ]}
    >
      {leading ? <View style={styles.leadingContainer}>{leading}</View> : null}

      <View style={styles.contentContainer}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>

      <View style={[styles.checkCircle, selected && styles.checkCircleSelected]}>
        {selected ? <CheckIcon size={14} color={colors.white} /> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginVertical: spacing.xs,
  },
  cardSelected: {
    borderWidth: borderWidth.thick,
    borderColor: colors.primary,
  },
  cardUnselected: {
    borderWidth: borderWidth.thin,
    borderColor: colors.border,
  },
  leadingContainer: {
    marginRight: spacing.md,
  },
  contentContainer: {
    flex: 1,
    marginRight: spacing.sm,
  },
  title: {
    ...typography.bodyBold,
    color: colors.textPrimary,
    marginBottom: 2,
  },
  subtitle: {
    ...typography.caption,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  checkCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkCircleSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  disabled: {
    opacity: opacity.disabled,
  },
  pressed: {
    opacity: opacity.pressed,
  },
});
