/**
 * Pieces of the Participants screen for the organizer and committee (DES-MEETUP-ADDENDUM-teams-payments AD-9 to AD-13; boards P1-P5): the summary
 * tiles with Cash collected, the Paid switch, the points box, the organizer section of the details pop-ups and the remove confirmation. Presentation
 * only: every figure arrives from the server's summary and registrations, and nothing is added up here. Theme tokens only; fixed-size boxes for
 * icon-plus-text rows.
 */
import React, { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';

import { useT } from '../../../labels/LabelsContext';
import { borderWidth, colors, groupView, radius, sizes, spacing, typography } from '../../../theme/tokens';
import { formatMoney } from '../../../utils/money';
import { parsePointsInput, pointsText, sanitizePointsTyping } from '../../../utils/participants';
import type { RegistrationSummary } from '../../../types/tournament';
import { ShieldIcon } from '../../icons/SharedIcons';

const POINTS_BOX_WIDTH = 64;
const POINTS_BOX_HEIGHT = 40;
const TEAM_TILE = 40;

/** Registered (or tournament teams), Paid, Unpaid and the Cash collected box, from the server's summary. */
export function SummaryTiles({ summary, teamMode }: { summary: RegistrationSummary; teamMode: boolean }): React.JSX.Element {
  const t = useT();
  const fee = summary.fee_cents !== null && summary.currency ? formatMoney(summary.fee_cents, summary.currency) : '';
  return (
    <View testID="participants-summary">
      <View style={styles.tiles}>
        <Tile value={summary.registered} label={t(teamMode ? 'mob.part.tile_teams' : 'mob.part.tile_registered')} testID="tile-registered" />
        <Tile value={summary.paid} label={t('mob.part.tile_paid')} testID="tile-paid" />
        <Tile value={summary.unpaid} label={t('mob.part.tile_unpaid')} testID="tile-unpaid" />
      </View>
      {summary.currency ? (
        <View style={styles.cash} testID="participants-cash">
          <View style={styles.cashText}>
            <Text style={styles.cashLabel}>{t('mob.part.cash_label')}</Text>
            <Text style={styles.cashSub}>{t('mob.part.cash_sub', { paid: summary.paid, fee })}</Text>
          </View>
          <Text style={styles.cashValue} testID="cash-collected">
            {formatMoney(summary.collected_cents, summary.currency)}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

function Tile({ value, label, testID }: { value: number; label: string; testID: string }): React.JSX.Element {
  return (
    <View style={styles.tile} testID={testID}>
      <Text style={styles.tileValue}>{value}</Text>
      <Text style={styles.tileLabel} numberOfLines={2}>
        {label}
      </Text>
    </View>
  );
}

/** The unpaid or excluded count, shown first (before the filters and the list). */
export function UnpaidWarning({ count, teamMode }: { count: number; teamMode: boolean }): React.JSX.Element | null {
  const t = useT();
  if (count <= 0) {
    return null;
  }
  const key = teamMode
    ? count === 1
      ? 'mob.part.warn_teams_one'
      : 'mob.part.warn_teams_other'
    : count === 1
    ? 'mob.part.warn_players_one'
    : 'mob.part.warn_players_other';
  return (
    <View style={styles.warning} testID="participants-warning" accessibilityRole="alert">
      <Text style={styles.warningText}>{t(key, { count })}</Text>
    </View>
  );
}

/** The Paid switch. The caller sets it from the server's answer, so it stays where it was while a request is in flight or after a refusal. */
export function PaidSwitch({
  value,
  busy,
  name,
  onChange,
  testID,
}: {
  value: boolean;
  busy: boolean;
  name: string;
  onChange: (next: boolean) => void;
  testID: string;
}): React.JSX.Element {
  const t = useT();
  return (
    <Switch
      value={value}
      disabled={busy}
      onValueChange={onChange}
      accessibilityLabel={t('mob.part.paid_a11y', { name })}
      trackColor={{ false: colors.border, true: colors.success }}
      thumbColor={colors.white}
      testID={testID}
    />
  );
}

/**
 * The points box: one number per entrant (empty = unrated). It sends on blur or submit when the value changed; a refusal shows beside it. The value
 * the server holds is the source: after a refusal the box reads it again.
 */
export function PointsBox({
  points,
  name,
  editable,
  onCommit,
  testID,
  wide = false,
}: {
  /** The server's value (a decimal string) or null. */
  points: string | null | undefined;
  name: string;
  editable: boolean;
  /** Resolves true when the server accepted the value. */
  onCommit: (value: number | null) => Promise<boolean>;
  testID: string;
  wide?: boolean;
}): React.JSX.Element {
  const t = useT();
  const stored = pointsText(points);
  const [text, setText] = useState(stored);
  const [invalid, setInvalid] = useState(false);

  useEffect(() => {
    setText(stored);
    setInvalid(false);
  }, [stored]);

  const commit = async (): Promise<void> => {
    const parsed = parsePointsInput(text);
    if (!parsed.valid) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    if (text.trim() === stored) {
      return;
    }
    const ok = await onCommit(parsed.value);
    if (!ok) {
      setText(stored);
    }
  };

  return (
    <TextInput
      value={text}
      onChangeText={value => {
        setInvalid(false);
        setText(sanitizePointsTyping(value));
      }}
      onEndEditing={commit}
      onSubmitEditing={commit}
      editable={editable}
      keyboardType="decimal-pad"
      returnKeyType="done"
      accessibilityLabel={t('mob.part.points_a11y', { name })}
      style={[styles.pointsBox, wide ? styles.pointsBoxWide : null, invalid ? styles.pointsInvalid : null, !editable ? styles.pointsReadOnly : null]}
      testID={testID}
    />
  );
}

/**
 * The organizer section of the details pop-ups (P3, P4): registration fee, payment received (switch, undoable), points, and Remove. Shown only to
 * the organizer and committee; every other viewer sees the pop-up without it.
 */
export function OrganizerSection(props: {
  /** "S$10.00 per player"; null hides the fee and payment rows (a free tournament). */
  feeValue: string | null;
  paid: boolean;
  exempt: boolean;
  busy: boolean;
  name: string;
  onTogglePaid: (next: boolean) => void;
  pointsVisible: boolean;
  pointsEditable: boolean;
  points: string | null;
  onCommitPoints: (value: number | null) => Promise<boolean>;
  error: string | null;
  removeLabel: string;
  onRemove: () => void;
  testID?: string;
}): React.JSX.Element {
  const t = useT();
  return (
    <View style={styles.section} testID={props.testID ?? 'organizer-section'}>
      {props.feeValue !== null && !props.exempt ? (
        <>
          <View style={styles.sectionRow}>
            <Text style={styles.sectionLabel}>{t('mob.part.row_fee')}</Text>
            <Text style={styles.sectionValue}>{props.feeValue}</Text>
          </View>
          <View style={styles.sectionRow}>
            <Text style={styles.sectionLabel}>{t('mob.part.row_payment')}</Text>
            <PaidSwitch value={props.paid} busy={props.busy} name={props.name} onChange={props.onTogglePaid} testID="details-paid" />
          </View>
        </>
      ) : props.exempt ? (
        <Text style={styles.sectionNote}>{t('mob.part.organizer_no_payment')}</Text>
      ) : null}
      {props.pointsVisible ? (
        <View style={styles.sectionRow}>
          <Text style={styles.sectionLabel}>{t('mob.part.row_points')}</Text>
          <PointsBox points={props.points} name={props.name} editable={props.pointsEditable} onCommit={props.onCommitPoints} testID="details-points" wide />
        </View>
      ) : null}
      {props.error ? (
        <Text style={styles.error} accessibilityRole="alert" testID="details-error">
          {props.error}
        </Text>
      ) : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={props.removeLabel}
        onPress={props.onRemove}
        style={styles.removeRow}
        testID="details-remove"
      >
        <Text style={styles.removeText}>{props.removeLabel}</Text>
      </Pressable>
    </View>
  );
}

/** "Are you sure?": the same confirmation pattern as the existing remove dialog (P5). A paid entrant adds the refund line (AD-12). */
export function RemoveConfirmDialog(props: {
  body: string;
  paid: boolean;
  busy: boolean;
  onCancel: () => void;
  onYes: () => void;
}): React.JSX.Element {
  const t = useT();
  return (
    <Modal visible transparent animationType="fade" onRequestClose={props.onCancel}>
      <View style={styles.dialogRoot}>
        <Pressable style={[StyleSheet.absoluteFill, styles.dialogBackdrop]} onPress={props.onCancel} accessibilityRole="button" accessibilityLabel={t('mob.part.remove_cancel')} />
        <View style={styles.dialog} accessibilityViewIsModal testID="remove-confirm">
          <Text style={styles.dialogTitle}>{t('mob.part.remove_title')}</Text>
          <Text style={styles.dialogBody} testID="remove-confirm-body">
            {props.body}
          </Text>
          {props.paid ? (
            <Text style={styles.dialogBody} testID="remove-confirm-paid">
              {t('mob.part.remove_paid_line')}
            </Text>
          ) : null}
          <View style={styles.dialogButtons}>
            <Pressable onPress={props.onCancel} disabled={props.busy} style={styles.dialogButton} accessibilityRole="button" accessibilityLabel={t('mob.part.remove_cancel')} testID="remove-cancel">
              <Text style={styles.dialogCancel}>{t('mob.part.remove_cancel')}</Text>
            </Pressable>
            <Pressable onPress={props.onYes} disabled={props.busy} style={styles.dialogButton} accessibilityRole="button" accessibilityLabel={t('mob.part.remove_yes')} testID="remove-yes">
              <Text style={styles.dialogYes}>{t('mob.part.remove_yes')}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

/** The team icon tile of a team row and of the team details pop-up. */
export function TeamTile({ size = TEAM_TILE }: { size?: number }): React.JSX.Element {
  return (
    <View style={[styles.teamTile, { width: size, height: size, borderRadius: size / 2 }]}>
      <ShieldIcon size={Math.round(size * 0.55)} />
    </View>
  );
}

const styles = StyleSheet.create({
  tiles: { flexDirection: 'row', marginBottom: spacing.sm },
  tile: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: borderWidth.thin,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm + 2,
    marginHorizontal: spacing.xs,
  },
  tileValue: { ...typography.h2, color: colors.textPrimary },
  tileLabel: { ...typography.label, fontWeight: '400', color: colors.textSecondary },
  cash: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderWidth: borderWidth.thin,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
    marginHorizontal: spacing.xs,
    marginBottom: spacing.sm,
  },
  cashText: { flexShrink: 1 },
  cashLabel: { ...typography.caption, color: colors.textPrimary },
  cashSub: { ...typography.label, fontWeight: '400', color: colors.textSecondary },
  cashValue: { ...typography.h2, color: colors.successDark, marginLeft: spacing.sm },
  warning: {
    backgroundColor: colors.warningLight,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md - 4,
    marginHorizontal: spacing.xs,
    marginBottom: spacing.sm,
  },
  warningText: { ...typography.caption, color: colors.textPrimary },
  pointsBox: {
    width: POINTS_BOX_WIDTH,
    height: POINTS_BOX_HEIGHT,
    borderWidth: borderWidth.thin,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    textAlign: 'center',
    paddingVertical: 0,
    ...typography.body,
    color: colors.textPrimary,
  },
  pointsBoxWide: { width: POINTS_BOX_WIDTH + 16 },
  pointsInvalid: { borderColor: colors.error },
  pointsReadOnly: { backgroundColor: colors.track },
  section: { borderTopWidth: borderWidth.thin, borderTopColor: groupView.divider, paddingHorizontal: spacing.md, paddingTop: spacing.sm },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: sizes.touchTarget },
  sectionLabel: { ...typography.body, color: colors.textSecondary },
  sectionValue: { ...typography.bodyBold, color: colors.textPrimary, flexShrink: 1, textAlign: 'right', marginLeft: spacing.sm },
  sectionNote: { ...typography.caption, color: colors.textSecondary, paddingVertical: spacing.sm },
  error: { ...typography.caption, fontWeight: '600', color: colors.error, marginBottom: spacing.sm },
  removeRow: { minHeight: sizes.touchTarget, alignItems: 'center', justifyContent: 'center', borderTopWidth: borderWidth.thin, borderTopColor: groupView.divider },
  removeText: { ...typography.bodyBold, color: groupView.destructive },
  dialogRoot: { flex: 1, justifyContent: 'center', paddingHorizontal: spacing.lg },
  dialogBackdrop: { backgroundColor: groupView.dim },
  dialog: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg - 4 },
  dialogTitle: { ...typography.h3, color: colors.textPrimary },
  dialogBody: { ...typography.caption, color: colors.textSecondary, marginTop: spacing.sm },
  dialogButtons: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: spacing.md },
  dialogButton: { minHeight: sizes.touchTarget, minWidth: 72, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.md },
  dialogCancel: { ...typography.bodyBold, color: colors.textSecondary },
  dialogYes: { ...typography.bodyBold, color: groupView.destructive },
  teamTile: { backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
});
