/**
 * The PayNow/PayLah number of a tournament or game (DES-MEETUP-ADDENDUM-teams-payments AD-7): the existing `MobileNumberInput` (country dropdown, default
 * +65 from `GET /public/country-codes`, E.164 out) with the organizer's disclosure line ("Shown to people who register for this tournament").
 *
 * - `initialValue` undefined: prefilled from the caller's OWN profile number (`GET /users/me`), which the caller can already read; the organizer edits it
 *   before saving. The server never fills it. `initialValue` null or a string (editing an event that stores one): used as is.
 * - Reports the prefilled value to the parent once, so the parent has it without a keystroke, then every edit.
 * - Never logs the number or puts it in an error.
 */
import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { getCountryCodes, getOwnMobileNumber } from '../api/mobileNumber';
import type { CountryCode } from '../api/mobileNumber';
import { withCorrelationId } from '../api/correlationId';
import { useT } from '../labels/LabelsContext';
import { colors, spacing, typography } from '../theme/tokens';
import MobileNumberInput from './MobileNumberInput';
import type { MobileNumberChange } from './MobileNumberInput';

export interface PayeeNumberFieldProps {
  /** `undefined`: prefill from the caller's profile. */
  initialValue?: string | null;
  kind: 'tournament' | 'game';
  onChange: (change: MobileNumberChange) => void;
  error?: string | null;
  testID?: string;
}

type Loaded = { status: 'loading' } | { status: 'unavailable' } | { status: 'ready'; countries: CountryCode[]; initial: string | null };

export default function PayeeNumberField({ initialValue, kind, onChange, error, testID }: PayeeNumberFieldProps): React.JSX.Element | null {
  const t = useT();
  const [loaded, setLoaded] = useState<Loaded>({ status: 'loading' });
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    let active = true;
    withCorrelationId(async correlationId => {
      try {
        const [countries, initial] = await Promise.all([
          getCountryCodes({ correlationId }),
          initialValue !== undefined
            ? Promise.resolve(initialValue)
            : getOwnMobileNumber({ correlationId }).catch(() => null),
        ]);
        if (!active) {
          return;
        }
        if (countries.length === 0) {
          setLoaded({ status: 'unavailable' });
          return;
        }
        setLoaded({ status: 'ready', countries, initial });
        onChangeRef.current({ e164: initial, isEmpty: !initial });
      } catch {
        if (active) {
          setLoaded({ status: 'unavailable' });
        }
      }
    });
    return () => {
      active = false;
    };
    // The first value seeds the field; later edits are the organizer's own.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loaded.status === 'loading') {
    return null;
  }
  return (
    <View style={styles.root} testID={testID ?? 'payee-number-field'}>
      <Text style={styles.label}>{t('mob.pay.number_label')}</Text>
      {loaded.status === 'ready' ? (
        <MobileNumberInput
          countries={loaded.countries}
          consentText={t(kind === 'tournament' ? 'mob.pay.number_disclosure_tournament' : 'mob.pay.number_disclosure_game')}
          initialValue={loaded.initial}
          onChange={change => onChangeRef.current(change)}
          error={error}
        />
      ) : (
        <Text style={styles.problem} accessibilityRole="alert">
          {t('mob.pay.number_load_error')}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { marginTop: spacing.sm },
  label: { ...typography.bodyBold, color: colors.textPrimary, marginBottom: spacing.xs },
  problem: { ...typography.caption, color: colors.error },
});
