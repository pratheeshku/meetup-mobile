/**
 * Close tournament form (board TV2MobClose; web reference te-w2 `teCloseHtml`, closure addendum AD-2, AD-3, AD-6 and
 * tournament-experience AD-T9): played or not held, who played, winner, runner-up, third place, star of the tournament
 * (`candidates[].members` for a team), comments (max 500 with a counter). One correlation id per submit; a stale version
 * and the coded closure errors show their label. This sheet replaces the te-a1 "Closure report" modal path for version 2
 * tournaments (the shared `ClosureModal` stays for games and legacy tournaments).
 */
import React, { useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { withCorrelationId } from '../../../../api/correlationId';
import { putTournamentClosure } from '../../../../api/tournaments';
import { useT } from '../../../../labels/LabelsContext';
import { dash } from '../../../../theme/dashboardTheme';
import { borderWidth, colors, radius, spacing, typography } from '../../../../theme/tokens';
import type { TournamentClosureResponse } from '../../../../types/tournament';
import {
  closureBody,
  closureErrorKey,
  closureInit,
  closureIssues,
  CLOSURE_COMMENTS_MAX,
  starOptions,
  type ClosureForm,
  type ClosureIssue,
} from '../../../../utils/tournamentTabs';
import Button from '../../../Button';
import DropdownField from '../../../DropdownField';
import KeyboardAwareScreen from '../../../KeyboardAwareScreen';
import { CheckIcon, CrossIcon } from '../../../icons/ActionIcons';
import SegmentedSwitch from '../../../SegmentedSwitch';
import TextField from '../../../TextField';
import UserAvatar from '../../../UserAvatar';

const CLOSE_BOX = 40;
const CHECK_BOX = 22;

const ISSUE_KEYS = {
  third_place_not_attendee: 'mob.tournament.closure.err.third_place_not_attendee',
  third_place_equals_winner: 'mob.tournament.closure.err.third_place_equals_winner',
  third_place_equals_runner_up: 'mob.tournament.closure.err.third_place_equals_runner_up',
  star_not_attendee: 'mob.tournament.closure.err.star_not_attendee',
  comments_too_long: 'mob.tournament.closure.err.comments_too_long',
} as const;

export interface CloseSheetProps {
  tournamentId: string;
  closure: TournamentClosureResponse;
  onClose: () => void;
  /** Saved: the host re-reads the page. */
  onSaved: () => void;
}

export default function CloseSheet(props: CloseSheetProps): React.JSX.Element {
  const t = useT();
  const { closure } = props;
  const candidates = useMemo(() => closure.candidates ?? [], [closure.candidates]);
  const [form, setForm] = useState<ClosureForm>(() => {
    const start = closureInit(closure);
    // First report: everyone who is a candidate is ticked, as on the web.
    return !closure.outcome && start.attendees.length === 0
      ? { ...start, attendees: candidates.map(c => c.registration_id ?? '').filter(Boolean) }
      : start;
  });
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const held = form.outcome !== 'not_held';

  const regOptions = candidates
    .filter(c => c.registration_id && form.attendees.includes(c.registration_id))
    .map(c => ({ value: c.registration_id as string, label: c.display_name }));
  const stars = starOptions(candidates, form.attendees).map(o => ({ value: o.userId, label: o.name }));

  const patch = (next: Partial<ClosureForm>): void => {
    setErrors([]);
    setForm(previous => ({ ...previous, ...next }));
  };
  const toggle = (id: string): void => {
    const on = form.attendees.includes(id);
    const attendees = on ? form.attendees.filter(x => x !== id) : [...form.attendees, id];
    patch({
      attendees,
      winner: form.winner === id && on ? '' : form.winner,
      runnerUp: form.runnerUp === id && on ? '' : form.runnerUp,
      third: form.third === id && on ? '' : form.third,
    });
  };

  const submit = async (): Promise<void> => {
    if (saving) {
      return;
    }
    const issues: ClosureIssue[] = closureIssues(form, candidates);
    if (issues.length > 0) {
      setErrors(issues.map(code => t(ISSUE_KEYS[code])));
      return;
    }
    setSaving(true);
    try {
      await withCorrelationId(correlationId => putTournamentClosure(props.tournamentId, closureBody(form), { correlationId }));
      props.onSaved();
    } catch (e) {
      const response = (e as { response?: { status?: number; data?: { code?: string } } } | null)?.response;
      const key = closureErrorKey(e);
      setErrors([
        response?.status === 409 && response.data?.code === 'version_conflict'
          ? t('mob.tournament.close.stale')
          : key
            ? t(key)
            : t('mob.tournament.close.failed'),
      ]);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible animationType="slide" transparent onRequestClose={props.onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet} testID="close-sheet">
          <KeyboardAwareScreen contentContainerStyle={styles.content}>
            <View style={styles.head}>
              <Text style={styles.title} accessibilityRole="header">
                {t('mob.tournament.close.title')}
              </Text>
              <Pressable accessibilityRole="button" accessibilityLabel={t('mob.tournament.close.cancel')} onPress={props.onClose} style={styles.close} testID="close-sheet-close">
                <CrossIcon size={18} color={dash.text} />
              </Pressable>
            </View>

            <Text style={styles.label}>{t('mob.closure.was_it_played')}</Text>
            <SegmentedSwitch<'completed' | 'not_held'>
              value={form.outcome}
              onChange={outcome => patch({ outcome })}
              options={[
                { value: 'completed', label: t('mob.closure.outcome.played') },
                { value: 'not_held', label: t('mob.closure.outcome.not_held') },
              ]}
            />

            {held ? (
              <>
                <Text style={styles.label}>{t('mob.closure.who_played')}</Text>
                {candidates.map(candidate => {
                  const id = candidate.registration_id ?? '';
                  const ticked = form.attendees.includes(id);
                  return (
                    <Pressable
                      key={id}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: ticked }}
                      accessibilityLabel={candidate.display_name}
                      onPress={() => toggle(id)}
                      style={styles.candidate}
                      testID={`close-candidate-${id}`}
                    >
                      <View style={[styles.check, ticked ? styles.checkOn : null]}>{ticked ? <CheckIcon size={14} color={colors.white} /> : null}</View>
                      <UserAvatar imageUrl={candidate.photo_url} name={candidate.display_name} size={32} fallback="initials" />
                      <Text style={styles.candidateName}>{candidate.display_name}</Text>
                    </Pressable>
                  );
                })}

                <Text style={styles.section}>{t('mob.tournament.close.podium_title')}</Text>
                <Text style={styles.label}>{t('mob.closure.winner')}</Text>
                <DropdownField options={regOptions} value={form.winner || null} onChange={winner => patch({ winner })} placeholder={t('mob.tournament.close.pick_player')} accessibilityLabel={t('mob.closure.winner')} />
                <Text style={styles.label}>{t('mob.closure.runner_up')}</Text>
                <DropdownField options={regOptions} value={form.runnerUp || null} onChange={runnerUp => patch({ runnerUp })} placeholder={t('mob.tournament.close.pick_player')} accessibilityLabel={t('mob.closure.runner_up')} />
                <Text style={styles.label}>{t('mob.tournament.closure.third_place')}</Text>
                <DropdownField options={regOptions} value={form.third || null} onChange={third => patch({ third })} placeholder={t('mob.tournament.close.pick_player')} accessibilityLabel={t('mob.tournament.closure.third_place')} />

                <Text style={styles.label}>{t('mob.tournament.closure.star')}</Text>
                <DropdownField options={stars} value={form.star || null} onChange={star => patch({ star })} placeholder={t('mob.tournament.close.pick_none')} accessibilityLabel={t('mob.tournament.closure.star')} />
                <Text style={styles.hint}>{t('mob.tournament.close.star_hint')}</Text>
              </>
            ) : null}

            <Text style={styles.label}>{t('mob.tournament.closure.comments')}</Text>
            <TextField
              value={form.comments}
              onChangeText={comments => patch({ comments })}
              multiline
              style={styles.comments}
              accessibilityLabel={t('mob.tournament.closure.comments')}
              testID="close-comments"
            />
            <Text style={styles.counter} testID="close-counter">
              {t('mob.tournament.close.comments_counter', { count: form.comments.length, max: CLOSURE_COMMENTS_MAX })}
            </Text>
            <Text style={styles.hint}>{t('mob.tournament.close.photos_note')}</Text>

            {errors.map(line => (
              <Text key={line} style={styles.error} accessibilityRole="alert">
                {line}
              </Text>
            ))}
            <Text style={styles.hint}>{t('mob.tournament.close.lock_note')}</Text>

            <View style={styles.actions}>
              <Button label={t('mob.tournament.close.cancel')} variant="secondary" onPress={props.onClose} style={styles.action} />
              <Button label={t('mob.tournament.close.submit')} onPress={submit} loading={saving} style={styles.action} testID="close-submit" />
            </View>
          </KeyboardAwareScreen>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: colors.scrim },
  sheet: { height: '94%', backgroundColor: colors.surface, borderTopLeftRadius: radius.lg + 8, borderTopRightRadius: radius.lg + 8 },
  content: { padding: spacing.md, paddingBottom: spacing.lg },
  head: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  title: { ...typography.h2, color: dash.text, flex: 1 },
  close: { width: CLOSE_BOX, height: CLOSE_BOX, borderRadius: CLOSE_BOX / 2, backgroundColor: dash.page, alignItems: 'center', justifyContent: 'center' },
  label: { ...typography.bodyBold, color: dash.text, marginTop: spacing.md, marginBottom: spacing.xs },
  section: { ...typography.h3, color: dash.text, marginTop: spacing.md },
  candidate: { flexDirection: 'row', alignItems: 'center', minHeight: 48 },
  check: { width: CHECK_BOX, height: CHECK_BOX, borderRadius: 6, borderWidth: borderWidth.medium, borderColor: dash.panelBorder, alignItems: 'center', justifyContent: 'center', marginRight: spacing.sm },
  checkOn: { backgroundColor: dash.brand, borderColor: dash.brand },
  candidateName: { ...typography.body, color: dash.text, marginLeft: spacing.sm, flex: 1 },
  hint: { ...typography.caption, color: dash.textMuted, marginTop: spacing.xs },
  comments: { minHeight: 96, textAlignVertical: 'top' },
  counter: { ...typography.caption, color: dash.textMuted, textAlign: 'right', marginTop: spacing.xs },
  error: { ...typography.body, color: colors.error, marginTop: spacing.sm },
  actions: { flexDirection: 'row', marginTop: spacing.md },
  action: { flex: 1, marginHorizontal: spacing.xs },
});
