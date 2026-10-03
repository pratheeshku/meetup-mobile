/**
 * Bottom sheet for ONE sport: the level card, Save, and the existing delete
 * action. The caller owns persistence and the delete confirmation; `error`
 * (including the backend's tournament-lock 409 text on delete) shows inside
 * the sheet. Captions are supplied by the caller.
 */
import React, { useState } from 'react';
import { StyleSheet, Text } from 'react-native';

import { colors, spacing, typography } from '../../theme/tokens';
import type { SkillLevelValue } from '../../types/user';
import { useSportDisplayName } from '../../utils/labels';
import Button from '../Button';
import BottomSheet from './BottomSheet';
import LevelPerSportCard from './LevelPerSportCard';

interface SportLevelSheetProps {
  sport: string;
  initialLevel: SkillLevelValue;
  saving: boolean;
  deleting: boolean;
  error: string | null;
  saveLabel: string;
  deleteLabel: string;
  closeLabel: string;
  onSave: (level: SkillLevelValue) => void;
  onDelete: (sportLabel: string) => void;
  onClose: () => void;
}

export default function SportLevelSheet({
  sport,
  initialLevel,
  saving,
  deleting,
  error,
  saveLabel,
  deleteLabel,
  closeLabel,
  onSave,
  onDelete,
  onClose,
}: SportLevelSheetProps): React.JSX.Element {
  const sportLabel = useSportDisplayName(sport);
  const [level, setLevel] = useState<SkillLevelValue>(initialLevel);
  const busy = saving || deleting;
  return (
    <BottomSheet onClose={onClose} closeLabel={closeLabel}>
      <LevelPerSportCard
        sport={sport}
        sportLabel={sportLabel}
        value={level}
        onChange={setLevel}
        disabled={busy}
      />
      {error ? (
        <Text style={styles.error} accessibilityRole="alert">
          {error}
        </Text>
      ) : null}
      <Button label={saveLabel} onPress={() => onSave(level)} loading={saving} disabled={deleting} />
      <Button
        label={deleteLabel}
        variant="destructive"
        onPress={() => onDelete(sportLabel)}
        loading={deleting}
        disabled={saving}
        style={styles.delete}
      />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  error: { ...typography.body, color: colors.error, marginBottom: spacing.sm, textAlign: 'center' },
  delete: { marginTop: spacing.sm },
});
