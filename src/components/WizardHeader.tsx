import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackArrowIcon } from './icons/ActionIcons';
import { CloseIcon } from './icons/SharedIcons';
import { useT } from '../labels/LabelsContext';
import { colors, spacing, typography } from '../theme/tokens';

export interface WizardHeaderProps {
  title: string;
  currentStep: number;
  totalSteps: number;
  onBack?: () => void;
  onClose?: () => void;
  stepLabel?: string;
}

export default function WizardHeader({
  title,
  currentStep,
  totalSteps,
  onBack,
  onClose,
  stepLabel,
}: WizardHeaderProps): React.JSX.Element {
  const t = useT();
  const insets = useSafeAreaInsets();

  const formattedStep =
    stepLabel ?? t('mob.wizard.step', { current: currentStep, total: totalSteps });

  return (
    <View style={[styles.container, { paddingTop: Math.max(insets.top, spacing.sm) }]}>
      <View style={styles.topRow}>
        <View style={styles.leftAction}>
          {onClose ? (
            <Pressable
              onPress={onClose}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={t('mob.common.close')}
              style={styles.iconButton}
            >
              <CloseIcon size={20} />
            </Pressable>
          ) : onBack ? (
            <Pressable
              onPress={onBack}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={t('mob.common.back')}
              style={styles.iconButton}
            >
              <BackArrowIcon size={20} color={colors.white} />
            </Pressable>
          ) : (
            <View style={styles.iconSpacer} />
          )}
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
        </View>

        <Text style={styles.stepText}>{formattedStep}</Text>
      </View>

      <View style={styles.progressBar}>
        {Array.from({ length: totalSteps }).map((_, index) => {
          const isActive = index < currentStep;
          return (
            <View
              key={`step-${index}`}
              style={[
                styles.progressSegment,
                isActive ? styles.segmentActive : styles.segmentInactive,
              ]}
            />
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
  },
  leftAction: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: spacing.sm,
  },
  iconButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  iconSpacer: {
    width: 8,
  },
  title: {
    ...typography.h3,
    color: colors.white,
    fontWeight: '700',
  },
  stepText: {
    ...typography.caption,
    color: colors.white,
    opacity: 0.9,
    fontWeight: '500',
  },
  progressBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: spacing.xs,
  },
  progressSegment: {
    flex: 1,
    height: 3,
    borderRadius: 2,
  },
  segmentActive: {
    backgroundColor: colors.white,
  },
  segmentInactive: {
    backgroundColor: colors.overlayWhite25,
  },
});
