/**
 * First-run step 1: sport skill levels (DES-MEETUP-ADDENDUM-profile-
 * onboarding.md AD-5, §4.3). Uses the EXISTING skill-level endpoints
 * (`getSkillLevels`, `updateSkillLevel`) and the admin sports list
 * (`GET /admin/sports/public`). Tapping the selected level again unselects it.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { withCorrelationId } from '../../api/correlationId';
import { getSkillLevels, updateSkillLevel } from '../../api/profile';
import { getSports } from '../../api/sports';
import { colors, spacing, typography } from '../../theme/tokens';
import type { Sport } from '../../types/sport';
import type { SkillLevelValue } from '../../types/user';
import Button from '../Button';
import LoadingView from '../LoadingView';
import OptionChips from '../OptionChips';
import type { ChipOption } from '../OptionChips';
import StepFooter from './StepFooter';

const LEVELS: ChipOption<SkillLevelValue>[] = [
  { value: 'Beginner', label: 'Beginner' },
  { value: 'Intermediate', label: 'Intermediate' },
  { value: 'Expert', label: 'Expert' },
];

interface SkillsStepProps {
  onDone: () => void;
}

export default function SkillsStep({ onDone }: SkillsStepProps): React.JSX.Element {
  const [sports, setSports] = useState<Sport[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [existing, setExisting] = useState<Record<string, SkillLevelValue>>({});
  const [chosen, setChosen] = useState<Record<string, SkillLevelValue>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadFailed(false);
    setSports(null);
    try {
      const [sportList, levels] = await withCorrelationId(correlationId =>
        Promise.all([getSports({ correlationId }), getSkillLevels({ correlationId })]),
      );
      const current: Record<string, SkillLevelValue> = {};
      for (const row of levels) {
        current[row.sport.trim().toLowerCase()] = row.skill_level;
      }
      setExisting(current);
      setChosen(current);
      setSports(sportList);
    } catch {
      setLoadFailed(true);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleSave = async (): Promise<void> => {
    const changes = Object.entries(chosen).filter(([sport, level]) => existing[sport] !== level);
    if (changes.length === 0) {
      onDone();
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await withCorrelationId(async correlationId => {
        for (const [sport, level] of changes) {
          await updateSkillLevel(sport, level, { correlationId });
        }
      });
      onDone();
    } catch {
      setError('Could not save your skill levels. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loadFailed) {
    return (
      <View style={styles.centered}>
        <Text style={styles.error} accessibilityRole="alert">
          Could not load sports.
        </Text>
        <Button label="Retry" onPress={load} />
        <StepFooter onSave={onDone} onSkip={onDone} saveLabel="Save" />
      </View>
    );
  }
  if (sports === null) {
    return <LoadingView />;
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.lead}>Pick your level for the sports you play. You can change this any time in Profile.</Text>
      {sports.map(sport => {
        const key = sport.name.trim().toLowerCase();
        return (
          <View key={sport.name} style={styles.sportBlock}>
            <Text style={styles.sportName}>{sport.display_name}</Text>
            <OptionChips
              options={LEVELS}
              value={chosen[key] ?? null}
              onChange={level =>
                setChosen(current => {
                  const next = { ...current };
                  if (next[key] === level) {
                    delete next[key];
                  } else {
                    next[key] = level;
                  }
                  return next;
                })
              }
              disabled={saving}
            />
          </View>
        );
      })}
      <StepFooter onSave={handleSave} onSkip={onDone} saving={saving} error={error} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.md },
  centered: { padding: spacing.md },
  lead: { ...typography.body, color: colors.textSecondary, marginBottom: spacing.md },
  sportBlock: { marginBottom: spacing.md },
  sportName: { ...typography.bodyBold, color: colors.textPrimary, marginBottom: spacing.xs },
  error: { ...typography.body, color: colors.error, marginBottom: spacing.sm },
});
