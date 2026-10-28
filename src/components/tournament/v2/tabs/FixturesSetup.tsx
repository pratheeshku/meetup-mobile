/**
 * Fixtures setup for the committee, before publication (AD-T12; boards TV2MobSetupDraw, TV2MobSetupSubmit; web reference `cnGenerate`,
 * `cnSubmit`). Three steps: (1) the points on file: they are edited per entrant on the Participants tab, which replaced the points Excel
 * (teams-payments AD-13: the template download and the upload are gone from the app); (2) choose the number of groups and how many advance (only
 * values the server allows, read from the draw options) and generate: with a fee, the count of unpaid entrants left out comes first (the server's
 * `excluded_from_fixtures`; a failed read hides Generate, never a guessed count); the draft is shown with its groups, seeds, match counts and
 * version, and replacing an open draft is confirmed; (3) submit for review, with the waiting state read from the server's request list, never from
 * local state alone.
 *
 * The draw, the seeds and the draft are the server's: nothing here builds, ranks or seeds. Registration ids of the draft
 * are shown as names from the participants the page already loads; an id is never shown. Role checks are UX only.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { withCorrelationId } from '../../../../api/correlationId';
import { shuffleFixtureDraft } from '../../../../api/tournaments';
import {
  generateFixtureDraft,
  getCommitteeActions,
  getFixtureDraft,
  getRegistrationSummary,
  submitFixturePublication,
} from '../../../../api/tournaments';
import { useT } from '../../../../labels/LabelsContext';
import type { LabelKey } from '../../../../labels/fallbackLabels';
import { dash } from '../../../../theme/dashboardTheme';
import { borderWidth, colors, radius, spacing, typography } from '../../../../theme/tokens';
import type { CommitteeSetup } from '../../../../types/tournamentScoring';
import type { RegistrationSummary } from '../../../../types/tournament';
import type { DraftDetail, UploadRefusal } from '../../../../types/tournamentTabs';
import {
  drawChoice,
  errLabelKey,
  publicationPending,
  readUploadRefusal,
} from '../../../../utils/fixturesSetup';
import { refusalText } from '../../../../utils/refusal';
import { formatDayShort, formatClock } from '../../../../utils/tournamentExperience';
import Button from '../../../Button';
import { CheckIcon } from '../../../icons/ActionIcons';
import RefusalList from './RefusalList';
import { CardHead, Chip, CommitteeNote, TabCard } from './parts';
import { UnpaidWarning } from '../../participants/parts';

const STEP = 28;

export interface FixturesSetupProps {
  tournamentId: string;
  /** File name stem for downloads, from the tournament's title (never an id). */
  fileStem: string;
  /** A team tournament: the excluded count reads "tournament teams". */
  teamMode?: boolean;
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

  // The server's summary: the unpaid entrants a generation would leave out. `undefined` = loading, `null` = the read failed.
  const [summary, setSummary] = useState<RegistrationSummary | null | undefined>(undefined);
  const [pick, setPick] = useState<{ groupCount: number | null; advance: number | null }>({ groupCount: null, advance: null });
  const [generateNote, setGenerateNote] = useState<Note>(null);
  const [submitNote, setSubmitNote] = useState<Note>(null);
  const [busy, setBusy] = useState<'generate' | 'submit' | 'shuffle' | null>(null);
  const [shuffleNote, setShuffleNote] = useState<Note>(null);
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

  // Read when the setup opens and whenever the server's state changes (a draft, the points): the count is never kept or guessed locally.
  useEffect(() => {
    let active = true;
    withCorrelationId(correlationId => getRegistrationSummary(tournamentId, { correlationId }))
      .then(next => active && setSummary(next))
      .catch(() => active && setSummary(null));
    return () => {
      active = false;
    };
  }, [tournamentId, draftId, points?.entrants, points?.rated]);

  const runGenerate = async (): Promise<void> => {
    if (choice.advance === null) {
      return;
    }
    setBusy('generate');
    setGenerateNote(null);
    setSubmitNote(null);
    try {
      const generated = await withCorrelationId(correlationId =>
        generateFixtureDraft(tournamentId, { group_count: choice.groupCount, advance_per_group: choice.advance as number }, { correlationId }),
      );
      // `excluded_unpaid` is the number actually left out at generation time (a toggle between view and generate cannot be misreported).
      const excluded = generated?.excludedUnpaid ?? 0;
      setGenerateNote({
        ok: true,
        text: excluded > 0 ? `${t('mob.scoring.draw.generated_ok')} ${t('mob.scoring.draw.excluded_line', { count: excluded })}` : t('mob.scoring.draw.generated_ok'),
      });
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

  // Shuffle again (AD-7, A38): the committee asks the server for the next balanced draw. No body, no client draw logic: the answer is the new
  // draft (its groups replace the list below) and, only when the server sends `shuffle {index, total}`, "Draw n of N". The server decides
  // availability: `SHUFFLE_UNAVAILABLE`, `FIXTURE_FROZEN` and the rate limit (429) show their labels, never the server text.
  const shuffle = async (): Promise<void> => {
    if (busy !== null) {
      return;
    }
    setBusy('shuffle');
    setShuffleNote(null);
    setSubmitNote(null);
    try {
      const result = await withCorrelationId(correlationId => shuffleFixtureDraft(tournamentId, { correlationId }));
      if (result.draft) {
        setDraft(result.draft);
      }
      setShuffleNote({
        ok: true,
        text: result.shuffle
          ? t('web.console.shuffle.done', { n: result.shuffle.index + 1, total: result.shuffle.total })
          : t('mob.scoring.draw.generated_ok'),
      });
      props.onChanged();
    } catch (e) {
      const code = (e as { response?: { data?: { code?: unknown } } } | null)?.response?.data?.code;
      setShuffleNote({
        ok: false,
        text: code === 'FIXTURE_FROZEN' ? t(errLabelKey('FIXTURE_FROZEN')) : refusalText(e, t, 'mob.scoring.error.generic'),
      });
    } finally {
      setBusy(null);
    }
  };
  // The draft says itself when it has a single balanced draw (`shuffle_total`); a fresh draft carries none, so the server answers then (A40).
  const singleDraw = draft?.shuffleTotal !== null && draft?.shuffleTotal !== undefined && draft.shuffleTotal <= 1;

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
        : summary === null
          ? 'mob.scoring.draw.summary_failed_generate'
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
        <Text style={styles.body}>{t('mob.scoring.draw.points_moved')}</Text>
        <Text style={styles.body} testID="setup-points-status">
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
      </TabCard>

      <TabCard testID="setup-draw">
        <Step n={2} done={Boolean(openDraft)} title={t('mob.scoring.draw.step_options')} />
        {generateBlocked ? <Text style={styles.body}>{t(generateBlocked)}</Text> : null}
        {!generateBlocked ? (
          <>
            {summary && summary.payments_enabled ? (
              <UnpaidWarning count={summary.excluded_from_fixtures} teamMode={props.teamMode === true} />
            ) : null}
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
          {openDraft && draft ? (
            <View style={styles.shuffleBox} testID="setup-shuffle">
              <Text style={styles.body}>{t('web.console.shuffle.hint')}</Text>
              <Button
                label={t('web.console.shuffle.button')}
                variant="secondary"
                onPress={shuffle}
                loading={busy === 'shuffle'}
                disabled={busy !== null || singleDraw}
                style={styles.button}
                testID="setup-shuffle-button"
              />
              {singleDraw ? <Text style={styles.body}>{t('web.console.shuffle.single')}</Text> : null}
              {noteView(shuffleNote)}
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
  shuffleBox: { marginTop: spacing.sm },
  waiting: { backgroundColor: colors.warningLight, borderRadius: radius.md, padding: spacing.md, marginTop: spacing.md },
  waitingTitle: { ...typography.bodyBold, color: colors.warningDark },
});
