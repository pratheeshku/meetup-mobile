/**
 * Step 6, boards TournVis / TournVisCap (the Public / Private choice and the group list). Private with groups is the
 * contract's `group` (AD-20 step 4), private with none is `invite`. Selecting a group sends no invitation (OI-15).
 * The groups use the shared "+" / "−" list (AD-19); at the cap the other rows' "+" is off.
 */
import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useT } from '../../../labels/LabelsContext';
import { colors, spacing, typography } from '../../../theme/tokens';
import type { Group } from '../../../types/group';
import IconBadge from '../../IconBadge';
import InlineError from '../../InlineError';
import SelectableCard from '../../SelectableCard';
import TextField from '../../TextField';
import { GroupInviteList } from '../../AddRemoveControl';
import { LockIcon } from '../../icons/ActionIcons';
import { GroupsIcon } from '../../icons/SharedIcons';
import { Banner, SectionCard, StepHeading } from './parts';
import { groupCapReached, type WizardState } from '../../../utils/tournamentWizard';

const BADGE = 44;

export default function VisibilityStep({
  state,
  groups,
  groupsError,
  onRetryGroups,
  cap,
  onChange,
  onToggleGroup,
  serverError,
}: {
  state: WizardState;
  groups: Group[];
  groupsError: boolean;
  onRetryGroups: () => void;
  cap: number;
  onChange: (patch: Partial<WizardState>) => void;
  onToggleGroup: (groupId: string) => void;
  /** A rejection the server returned for this step (cap exceeded, not a member). */
  serverError: string | null;
}): React.JSX.Element {
  const t = useT();
  const [query, setQuery] = useState('');
  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return needle ? groups.filter(group => group.name.toLowerCase().includes(needle)) : groups;
  }, [groups, query]);
  const atCap = groupCapReached(state, cap);
  const unselectedIds = groups.filter(group => !state.groupIds.includes(group.id)).map(group => group.id);
  return (
    <View>
      <StepHeading>{t('mob.tw.step_visibility')}</StepHeading>
      <SelectableCard
        testID="tw-vis-public"
        title={t('mob.tw.vis_public')}
        subtitle={t('mob.tw.vis_public_sub')}
        leading={
          <IconBadge size={BADGE} color="green">
            <GroupsIcon size={22} />
          </IconBadge>
        }
        selected={!state.isPrivate}
        onPress={() => onChange({ isPrivate: false })}
        style={styles.option}
      />
      <SelectableCard
        testID="tw-vis-private"
        title={t('mob.tw.vis_private')}
        subtitle={t('mob.tw.vis_private_sub')}
        leading={
          <IconBadge size={BADGE} color="amber">
            <LockIcon size={22} color={colors.white} />
          </IconBadge>
        }
        selected={state.isPrivate}
        onPress={() => onChange({ isPrivate: true })}
        style={styles.option}
      />
      {state.isPrivate ? (
        <SectionCard style={styles.groups}>
          <View style={styles.groupsHeader}>
            <Text style={styles.groupsTitle}>{t('mob.tw.vis_groups')}</Text>
            <Text style={[styles.count, atCap ? styles.countCap : null]} testID="tw-group-count">
              {t('mob.tw.vis_groups_count', { count: state.groupIds.length, cap })}
            </Text>
          </View>
          <TextField
            value={query}
            onChangeText={setQuery}
            placeholder={t('mob.tw.vis_groups_search')}
            accessibilityLabel={t('mob.tw.vis_groups_search')}
            testID="tw-group-search"
          />
          {groupsError ? (
            <InlineError message={t('mob.tw.vis_groups_load_error')} onRetry={onRetryGroups} />
          ) : groups.length === 0 ? (
            <Text style={styles.empty}>{t('mob.tw.vis_groups_none')}</Text>
          ) : visible.length === 0 ? (
            <Text style={styles.empty}>{t('mob.tw.vis_groups_no_match')}</Text>
          ) : (
            <GroupInviteList
              groups={visible}
              selectedIds={state.groupIds}
              onToggle={onToggleGroup}
              disabledIds={atCap ? unselectedIds : []}
            />
          )}
          {atCap ? <Banner tone="error" message={t('mob.tw.err_group_cap', { cap })} testID="tw-group-cap" /> : null}
          {serverError ? <Banner tone="error" message={serverError} testID="tw-vis-error" /> : null}
        </SectionCard>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  option: { marginBottom: spacing.sm },
  groups: { marginTop: spacing.sm },
  groupsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  groupsTitle: { ...typography.label, color: colors.textSecondary, textTransform: 'uppercase' },
  count: { ...typography.label, color: colors.textSecondary },
  countCap: { color: colors.error },
  empty: { ...typography.body, color: colors.textSecondary, paddingVertical: spacing.md },
});
