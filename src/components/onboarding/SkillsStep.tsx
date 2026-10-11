/**
 * First-run step 1: sport skill levels (DES-MEETUP-ADDENDUM-profile-
 * onboarding.md AD-5, §4.3). Uses the EXISTING skill-level endpoints
 * (`getSkillLevels`, `updateSkillLevel`) and the admin sports list
 * (`GET /admin/sports/public`). The UI is the shared `SkillLevelFlow`
 * (sport tiles -> one level card per sport); only changed levels are sent.
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
import SkillLevelFlow from '../skills/SkillLevelFlow';
import type { SkillLevelMap } from '../skills/SkillLevelFlow';
import StepFooter from './StepFooter';
import { useT } from '../../labels/LabelsContext';

interface SkillsStepProps {
  onDone: (outcome: 'saved' | 'skipped') => void;
}

const storageKey = (sport: Sport | string): string =>
  (typeof sport === 'string' ? sport : sport.name).trim().toLowerCase();

export default function SkillsStep({ onDone }: SkillsStepProps): React.JSX.Element {
  const t = useT();
  const [sports, setSports] = useState<Sport[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [existing, setExisting] = useState<Record<string, SkillLevelValue>>({});
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
        current[storageKey(row.sport)] = row.skill_level;
      }
      setExisting(current);
      setSports(sportList);
    } catch {
      setLoadFailed(true);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleSave = async (chosen: SkillLevelMap): Promise<void> => {
    const changes = Object.entries(chosen)
      .map(([name, level]) => [storageKey(name), level] as const)
      .filter(([sport, level]) => existing[sport] !== level);
    if (changes.length === 0) {
      onDone('saved');
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
      onDone('saved');
    } catch {
      setError(t('mob.onboarding.skills_save_error'));
    } finally {
      setSaving(false);
    }
  };

  if (loadFailed) {
    return (
      <View style={styles.centered}>
        <Text style={styles.error} accessibilityRole="alert">
          {t('mob.onboarding.sports_load_error')}
        </Text>
        <Button label={t('mob.common.retry')} onPress={load} />
        <StepFooter onSave={() => onDone('saved')} onSkip={() => onDone('skipped')} saveLabel={t('mob.common.save')} />
      </View>
    );
  }
  if (sports === null) {
    return <LoadingView />;
  }

  const initialLevels: SkillLevelMap = {};
  for (const sport of sports) {
    const level = existing[storageKey(sport)];
    if (level) {
      initialLevels[sport.name] = level;
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <SkillLevelFlow
        sports={sports}
        initialLevels={initialLevels}
        saving={saving}
        error={error}
        nextLabel={t('mob.common.next')}
        backLabel={t('mob.common.back')}
        saveLabel={t('mob.common.save')}
        onSave={handleSave}
        footer={<Button label={t('mob.common.skip')} variant="secondary" onPress={() => onDone('skipped')} disabled={saving} style={styles.skip} />}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.md },
  centered: { padding: spacing.md },
  error: { ...typography.body, color: colors.error, marginBottom: spacing.sm },
  skip: { marginTop: spacing.sm },
});
