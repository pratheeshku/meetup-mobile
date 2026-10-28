/**
 * Step 7, boards TournCommittee / TournCommitteeMin and the add picker TournCommitteeAdd. The organizer is member 1,
 * pinned and not removable; each added person shows the shared "−" (AD-19, staged); "Add committee member" opens the
 * standard player search (suggested / other players). At least one additional member is required (AD-20).
 *
 * Remarks (team-screens-remarks AD-4, D-2): the optional description row, moved here from step 1, is the last input before the review. The
 * addendum is the board of record for the moved row.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useAuth } from '../../../auth/AuthContext';
import { useTextFocus } from '../../../hooks/useAccessibilityFocus';
import { useT } from '../../../labels/LabelsContext';
import { borderWidth, colors, radius, spacing, typography } from '../../../theme/tokens';
import AddRemoveControl, { AddEntryRow } from '../../AddRemoveControl';
import UserAvatar from '../../UserAvatar';
import { ShieldIcon } from '../../icons/SharedIcons';
import TextField from '../../TextField';
import { Banner, FieldError, FieldLabel, StepHeading, tokenFor, type StepFocus } from './parts';
import { DESCRIPTION_MAX, type WizardState } from '../../../utils/tournamentWizard';

const AVATAR = 40;
const ICON_BOX = 24;

export default function CommitteeStep({
  state,
  onRemove,
  onOpenPicker,
  errorMessage,
  max,
  focus,
  onChange,
  remarksError,
}: {
  state: WizardState;
  onRemove: (userId: string) => void;
  onOpenPicker: () => void;
  errorMessage: string | null;
  /** Additional members still allowed (`committee_max - 1 - added`). */
  max: number;
  focus?: StepFocus;
  onChange: (patch: Partial<WizardState>) => void;
  /** The Remarks length message, shown under the field. */
  remarksError?: string;
}): React.JSX.Element {
  const t = useT();
  const { user } = useAuth();
  const remarksRef = useTextFocus(tokenFor(focus, 'description'));
  return (
    <View>
      <StepHeading>{t('mob.tw.step_committee')}</StepHeading>
      <View style={styles.row} testID="tw-committee-organizer">
        <UserAvatar name={user?.display_name ?? t('mob.tw.committee_you')} imageUrl={null} size={AVATAR} fallback="initials" />
        <View style={styles.rowText}>
          <Text style={styles.name}>{t('mob.tw.committee_you')}</Text>
          <Text style={styles.sub}>{t('mob.tw.committee_you_sub')}</Text>
        </View>
        <View style={styles.chip}>
          <Text style={styles.chipText}>{t('mob.tw.committee_creator')}</Text>
        </View>
      </View>
      {state.committee.map(person => (
        <View key={person.id} style={styles.row} testID={`tw-committee-${person.id}`}>
          <UserAvatar name={person.displayName} imageUrl={null} size={AVATAR} fallback="initials" />
          <View style={styles.rowText}>
            <Text style={styles.name}>{person.displayName}</Text>
            <Text style={styles.sub}>{t('mob.tw.committee_member')}</Text>
          </View>
          <AddRemoveControl
            mode="staged"
            name={person.displayName}
            staged
            onStage={() => undefined}
            onUnstage={() => onRemove(person.id)}
            testID={`tw-committee-remove-${person.id}`}
          />
        </View>
      ))}
      {errorMessage ? <Banner tone="error" message={errorMessage} testID="tw-committee-error" /> : null}
      <View style={styles.addWrap}>
        <AddEntryRow
          title={t('mob.tw.committee_add')}
          onPress={onOpenPicker}
          disabled={max <= 0}
          focusToken={tokenFor(focus, 'committee_add')}
          testID="tw-committee-add"
        />
      </View>
      <View style={styles.info}>
        <View style={styles.iconBox}>
          <ShieldIcon size={18} />
        </View>
        <Text style={styles.infoText}>{t('mob.tw.committee_info')}</Text>
      </View>

      <View style={styles.remarks}>
        <FieldLabel>{t('mob.tw.description')}</FieldLabel>
        <TextField
          ref={remarksRef}
          value={state.description}
          onChangeText={description => onChange({ description })}
          placeholder={t('mob.remarks.placeholder')}
          multiline
          maxLength={DESCRIPTION_MAX + 20}
          accessibilityLabel={t('mob.tw.description')}
          style={styles.multiline}
          testID="tw-description"
        />
        <FieldError message={remarksError} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: borderWidth.thin,
    borderColor: colors.border,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  rowText: { flex: 1, marginLeft: spacing.sm },
  name: { ...typography.bodyBold, color: colors.textPrimary },
  sub: { ...typography.caption, color: colors.textSecondary },
  chip: { backgroundColor: colors.ownerChipBg, borderRadius: radius.full, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  chipText: { ...typography.label, color: colors.ownerChipText },
  addWrap: { marginTop: spacing.xs },
  remarks: { marginTop: spacing.md },
  multiline: { minHeight: 96, textAlignVertical: 'top' },
  info: { flexDirection: 'row', backgroundColor: colors.primaryLight, borderRadius: radius.md, padding: spacing.md, marginTop: spacing.md },
  iconBox: { width: ICON_BOX, height: ICON_BOX, alignItems: 'center', justifyContent: 'center' },
  infoText: { ...typography.caption, fontWeight: '600', color: colors.primaryDark, flex: 1, marginLeft: spacing.sm },
});
