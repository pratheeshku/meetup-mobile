/**
 * The two pieces of the registration flow (DES-MEETUP-ADDENDUM-tournament-registration AD-5; no board exists, so they are built minimal
 * from the existing `BottomSheet` and the theme tokens, for the owner to review):
 *
 * - `RegistrationConfirmSheet`: ONE sheet for every in-app Register. Tournament name, mode, the fee line (or "Free registration"), the
 *   note that the fee is arranged outside the app, Confirm and Cancel. There is no payment control anywhere. When the fee cannot be read,
 *   Confirm is blocked: an unknown fee is never confirmed.
 * - `RegistrationResultPopup`: ONE pop-up for success and failure. Success: "You're registered" and the fee line. Failure: the label for the
 *   server `code`, a link to the skill-level screen for SKILL_LEVEL_REQUIRED, and Try again only where a retry can work.
 */
import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { useT } from '../../labels/LabelsContext';
import { borderWidth, colors, radius, sizes, spacing, typography } from '../../theme/tokens';
import type { RegistrationFailure } from '../../utils/registration';
import Button from '../Button';
import BottomSheet from '../skills/BottomSheet';

export interface RegistrationConfirmSheetProps {
  name: string;
  /** "Individual registration" or "Team registration" (a label). */
  modeLabel: string;
  feeLine: string;
  /** False when the fee could not be read: Confirm is blocked and a notice says so. */
  feeReadable: boolean;
  /** FEE_CHANGED: the fee was updated from the server's answer and the person is asked again. */
  notice: string | null;
  busy: boolean;
  /** Team mode only (AD-1): the caller's teams for the tournament's sport. Absent in individual mode. */
  teams?: ReadonlyArray<{ id: string; name: string }>;
  selectedTeamId?: string | null;
  onSelectTeam?: (teamId: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

const RADIO_BOX = 24;

export function RegistrationConfirmSheet(props: RegistrationConfirmSheetProps): React.JSX.Element {
  const t = useT();
  return (
    <BottomSheet onClose={props.onCancel} closeLabel={t('mob.reg.cancel')}>
      <View testID="registration-confirm-sheet">
        <Text style={styles.title} accessibilityRole="header">
          {props.name}
        </Text>
        <Text style={styles.mode} testID="registration-mode">
          {props.modeLabel}
        </Text>
        {props.notice ? (
          <Text style={styles.notice} accessibilityRole="alert" testID="registration-notice">
            {props.notice}
          </Text>
        ) : null}
        {props.teams ? (
          <View testID="registration-team-picker" accessibilityRole="radiogroup">
            <Text style={styles.teamLabel}>{t('mob.reg.team_label')}</Text>
            {props.teams.map(team => {
              const selected = team.id === props.selectedTeamId;
              return (
                <Pressable
                  key={team.id}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  accessibilityLabel={team.name}
                  onPress={() => props.onSelectTeam?.(team.id)}
                  disabled={props.busy}
                  style={styles.teamRow}
                  testID={`registration-team-${team.id}`}
                >
                  <View style={[styles.radio, selected ? styles.radioOn : null]}>
                    {selected ? <View style={styles.radioDot} /> : null}
                  </View>
                  <Text style={styles.teamName} numberOfLines={1}>
                    {team.name}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}
        {props.feeReadable ? (
          <>
            <Text style={styles.fee} testID="registration-fee-line">
              {props.feeLine}
            </Text>
            <Text style={styles.note} testID="registration-fee-note">
              {t('mob.reg.fee_note')}
            </Text>
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

export interface RegistrationResultPopupProps {
  /** Success: the fee line shown under "You're registered". Failure: ignored. */
  feeLine: string;
  /** Null = success. */
  failure: RegistrationFailure | null;
  onRetry: () => void;
  onSkillLevel: () => void;
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
        <View style={styles.popup} testID={failure ? 'registration-result-failure' : 'registration-result-success'}>
          <Text style={styles.title} accessibilityRole="header">
            {failure ? t('mob.reg.failure_title') : t('mob.reg.success_title')}
          </Text>
          {failure ? (
            <Text style={styles.message} accessibilityRole="alert" testID="registration-result-message">
              {t(failure.labelKey)}
            </Text>
          ) : (
            <Text style={styles.message} testID="registration-result-fee">
              {props.feeLine}
            </Text>
          )}
          {failure?.skillLevelLink ? (
            <Button
              label={t('mob.reg.err.skill_level_link')}
              variant="secondary"
              onPress={props.onSkillLevel}
              style={styles.popupButton}
              testID="registration-skill-link"
            />
          ) : null}
          {failure?.canRetry ? (
            <Button
              label={t('mob.reg.retry')}
              onPress={props.onRetry}
              style={styles.popupButton}
              testID="registration-retry"
            />
          ) : null}
          <Button
            label={t('mob.common.close')}
            variant="secondary"
            onPress={props.onClose}
            style={styles.popupButton}
            testID="registration-result-close"
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  title: { ...typography.h3, color: colors.textPrimary },
  mode: { ...typography.caption, color: colors.textSecondary, marginTop: spacing.xs },
  fee: { ...typography.bodyBold, color: colors.textPrimary, marginTop: spacing.md },
  note: { ...typography.caption, color: colors.textSecondary, marginTop: spacing.sm },
  notice: { ...typography.bodyBold, color: colors.error, marginTop: spacing.md },
  teamLabel: { ...typography.bodyBold, color: colors.textPrimary, marginTop: spacing.md },
  teamRow: { flexDirection: 'row', alignItems: 'center', minHeight: sizes.touchTarget },
  radio: {
    width: RADIO_BOX,
    height: RADIO_BOX,
    borderRadius: RADIO_BOX / 2,
    borderWidth: borderWidth.medium,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  radioOn: { borderColor: colors.ctaBlue },
  radioDot: { width: RADIO_BOX / 2, height: RADIO_BOX / 2, borderRadius: RADIO_BOX / 4, backgroundColor: colors.ctaBlue },
  teamName: { ...typography.body, color: colors.textPrimary, flex: 1 },
  buttons: { flexDirection: 'row', marginTop: spacing.lg },
  button: { flex: 1, marginHorizontal: spacing.xs },
  popupRoot: { flex: 1, justifyContent: 'center', paddingHorizontal: spacing.lg },
  backdrop: { backgroundColor: colors.scrim },
  popup: {
    backgroundColor: colors.background,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  message: { ...typography.body, color: colors.textPrimary, marginTop: spacing.sm },
  popupButton: { marginTop: spacing.md },
});
