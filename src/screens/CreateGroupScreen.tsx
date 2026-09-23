/**
 * Create Group / Tournament Team (DES-MEETUP-MOBILE.md §4.4;
 * REQ-MEETUP Addendum B R-200–R-207 for the Team entity).
 *
 * Single screen with a Players Group / Tournament Team toggle at top
 * (default: Players Group). Toggle changes the visible field set and
 * submit target within the same screen — not a screen navigation.
 *
 * Both forms' state is declared unconditionally at this component's top
 * level so toggling back and forth never loses what the user already
 * typed — the same pattern as CreateGameScreen's Casual/Tournament toggle.
 *
 * Players Group → POST /groups  — { name, description? }
 * Tournament Team → POST /teams — { name, sport, visibility }
 *
 * Two distinct endpoints, not a discriminator on one POST.
 * Captain is NOT a form field — backend auto-assigns to the creator.
 * No member-invite step on this screen.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { withCorrelationId } from '../api/correlationId';
import { createGroup } from '../api/groups';
import { getSports } from '../api/sports';
import { createTeam } from '../api/teams';
import Button from '../components/Button';
import ErrorView from '../components/ErrorView';
import LoadingView from '../components/LoadingView';
import OptionChips from '../components/OptionChips';
import type { ChipOption } from '../components/OptionChips';
import TextField from '../components/TextField';
import { colors, spacing, typography } from '../theme/tokens';
import type { Sport } from '../types/sport';
import type { TeamVisibility } from '../types/team';
import { getApiErrorMessage } from '../utils/apiError';
import type { GroupsStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<GroupsStackParamList, 'CreateGroup'>;

type GroupKind = 'group' | 'team';

const MODE_OPTIONS: ChipOption<GroupKind>[] = [
  { value: 'group', label: '👥 Players Group' },
  { value: 'team', label: '🛡️ Tournament Team' },
];

/**
 * Team visibility — `public` or `private` only.
 *
 * ⚠️ Distinct enum from Event visibility (public/invite_only/group)
 * and Tournament visibility (public/invite/group). This is its own key —
 * not aliased to either existing visibility lookup.
 */
const TEAM_VISIBILITY_OPTIONS: ChipOption<TeamVisibility>[] = [
  { value: 'public', label: 'Public' },
  { value: 'private', label: 'Private' },
];

const NAME_MAX_LENGTH = 100;

export default function CreateGroupScreen({ navigation }: Props): React.JSX.Element {
  const [mode, setMode] = useState<GroupKind>('group');

  // Sports loading — only needed for Tournament Team mode, but loaded
  // on mount (same as CreateGameScreen) so the dropdown is ready when
  // the user toggles.
  const [sports, setSports] = useState<Sport[]>([]);
  const [isLoadingSports, setIsLoadingSports] = useState(true);
  const [sportsError, setSportsError] = useState<string | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Players Group fields (GroupCreate).
  const [gName, setGName] = useState('');
  const [gDescription, setGDescription] = useState('');

  // Tournament Team fields (TeamCreate).
  const [tName, setTName] = useState('');
  const [tSport, setTSport] = useState<string | null>(null);
  const [tVisibility, setTVisibility] = useState<TeamVisibility>('public');

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

  // --- Players Group submit ---
  const handleSubmitGroup = async (): Promise<void> => {
    setError(null);

    const trimmedName = gName.trim();
    if (!trimmedName) {
      setError('Enter a group name.');
      return;
    }

    setIsSubmitting(true);
    try {
      const created = await withCorrelationId(async correlationId => {
        return await createGroup(
          { name: trimmedName, description: gDescription.trim() },
          { correlationId },
        );
      });
      // Navigate to GroupDetail for the newly created group.
      navigation.replace('GroupDetail', { groupId: created.id });
    } catch (e) {
      setError(getApiErrorMessage(e, 'Could not create the group. Please try again.'));
      setIsSubmitting(false);
    }
  };

  // --- Tournament Team submit ---
  const handleSubmitTeam = async (): Promise<void> => {
    setError(null);

    const trimmedName = tName.trim();
    if (!trimmedName) {
      setError('Enter a team name.');
      return;
    }
    if (!tSport) {
      setError('Choose a sport.');
      return;
    }

    setIsSubmitting(true);
    try {
      await withCorrelationId(async correlationId => {
        await createTeam(
          { name: trimmedName, sport: tSport, visibility: tVisibility },
          { correlationId },
        );
      });
      // TeamDetailScreen does not exist yet — navigate to the Groups list
      // instead. Flagged as a known gap in the Implementation Report.
      navigation.popTo('GroupsList', { refreshKey: Date.now() });
    } catch (e) {
      setError(getApiErrorMessage(e, 'Could not create the team. Please try again.'));
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
      <OptionChips options={MODE_OPTIONS} value={mode} onChange={setMode} disabled={isSubmitting} />

      {mode === 'group' ? (
        <>
          <Text style={[styles.label, styles.section]}>Name</Text>
          <TextField
            style={styles.input}
            placeholder="e.g. Sunday Footballers"
            value={gName}
            onChangeText={setGName}
            maxLength={NAME_MAX_LENGTH}
            editable={!isSubmitting}
          />

          <Text style={styles.label}>Description (optional)</Text>
          <TextField
            style={[styles.input, styles.multiline]}
            placeholder="What is this group about?"
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

          <Button label="Create Group" onPress={handleSubmitGroup} loading={isSubmitting} />
        </>
      ) : (
        <>
          <Text style={[styles.label, styles.section]}>Team Name</Text>
          <TextField
            style={styles.input}
            placeholder="e.g. Real Madrid FC"
            value={tName}
            onChangeText={setTName}
            maxLength={NAME_MAX_LENGTH}
            editable={!isSubmitting}
          />

          <Text style={[styles.label, styles.section]}>Sport</Text>
          {sportOptions.length === 0 ? (
            <Text style={styles.hint}>No sports are available right now.</Text>
          ) : (
            <OptionChips options={sportOptions} value={tSport} onChange={setTSport} disabled={isSubmitting} />
          )}

          <Text style={[styles.label, styles.section]}>Visibility</Text>
          <OptionChips
            options={TEAM_VISIBILITY_OPTIONS}
            value={tVisibility}
            onChange={setTVisibility}
            disabled={isSubmitting}
          />

          {error ? (
            <Text style={styles.error} accessibilityRole="alert">
              {error}
            </Text>
          ) : null}

          <Button label="Create Team" onPress={handleSubmitTeam} loading={isSubmitting} />
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg },
  label: { ...typography.bodyBold, color: colors.textPrimary, marginBottom: spacing.xs },
  section: { marginTop: spacing.md },
  input: { marginBottom: spacing.md },
  multiline: { minHeight: spacing.xxl * 2 },
  hint: { ...typography.caption, color: colors.textMuted, marginBottom: spacing.md },
  error: { ...typography.body, color: colors.error, marginBottom: spacing.md },
});
