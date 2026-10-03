/**
 * SportPicker -> one LevelPerSportCard per selected sport -> Save. Shared by
 * the first-run Skills step and Profile "Add sport". No default level: Save
 * with any selected sport still unlevelled shows an inline hint and does not
 * call `onSave`. Button captions and the error text are supplied by the
 * caller (screens own those strings); everything else comes from labels.
 */
import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { getLabel, useLabels } from '../../labels/LabelsContext';
import { colors, spacing, typography } from '../../theme/tokens';
import type { Sport } from '../../types/sport';
import type { SkillLevelValue } from '../../types/user';
import Button from '../Button';
import TextLink from '../TextLink';
import LevelPerSportCard from './LevelPerSportCard';
import SportPicker from './SportPicker';

export type SkillLevelMap = Record<string, SkillLevelValue>;

interface SkillLevelFlowProps {
  /** Sports the user may pick from (the caller filters out ones already set). */
  sports: readonly Sport[];
  /** Pre-selected sports with their current levels, keyed by `Sport.name`. */
  initialLevels?: SkillLevelMap;
  saving?: boolean;
  error?: string | null;
  nextLabel: string;
  backLabel: string;
  saveLabel: string;
  /** Called with a level for every selected sport. */
  onSave: (levels: SkillLevelMap) => void;
  /** Extra controls under the primary button (e.g. onboarding's Skip). */
  footer?: React.ReactNode;
}

export default function SkillLevelFlow({
  sports,
  initialLevels,
  saving = false,
  error,
  nextLabel,
  backLabel,
  saveLabel,
  onSave,
  footer,
}: SkillLevelFlowProps): React.JSX.Element {
  const labels = useLabels();
  const [phase, setPhase] = useState<'sports' | 'levels'>('sports');
  const [levels, setLevels] = useState<SkillLevelMap>(() => {
    const start: SkillLevelMap = {};
    for (const sport of sports) {
      const level = initialLevels?.[sport.name];
      if (level) {
        start[sport.name] = level;
      }
    }
    return start;
  });
  const [selected, setSelected] = useState<string[]>(() => Object.keys(levels));
  const [showHint, setShowHint] = useState(false);

  const chosen = sports.filter(sport => selected.includes(sport.name));
  const missing = chosen.filter(sport => !levels[sport.name]);

  const toggle = (name: string): void => {
    setShowHint(false);
    if (selected.includes(name)) {
      setSelected(current => current.filter(item => item !== name));
      setLevels(current => {
        const next = { ...current };
        delete next[name];
        return next;
      });
    } else {
      setSelected(current => [...current, name]);
    }
  };

  const handleSave = (): void => {
    if (missing.length > 0) {
      setShowHint(true);
      return;
    }
    onSave(Object.fromEntries(chosen.map(sport => [sport.name, levels[sport.name]])));
  };

  if (phase === 'sports') {
    return (
      <View>
        <Text style={styles.title} accessibilityRole="header">
          {getLabel(labels, 'mob_skill_sports_title')}
        </Text>
        <Text style={styles.subtitle}>{getLabel(labels, 'mob_skill_sports_subtitle')}</Text>
        <SportPicker sports={sports} selected={selected} onToggle={toggle} disabled={saving} />
        <Button
          label={nextLabel}
          onPress={() => setPhase('levels')}
          disabled={chosen.length === 0}
        />
        {footer}
      </View>
    );
  }

  return (
    <View>
      <Text style={styles.title} accessibilityRole="header">
        {getLabel(labels, 'mob_skill_level_title')}
      </Text>
      <Text style={styles.subtitle}>{getLabel(labels, 'mob_skill_level_subtitle')}</Text>
      {chosen.map(sport => (
        <LevelPerSportCard
          key={sport.name}
          sport={sport.name}
          sportLabel={sport.display_name}
          value={levels[sport.name] ?? null}
          onChange={level => {
            setShowHint(false);
            setLevels(current => ({ ...current, [sport.name]: level }));
          }}
          invalid={showHint}
          disabled={saving}
        />
      ))}
      {showHint && missing.length > 0 ? (
        <Text style={styles.error} accessibilityRole="alert">
          {getLabel(labels, 'mob_skill_pick_level_hint')}
        </Text>
      ) : null}
      {error ? (
        <Text style={styles.error} accessibilityRole="alert">
          {error}
        </Text>
      ) : null}
      <Button label={saveLabel} onPress={handleSave} loading={saving} />
      <TextLink
        label={backLabel}
        onPress={() => setPhase('sports')}
        disabled={saving}
        style={styles.back}
      />
      {footer}
    </View>
  );
}

const styles = StyleSheet.create({
  title: { ...typography.h2, color: colors.textPrimary, marginBottom: spacing.xs },
  subtitle: { ...typography.body, color: colors.textSecondary, marginBottom: spacing.md },
  error: { ...typography.body, color: colors.error, marginBottom: spacing.sm, textAlign: 'center' },
  back: { alignSelf: 'center', marginTop: spacing.sm },
});
