/**
 * Step 7, boards TournCommittee / TournCommitteeMin and the add picker TournCommitteeAdd. The organizer is member 1,
 * pinned and not removable; each added person shows the shared "−" (AD-19, staged); "Add committee member" opens the
 * standard player search (suggested / other players). At least one additional member is required (AD-20).
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useAuth } from '../../../auth/AuthContext';
import { useT } from '../../../labels/LabelsContext';
import { borderWidth, colors, radius, spacing, typography } from '../../../theme/tokens';
import AddRemoveControl, { AddEntryRow } from '../../AddRemoveControl';
import UserAvatar from '../../UserAvatar';
import { ShieldIcon } from '../../icons/SharedIcons';
import { Banner, StepHeading, tokenFor, type StepFocus } from './parts';
import type { WizardState } from '../../../utils/tournamentWizard';

const AVATAR = 40;
const ICON_BOX = 24;

export default function CommitteeStep({
  state,
  onRemove,
  onOpenPicker,
  errorMessage,
  max,
  focus,
}: {
  state: WizardState;
  onRemove: (userId: string) => void;
  onOpenPicker: () => void;
  errorMessage: string | null;
  /** Additional members still allowed (`committee_max - 1 - added`). */
  max: number;
  focus?: StepFocus;
}): React.JSX.Element {
  const t = useT();
  const { user } = useAuth();
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
  info: { flexDirection: 'row', backgroundColor: colors.primaryLight, borderRadius: radius.md, padding: spacing.md, marginTop: spacing.md },
  iconBox: { width: ICON_BOX, height: ICON_BOX, alignItems: 'center', justifyContent: 'center' },
  infoText: { ...typography.caption, fontWeight: '600', color: colors.primaryDark, flex: 1, marginLeft: spacing.sm },
});
