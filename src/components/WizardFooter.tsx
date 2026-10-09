import React from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Button from './Button';
import { useT } from '../labels/LabelsContext';
import { borderWidth, colors, spacing } from '../theme/tokens';

export interface WizardFooterProps {
  onNext: () => void;
  onBack?: () => void;
  nextLabel?: string;
  backLabel?: string;
  nextDisabled?: boolean;
  nextLoading?: boolean;
  backDisabled?: boolean;
  showBack?: boolean;
  style?: ViewStyle;
}

export default function WizardFooter({
  onNext,
  onBack,
  nextLabel,
  backLabel,
  nextDisabled = false,
  nextLoading = false,
  backDisabled = false,
  showBack = false,
  style,
}: WizardFooterProps): React.JSX.Element {
  const t = useT();
  const insets = useSafeAreaInsets();

  const resolvedNextLabel = nextLabel ?? t('mob.wizard.next');
  const resolvedBackLabel = backLabel ?? t('mob.wizard.back');

  const hasBackAction = showBack && Boolean(onBack);

  return (
    <View
      style={[
        styles.footer,
        { paddingBottom: Math.max(insets.bottom, spacing.md) },
        style,
      ]}
    >
      <View style={styles.buttonContainer}>
        {hasBackAction ? (
          <Button
            label={resolvedBackLabel}
            variant="secondary"
            onPress={onBack!}
            disabled={backDisabled || nextLoading}
            style={styles.backButton}
          />
        ) : null}

        <Button
          label={resolvedNextLabel}
          variant="primary"
          onPress={onNext}
          disabled={nextDisabled}
          loading={nextLoading}
          style={hasBackAction ? styles.nextButtonWithBack : styles.nextButtonFull}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  footer: {
    backgroundColor: colors.surface,
    borderTopWidth: borderWidth.thin,
    borderTopColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
  },
  buttonContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  backButton: {
    flex: 1,
  },
  nextButtonWithBack: {
    flex: 2,
  },
  nextButtonFull: {
    width: '100%',
  },
});
