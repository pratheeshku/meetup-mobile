/**
 * The pieces of the registration flow (DES-MEETUP-ADDENDUM-teams-payments AD-3, AD-7; board J2-J6):
 *
 * - `RegistrationConfirmSheet` (J2 individual, J3 tournament team): ONE sheet for every in-app Register. The fee row, the payment note ("the app does
 *   not take payment; you will see the organizer's PayNow/PayLah number after you register"; none on a free tournament), Cancel and Confirm. In team
 *   mode a dropdown lists the caller's tournament teams for the sport. When the fee cannot be read, Confirm is blocked.
 * - `RegistrationResultPopup` (J4 success, J6 failure): success shows "You're registered", the fee, and, when a fee applies, the number to pay to
 *   (the server's `payment_contact_number`, only when it returned one) with the Payment pending chip. Failure shows the label for the server `code`;
 *   its buttons are Close and, where it helps, Choose tournament team (NOT_TEAM_MEMBER), Set skill level or Try again.
 * - `CreateTeamPrompt` (J5): a team tournament and no eligible tournament team. Its button opens the Create team form.
 * The payee number is never logged and appears here only in the success pop-up of the person who just registered.
 */
import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { useT } from '../../labels/LabelsContext';
import { borderWidth, colors, radius, spacing, typography } from '../../theme/tokens';
import { formatPayeeNumber } from '../../utils/phoneNumber';
import type { RegistrationFailure } from '../../utils/registration';
import Button from '../Button';
import DropdownField from '../DropdownField';
import { CheckIcon } from '../icons/ActionIcons';
import BottomSheet from '../skills/BottomSheet';

export interface RegistrationConfirmSheetProps {
  title: string;
  subtitle: string;
  /** The "Entry: Individual" row (individual mode); team mode shows the team dropdown instead. */
  entryLabel: string | null;
  /** The fee value: "S$10.00 per player", "S$40.00 per tournament team" or "Free registration". Empty while the fee cannot be read. */
  feeValue: string;
  /** The payment note under the fee; null for a free tournament. */
  paymentNote: string | null;
  /** False when the fee could not be read: Confirm is blocked and a notice says so. */
  feeReadable: boolean;
  /** FEE_CHANGED: the fee was updated from the server's answer and the person is asked again. */
  notice: string | null;
  busy: boolean;
  /** Team mode only (AD-3): the caller's tournament teams for the tournament's sport, each with its dropdown text. Absent in individual mode. */
  teams?: ReadonlyArray<{ id: string; label: string }>;
  selectedTeamId?: string | null;
  onSelectTeam?: (teamId: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

export function RegistrationConfirmSheet(props: RegistrationConfirmSheetProps): React.JSX.Element {
  const t = useT();
  return (
    <BottomSheet onClose={props.onCancel} closeLabel={t('mob.reg.cancel')}>
      <View testID="registration-confirm-sheet">
        <Text style={styles.sheetTitle} accessibilityRole="header">
          {props.title}
        </Text>
        <Text style={styles.sheetSub}>{props.subtitle}</Text>
        {props.notice ? (
          <Text style={styles.notice} accessibilityRole="alert" testID="registration-notice">
            {props.notice}
          </Text>
        ) : null}
        {props.teams ? (
          <View testID="registration-team-picker">
            <Text style={styles.fieldLabel}>{t('mob.reg.team_field')}</Text>
            <DropdownField
              options={props.teams.map(team => ({ value: team.id, label: team.label }))}
              value={props.selectedTeamId ?? null}
              onChange={id => props.onSelectTeam?.(id)}
              placeholder={t('mob.reg.team_label')}
              accessibilityLabel={t('mob.reg.team_label')}
              disabled={props.busy}
              style={styles.dropdown}
            />
          </View>
        ) : props.entryLabel ? (
          <View style={styles.line}>
            <Text style={styles.lineLabel}>{t('mob.reg.entry_label')}</Text>
            <Text style={styles.lineValue} testID="registration-mode">
              {props.entryLabel}
            </Text>
          </View>
        ) : null}
        {props.feeReadable ? (
          <>
            <View style={styles.line}>
              <Text style={styles.lineLabel}>{t('mob.reg.fee_label')}</Text>
              <Text style={styles.lineValue} testID="registration-fee-line">
                {props.feeValue}
              </Text>
            </View>
            {props.paymentNote ? (
              <View style={styles.box}>
                <Text style={styles.boxText} testID="registration-fee-note">
                  {props.paymentNote}
                </Text>
              </View>
            ) : null}
          </>
        ) : (
          <Text style={styles.notice} accessibilityRole="alert" testID="registration-fee-unknown">
            {t('mob.reg.fee_unknown')}
          </Text>
        )}
        <View style={styles.buttons}>
          <Button
            label={t('mob.reg.cancel')}
            variant="secondary"
            onPress={props.onCancel}
            disabled={props.busy}
            style={styles.button}
            testID="registration-cancel"
          />
          <Button
            label={t('mob.reg.confirm')}
            variant="cta"
            onPress={props.onConfirm}
            loading={props.busy}
            disabled={!props.feeReadable || (Boolean(props.teams) && !props.selectedTeamId)}
            style={styles.button}
            testID="registration-confirm"
          />
        </View>
      </View>
    </BottomSheet>
  );
}

/** What the success pop-up shows under "You're registered" when a fee applies (teams-payments AD-7). */
export interface RegistrationPaymentInfo {
  /** "S$10.00" */
  amount: string;
  /** The payee number as the API returned it; null when it did not (then "Ask the organizer how to pay"). */
  number: string | null;
}

export interface RegistrationResultPopupProps {
  /** Success: "City Open · S$10.00 per player" (or "· Free registration"). Failure: ignored. */
  subtitle: string;
  /** Null = success. */
  failure: RegistrationFailure | null;
  /** Success on a tournament with a fee: the amount and the number to pay to. Null for a free tournament. */
  payment: RegistrationPaymentInfo | null;
  onRetry: () => void;
  onSkillLevel: () => void;
  onChooseTeam: () => void;
  onClose: () => void;
}

export function RegistrationResultPopup(props: RegistrationResultPopupProps): React.JSX.Element {
  const t = useT();
  const { failure } = props;
  return (
    <Modal transparent visible animationType="fade" statusBarTranslucent onRequestClose={props.onClose}>
      <View style={styles.popupRoot}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('mob.reg.close_a11y')}
          onPress={props.onClose}
          style={[StyleSheet.absoluteFill, styles.backdrop]}
        />
        <View style={[styles.popup, styles.popupCentered]} testID={failure ? 'registration-result-failure' : 'registration-result-success'}>
          <View style={[styles.circle, failure ? styles.circleError : styles.circleOk]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            {failure ? <Text style={styles.cross}>×</Text> : <CheckIcon size={26} color={colors.successDark} />}
          </View>
          <Text style={styles.popupTitle} accessibilityRole="header">
            {failure ? t('mob.reg.failure_title') : t('mob.reg.success_title')}
          </Text>
          {failure ? (
            <Text style={styles.message} accessibilityRole="alert" testID="registration-result-message">
              {t(failure.labelKey, failure.labelParams)}
            </Text>
          ) : (
            <>
              <Text style={styles.message} testID="registration-result-fee">
                {props.subtitle}
              </Text>
              {props.payment ? (
                <>
                  <View style={[styles.box, styles.boxLeft]} testID="registration-result-payment">
                    {props.payment.number ? (
                      <>
                        <Text style={styles.boxText}>{t('mob.pay.result_pay', { amount: props.payment.amount })}</Text>
                        <Text style={styles.boxNumber} testID="registration-result-number">
                          {formatPayeeNumber(props.payment.number)}
                        </Text>
                        <Text style={styles.boxMuted}>{t('mob.pay.result_confirm')}</Text>
                      </>
                    ) : (
                      <Text style={styles.boxText}>{t('mob.pay.no_number')}</Text>
                    )}
                  </View>
                  <View style={styles.chip}>
                    <Text style={styles.chipText}>{t('mob.pay.status_pending')}</Text>
                  </View>
                </>
              ) : null}
            </>
          )}
          {failure ? (
            <View style={styles.buttons}>
              <Button
                label={t('mob.common.close')}
                variant="secondary"
                onPress={props.onClose}
                style={styles.button}
                testID="registration-result-close"
              />
              {failure.chooseTeamLink ? (
                <Button
                  label={t('mob.reg.choose_team')}
                  variant="cta"
                  onPress={props.onChooseTeam}
                  style={styles.button}
                  testID="registration-choose-team"
                />
              ) : null}
              {failure.skillLevelLink ? (
                <Button
                  label={t('mob.reg.err.skill_level_link')}
                  variant="cta"
                  onPress={props.onSkillLevel}
                  style={styles.button}
                  testID="registration-skill-link"
                />
              ) : null}
              {failure.canRetry ? (
                <Button label={t('mob.reg.retry')} variant="cta" onPress={props.onRetry} style={styles.button} testID="registration-retry" />
              ) : null}
            </View>
          ) : (
            <Button
              label={t('mob.pay.result_done')}
              variant="cta"
              onPress={props.onClose}
              style={styles.doneButton}
              testID="registration-result-close"
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

export interface CreateTeamPromptProps {
  tournamentName: string;
  /** The sport's display name. */
  sport: string;
  onNotNow: () => void;
  onCreate: () => void;
}

/** J5: a team tournament and no eligible tournament team. */
export function CreateTeamPrompt(props: CreateTeamPromptProps): React.JSX.Element {
  const t = useT();
  return (
    <Modal transparent visible animationType="fade" statusBarTranslucent onRequestClose={props.onNotNow}>
      <View style={styles.popupRoot}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('mob.reg.close_a11y')}
          onPress={props.onNotNow}
          style={[StyleSheet.absoluteFill, styles.backdrop]}
        />
        <View style={styles.popup} testID="registration-create-team-prompt">
          <Text style={styles.popupTitleLeft} accessibilityRole="header">
            {t('mob.reg.noteam_title')}
          </Text>
          <Text style={styles.messageLeft} testID="registration-create-team-message">
            {t('mob.reg.noteam_body', { name: props.tournamentName, sport: props.sport })}
          </Text>
          <View style={styles.buttons}>
            <Button label={t('mob.reg.noteam_not_now')} variant="secondary" onPress={props.onNotNow} style={styles.button} testID="registration-create-team-not-now" />
            <Button label={t('mob.reg.noteam_create')} variant="cta" onPress={props.onCreate} style={styles.button} testID="registration-create-team-create" />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const CIRCLE = 52;

const styles = StyleSheet.create({
  sheetTitle: { ...typography.h3, color: colors.textPrimary },
  sheetSub: { ...typography.caption, color: colors.textSecondary, marginTop: spacing.xs, marginBottom: spacing.sm },
  fieldLabel: { ...typography.label, color: colors.textPrimary, marginTop: spacing.sm, marginBottom: spacing.xs },
  dropdown: { marginBottom: spacing.xs },
  line: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  lineLabel: { ...typography.body, color: colors.textSecondary },
  lineValue: { ...typography.bodyBold, color: colors.textPrimary, flexShrink: 1, textAlign: 'right', marginLeft: spacing.sm },
  box: {
    backgroundColor: colors.background,
    borderWidth: borderWidth.thin,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md - 4,
    marginTop: spacing.sm,
  },
  boxLeft: { alignSelf: 'stretch' },
  boxText: { ...typography.caption, color: colors.textPrimary },
  boxNumber: { ...typography.bodyBold, color: colors.textPrimary, marginTop: spacing.xs },
  boxMuted: { ...typography.label, fontWeight: '400', color: colors.textSecondary, marginTop: spacing.xs },
  notice: { ...typography.bodyBold, color: colors.error, marginTop: spacing.md },
  buttons: { flexDirection: 'row', marginTop: spacing.md },
  button: { flex: 1, marginHorizontal: spacing.xs },
  doneButton: { alignSelf: 'stretch', marginTop: spacing.md },
  popupRoot: { flex: 1, justifyContent: 'center', paddingHorizontal: spacing.lg },
  backdrop: { backgroundColor: colors.scrim },
  popup: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg - 4 },
  popupCentered: { alignItems: 'center' },
  circle: { width: CIRCLE, height: CIRCLE, borderRadius: CIRCLE / 2, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm },
  circleOk: { backgroundColor: colors.successLight },
  circleError: { backgroundColor: colors.errorLight },
  cross: { fontSize: 30, lineHeight: 34, fontWeight: '700', color: colors.error },
  popupTitle: { ...typography.h3, color: colors.textPrimary, textAlign: 'center' },
  popupTitleLeft: { ...typography.h3, color: colors.textPrimary },
  message: { ...typography.caption, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.xs, marginBottom: spacing.sm },
  messageLeft: { ...typography.caption, color: colors.textSecondary, marginTop: spacing.xs },
  chip: { backgroundColor: colors.warningLight, borderRadius: radius.full, paddingHorizontal: spacing.sm + 2, paddingVertical: 3, marginTop: spacing.sm },
  chipText: { ...typography.label, color: colors.textPrimary },
});
