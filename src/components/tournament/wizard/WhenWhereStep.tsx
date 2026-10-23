/**
 * Step 4, boards TournSched / TournSchedErr: start and end (also the daily playing window, AD-20), venue.
 * Not built: courts, match length and the fit check (no field in `WizardCreateBody`; see the report).
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useT } from '../../../labels/LabelsContext';
import { colors, spacing, typography } from '../../../theme/tokens';
import type { Sport } from '../../../types/sport';
import DateTimePickerField from '../../DateTimePickerField';
import TextField from '../../TextField';
import VenuePicker from '../../venue/VenuePicker';
import { Banner, FieldError, FieldLabel, SectionCard, StepHeading } from './parts';
import { toDate, type WizardState, type WizardVenue } from '../../../utils/tournamentWizard';

function timeOf(value: string): string {
  const date = toDate(value);
  return date ? date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : '';
}

export default function WhenWhereStep({
  state,
  sport,
  catalogueEnabled,
  mapsApiKey,
  onChange,
  errors,
  windowError,
}: {
  state: WizardState;
  sport: Sport | undefined;
  catalogueEnabled: boolean;
  mapsApiKey: string | null;
  onChange: (patch: Partial<WizardState>) => void;
  errors: Record<string, string>;
  windowError: string | null;
}): React.JSX.Element {
  const t = useT();
  const start = timeOf(state.startsAt);
  const end = timeOf(state.endsAt);
  const selectedVenue = state.venue
    ? {
        venueId: state.venue.venueId,
        name: state.venue.name,
        address: state.venue.address,
        lat: null,
        lng: null,
        source: '',
        isOthers: Boolean(state.venue.othersInput),
        othersInput: state.venue.othersInput,
      }
    : null;
  return (
    <View>
      <StepHeading>{t('mob.tw.step_when')}</StepHeading>
      <SectionCard title={t('mob.tw.window_section')}>
        <View style={styles.pair}>
          <View style={styles.half}>
            <FieldLabel>{t('mob.tw.starts')}</FieldLabel>
            <DateTimePickerField
              mode="datetime"
              value={state.startsAt}
              onChange={startsAt => onChange({ startsAt })}
              placeholder={t('mob.tw.pick_date')}
              accessibilityLabel={t('mob.tw.starts')}
              testID="tw-starts"
            />
            <FieldError message={errors.starts_at} testID="tw-starts-error" />
          </View>
          <View style={styles.half}>
            <FieldLabel>{t('mob.tw.ends')}</FieldLabel>
            <DateTimePickerField
              mode="datetime"
              value={state.endsAt}
              onChange={endsAt => onChange({ endsAt })}
              placeholder={t('mob.tw.pick_date')}
              accessibilityLabel={t('mob.tw.ends')}
              testID="tw-ends"
            />
            <FieldError message={errors.ends_at} testID="tw-ends-error" />
          </View>
        </View>
        <FieldLabel>{t('mob.tw.daily_hours')}</FieldLabel>
        <Text style={styles.readonly} testID="tw-daily-hours">
          {start && end ? t('mob.tw.daily_hours_value', { start, end }) : t('mob.tw.daily_hours_empty')}
        </Text>
        <FieldLabel>{t('mob.tw.venue')}</FieldLabel>
        {catalogueEnabled ? (
          <VenuePicker
            sportId={sport?.id ?? ''}
            sportDisplayName={sport?.display_name ?? state.sport}
            selectedVenue={selectedVenue}
            variant="tournament"
            mapsApiKey={mapsApiKey}
            onSelectVenue={venue => {
              const address = [venue.block, venue.street].filter(Boolean).join(' ') || venue.street || '';
              onChange({ venue: { venueId: venue.id, name: venue.name, address } as WizardVenue });
            }}
            onSaveOthersVenue={others =>
              onChange({
                venue: {
                  venueId: null,
                  othersInput: others.othersInput,
                  name: others.othersInput.name,
                  address: others.address ?? '',
                },
              })
            }
            onClearVenue={() => onChange({ venue: null })}
          />
        ) : (
          <>
            <TextField
              value={state.venueName}
              onChangeText={venueName => onChange({ venueName })}
              placeholder={t('mob.tw.venue_name')}
              accessibilityLabel={t('mob.tw.venue_name')}
              testID="tw-venue-name"
            />
            <TextField
              value={state.venueAddress}
              onChangeText={venueAddress => onChange({ venueAddress })}
              placeholder={t('mob.tw.venue_address')}
              accessibilityLabel={t('mob.tw.venue_address')}
              style={styles.addressField}
              testID="tw-venue-address"
            />
          </>
        )}
        <FieldError message={errors.venue} testID="tw-venue-error" />
      </SectionCard>
      {windowError ? <Banner tone="error" message={windowError} testID="tw-window-error" /> : null}
      <Text style={styles.footer}>{t('mob.tw.when_footer')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pair: { flexDirection: 'row', gap: spacing.sm },
  half: { flex: 1 },
  readonly: { ...typography.body, color: colors.textPrimary, paddingVertical: spacing.sm },
  addressField: { marginTop: spacing.sm },
  footer: { ...typography.caption, color: colors.textSecondary, marginTop: spacing.md, textAlign: 'center' },
});
