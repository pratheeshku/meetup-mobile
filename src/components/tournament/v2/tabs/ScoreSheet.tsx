/**
 * Enter score and Edit score (boards TV2MobScore, TV2MobEditScore; web reference te-w2 `teScore*`). A bottom sheet with
 * up to three sets (set 1 required, sets 2 and 3 optional, set 3 only with set 2), the result type, and, on a correction,
 * the saved values ("was"), the server's impact box and a required reason. The app NEVER sends or computes a winner: the
 * body carries sets and a result type only, and the "Final score" line and the impact box are the server's preview
 * (`POST .../result/preview`). One correlation id per save and per preview (a user action each).
 *
 * A correction that changes the winner is refused by the server with `CORRECTION_NEEDS_APPROVAL`; the sheet then sends
 * the same proposal for a second committee member to approve (`result_winner_change`), as the web does.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { generateCorrelationId, withCorrelationId } from '../../../../api/correlationId';
import { postMatchResult, previewMatchResult, submitResultChangeForApproval } from '../../../../api/tournaments';
import { useT } from '../../../../labels/LabelsContext';
import { dash } from '../../../../theme/dashboardTheme';
import { borderWidth, colors, radius, spacing, typography } from '../../../../theme/tokens';
import type { ScoringMatch } from '../../../../types/tournamentScoring';
import type { MatchEntryResponse, MatchPreview } from '../../../../types/tournamentTabs';
import {
  digitsOnly,
  impactOf,
  readResultRefusal,
  scoreBody,
  scoreErrorKey,
  scoreFormInit,
  scoreIssues,
  SET_SLOTS,
  winnerSide,
  type ScoreForm,
} from '../../../../utils/tournamentTabs';
import type { TournamentStandingsView } from '../../../../types/tournamentScoring';
import { formatClock } from '../../../../utils/tournamentExperience';
import Button from '../../../Button';
import KeyboardAwareScreen from '../../../KeyboardAwareScreen';
import TextField from '../../../TextField';
import { CheckIcon, CrossIcon } from '../../../icons/ActionIcons';
import UserAvatar from '../../../UserAvatar';
import { knockoutName } from './matchLabels';
import { Chip } from './parts';

const BOX_W = 56;
const BOX_H = 48;
const AVATAR = 36;
const CLOSE_BOX = 40;
const PREVIEW_DELAY_MS = 450;

export interface ScoreSheetProps {
  tournamentId: string;
  match: ScoringMatch;
  /** The group of a group match, for the stage chip. */
  group: string | null;
  view: TournamentStandingsView | null;
  onClose: () => void;
  /** A score was saved: the entry response, to re-render from. */
  onSaved: (entry: MatchEntryResponse) => void;
  /** The proposal was sent for approval (a winner change). */
  onSentForApproval: () => void;
  /** The match changed under the editor (RESULT_STALE): the current match, to show again. */
  onStale: (current: ScoringMatch | null) => void;
}

export default function ScoreSheet(props: ScoreSheetProps): React.JSX.Element {
  const t = useT();
  const { match } = props;
  const [form, setForm] = useState<ScoreForm>(() => scoreFormInit(match));
  const initial = useMemo(() => scoreFormInit(match), [match]);
  const [preview, setPreview] = useState<MatchPreview | null>(null);
  const [previewState, setPreviewState] = useState<'idle' | 'checking' | 'failed'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const ticket = useRef(0);
  const correcting = form.mode === 'correct';
  const issues = scoreIssues(form);
  const shapeOk = issues.filter(code => code !== 'REASON_REQUIRED').length === 0;
  const names = { a: match.side_a.name ?? '', b: match.side_b.name ?? '' };

  const update = (patch: Partial<ScoreForm>): void => {
    setError(null);
    setForm(previous => ({ ...previous, ...patch }));
  };
  const setBox = (index: number, side: 'a' | 'b', value: string): void => {
    setError(null);
    setForm(previous => ({
      ...previous,
      sets: previous.sets.map((set, i) => (i === index ? { ...set, [side]: digitsOnly(value) } : set)),
    }));
  };

  // The impact and the final line come from the server's preview, asked for after the person stops typing.
  const bodyKey = JSON.stringify(scoreBody(form));
  useEffect(() => {
    if (!shapeOk) {
      setPreview(null);
      setPreviewState('idle');
      return undefined;
    }
    const mine = ++ticket.current;
    setPreviewState('checking');
    const timer = setTimeout(async () => {
      try {
        const next = await withCorrelationId(correlationId =>
          previewMatchResult(props.tournamentId, match.fixture_id, scoreBody(form), { correlationId }),
        );
        if (ticket.current === mine) {
          setPreview(next);
          setPreviewState('idle');
          setError(null);
        }
      } catch (e) {
        if (ticket.current === mine) {
          setPreview(null);
          const refusal = readResultRefusal(e);
          if (refusal.currentMatch) {
            props.onStale(refusal.currentMatch);
            return;
          }
          const known = refusal.code === 'MATCH_TIED' || refusal.code === 'RESULTS_LOCKED';
          setPreviewState(known ? 'idle' : 'failed');
          setError(known ? t(scoreErrorKey(refusal)) : null);
        }
      }
    }, PREVIEW_DELAY_MS);
    return () => clearTimeout(timer);
    // The body is the whole input of the preview.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bodyKey, shapeOk, match.fixture_id, props.tournamentId]);

  const impact = useMemo(() => (preview ? impactOf(preview, props.view) : null), [preview, props.view]);

  const save = async (): Promise<void> => {
    if (issues.length > 0 || saving) {
      setError(issues.includes('REASON_REQUIRED') ? t('mob.tournament.score.err.REASON_REQUIRED') : null);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await withCorrelationId(async correlationId => {
        try {
          const entry = await postMatchResult(
            props.tournamentId,
            match.fixture_id,
            scoreBody(form, { requestId: generateCorrelationId(), withReason: true }),
            { correlationId },
          );
          props.onSaved(entry);
        } catch (e) {
          const refusal = readResultRefusal(e);
          if (refusal.needsApproval) {
            const body = scoreBody(form);
            await submitResultChangeForApproval(
              props.tournamentId,
              match.fixture_id,
              { result_type: body.result_type, sets: body.sets, advancing_side: body.advancing_side, reason: form.reason.trim() },
              { correlationId },
            );
            props.onSentForApproval();
            return;
          }
          if (refusal.currentMatch) {
            props.onStale(refusal.currentMatch);
            return;
          }
          throw e;
        }
      });
    } catch (e) {
      setError(t(scoreErrorKey(readResultRefusal(e))));
    } finally {
      setSaving(false);
    }
  };

  const winner = preview?.will_be ? winnerSide(preview.will_be) : null;
  const [winsA, winsB] = (() => {
    const sets = preview?.will_be?.result?.sets ?? [];
    return [sets.filter(s => s.a > s.b).length, sets.filter(s => s.b > s.a).length];
  })();
  const wasText = (index: number, side: 'a' | 'b'): string | null => {
    if (!correcting) {
      return null;
    }
    const now = form.sets[index][side];
    const before = initial.sets[index][side];
    if (now === before) {
      return null;
    }
    return before === '' ? t('mob.tournament.score.was_empty') : t('mob.tournament.score.was_value', { value: before });
  };

  return (
    <Modal visible animationType="slide" transparent onRequestClose={props.onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet} testID="score-sheet">
          <KeyboardAwareScreen contentContainerStyle={styles.content}>
            <View style={styles.head}>
              <Text style={styles.title} accessibilityRole="header">
                {t(correcting ? 'mob.tournament.score.title_edit' : 'mob.tournament.score.title_enter')}
              </Text>
              <Pressable accessibilityRole="button" accessibilityLabel={t('mob.tournament.score.cancel')} onPress={props.onClose} style={styles.close} testID="score-close">
                <CrossIcon size={18} color={dash.text} />
              </Pressable>
            </View>
            <View style={styles.chips}>
              {props.group ? <Chip label={t('mob.tournament.standings.group_title', { group: props.group })} tone="teal" /> : null}
              {match.court ? <Chip label={match.court} tone="teal" /> : null}
              {match.scheduled_at ? <Chip label={formatClock(match.scheduled_at)} /> : null}
              {correcting ? <Chip label={t('mob.tournament.score.type_completed')} tone="green" /> : null}
            </View>

            <View style={styles.setHeads}>
              <View style={styles.nameCol} />
              {Array.from({ length: SET_SLOTS }, (_, index) => (
                <View key={index} style={styles.boxCol}>
                  <Text style={styles.setHead} numberOfLines={2}>
                    {t(index === 0 ? 'mob.tournament.score.set_n' : 'mob.tournament.score.set_optional', { n: index + 1 })}
                  </Text>
                </View>
              ))}
            </View>
            {(['a', 'b'] as const).map(side => (
              <View key={side} style={styles.sideRow} testID={`score-side-${side}`}>
                <View style={styles.nameCol}>
                  <UserAvatar name={names[side]} size={AVATAR} fallback="initials" />
                  <Text style={styles.sideName} numberOfLines={2}>
                    {names[side]}
                  </Text>
                </View>
                {form.sets.map((set, index) => (
                  <View key={index} style={styles.boxCol}>
                    <TextField
                      value={set[side]}
                      onChangeText={value => setBox(index, side, value)}
                      keyboardType="number-pad"
                      editable={form.resultType !== 'walkover'}
                      maxLength={3}
                      style={[styles.box, wasText(index, side) ? styles.boxChanged : null]}
                      accessibilityLabel={`${t('mob.tournament.score.points_for', { name: names[side] })}, ${t('mob.tournament.score.set_n', { n: index + 1 })}`}
                      testID={`score-set-${index + 1}-${side}`}
                    />
                    {wasText(index, side) ? <Text style={styles.was}>{wasText(index, side)}</Text> : null}
                  </View>
                ))}
              </View>
            ))}

            {preview?.will_be && winner && form.resultType === 'normal' ? (
              <View style={styles.final} testID="score-final-line">
                <View style={styles.finalGlyph}>
                  <CheckIcon size={18} color={colors.successDark} />
                </View>
                <Text style={styles.finalText}>
                  {t('mob.tournament.score.final_line', { a: winsA, b: winsB, name: names[winner] })}
                </Text>
              </View>
            ) : null}
            <Text style={styles.hint}>{t('mob.tournament.score.rules_hint')}</Text>

            <Text style={styles.label}>{t('mob.tournament.score.result_type')}</Text>
            <View style={styles.typeRow}>
              {(['normal', 'walkover', 'retired'] as const).map(type => (
                <Pressable
                  key={type}
                  accessibilityRole="button"
                  accessibilityState={{ selected: form.resultType === type }}
                  onPress={() => update({ resultType: type, advancing: type === 'normal' ? null : form.advancing })}
                  style={[styles.typeChip, form.resultType === type ? styles.typeChipOn : null]}
                  testID={`score-type-${type}`}
                >
                  <Text style={[styles.typeText, form.resultType === type ? styles.typeTextOn : null]}>
                    {t(
                      type === 'normal'
                        ? 'mob.tournament.score.type_completed'
                        : type === 'walkover'
                          ? 'mob.tournament.score.type_walkover'
                          : 'mob.tournament.score.type_retired',
                    )}
                  </Text>
                </Pressable>
              ))}
            </View>

            {form.resultType !== 'normal' ? (
              <View testID="score-winner-pick">
                <Text style={styles.label}>{t('mob.tournament.score.winner')}</Text>
                <View style={styles.typeRow}>
                  {(['a', 'b'] as const).map(side => (
                    <Pressable
                      key={side}
                      accessibilityRole="button"
                      accessibilityState={{ selected: form.advancing === side }}
                      onPress={() => update({ advancing: side })}
                      style={[styles.typeChip, form.advancing === side ? styles.typeChipOn : null]}
                      testID={`score-advancing-${side}`}
                    >
                      <Text style={[styles.typeText, form.advancing === side ? styles.typeTextOn : null]} numberOfLines={1}>
                        {names[side]}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : null}

            {previewState === 'checking' ? <Text style={styles.hint}>{t('mob.tournament.score.checking')}</Text> : null}
            {previewState === 'failed' ? <Text style={styles.error}>{t('mob.tournament.score.preview_failed')}</Text> : null}

            {correcting && impact ? (
              <View style={styles.impact} testID="score-impact">
                <Text style={styles.impactTitle}>{t('mob.tournament.score.impact_title')}</Text>
                {impact.hasWillBe && impact.from ? (
                  <Text style={styles.impactText}>
                    {t('mob.tournament.score.changes_from_to', { from: impact.from, to: impact.to })}
                    {impact.winnerChanged ? ` ${t('mob.tournament.score.new_winner', { name: impact.newWinner })}` : ''}
                  </Text>
                ) : null}
                {impact.rankMoves.map(move => (
                  <Text key={`${move.group}-${move.name}`} style={styles.impactText}>
                    {t('mob.tournament.score.delta_moves', { group: t('mob.tournament.standings.group_title', { group: move.group }), name: move.name, from: move.from, to: move.to })}
                  </Text>
                ))}
                {impact.advances.map(advance => (
                  <Text key={advance.fixtureId} style={styles.impactText}>
                    {t('mob.tournament.score.delta_advance', {
                      match: advance.target ? knockoutName(advance.target, props.view, t) : '',
                      old: advance.oldName,
                      new: advance.newName,
                    })}
                  </Text>
                ))}
                {impact.needsApproval ? <Text style={styles.impactText}>{t('mob.tournament.score.impact_needs_approval')}</Text> : null}
                {impact.downstream.length > 0 ? <Text style={styles.impactText}>{t('mob.tournament.score.impact_downstream')}</Text> : null}
                {impact.hasWillBe ? <Text style={styles.impactText}>{t('mob.tournament.score.notify_note')}</Text> : null}
              </View>
            ) : null}

            {correcting ? (
              <View>
                <Text style={styles.label}>{t('mob.tournament.score.reason')}</Text>
                <TextField
                  value={form.reason}
                  onChangeText={value => update({ reason: value.slice(0, 500) })}
                  multiline
                  style={styles.reason}
                  accessibilityLabel={t('mob.tournament.score.reason')}
                  testID="score-reason"
                />
              </View>
            ) : null}

            {error ? (
              <Text style={styles.error} accessibilityRole="alert" testID="score-error">
                {error}
              </Text>
            ) : null}
            <Text style={styles.hint}>{t(correcting ? 'mob.tournament.score.history_note' : 'mob.tournament.score.save_note')}</Text>

            <View style={styles.actions}>
              <Button label={t('mob.tournament.score.cancel')} variant="secondary" onPress={props.onClose} style={styles.action} />
              <Button
                label={t(correcting ? 'mob.tournament.score.save_changes' : 'mob.tournament.score.save')}
                onPress={save}
                loading={saving}
                disabled={issues.length > 0 || saving || impact?.downstream.length ? true : false}
                style={styles.action}
                testID="score-save"
              />
            </View>
          </KeyboardAwareScreen>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: colors.scrim },
  sheet: { height: '92%', backgroundColor: colors.surface, borderTopLeftRadius: radius.lg + 8, borderTopRightRadius: radius.lg + 8 },
  content: { padding: spacing.md, paddingBottom: spacing.lg },
  head: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  title: { ...typography.h2, color: dash.text, flex: 1 },
  close: { width: CLOSE_BOX, height: CLOSE_BOX, borderRadius: CLOSE_BOX / 2, backgroundColor: dash.page, alignItems: 'center', justifyContent: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: spacing.sm },
  setHeads: { flexDirection: 'row', alignItems: 'flex-end', marginTop: spacing.sm },
  nameCol: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center' },
  boxCol: { width: BOX_W + spacing.sm, alignItems: 'center' },
  setHead: { ...typography.label, color: dash.textMuted, textAlign: 'center' },
  sideRow: { flexDirection: 'row', alignItems: 'flex-start', marginTop: spacing.sm },
  sideName: { ...typography.bodyBold, color: dash.text, marginLeft: spacing.sm, flexShrink: 1 },
  box: {
    width: BOX_W,
    height: BOX_H,
    textAlign: 'center',
    ...typography.h3,
    color: dash.text,
    borderRadius: radius.md,
    borderWidth: borderWidth.medium,
    borderColor: dash.panelBorder,
    paddingVertical: 0,
    paddingHorizontal: 0,
    minHeight: BOX_H,
  },
  boxChanged: { borderColor: colors.accent, backgroundColor: colors.warningLight },
  was: { ...typography.label, color: colors.accent, textDecorationLine: 'line-through', textAlign: 'center' },
  final: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.successLight, borderRadius: radius.md, padding: spacing.sm + 4, marginTop: spacing.md },
  finalGlyph: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  finalText: { ...typography.bodyBold, color: colors.successDark, flex: 1 },
  hint: { ...typography.caption, color: dash.textMuted, marginTop: spacing.sm },
  label: { ...typography.bodyBold, color: dash.text, marginTop: spacing.md, marginBottom: spacing.xs },
  typeRow: { flexDirection: 'row', flexWrap: 'wrap' },
  typeChip: { minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.md, borderRadius: radius.full, borderWidth: borderWidth.thin, borderColor: dash.cardBorder, marginRight: spacing.sm, marginBottom: spacing.xs, backgroundColor: colors.surface },
  typeChipOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  typeText: { ...typography.bodyBold, color: dash.text },
  typeTextOn: { color: colors.white },
  impact: { backgroundColor: colors.warningLight, borderRadius: radius.md, borderWidth: borderWidth.thin, borderColor: colors.warning, padding: spacing.md, marginTop: spacing.md },
  impactTitle: { ...typography.bodyBold, color: colors.warningDark, marginBottom: spacing.xs },
  impactText: { ...typography.body, color: colors.warningDark, marginBottom: spacing.xs },
  reason: { minHeight: 72, textAlignVertical: 'top' },
  error: { ...typography.body, color: colors.error, marginTop: spacing.sm },
  actions: { flexDirection: 'row', marginTop: spacing.md },
  action: { flex: 1, marginHorizontal: spacing.xs },
});
