/**
 * The picked workbook row of the boards (TV2MobSetupPoints, TV2MobSetupResultsFile): a fixed "XLS" tile, the file name and
 * size, and a Change action. Pure display; the screens own the picking and the upload.
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useT } from '../../../../labels/LabelsContext';
import { dash } from '../../../../theme/dashboardTheme';
import { colors, radius, spacing, typography } from '../../../../theme/tokens';
import type { PickedWorkbook } from '../../../../utils/fileTransfer';

const TILE = 44;

export default function WorkbookPicker({
  file,
  onChange,
  testID,
}: {
  file: PickedWorkbook;
  onChange: () => void;
  testID?: string;
}): React.JSX.Element {
  const t = useT();
  return (
    <View style={styles.row} testID={testID}>
      <View style={styles.tile}>
        <Text style={styles.tileText}>{t('mob.tournament.setup.file_tile')}</Text>
      </View>
      <View style={styles.text}>
        <Text style={styles.name} numberOfLines={2}>
          {file.name}
        </Text>
        {file.size !== null ? <Text style={styles.size}>{t('mob.tournament.setup.file_size', { kb: Math.max(1, Math.round(file.size / 1024)) })}</Text> : null}
      </View>
      <Pressable accessibilityRole="button" onPress={onChange} style={styles.change} testID={testID ? `${testID}-change` : undefined}>
        <Text style={styles.changeText}>{t('mob.common.change')}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: dash.page, borderRadius: radius.md, padding: spacing.sm, marginTop: spacing.sm },
  tile: { width: TILE, height: TILE, borderRadius: radius.md, backgroundColor: colors.successLight, alignItems: 'center', justifyContent: 'center' },
  tileText: { ...typography.label, color: colors.successDark },
  text: { flex: 1, minWidth: 0, marginLeft: spacing.sm },
  name: { ...typography.bodyBold, color: dash.text },
  size: { ...typography.caption, color: dash.textMuted },
  change: { minHeight: 44, minWidth: 44, justifyContent: 'center', paddingHorizontal: spacing.sm },
  changeText: { ...typography.bodyBold, color: dash.brand },
});
