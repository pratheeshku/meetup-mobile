/**
 * Checkbox-style multi-select of groups for sharing a game (create + edit wizard).
 * Search box, per-group member count line, "n selected (max N)", and a hard cap:
 * at the cap unselected rows cannot be added and a message says so. With
 * `max === 1` (tournaments, one group) tapping another group replaces the choice.
 * Selection state is owned by the screen.
 */
import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { CheckIcon } from './icons/ActionIcons';
import { useT } from '../labels/LabelsContext';
import { borderWidth, colors, radius, spacing, typography } from '../theme/tokens';
import type { Group } from '../types/group';
import { getAvatarTint, getInitials } from '../utils/avatarTint';
import { sortByLastActivity } from '../utils/gameGroups';

interface GroupMultiSelectProps {
  groups: Group[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  max: number;
  /** Show "Choose at least one group" while nothing is selected (a group game needs one). Default true. */
  showRequired?: boolean;
}

export default function GroupMultiSelect({
  groups,
  selectedIds,
  onChange,
  max,
  showRequired = true,
}: GroupMultiSelectProps): React.JSX.Element {
  const t = useT();
  const [query, setQuery] = useState('');

  const sorted = useMemo(() => sortByLastActivity(groups), [groups]);
  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return needle ? sorted.filter(group => group.name.toLowerCase().includes(needle)) : sorted;
  }, [sorted, query]);

  const atCap = max > 1 && selectedIds.length >= max;

  const toggle = (id: string): void => {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter(existing => existing !== id));
    } else if (max === 1) {
      onChange([id]);
    } else if (!atCap) {
      onChange([...selectedIds, id]);
    }
  };

  return (
    <View testID="group-multi-select">
      <TextInput
        style={styles.search}
        value={query}
        onChangeText={setQuery}
        placeholder={t('mob.create_game.groups_search_placeholder')}
        placeholderTextColor={colors.textMuted}
        accessibilityLabel={t('mob.create_game.groups_search_a11y')}
        autoCorrect={false}
        autoCapitalize="none"
      />

      {max > 1 ? (
        <Text style={styles.counter} testID="group-selected-count">
          {t('mob.create_game.groups_selected', { count: selectedIds.length, max })}
        </Text>
      ) : null}
      {atCap ? (
        <Text style={styles.capMessage} accessibilityRole="alert" testID="group-cap-message">
          {t('mob.create_game.groups_max_reached', { max })}
        </Text>
      ) : null}
      {showRequired && selectedIds.length === 0 ? (
        <Text style={styles.required} testID="group-required-message">
          {t('mob.create_game.groups_required')}
        </Text>
      ) : null}

      {visible.length === 0 && query.trim() ? (
        <Text style={styles.empty}>{t('mob.create_game.groups_no_match')}</Text>
      ) : null}

      {visible.map(group => {
        const selected = selectedIds.includes(group.id);
        const blocked = !selected && atCap;
        const tint = getAvatarTint(group.name);
        return (
          <TouchableOpacity
            key={group.id}
            testID={`group-option-${group.id}`}
            accessibilityRole="checkbox"
            accessibilityLabel={group.name}
            accessibilityState={{ checked: selected, disabled: blocked }}
            style={[styles.card, selected && styles.cardSelected, blocked && styles.cardBlocked]}
            onPress={() => toggle(group.id)}
          >
            <View style={[styles.avatar, { backgroundColor: tint.bg }]}>
              <Text style={[styles.avatarText, { color: tint.text }]}>{getInitials(group.name)}</Text>
            </View>
            <View style={styles.info}>
              <Text style={styles.name}>{group.name}</Text>
              <Text style={styles.members}>
                {t('mob.create_game.group_members_count', { count: group.member_count ?? 0 })}
              </Text>
            </View>
            <View style={[styles.checkbox, selected && styles.checkboxSelected]}>
              {selected ? <CheckIcon size={14} color={colors.white} /> : null}
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  search: {
    ...typography.body,
    color: colors.textPrimary,
    backgroundColor: colors.surface,
    borderWidth: borderWidth.thin,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.sm,
  },
  counter: { ...typography.caption, color: colors.textSecondary, marginBottom: spacing.xs },
  capMessage: { ...typography.caption, color: colors.warningDark, marginBottom: spacing.sm },
  required: { ...typography.caption, color: colors.error, marginBottom: spacing.sm },
  empty: { ...typography.body, color: colors.textSecondary, paddingVertical: spacing.md },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: borderWidth.thin,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  cardSelected: { borderColor: colors.primary, borderWidth: borderWidth.thick },
  cardBlocked: { opacity: 0.5 },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { ...typography.bodyBold },
  info: { flex: 1, marginLeft: spacing.md },
  name: { ...typography.bodyBold, color: colors.textPrimary },
  members: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: radius.sm,
    borderWidth: borderWidth.thick,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxSelected: { borderColor: colors.primary, backgroundColor: colors.primary },
});
