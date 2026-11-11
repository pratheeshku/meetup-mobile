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
import { getTournament, getWizardTemplates, updateTournament } from '../api/tournaments';
import Button from '../components/Button';
import DateTimePickerField from '../components/DateTimePickerField';
import DropdownField from '../components/DropdownField';
import ErrorView from '../components/ErrorView';
import KeyboardAwareScreen from '../components/KeyboardAwareScreen';
import LoadingView from '../components/LoadingView';
import SegmentedSwitch from '../components/SegmentedSwitch';
import TextField from '../components/TextField';
import { formatDayTime } from '../components/tournament/wizard/RegistrationStep';
import { Banner, CountStepper, FieldError, FieldLabel, LockedBox, SectionCard } from '../components/tournament/wizard/parts';
import VenuePicker from '../components/venue/VenuePicker';
import { useT } from '../labels/LabelsContext';
import type { TournamentsStackParamList } from '../navigation/types';
import { getSports } from '../api/sports';
import { borderWidth, colors, spacing, typography } from '../theme/tokens';
import type { Sport } from '../types/sport';
import type { Tournament } from '../types/tournament';
import {
  editErrorLabel,
  editResetsFixtures,
  initialEditForm,
  fixturesExist,
  planEdit,
  registeredCountOf,
  type TournamentEditForm,
} from '../utils/tournamentEdit';
import { FALLBACK_RANGE_HINTS, rangeHints, toDate, type WizardRangeHints, type WizardVenue } from '../utils/tournamentWizard';
import type { TournamentParticipationMode } from '../types/tournament';

type Props = NativeStackScreenProps<TournamentsStackParamList, 'TournamentEdit'>;

const LOCKED_WIDTH = 90;
const STRUCTURE_CODES = new Set([
  'CAPACITY_BELOW_REGISTERED',
  'TEAM_SIZE_LOCKED',
  'TEAM_SIZE_INVALID',
  'FIELD_LOCKED_AFTER_REGISTRATION',
  'OVERRIDE_NOT_LISTED',
  'OVERRIDE_OUTSIDE_LIMITS',
]);

export default function TournamentEditScreen({ navigation, route }: Props): React.JSX.Element {
  const t = useT();
  const { tournamentId } = route.params;
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [form, setForm] = useState<TournamentEditForm | null>(null);
  const [catalogueEnabled, setCatalogueEnabled] = useState(false);
  const [mapsApiKey, setMapsApiKey] = useState<string | null>(null);
  const [sports, setSports] = useState<Sport[]>([]);
  // Stepper ranges from the templates answer (UX only; the server decides). The fallback hints until it arrives.
  const [hints, setHints] = useState<WizardRangeHints>(FALLBACK_RANGE_HINTS);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // A capacity, team size, sport or mode refusal shows under those fields (board M6); any other refusal above Save.
  const [errorInStructure, setErrorInStructure] = useState(false);
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
    getWizardTemplates()
      .then(answer => setHints(rangeHints(answer)))
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
    setErrorInStructure(false);
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
  // team-size-capacity AD-5, boards M4 to M6: sport, who plays and players per team lock at the first registration (UX only).
  const registered = registeredCountOf(tournament);
  const locked = registered > 0;
  const team = form.participation === 'team';
  const sportOptions = sports.map(item => ({ value: item.name, label: item.display_name }));
  const sportLabel = sports.find(item => item.name === form.sport)?.display_name ?? form.sport;

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
      const label = editErrorLabel(e, start ? formatDayTime(start) : '', { registered: registeredCountOf(tournament), hints });
      setError(t(label.key, label.params));
      setErrorInStructure(STRUCTURE_CODES.has(String((e as { response?: { data?: { code?: unknown } } })?.response?.data?.code)));
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
      // The existing notice names dates and venue; a capacity, sport or who-plays change shows the board's wording (M5).
      const notice = plan.placeChanged || !plan.structureChanged ? 'web.tournament_edit.reset_confirm' : 'mob.te.reset_note';
      Alert.alert(t('web.tournament.edit_tournament'), t(notice), [
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

      <View style={styles.structure}>
        <FieldLabel>{t('mob.tw.sport')}</FieldLabel>
        {locked ? (
          <LockedBox value={sportLabel} testID="edit-sport-locked" />
        ) : (
          <DropdownField
            options={sportOptions}
            value={form.sport}
            onChange={value => patch({ sport: value })}
            placeholder={sportLabel}
            accessibilityLabel={t('mob.tw.sport')}
            disabled={saving}
          />
        )}
        <FieldLabel>{t('mob.te.who_plays')}</FieldLabel>
        <SegmentedSwitch<TournamentParticipationMode>
          value={form.participation}
          onChange={participation => patch({ participation })}
          disabled={locked || saving}
          options={[
            { value: 'individual', label: t('mob.tw.part_individual') },
            { value: 'team', label: t('mob.tw.part_team') },
          ]}
        />
        <SectionCard style={styles.stepperCard}>
          {team ? (
            locked ? (
              <View style={styles.counterRow} testID="edit-team-size-locked">
                <View style={styles.counterText}>
                  <Text style={styles.switchLabel}>{t('mob.tw.team_size')}</Text>
                  <Text style={styles.hint}>
                    {t(registered === 1 ? 'mob.te.team_size_locked_one' : 'mob.te.team_size_locked', { count: registered })}
                  </Text>
                </View>
                <LockedBox value={String(form.teamSize)} width={LOCKED_WIDTH} />
              </View>
            ) : (
              <CountStepper
                label={t('mob.tw.team_size')}
                hint={t('mob.tw.team_size_hint', hints.teamSize)}
                value={form.teamSize}
                min={hints.teamSize.min}
                max={hints.teamSize.max}
                onChange={teamSize => patch({ teamSize })}
                decreaseLabel={t('mob.tw.team_size_less')}
                increaseLabel={t('mob.tw.team_size_more')}
                testID="edit-team-size"
              />
            )
          ) : null}
          <View style={team ? styles.divided : null}>
            <CountStepper
              label={t('mob.tw.entrants_max')}
              hint={locked ? t('mob.te.capacity_floor', { count: registered }) : t('mob.tw.entrants_hint_range', hints.entrants)}
              value={form.capacity}
              min={hints.entrants.min}
              max={hints.entrants.max}
              onChange={capacity => patch({ capacity })}
              decreaseLabel={t('mob.tw.entrants_less')}
              increaseLabel={t('mob.tw.entrants_more')}
              testID="edit-capacity"
            />
          </View>
        </SectionCard>
        {error && errorInStructure ? <Banner tone="error" message={error} testID="edit-error" /> : null}
        {locked ? <Banner tone="info" message={t(team ? 'mob.te.lock_note_team' : 'mob.te.lock_note_individual')} testID="edit-lock-note" /> : null}
        {fixturesExist(tournament) ? <Banner tone="info" message={t('mob.te.reset_note')} testID="edit-reset-note" /> : null}
      </View>

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

      {error && !errorInStructure ? <Banner tone="error" message={error} testID="edit-error" /> : null}
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
  structure: { marginTop: spacing.md },
  stepperCard: { marginTop: spacing.md },
  divided: { borderTopWidth: borderWidth.thin, borderTopColor: colors.border },
  counterRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm },
  counterText: { flex: 1, paddingRight: spacing.sm },
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
