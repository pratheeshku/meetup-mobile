/**
 * Results file for the committee, after publication (AD-T12; board TV2MobSetupResultsFile; web reference `cnDownload`,
 * `cnUpload`). Optional: per-match entry stays the main path. Download the scoring workbook to the system share sheet,
 * pick the filled .xlsx from Files and upload it; the summary shows posted, corrected and unchanged counts; a refusal
 * lists its rows (`WORKBOOK_STALE` asks for a fresh download, `CORRECTION_NEEDS_APPROVAL` rows point to the correction
 * flow). A saved upload refreshes the board in place. The winner of each match is derived by the server from the sets.
 */
import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { withCorrelationId } from '../../../../api/correlationId';
import { uploadResultsFile } from '../../../../api/tournaments';
import { useT } from '../../../../labels/LabelsContext';
import { dash } from '../../../../theme/dashboardTheme';
import { colors, spacing, typography } from '../../../../theme/tokens';
import type { ScoringMatch } from '../../../../types/tournamentScoring';
import type { UploadRefusal } from '../../../../types/tournamentTabs';
import { discardPicked, downloadAndShare, pickWorkbook, XLSX_MIME, type PickedWorkbook } from '../../../../utils/fileTransfer';
import { readUploadRefusal } from '../../../../utils/fixturesSetup';
import Button from '../../../Button';
import RefusalList from './RefusalList';
import { TabCard } from './parts';
import WorkbookPicker from './WorkbookPicker';

export default function ResultsFileCard(props: {
  tournamentId: string;
  fileStem: string;
  /** Matches of the board, to name the players of a refused row. */
  matches: ScoringMatch[];
  /** The upload was saved: the host reloads the board in place. */
  onUploaded: () => void;
}): React.JSX.Element {
  const t = useT();
  const [file, setFile] = useState<PickedWorkbook | null>(null);
  const [busy, setBusy] = useState<'download' | 'upload' | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [refusal, setRefusal] = useState<UploadRefusal | null>(null);

  const matchName = (matchId: string): string | null => {
    const hit = props.matches.find(m => m.match_id === matchId);
    return hit && hit.side_a.name && hit.side_b.name ? t('mob.tournament.fixtures.match_label', { a: hit.side_a.name, b: hit.side_b.name }) : null;
  };

  const download = async (): Promise<void> => {
    setBusy('download');
    setFailed(null);
    try {
      await withCorrelationId(correlationId =>
        downloadAndShare(`/tournaments/${props.tournamentId}/fixtures/workbook`, `${props.fileStem}-scoring.xlsx`, correlationId),
      );
    } catch {
      setFailed(t('mob.scoring.download.failed'));
    } finally {
      setBusy(null);
    }
  };

  const choose = async (): Promise<void> => {
    try {
      const picked = await pickWorkbook();
      if (picked) {
        if (file) {
          await discardPicked(file.uri);
        }
        setFile(picked);
        setSaved(null);
        setFailed(null);
        setRefusal(null);
      }
    } catch {
      setFailed(t('mob.scoring.error.generic'));
    }
  };

  const upload = async (): Promise<void> => {
    if (!file) {
      return;
    }
    setBusy('upload');
    setSaved(null);
    setFailed(null);
    setRefusal(null);
    try {
      const summary = await withCorrelationId(correlationId =>
        uploadResultsFile(props.tournamentId, { uri: file.uri, name: file.name, type: XLSX_MIME }, { correlationId }),
      );
      setSaved(t('mob.scoring.results.upload_ok', { ...summary }));
      await discardPicked(file.uri);
      setFile(null);
      props.onUploaded();
    } catch (e) {
      const parsed = readUploadRefusal(e);
      if (parsed.status === 0) {
        setFailed(t('mob.scoring.error.generic'));
      } else {
        setRefusal(parsed);
      }
    } finally {
      setBusy(null);
    }
  };

  return (
    <TabCard testID="results-file">
      <Text style={styles.title} accessibilityRole="header">
        {t('mob.scoring.results.step_workbook')}
      </Text>
      <Text style={styles.body}>{t('mob.scoring.results.workbook_intro')}</Text>
      <Button label={t('mob.scoring.results.download_workbook')} variant="secondary" onPress={download} loading={busy === 'download'} style={styles.button} testID="results-file-download" />
      <Text style={[styles.title, styles.second]} accessibilityRole="header">
        {t('mob.scoring.results.step_upload')}
      </Text>
      {file ? (
        <WorkbookPicker file={file} onChange={choose} testID="results-file-picked" />
      ) : (
        <Button label={t('mob.scoring.results.upload_label')} variant="secondary" onPress={choose} style={styles.button} testID="results-file-choose" />
      )}
      {file ? <Button label={t('mob.scoring.results.upload')} onPress={upload} loading={busy === 'upload'} style={styles.button} testID="results-file-upload" /> : null}
      {saved ? (
        <Text style={styles.ok} accessibilityRole="alert" testID="results-file-saved">
          {saved}
        </Text>
      ) : null}
      {failed ? (
        <Text style={styles.bad} accessibilityRole="alert">
          {failed}
        </Text>
      ) : null}
      {refusal ? <RefusalList refusal={refusal} matchName={matchName} /> : null}
      <View />
    </TabCard>
  );
}

const styles = StyleSheet.create({
  title: { ...typography.h3, color: dash.text },
  second: { marginTop: spacing.md },
  body: { ...typography.body, color: dash.textMuted, marginTop: spacing.xs },
  button: { marginTop: spacing.sm, alignSelf: 'stretch' },
  ok: { ...typography.bodyBold, color: colors.successDark, marginTop: spacing.sm },
  bad: { ...typography.bodyBold, color: colors.error, marginTop: spacing.sm },
});
