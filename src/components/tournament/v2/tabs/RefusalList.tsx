/**
 * The refusal of an upload, in words (boards TV2MobSetupPointsErr, TV2MobSetupResultsFile): the headline ("nothing was
 * saved" for a refused file), then every row with its row number, column and the label of its reason code. Rows that name
 * a match are shown with the players' names, never an id. State is carried by the words and the glyph, not by colour alone.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useT } from '../../../../labels/LabelsContext';
import { colors, radius, spacing, typography } from '../../../../theme/tokens';
import type { UploadRefusal, UploadRow } from '../../../../types/tournamentTabs';
import { errLabelKey, refusalView } from '../../../../utils/fixturesSetup';
import { CrossIcon } from '../../../icons/ActionIcons';

const GLYPH = 20;

export default function RefusalList({
  refusal,
  matchName,
}: {
  refusal: UploadRefusal;
  /** The players of a match named by a row (`match_id`), from the board; null when unknown. */
  matchName?: (matchId: string) => string | null;
}): React.JSX.Element {
  const t = useT();
  const view = refusalView(refusal);

  const rowText = (row: UploadRow): string => {
    const message = t(errLabelKey(row.code));
    const who = row.matchId ? matchName?.(row.matchId) : null;
    const body = who ? `${who}: ${message}` : message;
    if (row.row === null) {
      return row.sheet ? t('mob.scoring.error.sheet', { sheet: row.sheet, message: body }) : body;
    }
    return row.column
      ? t('mob.scoring.error.row', { row: row.row, column: row.column, message: body })
      : t('mob.scoring.error.row_nocol', { row: row.row, message: body });
  };
  const hint = (row: UploadRow): string | null => (row.code === 'CORRECTION_NEEDS_APPROVAL' ? t('mob.scoring.results.needs_approval_hint') : null);

  return (
    <View style={styles.box} accessibilityRole="alert" testID="upload-refusal">
      <View style={styles.head}>
        <View style={styles.glyph}>
          <CrossIcon size={16} color={colors.error} />
        </View>
        <Text style={styles.headline}>{view.headlineKey ? t(view.headlineKey) : view.headlineText}</Text>
      </View>
      {[...view.fileLevel, ...view.sections.flatMap(section => section.rows)].map((row, index) => (
        <View key={`${row.sheet}-${row.row}-${row.code}-${index}`} style={styles.row}>
          <Text style={styles.rowText}>{`• ${rowText(row)}`}</Text>
          {hint(row) ? <Text style={styles.hint}>{hint(row)}</Text> : null}
        </View>
      ))}
      {view.more > 0 ? <Text style={styles.more}>{t('mob.scoring.error.more', { count: view.more })}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { backgroundColor: colors.errorLight, borderRadius: radius.md, borderWidth: 1, borderColor: colors.error, padding: spacing.md, marginTop: spacing.sm },
  head: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: spacing.xs },
  glyph: { width: GLYPH, height: GLYPH, alignItems: 'center', justifyContent: 'center' },
  headline: { ...typography.bodyBold, color: colors.error, flex: 1, marginLeft: spacing.xs },
  row: { marginTop: spacing.xs },
  rowText: { ...typography.body, color: colors.error },
  hint: { ...typography.caption, color: colors.error, marginLeft: spacing.md },
  more: { ...typography.caption, color: colors.error, marginTop: spacing.sm },
});
