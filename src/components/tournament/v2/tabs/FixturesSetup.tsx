/**
 * Fixtures setup for the committee, before publication (AD-T12; boards TV2MobSetupPoints, TV2MobSetupPointsErr,
 * TV2MobSetupDraw, TV2MobSetupSubmit; web reference `cnDownload`, `cnUpload`, `cnGenerate`, `cnSubmit`). Four steps:
 * (1) download the points template to the system share sheet; (2) pick the filled .xlsx from Files and upload it
 * (all or nothing: a 422 lists the rows and says nothing was saved); (3) choose the number of groups and how many
 * advance (only values the server allows, read from the draw options) and generate; the draft is shown with its groups,
 * seeds, match counts and version, and replacing an open draft is confirmed; (4) submit for review, with the waiting
 * state read from the server's request list, never from local state alone.
 *
 * The draw, the seeds and the draft are the server's: nothing here builds, ranks or seeds. Registration ids of the draft
 * are shown as names from the participants the page already loads; an id is never shown. Role checks are UX only.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { withCorrelationId } from '../../../../api/correlationId';
import {
  generateFixtureDraft,
  getCommitteeActions,
  getFixtureDraft,
  submitFixturePublication,
  uploadPoints,
} from '../../../../api/tournaments';
import { useT } from '../../../../labels/LabelsContext';
import type { LabelKey } from '../../../../labels/fallbackLabels';
import { dash } from '../../../../theme/dashboardTheme';
import { borderWidth, colors, radius, spacing, typography } from '../../../../theme/tokens';
import type { CommitteeSetup } from '../../../../types/tournamentScoring';
import type { DraftDetail, UploadRefusal } from '../../../../types/tournamentTabs';
import { discardPicked, downloadAndShare, pickWorkbook, XLSX_MIME, type PickedWorkbook } from '../../../../utils/fileTransfer';
import {
  drawChoice,
  errLabelKey,
  publicationPending,
  readUploadRefusal,
} from '../../../../utils/fixturesSetup';
import { formatDayShort, formatClock } from '../../../../utils/tournamentExperience';
import Button from '../../../Button';
import { CheckIcon } from '../../../icons/ActionIcons';
import RefusalList from './RefusalList';
import { CardHead, Chip, CommitteeNote, TabCard } from './parts';
import WorkbookPicker from './WorkbookPicker';

const STEP = 28;

export interface FixturesSetupProps {
  tournamentId: string;
  /** File name stem for downloads, from the tournament's title (never an id). */
  fileStem: string;
  /** The server's `committee` block of `scoring/state` (points, latest draft, draw options). */
  setup: CommitteeSetup | null;
  /** `registration_phase`: the template, the upload and the draw need `frozen`. */
  phase: string | null;
  /** Registration id (lower case) to display name, from the registrations the page loads. */
  names: ReadonlyMap<string, string>;
  /** Something changed on the server (points, draft, submission): the host reads the scoring state again. */
  onChanged: () => void;
}

type Note = { ok: boolean; text?: string; refusal?: UploadRefusal } | null;

function Step({ n, done, title }: { n: number; done?: boolean; title: string }): React.JSX.Element {
  return (
    <View style={styles.stepHead}>
      <View style={[styles.stepDot, done ? styles.stepDone : null]}>
        {done ? <CheckIcon size={16} color={colors.white} /> : <Text style={styles.stepNum}>{n}</Text>}
      </View>
      <Text style={styles.stepTitle} accessibilityRole="header">
        {title}
      </Text>
    </View>
  );
}

function Choice({
  options,
  value,
  label,
  onPick,
  testID,
}: {
  options: number[];
  value: number | null;
  label: (n: number) => string;
  onPick: (n: number) => void;
  testID: string;
}): React.JSX.Element {
  return (
    <View style={styles.choices}>
      {options.map(n => (
        <Pressable
          key={n}
          accessibilityRole="button"
          accessibilityState={{ selected: value === n }}
          onPress={() => onPick(n)}
          style={[styles.choice, value === n ? styles.choiceOn : null]}
          testID={`${testID}-${n}`}
        >
          <Text style={[styles.choiceText, value === n ? styles.choiceTextOn : null]}>{label(n)}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export default function FixturesSetup(props: FixturesSetupProps): React.JSX.Element {
  const t = useT();
  const { setup, tournamentId } = props;
  const frozen = props.phase === 'frozen';
  const points = setup?.points ?? null;
  const latest = setup?.latest_draft ?? null;
  const openDraft = latest && latest.status === 'draft' ? latest : null;

  const [file, setFile] = useState<PickedWorkbook | null>(null);
  const [pointsNote, setPointsNote] = useState<Note>(null);
  const [downloadNote, setDownloadNote] = useState<string | null>(null);
  const [pick, setPick] = useState<{ groupCount: number | null; advance: number | null }>({ groupCount: null, advance: null });
  const [generateNote, setGenerateNote] = useState<Note>(null);
  const [submitNote, setSubmitNote] = useState<Note>(null);
  const [busy, setBusy] = useState<'download' | 'upload' | 'generate' | 'submit' | null>(null);
  const [draft, setDraft] = useState<DraftDetail | null>(null);
  const [pending, setPending] = useState<{ pending: boolean; createdAt: string | null }>({ pending: false, createdAt: null });

  const draftId = latest?.draft_id ?? null;

  // The draft and the waiting state are read from the server whenever the latest draft changes (never kept locally).
  const loadDraft = useCallback(async (): Promise<void> => {
    if (!draftId) {
      setDraft(null);
      setPending({ pending: false, createdAt: null });
      return;
    }
    try {
      await withCorrelationId(async correlationId => {
        const [detail, requests] = await Promise.all([
          getFixtureDraft(tournamentId, draftId, { correlationId }),
          getCommitteeActions(tournamentId, { correlationId }).catch(() => []),
        ]);
        setDraft(detail);
        setPending(publicationPending(requests, draftId));
      });
    } catch {
      setDraft(null);
    }
  }, [tournamentId, draftId]);

  useEffect(() => {
    loadDraft();
  }, [loadDraft]);

  const choice = drawChoice(setup?.group_options ?? null, latest, pick);

  const refusalNote = (e: unknown): Note => {
    const refusal = readUploadRefusal(e);
    return refusal.status === 0 ? { ok: false, text: t('mob.scoring.error.generic') } : { ok: false, refusal };
  };

  const download = async (): Promise<void> => {
    setBusy('download');
    setDownloadNote(null);
    try {
      await withCorrelationId(correlationId =>
        downloadAndShare(`/tournaments/${tournamentId}/points/template`, `${props.fileStem}-points.xlsx`, correlationId),
      );
    } catch {
      setDownloadNote(t('mob.scoring.download.failed'));
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
        setPointsNote(null);
      }
    } catch {
      setPointsNote({ ok: false, text: t('mob.scoring.error.generic') });
    }
  };

  const upload = async (): Promise<void> => {
    if (!file) {
      setPointsNote({ ok: false, text: t('mob.scoring.draw.choose_file') });
      return;
    }
    setBusy('upload');
    setPointsNote(null);
    try {
      const accepted = await withCorrelationId(correlationId =>
        uploadPoints(tournamentId, { uri: file.uri, name: file.name, type: XLSX_MIME }, { correlationId }),
      );
      setPointsNote({ ok: true, text: t('mob.scoring.draw.upload_ok', { ...accepted }) });
      await discardPicked(file.uri);
      setFile(null);
      props.onChanged();
    } catch (e) {
      setPointsNote(refusalNote(e));
    } finally {
      setBusy(null);
    }
  };

  const runGenerate = async (): Promise<void> => {
    if (choice.advance === null) {
      return;
    }
    setBusy('generate');
    setGenerateNote(null);
    setSubmitNote(null);
    try {
      await withCorrelationId(correlationId =>
        generateFixtureDraft(tournamentId, { group_count: choice.groupCount, advance_per_group: choice.advance as number }, { correlationId }),
      );
      setGenerateNote({ ok: true, text: t('mob.scoring.draw.generated_ok') });
      props.onChanged();
    } catch (e) {
      setGenerateNote(refusalNote(e));
    } finally {
      setBusy(null);
    }
  };

  const generate = (): void => {
    if (openDraft) {
      Alert.alert(t('mob.scoring.draw.regenerate_confirm', { version: openDraft.version }), undefined, [
        { text: t('mob.common.cancel'), style: 'cancel' },
        { text: t('mob.scoring.draw.regenerate'), onPress: runGenerate },
      ]);
      return;
    }
    runGenerate();
  };

  const runSubmit = async (): Promise<void> => {
    if (!latest) {
      return;
    }
    setBusy('submit');
    setSubmitNote(null);
    try {
      await withCorrelationId(correlationId => submitFixturePublication(tournamentId, latest.draft_id, latest.payload_hash, { correlationId }));
      setSubmitNote({ ok: true, text: t('mob.scoring.draw.submitted_ok') });
      await loadDraft();
      props.onChanged();
    } catch (e) {
      setSubmitNote(refusalNote(e));
    } finally {
      setBusy(null);
    }
  };

  const submit = (): void => {
    Alert.alert(t('mob.scoring.draw.submit_confirm'), undefined, [
      { text: t('mob.common.cancel'), style: 'cancel' },
      { text: t('mob.scoring.draw.submit'), onPress: runSubmit },
    ]);
  };

  const unknownEntry = t('mob.scoring.unknown_entry');

  const noteView = (note: Note): React.JSX.Element | null =>
    note ? (
      note.refusal ? (
        <RefusalList refusal={note.refusal} />
      ) : (
        <Text style={[styles.note, note.ok ? styles.noteOk : styles.noteBad]} accessibilityRole="alert">
          {note.text}
        </Text>
      )
    ) : null;

  const blockedKey: LabelKey | null = !frozen ? errLabelKey('REGISTRATION_NOT_FROZEN') : null;
  const generateBlocked: LabelKey | null = blockedKey
    ? blockedKey
    : !points
      ? errLabelKey('POINTS_REQUIRED')
      : choice.groupCounts.length === 0 || choice.advanceOptions.length === 0
        ? 'mob.scoring.draw.blocked.no_options'
        : null;
  const pointsLocked = Boolean(points?.locked);

  return (
    <View testID="fixtures-setup">
      <CommitteeNote text={t('mob.tournament.fixtures.setup_note')} />
      {blockedKey ? (
        <TabCard>
          <Text style={styles.body}>{t(blockedKey)}</Text>
        </TabCard>
      ) : null}

      <TabCard testID="setup-points">
        <Step n={1} done={Boolean(points)} title={t('mob.scoring.draw.step_points')} />
        <Text style={styles.body}>{t('mob.scoring.draw.points_intro')}</Text>
        <Button
          label={t('mob.scoring.draw.download_template')}
          onPress={download}
          loading={busy === 'download'}
          disabled={!frozen}
          style={styles.button}
          testID="setup-download"
        />
        {downloadNote ? <Text style={[styles.note, styles.noteBad]}>{downloadNote}</Text> : null}
        <Text style={styles.body}>
          {points
            ? t('mob.scoring.draw.points_on_file', {
                entrants: points.entrants,
                rated: points.rated,
                unrated: points.unrated,
                when: points.uploaded_at ? `${formatDayShort(points.uploaded_at)} ${formatClock(points.uploaded_at)}` : '',
              })
            : t('mob.scoring.draw.points_none')}
        </Text>
        {pointsLocked ? <Text style={styles.body}>{t('mob.scoring.err.POINTS_LOCKED')}</Text> : null}
        {!pointsLocked ? (
          <>
            {file ? (
              <WorkbookPicker file={file} onChange={choose} testID="setup-file" />
            ) : (
              <Button label={t('mob.scoring.draw.upload_label')} variant="secondary" onPress={choose} disabled={!frozen} style={styles.button} testID="setup-choose" />
            )}
            {file ? (
              <Button label={t('mob.scoring.draw.upload')} onPress={upload} loading={busy === 'upload'} style={styles.button} testID="setup-upload" />
            ) : null}
          </>
        ) : null}
        {noteView(pointsNote)}
      </TabCard>

      <TabCard testID="setup-draw">
        <Step n={2} done={Boolean(openDraft)} title={t('mob.scoring.draw.step_options')} />
        {generateBlocked ? <Text style={styles.body}>{t(generateBlocked)}</Text> : null}
        {!generateBlocked ? (
          <>
            <Text style={styles.label}>{t('mob.scoring.draw.group_count')}</Text>
            <Choice
              options={choice.groupCounts}
              value={choice.groupCount}
              label={n => t('mob.scoring.draw.groups_option', { n })}
              onPick={n => setPick(p => ({ ...p, groupCount: n }))}
              testID="setup-groups"
            />
            <Text style={styles.label}>{t('mob.scoring.draw.advance')}</Text>
            <Choice
              options={choice.advanceOptions}
              value={choice.advance}
              label={n => t('mob.scoring.draw.advance_option', { n })}
              onPick={n => setPick(p => ({ ...p, advance: n }))}
              testID="setup-advance"
            />
            <Button
              label={t(openDraft ? 'mob.scoring.draw.regenerate' : 'mob.scoring.draw.generate')}
              onPress={generate}
              loading={busy === 'generate'}
              disabled={choice.advance === null}
              style={styles.button}
              testID="setup-generate"
            />
          </>
        ) : null}
        {noteView(generateNote)}
      </TabCard>

      {latest ? (
        <TabCard testID="setup-draft">
          <Step n={3} done={Boolean(pending.pending)} title={t('mob.scoring.draw.step_draft')} />
          <CardHead title={t('mob.scoring.draw.draft_title')} />
          <View style={styles.chips}>
            <Chip label={t(`mob.scoring.draw.status.${latest.status}` as LabelKey)} tone={latest.status === 'draft' ? 'amber' : 'neutral'} />
            {openDraft ? <Chip label={t('mob.tournament.fixtures.draft_badge')} tone="amber" /> : null}
          </View>
          <Text style={styles.body}>
            {t('mob.scoring.draft.summary', { version: latest.version, groups: latest.groups ?? '', advance: latest.advance_per_group ?? '' })}
          </Text>
          {!draft ? <ActivityIndicator color={dash.brand} style={styles.loading} testID="setup-draft-loading" /> : null}
          {draft ? (
            <View>
              <Text style={styles.body}>{t('mob.scoring.draw.draft_counts', { group: draft.groupMatches, knockout: draft.knockoutMatches })}</Text>
              {draft.groupList.map(group => (
                <View key={group.key} style={styles.group} testID={`setup-group-${group.key}`}>
                  <Text style={styles.groupTitle}>{t('mob.scoring.draw.group_title', { group: group.key })}</Text>
                  {group.members.map(member => {
                    const name = props.names.get(member.entrantId.toLowerCase()) ?? unknownEntry;
                    return (
                      <Text key={member.entrantId} style={styles.member}>
                        {member.seed !== null ? t('mob.scoring.draw.member', { seed: member.seed, name }) : t('mob.scoring.draw.member_noseed', { name })}
                      </Text>
                    );
                  })}
                </View>
              ))}
            </View>
          ) : null}
          {pending.pending ? (
            <View style={styles.waiting} testID="setup-waiting">
              <Text style={styles.waitingTitle}>{t('mob.scoring.draw.blocked.pending')}</Text>
              {pending.createdAt ? <Text style={styles.body}>{`${formatDayShort(pending.createdAt)} ${formatClock(pending.createdAt)}`}</Text> : null}
            </View>
          ) : openDraft ? (
            <Button label={t('mob.scoring.draw.submit')} onPress={submit} loading={busy === 'submit'} style={styles.button} testID="setup-submit" />
          ) : (
            <Text style={styles.body}>{t('mob.scoring.draw.blocked.not_open')}</Text>
          )}
          {noteView(submitNote)}
        </TabCard>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  stepHead: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  stepDot: { width: STEP, height: STEP, borderRadius: STEP / 2, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  stepDone: { backgroundColor: colors.successDark },
  stepNum: { ...typography.label, color: colors.white },
  stepTitle: { ...typography.h3, color: dash.text, marginLeft: spacing.sm, flex: 1 },
  body: { ...typography.body, color: dash.textMuted, marginTop: spacing.xs },
  label: { ...typography.bodyBold, color: dash.text, marginTop: spacing.md, marginBottom: spacing.xs },
  button: { marginTop: spacing.sm, alignSelf: 'stretch' },
  note: { ...typography.bodyBold, marginTop: spacing.sm },
  noteOk: { color: colors.successDark },
  noteBad: { color: colors.error },
  choices: { flexDirection: 'row', flexWrap: 'wrap' },
  choice: { minHeight: 44, minWidth: 72, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.md, borderRadius: radius.md, borderWidth: borderWidth.thin, borderColor: dash.panelBorder, marginRight: spacing.sm, marginBottom: spacing.xs, backgroundColor: colors.surface },
  choiceOn: { backgroundColor: dash.brand, borderColor: dash.brand },
  choiceText: { ...typography.bodyBold, color: dash.text },
  choiceTextOn: { color: colors.white },
  chips: { flexDirection: 'row', flexWrap: 'wrap' },
  loading: { marginVertical: spacing.md },
  group: { borderWidth: borderWidth.thin, borderColor: dash.cardBorder, borderRadius: radius.md, marginTop: spacing.sm, overflow: 'hidden' },
  groupTitle: { ...typography.bodyBold, color: dash.text, backgroundColor: dash.page, padding: spacing.sm },
  member: { ...typography.body, color: dash.text, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs + 2, borderTopWidth: borderWidth.thin, borderTopColor: dash.cardBorder },
  waiting: { backgroundColor: colors.warningLight, borderRadius: radius.md, padding: spacing.md, marginTop: spacing.md },
  waitingTitle: { ...typography.bodyBold, color: colors.warningDark },
});
