/**
 * Edit tournament (DES-MEETUP-ADDENDUM-tournament-edit-recurring AD-3, AD-6; ruling A38: the addendum is the board of record, built from the
 * create wizard's components). The organizer of a lifecycle version 2 tournament edits title, description, dates, venue and the per-edit
 * withdrawal choice until the tournament starts; only changed fields are sent, dates as ISO UTC from local-time pickers. The fee keeps its own
 * sheet and client. The future-date check is UX only: the server decides and its codes show their own labels. A change after fixtures exist
 * resets them (confirmed first; `fixtures_reset` in the answer is shown).
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, StyleSheet, Switch, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { getClientConfig } from '../api/config';
import { withCorrelationId } from '../api/correlationId';
import { getTournament, updateTournament } from '../api/tournaments';
import Button from '../components/Button';
import DateTimePickerField from '../components/DateTimePickerField';
import ErrorView from '../components/ErrorView';
import KeyboardAwareScreen from '../components/KeyboardAwareScreen';
import LoadingView from '../components/LoadingView';
import TextField from '../components/TextField';
import { formatDayTime } from '../components/tournament/wizard/RegistrationStep';
import { Banner, FieldError, FieldLabel, SectionCard } from '../components/tournament/wizard/parts';
import VenuePicker from '../components/venue/VenuePicker';
import { useT } from '../labels/LabelsContext';
import type { TournamentsStackParamList } from '../navigation/types';
import { getSports } from '../api/sports';
import { colors, spacing, typography } from '../theme/tokens';
import type { Sport } from '../types/sport';
import type { Tournament } from '../types/tournament';
import {
  editErrorLabel,
  editResetsFixtures,
  initialEditForm,
  planEdit,
  type TournamentEditForm,
} from '../utils/tournamentEdit';
import { toDate, type WizardVenue } from '../utils/tournamentWizard';

type Props = NativeStackScreenProps<TournamentsStackParamList, 'TournamentEdit'>;

export default function TournamentEditScreen({ navigation, route }: Props): React.JSX.Element {
  const t = useT();
  const { tournamentId } = route.params;
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [form, setForm] = useState<TournamentEditForm | null>(null);
  const [catalogueEnabled, setCatalogueEnabled] = useState(false);
  const [mapsApiKey, setMapsApiKey] = useState<string | null>(null);
  const [sports, setSports] = useState<Sport[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Fixed for the life of the screen, like the wizard: the future-date hint compares against it.
  const [now] = useState(() => new Date());

  const load = useCallback(() => {
    setLoadFailed(false);
    withCorrelationId(correlationId => getTournament(tournamentId, { correlationId }))
      .then(loaded => {
        setTournament(loaded);
        setForm(initialEditForm(loaded));
      })
      .catch(() => setLoadFailed(true));
  }, [tournamentId]);

  useEffect(() => {
    load();
    getClientConfig()
      .then(config => {
        setMapsApiKey(config.google_maps_api_key);
        setCatalogueEnabled(Boolean(config.venue_catalogue_enabled));
      })
      .catch(() => {});
    getSports()
      .then(setSports)
      .catch(() => {});
  }, [load]);

  const plan = useMemo(
    () => (tournament && form ? planEdit(tournament, form, { catalogueEnabled, now }) : null),
    [tournament, form, catalogueEnabled, now],
  );

  if (loadFailed) {
    return <ErrorView message={t('mob.tournament.not_found')} onRetry={load} />;
  }
  if (!tournament || !form || !plan) {
    return <LoadingView />;
  }

  const patch = (change: Partial<TournamentEditForm>): void => {
    setError(null);
    setForm(current => (current ? { ...current, ...change } : current));
  };
  const sport = sports.find(item => item.name === tournament.sport);
  const selectedVenue = form.venue
    ? {
        venueId: form.venue.venueId,
        name: form.venue.name,
        address: form.venue.address,
        lat: form.venue.lat ?? null,
        lng: form.venue.lng ?? null,
        source: '',
        isOthers: Boolean(form.venue.othersInput),
        othersInput: form.venue.othersInput,
      }
    : null;
  const pastDateMessage = plan.pastDate ? t('web.tournament_edit.dates_future') : null;
  const hasHardBlock = tournament.lifecycle_version === 2;

  const send = async (): Promise<void> => {
    setSaving(true);
    setError(null);
    try {
      const result = await withCorrelationId(correlationId => updateTournament(tournament.id, plan.body, { correlationId }));
      Alert.alert(
        '',
        t(result.fixturesReset ? 'web.tournament_edit.reset_done' : 'web.edit_tournament.tournament_updated_successfully'),
        [{ text: t('mob.common.done'), onPress: () => navigation.goBack() }],
        { onDismiss: () => navigation.goBack() },
      );
    } catch (e) {
      const start = toDate(form.startsAt);
      const label = editErrorLabel(e, start ? formatDayTime(start) : '');
      setError(t(label.key, label.params));
    } finally {
      setSaving(false);
    }
  };

  const save = (): void => {
    if (!plan.hasChanges || saving) {
      return;
    }
    if (plan.pastDate) {
      setError(t('web.tournament_edit.dates_future'));
      return;
    }
    if (editResetsFixtures(tournament, plan)) {
      Alert.alert(t('web.tournament.edit_tournament'), t('web.tournament_edit.reset_confirm'), [
        { text: t('mob.common.cancel'), style: 'cancel' },
        { text: t('mob.common.save'), onPress: send },
      ]);
      return;
    }
    send();
  };

  return (
    <KeyboardAwareScreen contentContainerStyle={styles.container} testID="tournament-edit">
      <SectionCard>
        <FieldLabel>{t('mob.tw.name')}</FieldLabel>
        <TextField
          value={form.title}
          onChangeText={title => patch({ title })}
          maxLength={150}
          accessibilityLabel={t('mob.tw.name')}
          editable={!saving}
          testID="edit-title"
        />
        <FieldLabel>{t('mob.tw.description')}</FieldLabel>
        <TextField
          value={form.description}
          onChangeText={description => patch({ description })}
          multiline
          textAlignVertical="top"
          accessibilityLabel={t('mob.tw.description')}
          style={styles.multiline}
          editable={!saving}
          testID="edit-description"
        />
      </SectionCard>

      <SectionCard title={t('mob.tw.window_section')}>
        <View style={styles.pair}>
          <View style={styles.half}>
            <FieldLabel>{t('mob.tw.starts')}</FieldLabel>
            <DateTimePickerField
              mode="datetime"
              value={form.startsAt}
              onChange={startsAt => patch({ startsAt })}
              placeholder={t('mob.tw.pick_date')}
              accessibilityLabel={t('mob.tw.starts')}
              disabled={saving}
              testID="edit-starts"
            />
          </View>
          <View style={styles.half}>
            <FieldLabel>{t('mob.tw.ends')}</FieldLabel>
            <DateTimePickerField
              mode="datetime"
              value={form.endsAt}
              onChange={endsAt => patch({ endsAt })}
              placeholder={t('mob.tw.pick_date')}
              accessibilityLabel={t('mob.tw.ends')}
              disabled={saving}
              testID="edit-ends"
            />
          </View>
        </View>

        <FieldLabel>{t('web.edit_tournament.registration_closes_at')}</FieldLabel>
        <DateTimePickerField
          mode="datetime"
          value={form.closesAt}
          onChange={closesAt => patch({ closesAt })}
          placeholder={t('mob.tw.pick_date')}
          accessibilityLabel={t('web.edit_tournament.registration_closes_at')}
          disabled={saving}
          testID="edit-closes"
        />

        {hasHardBlock ? (
          <>
            <FieldLabel>{t('web.tournament_edit.hard_block')}</FieldLabel>
            <DateTimePickerField
              mode="datetime"
              value={form.hardBlockAt}
              onChange={hardBlockAt => patch({ hardBlockAt })}
              placeholder={t('mob.tw.pick_date')}
              accessibilityLabel={t('web.tournament_edit.hard_block')}
              disabled={saving}
              testID="edit-hard-block"
            />
            <Text style={styles.hint}>{t('web.tournament_edit.hard_block_hint')}</Text>
          </>
        ) : null}
        <FieldError message={pastDateMessage} testID="edit-past-date" />
      </SectionCard>

      <SectionCard title={t('mob.create_game.venue_label')}>
        {catalogueEnabled ? (
          <VenuePicker
            sportId={sport?.id ?? ''}
            sportDisplayName={sport?.display_name ?? tournament.sport}
            selectedVenue={selectedVenue}
            mapsApiKey={mapsApiKey}
            autoFocusSearch={false}
            onSelectVenue={venue => {
              const address = [venue.block, venue.street].filter(Boolean).join(' ') || venue.street || '';
              patch({
                venueTouched: true,
                venue: { venueId: venue.id, name: venue.name, address, lat: venue.lat ?? null, lng: venue.lng ?? null } as WizardVenue,
              });
            }}
            onSaveOthersVenue={others =>
              patch({
                venueTouched: true,
                venue: {
                  venueId: null,
                  othersInput: others.othersInput,
                  name: others.othersInput.name,
                  address: others.address ?? '',
                  lat: others.lat ?? null,
                  lng: others.lng ?? null,
                },
              })
            }
            onClearVenue={() => patch({ venueTouched: true, venue: null })}
          />
        ) : (
          <>
            <TextField
              value={form.venueName}
              onChangeText={venueName => patch({ venueName, venueTouched: true })}
              placeholder={t('mob.tw.venue_name')}
              accessibilityLabel={t('mob.tw.venue_name')}
              editable={!saving}
              testID="edit-venue-name"
            />
            <TextField
              value={form.venueAddress}
              onChangeText={venueAddress => patch({ venueAddress, venueTouched: true })}
              placeholder={t('mob.tw.venue_address')}
              accessibilityLabel={t('mob.tw.venue_address')}
              style={styles.addressField}
              editable={!saving}
              testID="edit-venue-address"
            />
          </>
        )}
      </SectionCard>

      <SectionCard>
        <View style={styles.switchRow}>
          <View style={styles.switchText}>
            <Text style={styles.switchLabel}>{t('web.tournament_edit.may_withdraw')}</Text>
            <Text style={styles.hint}>{t('web.tournament_edit.may_withdraw_hint')}</Text>
          </View>
          <Switch
            value={form.mayWithdraw}
            onValueChange={mayWithdraw => patch({ mayWithdraw })}
            disabled={saving}
            trackColor={{ false: colors.border, true: colors.primaryLight }}
            thumbColor={form.mayWithdraw ? colors.primary : colors.textMuted}
            accessibilityLabel={t('web.tournament_edit.may_withdraw')}
            testID="edit-may-withdraw"
          />
        </View>
      </SectionCard>

      {error ? <Banner tone="error" message={error} testID="edit-error" /> : null}
      <Button
        label={t('mob.common.save')}
        onPress={save}
        loading={saving}
        disabled={!plan.hasChanges}
        style={styles.save}
        testID="edit-save"
      />
    </KeyboardAwareScreen>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.md, paddingBottom: spacing.xl },
  multiline: { minHeight: 96 },
  pair: { flexDirection: 'row', gap: spacing.sm },
  half: { flex: 1 },
  addressField: { marginTop: spacing.sm },
  hint: { ...typography.caption, color: colors.textSecondary, marginTop: spacing.xs },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  switchText: { flex: 1, marginRight: spacing.md },
  switchLabel: { ...typography.bodyBold, color: colors.textPrimary },
  save: { marginTop: spacing.md },
});
