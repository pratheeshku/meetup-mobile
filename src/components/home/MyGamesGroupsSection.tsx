/**
 * "My Games & Groups": two side-by-side stat tiles.
 *
 * - My Games: count supplied by the screen (organises or going); tapping
 *   switches the Home dashboard to a filtered "My Games" view (BUG-M04 —
 *   previously inert, since no dedicated "my games" screen existed; the
 *   dashboard now doubles as one via `EventsList`'s `filter` param).
 * - My Groups: count from `getMyGroups()`; tapping goes to the Groups tab.
 *   When the groups request failed (`groupsCount === null`) the count is
 *   dropped from the copy rather than showing a wrong "0".
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, spacing, typography } from '../../theme/tokens';
import StatCard from '../StatCard';

interface MyGamesGroupsSectionProps {
  myGamesCount: number;
  /** `null` when the groups request failed. */
  groupsCount: number | null;
  onPressMyGames: () => void;
  onPressMyGroups: () => void;
}

export default function MyGamesGroupsSection({
  myGamesCount,
  groupsCount,
  onPressMyGames,
  onPressMyGroups,
}: MyGamesGroupsSectionProps): React.JSX.Element {
  const groupsSubtitle =
    groupsCount === null
      ? 'Tap to manage'
      : `${groupsCount} ${groupsCount === 1 ? 'group' : 'groups'} · tap to manage`;

  return (
    <View style={styles.section}>
      <Text style={styles.title} accessibilityRole="header">
        My Games & Groups
      </Text>
      <View style={styles.row}>
        <StatCard
          icon="🎮"
          title="My Games"
          subtitle={`${myGamesCount} active · tap to manage`}
          onPress={onPressMyGames}
          style={styles.tile}
        />
        <StatCard
          icon="👥"
          title="My Groups"
          subtitle={groupsSubtitle}
          onPress={onPressMyGroups}
          style={styles.tile}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: spacing.lg },
  title: { ...typography.h3, fontWeight: '700', color: colors.textPrimary },
  row: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.md },
  tile: { flex: 1 },
});
