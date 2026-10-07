/**
 * Tournament Teams screen (Shuttlr Home v2).
 *
 * Reached from hamburger drawer "Groups > Tournament teams".
 * Displays admin WIP strip at the top, functionality unchanged / coming soon.
 */
import React from 'react';
import { StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import EmptyState from '../components/EmptyState';
import WipStrip from '../components/WipStrip';
import { useT } from '../labels/LabelsContext';
import type { GroupsStackParamList } from '../navigation/types';
import { colors, spacing } from '../theme/tokens';

type Props = NativeStackScreenProps<GroupsStackParamList, 'TournamentTeams'>;

export default function TournamentTeamsScreen({}: Props): React.JSX.Element {
  const t = useT();

  return (
    <View style={styles.root}>
      <WipStrip labelKey="mob.wip.banner_text" />
      <View style={styles.content}>
        <EmptyState
          title={t('mob.menu.tournament_teams')}
          subtitle={t('mob.wip.banner_text')}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.md,
  },
});
