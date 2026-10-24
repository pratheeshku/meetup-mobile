/**
 * Folder-style tabs of the tournament page (AD-T5, TE-06, TE-07, TE-08; boards TV2MobOpen, TV2MobOpenLockFixtures,
 * TV2MobLiveLockResults), same look as the Home tabs. The tabs and their open or locked state come from the server
 * `tabs` object only (the entries are built by `tabEntries`); a tab the server did not send is not drawn, and Approvals
 * appears only when the server sent it. A locked tab is greyed and carries a lock glyph (state is not colour alone);
 * it still opens its greyed preview. The row scrolls horizontally. Active 52, inactive 44 (board sizes).
 */
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useT } from '../../../labels/LabelsContext';
import type { LabelKey } from '../../../labels/fallbackLabels';
import { dash } from '../../../theme/dashboardTheme';
import { borderWidth, colors, spacing } from '../../../theme/tokens';
import type { TournamentTabKey } from '../../../types/tournamentScoring';
import { unlockLabelKey, type TabEntry } from '../../../utils/tournamentExperience';
import { LockIcon } from '../../icons/ActionIcons';

export const TAB_ACTIVE_HEIGHT = 52;
export const TAB_IDLE_HEIGHT = 44;
const LOCK_BOX = 16;

export function tabLabelKey(key: TournamentTabKey): LabelKey {
  return `mob.tournament.tabs.${key}` as LabelKey;
}

export default function TournamentTabs({
  entries,
  selected,
  onSelect,
}: {
  entries: TabEntry[];
  selected: TournamentTabKey;
  onSelect: (key: TournamentTabKey) => void;
}): React.JSX.Element {
  const t = useT();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.scroll}
      contentContainerStyle={styles.row}
      accessibilityRole="tablist"
      accessibilityLabel={t('mob.tournament.tabs.aria')}
      testID="tournament-tabs"
    >
      {entries.map(entry => {
        const active = entry.key === selected;
        const name = t(tabLabelKey(entry.key));
        const a11y = entry.locked
          ? t('mob.tournament.tabs.locked_aria', { tab: name, when: t(unlockLabelKey(entry.unlocks)) })
          : entry.badge
          ? `${name}. ${t('mob.tournament.tabs.badge_aria', { count: entry.badge })}`
          : name;
        return (
          <Pressable
            key={entry.key}
            accessibilityRole="tab"
            accessibilityLabel={a11y}
            accessibilityState={{ selected: active }}
            onPress={() => onSelect(entry.key)}
            style={[
              styles.tab,
              active ? styles.tabActive : entry.locked ? styles.tabLocked : styles.tabIdle,
            ]}
            testID={`tournament-tab-${entry.key}`}
          >
            <Text
              style={[styles.label, active ? styles.labelActive : entry.locked ? styles.labelLocked : null]}
              numberOfLines={1}
            >
              {name}
            </Text>
            {entry.locked ? (
              <View style={styles.lockBox} testID={`tournament-tab-lock-${entry.key}`}>
                <LockIcon size={13} color={colors.textMuted} />
              </View>
            ) : null}
            {!entry.locked && entry.badge ? (
              <View style={styles.badge} testID={`tournament-tab-badge-${entry.key}`}>
                <Text style={styles.badgeText}>{entry.badge}</Text>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 0, marginTop: spacing.sm + 4 },
  row: { paddingHorizontal: spacing.md, alignItems: 'flex-end', height: TAB_ACTIVE_HEIGHT },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    marginRight: 4,
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    borderWidth: borderWidth.medium,
    borderBottomWidth: 0,
  },
  tabActive: {
    height: TAB_ACTIVE_HEIGHT,
    backgroundColor: dash.page,
    borderColor: dash.panelBorder,
    borderTopWidth: 3,
    borderTopColor: dash.brand,
    marginBottom: -borderWidth.medium,
    zIndex: 3,
    elevation: 0,
  },
  tabIdle: { height: TAB_IDLE_HEIGHT, backgroundColor: dash.tabIdleBg, borderColor: dash.tabIdleBorder },
  tabLocked: { height: TAB_IDLE_HEIGHT, backgroundColor: colors.track, borderColor: colors.border },
  label: { fontSize: 13, fontWeight: '800', color: dash.text },
  labelActive: { color: dash.brand },
  labelLocked: { color: colors.textMuted },
  lockBox: { width: LOCK_BOX, height: LOCK_BOX, alignItems: 'center', justifyContent: 'center', marginLeft: 6 },
  badge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.error,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 6,
    paddingHorizontal: 4,
  },
  badgeText: { fontSize: 11, fontWeight: '800', color: colors.white },
});
