/**
 * Create Tournament (DES-MEETUP-MOBILE.md §4.5, §7.7; R-040).
 *
 * Fields are a subset of the live OpenAPI `TournamentCreate` schema; every
 * name/type/limit below was checked against it (see `CreateTournamentInput`):
 * - `title` (1–150) — always sent (the server default is "Test Tourney").
 * - `sport` (1–30) — chosen from `GET /admin/sports/public`.
 * - `participation_mode` — required, no default: the user must choose.
 * - `format` — documented values, pre-selected to the schema default.
 * - `capacity` — integer ≥ 2 (`exclusiveMinimum: 1`), pre-filled with the
 *   schema default of 8.
 * - `starts_at` — always sent (see the type's note); `registration_closes_at`
 *   optional. Both typed as local "YYYY-MM-DD HH:mm" (no date-picker package).
 * Only prefilled where the schema documents a default. Everything else about
 * validity (e.g. close-before-start, permissions) is left to the backend,
 * whose message is shown inline. On success it pops back to the list with a
 * new `refreshKey`.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { withCorrelationId } from '../api/correlationId';
import { getSports } from '../api/sports';
import { createTournament } from '../api/tournaments';
import Button from '../components/Button';
import ErrorView from '../components/ErrorView';
import LoadingView from '../components/LoadingView';
import OptionChips from '../components/OptionChips';
import type { ChipOption } from '../components/OptionChips';
import TextField from '../components/TextField';
import { colors, spacing, typography } from '../theme/tokens';
import type { Sport } from '../types/sport';
import type { TournamentFormat, TournamentParticipationMode } from '../types/tournament';
import { getApiErrorMessage } from '../utils/apiError';
import { LOCAL_DATE_TIME_PLACEHOLDER, parseLocalDateTime } from '../utils/localDateTime';
import type { TournamentsStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<TournamentsStackParamList, 'CreateTournament'>;

const TITLE_MAX_LENGTH = 150;
const DEFAULT_CAPACITY = '8';

const PARTICIPATION_OPTIONS: ChipOption<TournamentParticipationMode>[] = [
  { value: 'individual', label: 'Individual' },
  { value: 'team', label: 'Team' },
];

const FORMAT_OPTIONS: ChipOption<TournamentFormat>[] = [
  { value: 'knockout', label: 'Knockout' },
  { value: 'round_robin', label: 'Round robin' },
  { value: 'group_stage', label: 'Group stage' },
];

export default function CreateTournamentScreen({ navigation }: Props): React.JSX.Element {
  const [sports, setSports] = useState<Sport[]>([]);
  const [isLoadingSports, setIsLoadingSports] = useState(true);
  const [sportsError, setSportsError] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [sport, setSport] = useState<string | null>(null);
  const [participationMode, setParticipationMode] =
    useState<TournamentParticipationMode | null>(null);
  const [format, setFormat] = useState<TournamentFormat>('knockout');
  const [capacity, setCapacity] = useState(DEFAULT_CAPACITY);
  const [startsAt, setStartsAt] = useState('');
  const [registrationClosesAt, setRegistrationClosesAt] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
  }, [loadSports]);

  const handleSubmit = async (): Promise<void> => {
    setError(null);

    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError('Enter a tournament title.');
      return;
    }
    if (!sport) {
      setError('Choose a sport.');
      return;
    }
    if (!participationMode) {
      setError('Choose individual or team participation.');
      return;
    }
    const capacityNumber = Number(capacity.trim());
    if (!/^\d+$/.test(capacity.trim()) || capacityNumber < 2) {
      setError('Capacity must be a whole number of at least 2.');
      return;
    }
    const startsAtIso = parseLocalDateTime(startsAt);
    if (!startsAtIso) {
      setError(`Enter the start as ${LOCAL_DATE_TIME_PLACEHOLDER}.`);
      return;
    }
    let closesAtIso: string | undefined;
    if (registrationClosesAt.trim()) {
      const parsed = parseLocalDateTime(registrationClosesAt);
      if (!parsed) {
        setError(`Enter the registration close as ${LOCAL_DATE_TIME_PLACEHOLDER}, or leave it empty.`);
        return;
      }
      closesAtIso = parsed;
    }

    setIsSubmitting(true);
    try {
      await withCorrelationId(async correlationId => {
        await createTournament(
          {
            title: trimmedTitle,
            sport,
            participation_mode: participationMode,
            format,
            capacity: capacityNumber,
            starts_at: startsAtIso,
            ...(closesAtIso ? { registration_closes_at: closesAtIso } : {}),
          },
          { correlationId },
        );
      });
      navigation.popTo('TournamentsList', { refreshKey: Date.now() });
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
  }));

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.label}>Title</Text>
      <TextField
        style={styles.input}
        placeholder="e.g. Summer Cup"
        value={title}
        onChangeText={setTitle}
        maxLength={TITLE_MAX_LENGTH}
        editable={!isSubmitting}
      />

      <Text style={styles.label}>Sport</Text>
      {sportOptions.length === 0 ? (
        <Text style={styles.hint}>No sports are available right now.</Text>
      ) : (
        <OptionChips options={sportOptions} value={sport} onChange={setSport} disabled={isSubmitting} />
      )}

      <Text style={[styles.label, styles.section]}>Participation</Text>
      <OptionChips
        options={PARTICIPATION_OPTIONS}
        value={participationMode}
        onChange={setParticipationMode}
        disabled={isSubmitting}
      />

      <Text style={[styles.label, styles.section]}>Format</Text>
      <OptionChips options={FORMAT_OPTIONS} value={format} onChange={setFormat} disabled={isSubmitting} />

      <Text style={[styles.label, styles.section]}>Capacity</Text>
      <TextField
        style={styles.input}
        keyboardType="number-pad"
        value={capacity}
        onChangeText={setCapacity}
        editable={!isSubmitting}
      />

      <Text style={styles.label}>Starts at</Text>
      <TextField
        style={styles.input}
        placeholder={LOCAL_DATE_TIME_PLACEHOLDER}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="numbers-and-punctuation"
        value={startsAt}
        onChangeText={setStartsAt}
        editable={!isSubmitting}
      />

      <Text style={styles.label}>Registration closes at (optional)</Text>
      <TextField
        style={styles.input}
        placeholder={LOCAL_DATE_TIME_PLACEHOLDER}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="numbers-and-punctuation"
        value={registrationClosesAt}
        onChangeText={setRegistrationClosesAt}
        editable={!isSubmitting}
      />
      <Text style={styles.hint}>Times are in your local time zone.</Text>

      {error ? (
        <Text style={styles.error} accessibilityRole="alert">
          {error}
        </Text>
      ) : null}

      <Button label="Create Tournament" onPress={handleSubmit} loading={isSubmitting} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg },
  label: { ...typography.bodyBold, color: colors.textPrimary, marginBottom: spacing.xs },
  section: { marginTop: spacing.md },
  input: { marginBottom: spacing.md },
  hint: { ...typography.caption, color: colors.textMuted, marginBottom: spacing.md },
  error: { ...typography.body, color: colors.error, marginBottom: spacing.md },
});
