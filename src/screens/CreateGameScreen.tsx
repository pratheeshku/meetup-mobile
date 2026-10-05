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
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
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
import KeyboardAwareScreen from '../components/KeyboardAwareScreen';
import TextField from '../components/TextField';
import { useFieldChain } from '../hooks/useFieldChain';
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
import { goToDashboard } from '../navigation/goToDashboard';
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
import { useT } from '../labels/LabelsContext';

type Props = CompositeScreenProps<
  NativeStackScreenProps<HomeStackParamList, 'CreateGame'>,
  BottomTabScreenProps<AppTabParamList, 'Home'>
>;

type GameKind = 'game' | 'tournament';

const TITLE_MAX_LENGTH = 150;
const DEFAULT_TOURNAMENT_CAPACITY = '8';

export default function CreateGameScreen(_props: Props): React.JSX.Element {
  const labels = useLabels();
  const t = useT();
  const tRef = useRef(t);
  tRef.current = t;

  const MODE_OPTIONS: ChipOption<GameKind>[] = [
    { value: 'game', label: t('mob.create_game.mode_game') },
    { value: 'tournament', label: t('mob.create_game.mode_tournament') },
  ];

  const PARTICIPATION_OPTIONS: ChipOption<TournamentParticipationMode>[] = [
    { value: 'individual', label: t('mob.create_game.participation_individual') },
    { value: 'team', label: t('mob.create_game.participation_team') },
  ];

  /** Group Stage intentionally excluded — see `TournamentFormat`'s type comment. */
  const FORMAT_OPTIONS: ChipOption<TournamentFormat>[] = [
    { value: 'knockout', label: t('mob.create_game.format_knockout') },
    { value: 'round_robin', label: t('mob.create_game.format_round_robin') },
  ];
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
      setSportsError(tRef.current('mob.common.sports_load_error'));
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

  const chain = useFieldChain([
    'gTitle',
    'gCapacity',
    'gVenueName',
    'gVenueAddress',
    'gCost',
    'gCurrency',
    'gDescription',
    'tTitle',
    'tDescription',
    'tCapacity',
    'tVenueName',
  ]);

  const handleSubmitCasual = async (): Promise<void> => {
    setError(null);

    const trimmedTitle = gTitle.trim();
    if (!trimmedTitle) {
      setError(t('mob.create_game.err_game_title'));
      chain.focus('gTitle');
      return;
    }
    const capacityNumber = Number(gCapacity.trim());
    if (!/^\d+$/.test(gCapacity.trim()) || capacityNumber < 2 || capacityNumber > 200) {
      setError(t('mob.create_game.err_game_capacity'));
      chain.focus('gCapacity');
      return;
    }
    const startsAtIso = parseLocalDateTime(gStart);
    if (!startsAtIso) {
      setError(t('mob.create_game.err_game_start', { format: LOCAL_DATE_TIME_PLACEHOLDER }));
      return;
    }
    if (gVisibility === 'group' && !gGroupId) {
      setError(t('mob.create_game.err_group'));
      return;
    }

    let costCents: number | undefined;
    if (gCost.trim()) {
      const parsedCost = parseFloat(gCost.trim());
      if (isNaN(parsedCost) || parsedCost < 0) {
        setError(t('mob.create_game.err_cost'));
        chain.focus('gCost');
        return;
      }
      costCents = Math.round(parsedCost * 100);
    }
    let currencyCode: string | undefined;
    if (gCurrency.trim()) {
      const trimmedCurrency = gCurrency.trim().toUpperCase();
      if (trimmedCurrency.length !== 3) {
        setError(t('mob.create_game.err_currency'));
        chain.focus('gCurrency');
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
      goToDashboard(t('mob.success.game_created'));
    } catch (e) {
      setError(getApiErrorMessage(e, t('mob.create_game.err_game_create')));
      setIsSubmitting(false);
    }
  };

  const handleSubmitTournament = async (): Promise<void> => {
    setError(null);

    const trimmedTitle = tTitle.trim();
    if (!trimmedTitle) {
      setError(t('mob.create_game.err_tournament_title'));
      chain.focus('tTitle');
      return;
    }
    if (!tSport) {
      setError(t('mob.create_game.err_sport'));
      return;
    }
    if (!tParticipationMode) {
      setError(t('mob.create_game.err_participation'));
      return;
    }
    const capacityNumber = Number(tCapacity.trim());
    if (!/^\d+$/.test(tCapacity.trim()) || capacityNumber < 2) {
      setError(t('mob.create_game.err_tournament_capacity'));
      chain.focus('tCapacity');
      return;
    }
    const startsAtIso = parseLocalDate(tStart);
    if (!startsAtIso) {
      setError(t('mob.create_game.err_tournament_start', { format: LOCAL_DATE_PLACEHOLDER }));
      return;
    }
    if (tVisibility === 'group' && !tGroupId) {
      setError(t('mob.create_game.err_group'));
      return;
    }
    let closesAtIso: string | undefined;
    if (tRegClose.trim()) {
      const parsed = parseLocalDateTime(tRegClose);
      if (!parsed) {
        setError(t('mob.create_game.err_reg_close', { format: LOCAL_DATE_TIME_PLACEHOLDER }));
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
      goToDashboard(t('mob.success.tournament_created'));
    } catch (e) {
      setError(getApiErrorMessage(e, t('mob.create_game.err_tournament_create')));
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
      <Text style={[styles.label, styles.section]}>{t('mob.create_game.group')}</Text>
      {groupOptions.length === 0 ? (
        <Text style={styles.hint}>{t('mob.create_game.no_groups')}</Text>
      ) : (
        <DropdownField
          options={groupOptions}
          value={value}
          onChange={onChange}
          placeholder={t('mob.create_game.group_placeholder')}
          accessibilityLabel={t('mob.create_game.group')}
          disabled={isSubmitting}
        />
      )}
    </>
  );

  return (
    <KeyboardAwareScreen contentContainerStyle={styles.container}>
        <OptionChips options={MODE_OPTIONS} value={mode} onChange={setMode} disabled={isSubmitting} />

      {mode === 'game' ? (
        <>
          <Text style={[styles.label, styles.section]}>{t('mob.create_game.title')}</Text>
          <TextField
            {...chain.props('gTitle')}
            style={styles.input}
            placeholder={t('mob.create_game.title_placeholder')}
            value={gTitle}
            onChangeText={setGTitle}
            maxLength={TITLE_MAX_LENGTH}
            editable={!isSubmitting}
          />

          <Text style={styles.label}>{t('mob.create_game.sport')}</Text>
          {sportOptions.length === 0 ? (
            <Text style={styles.hint}>{t('mob.common.no_sports')}</Text>
          ) : (
            <OptionChips options={sportOptions} value={gSport} onChange={setGSport} disabled={isSubmitting} />
          )}

          <Text style={[styles.label, styles.section]}>{t('mob.create_game.visibility')}</Text>
          <OptionChips
            options={CASUAL_VISIBILITY_OPTIONS}
            value={gVisibility}
            onChange={setGVisibility}
            disabled={isSubmitting}
            selectedColor={colors.textPrimary}
          />
          {gVisibility === 'group' ? renderGroupPicker(gGroupId, setGGroupId) : null}

          <Text style={[styles.label, styles.section]}>{t('mob.create_game.skill_level')}</Text>
          <OptionChips
            options={SKILL_LEVEL_OPTIONS}
            value={gSkill}
            onChange={setGSkill}
            disabled={isSubmitting}
            selectedColor={colors.textPrimary}
          />

          <Text style={[styles.label, styles.section]}>{t('mob.create_game.capacity')}</Text>
          <TextField
            {...chain.props('gCapacity')}
            style={styles.input}
            keyboardType="number-pad"
            placeholder={t('mob.create_game.capacity_placeholder')}
            value={gCapacity}
            onChangeText={setGCapacity}
            editable={!isSubmitting}
          />

          <Text style={[styles.label, styles.section]}>{t('mob.create_game.start')}</Text>
          <OptionChips
            options={[
              { value: 'today', label: t('mob.time.today') },
              { value: 'tomorrow', label: t('mob.time.tomorrow') },
              { value: 'sat', label: t('mob.create_game.quick_sat') },
              { value: 'sun', label: t('mob.create_game.quick_sun') },
            ]}
            value={null}
            onChange={which => setGStart(current => applyQuickDate(current, quickDate(which)))}
            disabled={isSubmitting}
          />
          <DateTimePickerField
            accessibilityLabel={t('mob.create_game.start')}
            testID="casual-start-date-time"
            mode="datetime"
            value={gStart}
            onChange={setGStart}
            disabled={isSubmitting}
          />

          <Text style={styles.label}>{t('mob.create_game.venue_name')}</Text>
          <TextField
            {...chain.props('gVenueName')}
            style={styles.input}
            placeholder={t('mob.create_game.venue_name_placeholder')}
            value={gVenueName}
            onChangeText={setGVenueName}
            editable={!isSubmitting}
          />

          <Text style={styles.label}>{t('mob.create_game.venue_address')}</Text>
          <TextField
            {...chain.props('gVenueAddress')}
            style={styles.input}
            placeholder={t('mob.create_game.venue_address_placeholder')}
            value={gVenueAddress}
            onChangeText={setGVenueAddress}
            editable={!isSubmitting}
          />

          <Text style={[styles.label, styles.section]}>{t('mob.create_game.cost')}</Text>
          <View style={styles.costCurrencyRow}>
            <TextField
              {...chain.props('gCost')}
              style={[styles.input, styles.costField]}
              placeholder={t('mob.create_game.cost_placeholder')}
              accessibilityLabel={t('mob.create_game.cost_a11y')}
              value={gCost}
              onChangeText={setGCost}
              keyboardType="decimal-pad"
              editable={!isSubmitting}
            />
            <TextField
              {...chain.props('gCurrency')}
              style={[styles.input, styles.currencyField]}
              placeholder={t('mob.create_game.currency_placeholder')}
              accessibilityLabel={t('mob.create_game.currency_a11y')}
              value={gCurrency}
              onChangeText={text => setGCurrency(text.toUpperCase())}
              maxLength={3}
              autoCapitalize="characters"
              editable={!isSubmitting}
            />
          </View>

          <Text style={styles.label}>{t('mob.create_game.description')}</Text>
          <TextField
            ref={chain.ref('gDescription')}
            style={[styles.input, styles.multiline]}
            placeholder={t('mob.create_game.description_placeholder')}
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
            label={t('mob.create_game.submit_game')}
            variant="cta"
            onPress={handleSubmitCasual}
            loading={isSubmitting}
          />
        </>
      ) : (
        <>
          <Text style={[styles.label, styles.section]}>{t('mob.create_game.tournament_title')}</Text>
          <TextField
            {...chain.props('tTitle')}
            style={styles.input}
            placeholder={t('mob.create_game.tournament_title_placeholder')}
            value={tTitle}
            onChangeText={setTTitle}
            maxLength={TITLE_MAX_LENGTH}
            editable={!isSubmitting}
          />

          <Text style={styles.label}>{t('mob.create_game.tournament_start')}</Text>
          <DateTimePickerField
            accessibilityLabel={t('mob.create_game.tournament_start')}
            testID="tournament-start-date"
            mode="date"
            value={tStart}
            onChange={setTStart}
            disabled={isSubmitting}
          />

          <Text style={[styles.label, styles.section]}>{t('mob.create_game.sport')}</Text>
          {sportOptions.length === 0 ? (
            <Text style={styles.hint}>{t('mob.common.no_sports')}</Text>
          ) : (
            <OptionChips options={sportOptions} value={tSport} onChange={setTSport} disabled={isSubmitting} />
          )}

          <Text style={[styles.label, styles.section]}>{t('mob.create_game.visibility')}</Text>
          <OptionChips
            options={TOURNAMENT_VISIBILITY_OPTIONS}
            value={tVisibility}
            onChange={setTVisibility}
            disabled={isSubmitting}
            selectedColor={colors.textPrimary}
          />
          {tVisibility === 'group' ? renderGroupPicker(tGroupId, setTGroupId) : null}

          <Text style={[styles.label, styles.section]}>{t('mob.create_game.description_optional')}</Text>
          <TextField
            ref={chain.ref('tDescription')}
            style={[styles.input, styles.multiline]}
            placeholder={t('mob.create_game.tournament_description_placeholder')}
            value={tDescription}
            onChangeText={setTDescription}
            multiline
            textAlignVertical="top"
            editable={!isSubmitting}
          />

          <Text style={[styles.label, styles.section]}>{t('mob.create_game.participation')}</Text>
          <OptionChips
            options={PARTICIPATION_OPTIONS}
            value={tParticipationMode}
            onChange={setTParticipationMode}
            disabled={isSubmitting}
          />

          <Text style={[styles.label, styles.section]}>{t('mob.create_game.reg_close')}</Text>
          <DateTimePickerField
            accessibilityLabel={t('mob.create_game.reg_close')}
            testID="tournament-reg-close"
            mode="datetime"
            value={tRegClose}
            onChange={setTRegClose}
            disabled={isSubmitting}
          />

          <Text style={[styles.label, styles.section]}>{t('mob.create_game.format')}</Text>
          <OptionChips options={FORMAT_OPTIONS} value={tFormat} onChange={setTFormat} disabled={isSubmitting} />

          <Text style={[styles.label, styles.section]}>{t('mob.create_game.capacity')}</Text>
          <TextField
            {...chain.props('tCapacity')}
            style={styles.input}
            keyboardType="number-pad"
            value={tCapacity}
            onChangeText={setTCapacity}
            editable={!isSubmitting}
          />

          <Text style={styles.label}>{t('mob.create_game.venue_name')}</Text>
          <TextField
            {...chain.props('tVenueName')}
            style={styles.input}
            placeholder={t('mob.create_game.tournament_venue_placeholder')}
            value={tVenueName}
            onChangeText={setTVenueName}
            editable={!isSubmitting}
          />
          <Text style={styles.hint}>{t('mob.create_game.timezone_hint')}</Text>

          {error ? (
            <Text style={styles.error} accessibilityRole="alert">
              {error}
            </Text>
          ) : null}

          <Button
            label={t('mob.create_game.submit_tournament')}
            variant="cta"
            onPress={handleSubmitTournament}
            loading={isSubmitting}
          />
        </>
      )}
    </KeyboardAwareScreen>
  );
}

const styles = StyleSheet.create({
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
