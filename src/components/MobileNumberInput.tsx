/**
 * Reusable mobile number field (DES-MEETUP-ADDENDUM-profile-onboarding.md
 * AD-9, §4.3): a country dropdown showing the ISO code and dial code ("SG
 * +65", no emoji flags) next to the national-number input, plus the consent
 * text supplied by the caller (never hardcoded here).
 *
 * - The country list comes from the caller (loaded ONLY from
 *   `GET /public/country-codes`); the default is its first row.
 * - Editing a stored number preselects the country from its dial code
 *   (`splitE164`), falling back as documented there.
 * - Emits `onChange(e164 | null, { isEmpty })` on every edit: `e164` is built
 *   with libphonenumber-js, `null` when empty or not possible. The server
 *   validates; this is UX only.
 * - Never logs the number or echoes it in an error message.
 */
import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { CountryCode } from '../api/mobileNumber';
import { colors, spacing, typography } from '../theme/tokens';
import { buildE164, countryLabel, nationalDigits, splitE164 } from '../utils/phoneNumber';
import DropdownField from './DropdownField';
import TextField from './TextField';

export interface MobileNumberChange {
  e164: string | null;
  /** The national-number field is empty. */
  isEmpty: boolean;
}

interface MobileNumberInputProps {
  countries: readonly CountryCode[];
  /** Consent text from `GET /public/consent/mobile-number`. */
  consentText: string;
  /** Stored E.164 number to edit, or `null`/absent for a new entry. */
  initialValue?: string | null;
  onChange: (change: MobileNumberChange) => void;
  /** Inline error (e.g. after a 422); must not contain the number. */
  error?: string | null;
}

export default function MobileNumberInput({
  countries,
  consentText,
  initialValue,
  onChange,
  error,
}: MobileNumberInputProps): React.JSX.Element {
  const initial = useMemo(() => {
    const split = initialValue ? splitE164(initialValue, countries) : null;
    return {
      country: split?.country ?? countries[0],
      national: split?.national ?? '',
    };
    // Only the first value seeds the field; later edits are the user's own.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [country, setCountry] = useState<CountryCode>(initial.country);
  const [national, setNational] = useState(initial.national);

  const options = useMemo(
    () => countries.map(row => ({ value: row.iso2, label: countryLabel(row) })),
    [countries],
  );

  const emit = (nextCountry: CountryCode, nextNational: string): void => {
    onChange({
      e164: buildE164(nextCountry, nextNational),
      isEmpty: nationalDigits(nextNational).length === 0,
    });
  };

  return (
    <View>
      <View style={styles.row}>
        <DropdownField
          style={styles.country}
          options={options}
          value={country.iso2}
          placeholder="Code"
          accessibilityLabel="Country code"
          onChange={iso2 => {
            const next = countries.find(row => row.iso2 === iso2) ?? country;
            setCountry(next);
            emit(next, national);
          }}
        />
        <TextField
          style={styles.number}
          value={national}
          onChangeText={text => {
            setNational(text);
            emit(country, text);
          }}
          placeholder="Mobile number"
          accessibilityLabel="Mobile number"
          keyboardType="phone-pad"
          autoComplete="tel-national"
          textContentType="telephoneNumber"
          importantForAutofill="no"
          maxLength={20}
        />
      </View>
      {error ? (
        <Text style={styles.error} accessibilityRole="alert">
          {error}
        </Text>
      ) : null}
      <Text style={styles.consent}>{consentText}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.sm },
  country: { width: 120 },
  number: { flex: 1 },
  error: { ...typography.caption, color: colors.error, marginTop: spacing.xs },
  consent: { ...typography.caption, color: colors.textMuted, marginTop: spacing.sm },
});
