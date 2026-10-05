/**
 * Profile "Mobile number" card (DES-MEETUP-ADDENDUM-profile-onboarding.md
 * §4.3): view, change, clear. Hidden entirely while the consent text or
 * country list is unavailable (§7). The stored number is the signed-in
 * user's own and is only shown on their own screen; it is never logged or
 * placed in navigation params.
 */
import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useMobileNumberConfig } from '../hooks/useMobileNumberConfig';
import type { MobileNumberConfig } from '../hooks/useMobileNumberConfig';
import { useMobileNumberSave } from '../hooks/useMobileNumberSave';
import { colors, spacing, typography } from '../theme/tokens';
import Button from './Button';
import Card from './Card';
import MobileNumberInput from './MobileNumberInput';
import type { MobileNumberChange } from './MobileNumberInput';
import { useT } from '../labels/LabelsContext';

interface MobileNumberCardProps {
  /** Stored E.164 number, or `null`/absent when none. */
  storedNumber: string | null | undefined;
  /** Called with the new stored value (`null` after a clear) once the server accepted it. */
  onSaved: (mobileNumber: string | null) => void;
}

export default function MobileNumberCard({
  storedNumber,
  onSaved,
}: MobileNumberCardProps): React.JSX.Element | null {
  const config = useMobileNumberConfig();
  if (config.status !== 'ready') {
    return null;
  }
  return <ReadyCard config={config} storedNumber={storedNumber} onSaved={onSaved} />;
}

function ReadyCard({
  config,
  storedNumber,
  onSaved,
}: MobileNumberCardProps & {
  config: Extract<MobileNumberConfig, { status: 'ready' }>;
}): React.JSX.Element {
  const [isEditing, setIsEditing] = useState(false);
  const [change, setChange] = useState<MobileNumberChange>({ e164: null, isEmpty: true });
  const [localError, setLocalError] = useState<string | null>(null);
  const saver = useMobileNumberSave(config);
  const t = useT();

  const startEditing = (): void => {
    setChange({ e164: null, isEmpty: true });
    setLocalError(null);
    saver.resetError();
    setIsEditing(true);
  };

  const handleSave = async (): Promise<void> => {
    if (change.e164 === null) {
      setLocalError(t('mob.mobile_number.invalid'));
      return;
    }
    setLocalError(null);
    if (await saver.save(change.e164)) {
      setIsEditing(false);
      onSaved(change.e164);
    }
  };

  const handleClear = async (): Promise<void> => {
    if (await saver.clear()) {
      setIsEditing(false);
      onSaved(null);
    }
  };

  return (
    <Card style={styles.card}>
      <Text style={styles.title} accessibilityRole="header">
        {t('mob.mobile_number.title')}
      </Text>
      {isEditing ? (
        <View>
          <MobileNumberInput
            countries={config.countries}
            consentText={config.consent.text}
            initialValue={storedNumber}
            error={localError ?? saver.error}
            onChange={next => {
              setChange(next);
              setLocalError(null);
              saver.resetError();
            }}
          />
          <View style={styles.actions}>
            <Button
              label={saver.needsReconfirm ? t('mob.mobile_number.confirm_save') : t('mob.common.save')}
              onPress={handleSave}
              loading={saver.isSaving}
              size="sm"
            />
            <Button
              label={t('mob.common.cancel')}
              variant="secondary"
              size="sm"
              disabled={saver.isSaving}
              onPress={() => {
                setIsEditing(false);
                saver.resetError();
              }}
            />
          </View>
        </View>
      ) : (
        <View>
          <Text style={styles.value}>{storedNumber ? storedNumber : t('mob.mobile_number.none')}</Text>
          {saver.error ? (
            <Text style={styles.error} accessibilityRole="alert">
              {saver.error}
            </Text>
          ) : null}
          <View style={styles.actions}>
            <Button
              label={storedNumber ? t('mob.common.change') : t('mob.mobile_number.add')}
              variant="secondary"
              size="sm"
              onPress={startEditing}
            />
            {storedNumber ? (
              <Button
                label={t('mob.common.remove')}
                variant="destructive"
                size="sm"
                loading={saver.isSaving}
                onPress={handleClear}
              />
            ) : null}
          </View>
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { marginTop: spacing.md },
  title: { ...typography.h3, color: colors.textPrimary, marginBottom: spacing.sm },
  value: { ...typography.body, color: colors.textPrimary },
  error: { ...typography.caption, color: colors.error, marginTop: spacing.xs },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
});
