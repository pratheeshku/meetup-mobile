/**
 * Entry row on the tournament view to the standings, results and bracket screen. It appears only
 * when `GET /tournaments/{id}/scoring/state` says scoring is enabled and applies to this tournament.
 * Any other answer (off, not applicable, 404, error) renders nothing, so v1 tournaments and
 * tournaments without scoring look exactly as before.
 */
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text } from 'react-native';

import { getTournamentScoringState } from '../../api/tournaments';
import { useT } from '../../labels/LabelsContext';
import { colors, spacing, typography } from '../../theme/tokens';
import Card from '../Card';

interface Props {
  tournamentId: string;
  onOpen: () => void;
}

export default function TournamentScoringEntry({
  tournamentId,
  onOpen,
}: Props): React.JSX.Element | null {
  const t = useT();
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const state = await getTournamentScoringState(tournamentId);
        if (active) {
          setAvailable(Boolean(state && state.enabled && state.applicable));
        }
      } catch {
        if (active) {
          setAvailable(false);
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [tournamentId]);

  if (!available) {
    return null;
  }
  return (
    <Card style={styles.card} onPress={onOpen} testID="tournament-scoring-entry">
      <Text style={styles.title} accessibilityRole="header">
        {t('mob.scoring.entry_title')}
      </Text>
      <Text style={styles.hint}>{t('mob.scoring.entry_hint')}</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: spacing.md },
  title: { ...typography.h3, color: colors.textPrimary },
  hint: { ...typography.caption, color: colors.textMuted, marginTop: spacing.xs },
});
