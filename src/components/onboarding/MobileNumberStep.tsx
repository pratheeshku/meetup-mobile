/**
 * First-run step 3: optional mobile number (shown only when none is stored
 * and the consent text and country list loaded). Uses the same
 * `MobileNumberInput` and save logic as Profile (409 re-confirm, 422 inline
 * error without echoing the value). Save with an empty field just advances.
 * The number is never logged.
 */
import React, { useState } from 'react';
import { StyleSheet } from 'react-native';

import type { MobileNumberConfig } from '../../hooks/useMobileNumberConfig';
import { useMobileNumberSave } from '../../hooks/useMobileNumberSave';
import { spacing } from '../../theme/tokens';
import KeyboardAwareScreen from '../KeyboardAwareScreen';
import MobileNumberInput from '../MobileNumberInput';
import type { MobileNumberChange } from '../MobileNumberInput';
import StepFooter from './StepFooter';
import { useT } from '../../labels/LabelsContext';

type ReadyConfig = Extract<MobileNumberConfig, { status: 'ready' }>;

export default function MobileNumberStep({
  config,
  onDone,
}: {
  config: ReadyConfig;
  onDone: () => void;
}): React.JSX.Element {
  const [change, setChange] = useState<MobileNumberChange>({ e164: null, isEmpty: true });
  const [localError, setLocalError] = useState<string | null>(null);
  const saver = useMobileNumberSave(config);
  const t = useT();

  const handleSave = async (): Promise<void> => {
    if (change.isEmpty) {
      onDone();
      return;
    }
    if (change.e164 === null) {
      setLocalError(t('mob.mobile_number.invalid'));
      return;
    }
    if (await saver.save(change.e164)) {
      onDone();
    }
  };

  return (
    <KeyboardAwareScreen contentContainerStyle={styles.container}>
      <MobileNumberInput
        countries={config.countries}
        consentText={config.consent.text}
        onChange={next => {
          setChange(next);
          setLocalError(null);
          saver.resetError();
        }}
        error={localError}
      />
      <StepFooter
        onSave={handleSave}
        onSkip={onDone}
        saving={saver.isSaving}
        error={saver.error}
        saveLabel={saver.needsReconfirm ? t('mob.mobile_number.confirm_save') : t('mob.common.save')}
      />
    </KeyboardAwareScreen>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.md },
});
