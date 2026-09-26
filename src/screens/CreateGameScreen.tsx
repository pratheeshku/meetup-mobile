/**
 * Create Game (DES-MEETUP-MOBILE.md §4.3 Create Flow Amendment,
 * architect-approved 2026-09-22; R-021, R-040).
 *
 * Single screen with a Casual Game/Tournament toggle at the top
 * (`MODE_OPTIONS`, default Casual Game), replacing the former placeholder
 * and, for the Tournament side, the retired standalone
 * `CreateTournamentScreen`/`TournamentsStackParamList.CreateTournament`.
 * Both forms' state is declared unconditionally at this component's top
 * level (not in child components mounted/unmounted per mode), so toggling
 * back and forth never loses whatever the user already typed into either
 * one — the same intent as the web reference's "both forms stay mounted"
 * comment (`frontend/app.js`, `renderCreateEventPage`), achieved here by
 * never destroying the state instead of literally keeping both subtrees
 * mounted.
 *
 * Field sets, enum values and endpoints are sourced directly from
 * `pratheeshku/meetup` (fetched via `gh api` during this task): backend
 * `events/schemas.py` (`EventCreate`) / `tournaments/schemas.py`
 * (`TournamentCreate`) for the authoritative payload contract, and
 * `frontend/app.js` (`eventCreateFormHtml`/`submitCreateEvent`,
 * `tournamentCreateFormHtml`/`submitCreateTournament`) for which subset of
 * each schema the web UI actually exposes, in what order, with what
 * defaults. See the Implementation Report for the full source-by-source
 * breakdown and every Proposed Assumption below.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';

import { withCorrelationId } from '../api/correlationId';
import { createEvent } from '../api/events';
import { getMyGroups } from '../api/groups';
import { getSports } from '../api/sports';
import { createTournament } from '../api/tournaments';
import Button from '../components/Button';
import DateTimePickerField from '../components/DateTimePickerField';
import DropdownField from '../components/DropdownField';
import ErrorView from '../components/ErrorView';
import LoadingView from '../components/LoadingView';
import OptionChips from '../components/OptionChips';
import type { ChipOption } from '../components/OptionChips';
import TextField from '../components/TextField';
import { colors, getSportColor, spacing, typography } from '../theme/tokens';
import type { CreateEventInput, EventSkillLevel, EventVisibility } from '../types/event';
import type { Group } from '../types/group';
import type { Sport } from '../types/sport';
import type {
  CreateTournamentInput,
  TournamentFormat,
  TournamentParticipationMode,
  TournamentVisibility,
} from '../types/tournament';
import { getLabel, useLabels } from '../labels/LabelsContext';
import { getApiErrorMessage } from '../utils/apiError';
import { getEventVisibilityLabel } from '../utils/labels';
import {
  applyQuickDate,
  LOCAL_DATE_PLACEHOLDER,
  LOCAL_DATE_TIME_PLACEHOLDER,
  parseLocalDate,
  parseLocalDateTime,
  quickDate,
} from '../utils/localDateTime';
import type { AppTabParamList, HomeStackParamList } from '../navigation/types';

type Props = CompositeScreenProps<
  NativeStackScreenProps<HomeStackParamList, 'CreateGame'>,
  BottomTabScreenProps<AppTabParamList, 'Home'>
>;

type GameKind = 'game' | 'tournament';

const MODE_OPTIONS: ChipOption<GameKind>[] = [
  { value: 'game', label: '🎮 Casual Game' },
  { value: 'tournament', label: '🏆 Tournament' },
];

const PARTICIPATION_OPTIONS: ChipOption<TournamentParticipationMode>[] = [
  { value: 'individual', label: 'Individual' },
  { value: 'team', label: 'Team' },
];

/** Group Stage intentionally excluded — see `TournamentFormat`'s type comment. */
const FORMAT_OPTIONS: ChipOption<TournamentFormat>[] = [
  { value: 'knockout', label: 'Knockout' },
  { value: 'round_robin', label: 'Round robin' },
];

const TITLE_MAX_LENGTH = 150;
const DEFAULT_TOURNAMENT_CAPACITY = '8';

export default function CreateGameScreen({ navigation }: Props): React.JSX.Element {
  const labels = useLabels();
  const [mode, setMode] = useState<GameKind>('game');

  const [sports, setSports] = useState<Sport[]>([]);
  const [isLoadingSports, setIsLoadingSports] = useState(true);
  const [sportsError, setSportsError] = useState<string | null>(null);
  // Secondary, non-blocking (only needed for the conditional Group picker,
  // shown when Visibility = Group): a failure degrades to an empty list —
  // same pattern as HomeScreen's groups tile — rather than blocking the
  // whole Create Game form over a field most creates never touch.
  const [groups, setGroups] = useState<Group[]>([]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Casual Game fields (EventCreate).
  const [gTitle, setGTitle] = useState('');
  const [gSport, setGSport] = useState<string | null>(null);
  const [gVisibility, setGVisibility] = useState<EventVisibility>('public');
  const [gGroupId, setGGroupId] = useState<string | null>(null);
  const [gSkill, setGSkill] = useState<EventSkillLevel>('all_levels');
  const [gCapacity, setGCapacity] = useState('');
  const [gStart, setGStart] = useState('');
  const [gVenueName, setGVenueName] = useState('');
  const [gVenueAddress, setGVenueAddress] = useState('');
  const [gDescription, setGDescription] = useState('');
  // Cost/currency (EventCreate.estimated_cost_cents/estimated_cost_currency
  // — verified against the live backend schema, see CreateEventInput's
  // type comment). Both optional and independent, matching the pre-BUILD-B
  // edit-form validation pattern this restyles from.
  const [gCost, setGCost] = useState('');
  const [gCurrency, setGCurrency] = useState('');

  // Tournament fields (TournamentCreate).
  const [tTitle, setTTitle] = useState('');
  const [tSport, setTSport] = useState<string | null>(null);
  const [tVisibility, setTVisibility] = useState<TournamentVisibility>('public');
  const [tGroupId, setTGroupId] = useState<string | null>(null);
  const [tDescription, setTDescription] = useState('');
  const [tParticipationMode, setTParticipationMode] =
    useState<TournamentParticipationMode | null>(null);
  const [tRegClose, setTRegClose] = useState('');
  const [tFormat, setTFormat] = useState<TournamentFormat>('knockout');
  const [tCapacity, setTCapacity] = useState(DEFAULT_TOURNAMENT_CAPACITY);
  const [tStart, setTStart] = useState('');
  const [tVenueName, setTVenueName] = useState('');

  const loadSports = useCallback(async () => {
    setIsLoadingSports(true);
    setSportsError(null);
    try {
      setSports(await getSports());
    } catch {
      setSportsError('Could not load the list of sports. Please try again.');
    } finally {
      setIsLoadingSports(false);
    }
  }, []);

  useEffect(() => {
    loadSports();
    getMyGroups().then(
      response => setGroups(response.items),
      () => setGroups([]),
    );
  }, [loadSports]);

  const handleSubmitCasual = async (): Promise<void> => {
    setError(null);

    const trimmedTitle = gTitle.trim();
    if (!trimmedTitle) {
      setError('Enter a game title.');
      return;
    }
    const capacityNumber = Number(gCapacity.trim());
    if (!/^\d+$/.test(gCapacity.trim()) || capacityNumber < 2 || capacityNumber > 200) {
      setError('Capacity must be a whole number between 2 and 200.');
      return;
    }
    const startsAtIso = parseLocalDateTime(gStart);
    if (!startsAtIso) {
      setError(`Enter the start as ${LOCAL_DATE_TIME_PLACEHOLDER}.`);
      return;
    }
    if (gVisibility === 'group' && !gGroupId) {
      setError('Choose a group.');
      return;
    }

    let costCents: number | undefined;
    if (gCost.trim()) {
      const parsedCost = parseFloat(gCost.trim());
      if (isNaN(parsedCost) || parsedCost < 0) {
        setError('Estimated cost must be a non-negative number.');
        return;
      }
      costCents = Math.round(parsedCost * 100);
    }
    let currencyCode: string | undefined;
    if (gCurrency.trim()) {
      const trimmedCurrency = gCurrency.trim().toUpperCase();
      if (trimmedCurrency.length !== 3) {
        setError('Currency code must be 3 letters (e.g. USD, SGD).');
        return;
      }
      currencyCode = trimmedCurrency;
    }

    const input: CreateEventInput = {
      title: trimmedTitle,
      ...(gSport ? { sport: gSport } : {}),
      visibility: gVisibility,
      ...(gVisibility === 'group' && gGroupId ? { group_id: gGroupId } : {}),
      skill_level_requirement: gSkill,
      capacity: capacityNumber,
      starts_at: startsAtIso,
      ends_at: null,
      ...(gVenueName.trim() ? { venue_name: gVenueName.trim() } : {}),
      ...(gVenueAddress.trim() ? { venue_address: gVenueAddress.trim() } : {}),
      ...(gDescription.trim() ? { description: gDescription.trim() } : {}),
      ...(costCents !== undefined ? { estimated_cost_cents: costCents } : {}),
      ...(currencyCode !== undefined ? { estimated_cost_currency: currencyCode } : {}),
    };

    setIsSubmitting(true);
    try {
      await withCorrelationId(async correlationId => {
        await createEvent(input, { correlationId });
      });
      navigation.popTo('EventsList', { refreshKey: Date.now() });
    } catch (e) {
      setError(getApiErrorMessage(e, 'Could not create the game. Please try again.'));
      setIsSubmitting(false);
    }
  };

  const handleSubmitTournament = async (): Promise<void> => {
    setError(null);

    const trimmedTitle = tTitle.trim();
    if (!trimmedTitle) {
      setError('Enter a tournament title.');
      return;
    }
    if (!tSport) {
      setError('Choose a sport.');
      return;
    }
    if (!tParticipationMode) {
      setError('Choose individual or team participation.');
      return;
    }
    const capacityNumber = Number(tCapacity.trim());
    if (!/^\d+$/.test(tCapacity.trim()) || capacityNumber < 2) {
      setError('Capacity must be a whole number of at least 2.');
      return;
    }
    const startsAtIso = parseLocalDate(tStart);
    if (!startsAtIso) {
      setError(`Enter the tournament start date as ${LOCAL_DATE_PLACEHOLDER}.`);
      return;
    }
    if (tVisibility === 'group' && !tGroupId) {
      setError('Choose a group.');
      return;
    }
    let closesAtIso: string | undefined;
    if (tRegClose.trim()) {
      const parsed = parseLocalDateTime(tRegClose);
      if (!parsed) {
        setError(`Enter the registration close as ${LOCAL_DATE_TIME_PLACEHOLDER}, or leave it empty.`);
        return;
      }
      closesAtIso = parsed;
    }

    const input: CreateTournamentInput = {
      title: trimmedTitle,
      sport: tSport,
      ...(tDescription.trim() ? { description: tDescription.trim() } : {}),
      visibility: tVisibility,
      ...(tVisibility === 'group' && tGroupId ? { group_id: tGroupId } : {}),
      participation_mode: tParticipationMode,
      format: tFormat,
      capacity: capacityNumber,
      starts_at: startsAtIso,
      ...(closesAtIso ? { registration_closes_at: closesAtIso } : {}),
      ...(tVenueName.trim() ? { venue_name: tVenueName.trim() } : {}),
    };

    setIsSubmitting(true);
    try {
      await withCorrelationId(async correlationId => {
        await createTournament(input, { correlationId });
      });
      // Creation happened outside the Tournaments stack (this screen lives
      // in the Home stack), so there is no local route to `popTo` back to
      // — land on the Tournaments tab's list instead, refreshed, the
      // closest equivalent to the retired CreateTournamentScreen's
      // `popTo('TournamentsList', ...)`.
      navigation.navigate('Tournaments', {
        screen: 'TournamentsList',
        params: { refreshKey: Date.now() },
      });
    } catch (e) {
      setError(getApiErrorMessage(e, 'Could not create the tournament. Please try again.'));
      setIsSubmitting(false);
    }
  };

  if (isLoadingSports) {
    return <LoadingView />;
  }

  if (sportsError) {
    return <ErrorView message={sportsError} onRetry={loadSports} />;
  }

  const sportOptions: ChipOption<string>[] = sports.map(item => ({
    value: item.name,
    label: item.display_name,
    // Sport chip pickers: selected = that sport's own colour (matches web).
    color: getSportColor(item.name),
  }));
  const groupOptions: ChipOption<string>[] = groups.map(item => ({
    value: item.id,
    label: item.name,
  }));

  /**
   * `EventCreate.visibility` (`events/schemas.py`, `validate_visibility`):
   * enforced enum. Labels match web's `event-visibility` `<select>`; words
   * sourced from `GET /api/labels` (`event_visibility.*`, replacing
   * BUG-M02's hardcoded map) so this picker and every read-only display
   * (e.g. `EventCard`) stay in sync with the backend's own source of truth.
   */
  const CASUAL_VISIBILITY_OPTIONS: ChipOption<EventVisibility>[] = [
    { value: 'public', label: getEventVisibilityLabel('public', labels) },
    { value: 'invite_only', label: getEventVisibilityLabel('invite_only', labels) },
    { value: 'group', label: getEventVisibilityLabel('group', labels) },
  ];

  /** `EventCreate.skill_level_requirement` (`validate_skill`): enforced enum. */
  const SKILL_LEVEL_OPTIONS: ChipOption<EventSkillLevel>[] = [
    { value: 'all_levels', label: getLabel(labels, 'skill_level.all_levels') },
    { value: 'beginner', label: getLabel(labels, 'skill_level.beginner') },
    { value: 'intermediate', label: getLabel(labels, 'skill_level.intermediate') },
    { value: 'expert', label: getLabel(labels, 'skill_level.expert') },
  ];

  /**
   * `TournamentCreate.visibility` — documented values, distinct literal
   * (`invite`, not Event's `invite_only`) — see `types/tournament.ts`. Words
   * sourced from `GET /api/labels` (`tournament_visibility.*`), a distinct
   * key prefix from Event's `event_visibility.*` since the two enums'
   * literals (and this one's "Group Only" vs Event's "Group") genuinely
   * differ — never cross-wired.
   */
  const TOURNAMENT_VISIBILITY_OPTIONS: ChipOption<TournamentVisibility>[] = [
    { value: 'public', label: getLabel(labels, 'tournament_visibility.public') },
    { value: 'invite', label: getLabel(labels, 'tournament_visibility.invite') },
    { value: 'group', label: getLabel(labels, 'tournament_visibility.group') },
  ];

  const renderGroupPicker = (
    value: string | null,
    onChange: (value: string) => void,
  ): React.JSX.Element => (
    <>
      <Text style={[styles.label, styles.section]}>Group</Text>
      {groupOptions.length === 0 ? (
        <Text style={styles.hint}>You don&apos;t belong to any groups yet.</Text>
      ) : (
        <DropdownField
          options={groupOptions}
          value={value}
          onChange={onChange}
          placeholder="Select a group"
          accessibilityLabel="Group"
          disabled={isSubmitting}
        />
      )}
    </>
  );

  return (
    <KeyboardAvoidingView
      style={styles.keyboardAvoid}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <OptionChips options={MODE_OPTIONS} value={mode} onChange={setMode} disabled={isSubmitting} />

      {mode === 'game' ? (
        <>
          <Text style={[styles.label, styles.section]}>Title</Text>
          <TextField
            style={styles.input}
            placeholder="e.g. Sunday 5-a-side Football"
            value={gTitle}
            onChangeText={setGTitle}
            maxLength={TITLE_MAX_LENGTH}
            editable={!isSubmitting}
          />

          <Text style={styles.label}>Sport</Text>
          {sportOptions.length === 0 ? (
            <Text style={styles.hint}>No sports are available right now.</Text>
          ) : (
            <OptionChips options={sportOptions} value={gSport} onChange={setGSport} disabled={isSubmitting} />
          )}

          <Text style={[styles.label, styles.section]}>Visibility</Text>
          <OptionChips
            options={CASUAL_VISIBILITY_OPTIONS}
            value={gVisibility}
            onChange={setGVisibility}
            disabled={isSubmitting}
            selectedColor={colors.textPrimary}
          />
          {gVisibility === 'group' ? renderGroupPicker(gGroupId, setGGroupId) : null}

          <Text style={[styles.label, styles.section]}>Skill Level</Text>
          <OptionChips
            options={SKILL_LEVEL_OPTIONS}
            value={gSkill}
            onChange={setGSkill}
            disabled={isSubmitting}
            selectedColor={colors.textPrimary}
          />

          <Text style={[styles.label, styles.section]}>Capacity</Text>
          <TextField
            style={styles.input}
            keyboardType="number-pad"
            placeholder="e.g. 10"
            value={gCapacity}
            onChangeText={setGCapacity}
            editable={!isSubmitting}
          />

          <Text style={[styles.label, styles.section]}>Start Date &amp; Time</Text>
          <OptionChips
            options={[
              { value: 'today', label: 'Today' },
              { value: 'tomorrow', label: 'Tomorrow' },
              { value: 'sat', label: 'This Sat' },
              { value: 'sun', label: 'This Sun' },
            ]}
            value={null}
            onChange={which => setGStart(current => applyQuickDate(current, quickDate(which)))}
            disabled={isSubmitting}
          />
          <DateTimePickerField
            accessibilityLabel="Start Date & Time"
            testID="casual-start-date-time"
            mode="datetime"
            placeholder={LOCAL_DATE_TIME_PLACEHOLDER}
            value={gStart}
            onChange={setGStart}
            disabled={isSubmitting}
          />

          <Text style={styles.label}>Venue Name</Text>
          <TextField
            style={styles.input}
            placeholder="e.g. Bishan Sports Hall"
            value={gVenueName}
            onChangeText={setGVenueName}
            editable={!isSubmitting}
          />

          <Text style={styles.label}>Venue Address</Text>
          <TextField
            style={styles.input}
            placeholder="e.g. 5 Bishan St 14, Singapore"
            value={gVenueAddress}
            onChangeText={setGVenueAddress}
            editable={!isSubmitting}
          />

          <Text style={[styles.label, styles.section]}>Cost (optional)</Text>
          <View style={styles.costCurrencyRow}>
            <TextField
              style={[styles.input, styles.costField]}
              placeholder="e.g. 15.00"
              accessibilityLabel="Estimated Cost"
              value={gCost}
              onChangeText={setGCost}
              keyboardType="decimal-pad"
              editable={!isSubmitting}
            />
            <TextField
              style={[styles.input, styles.currencyField]}
              placeholder="USD"
              accessibilityLabel="Currency"
              value={gCurrency}
              onChangeText={text => setGCurrency(text.toUpperCase())}
              maxLength={3}
              autoCapitalize="characters"
              editable={!isSubmitting}
            />
          </View>

          <Text style={styles.label}>Description</Text>
          <TextField
            style={[styles.input, styles.multiline]}
            placeholder="Optional description..."
            value={gDescription}
            onChangeText={setGDescription}
            multiline
            textAlignVertical="top"
            editable={!isSubmitting}
          />

          {error ? (
            <Text style={styles.error} accessibilityRole="alert">
              {error}
            </Text>
          ) : null}

          <Button
            label="Create Game"
            variant="cta"
            onPress={handleSubmitCasual}
            loading={isSubmitting}
          />
        </>
      ) : (
        <>
          <Text style={[styles.label, styles.section]}>Tournament Title</Text>
          <TextField
            style={styles.input}
            placeholder="e.g. Summer League"
            value={tTitle}
            onChangeText={setTTitle}
            maxLength={TITLE_MAX_LENGTH}
            editable={!isSubmitting}
          />

          <Text style={styles.label}>Tournament Start Date</Text>
          <DateTimePickerField
            accessibilityLabel="Tournament Start Date"
            testID="tournament-start-date"
            mode="date"
            placeholder={LOCAL_DATE_PLACEHOLDER}
            value={tStart}
            onChange={setTStart}
            disabled={isSubmitting}
          />

          <Text style={[styles.label, styles.section]}>Sport</Text>
          {sportOptions.length === 0 ? (
            <Text style={styles.hint}>No sports are available right now.</Text>
          ) : (
            <OptionChips options={sportOptions} value={tSport} onChange={setTSport} disabled={isSubmitting} />
          )}

          <Text style={[styles.label, styles.section]}>Visibility</Text>
          <OptionChips
            options={TOURNAMENT_VISIBILITY_OPTIONS}
            value={tVisibility}
            onChange={setTVisibility}
            disabled={isSubmitting}
            selectedColor={colors.textPrimary}
          />
          {tVisibility === 'group' ? renderGroupPicker(tGroupId, setTGroupId) : null}

          <Text style={[styles.label, styles.section]}>Description (optional)</Text>
          <TextField
            style={[styles.input, styles.multiline]}
            placeholder="Details about rules, scheduling..."
            value={tDescription}
            onChangeText={setTDescription}
            multiline
            textAlignVertical="top"
            editable={!isSubmitting}
          />

          <Text style={[styles.label, styles.section]}>Participation</Text>
          <OptionChips
            options={PARTICIPATION_OPTIONS}
            value={tParticipationMode}
            onChange={setTParticipationMode}
            disabled={isSubmitting}
          />

          <Text style={[styles.label, styles.section]}>Registration closes at (optional)</Text>
          <DateTimePickerField
            accessibilityLabel="Registration closes at (optional)"
            testID="tournament-reg-close"
            mode="datetime"
            placeholder={LOCAL_DATE_TIME_PLACEHOLDER}
            value={tRegClose}
            onChange={setTRegClose}
            disabled={isSubmitting}
          />

          <Text style={[styles.label, styles.section]}>Format</Text>
          <OptionChips options={FORMAT_OPTIONS} value={tFormat} onChange={setTFormat} disabled={isSubmitting} />

          <Text style={[styles.label, styles.section]}>Capacity</Text>
          <TextField
            style={styles.input}
            keyboardType="number-pad"
            value={tCapacity}
            onChangeText={setTCapacity}
            editable={!isSubmitting}
          />

          <Text style={styles.label}>Venue Name</Text>
          <TextField
            style={styles.input}
            placeholder="e.g. Sports Hub Court 3"
            value={tVenueName}
            onChangeText={setTVenueName}
            editable={!isSubmitting}
          />
          <Text style={styles.hint}>Times are in your local time zone.</Text>

          {error ? (
            <Text style={styles.error} accessibilityRole="alert">
              {error}
            </Text>
          ) : null}

          <Button
            label="Create Tournament"
            variant="cta"
            onPress={handleSubmitTournament}
            loading={isSubmitting}
          />
        </>
      )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboardAvoid: { flex: 1 },
  container: { padding: spacing.lg },
  label: { ...typography.bodyBold, color: colors.textPrimary, marginBottom: spacing.xs },
  section: { marginTop: spacing.md },
  input: { marginBottom: spacing.md },
  multiline: { minHeight: spacing.xxl * 2 },
  costCurrencyRow: { flexDirection: 'row', gap: spacing.sm },
  costField: { flex: 2 },
  currencyField: { flex: 1 },
  hint: { ...typography.caption, color: colors.textMuted, marginBottom: spacing.md },
  error: { ...typography.body, color: colors.error, marginBottom: spacing.md },
});
