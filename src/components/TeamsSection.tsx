/**
 * Groups > Tournament teams (DES-MEETUP-ADDENDUM-team-screens-remarks AD-2): a Mine | Discover switch (the existing `SegmentedSwitch`) over the
 * caller's tournament teams (`GET /teams/mine`) and the Discover list. Both stay mounted once visited; opening Discover reads it again.
 */
import React, { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useT } from '../labels/LabelsContext';
import { spacing } from '../theme/tokens';
import SegmentedSwitch from './SegmentedSwitch';
import TeamsDiscoverContent from './TeamsDiscoverContent';
import TeamsListContent from './TeamsListContent';

type Scope = 'mine' | 'discover';

interface Props {
  onCreateTeam: () => void;
  onOpenTeam: (teamId: string) => void;
  /** Every new value reads Mine (and Discover, once visited) again. */
  reloadKey?: number;
}

export default function TeamsSection({ onCreateTeam, onOpenTeam, reloadKey }: Props): React.JSX.Element {
  const t = useT();
  const [scope, setScope] = useState<Scope>('mine');
  const [discoverVisited, setDiscoverVisited] = useState(false);
  const [discoverReload, setDiscoverReload] = useState(0);

  const change = useCallback((next: Scope) => {
    setScope(next);
    if (next === 'discover') {
      setDiscoverVisited(true);
      setDiscoverReload(value => value + 1);
    }
  }, []);

  return (
    <View style={styles.flex}>
      <View style={styles.switchWrap}>
        <SegmentedSwitch<Scope>
          options={[
            { value: 'mine', label: t('mob.teams.switch_mine') },
            { value: 'discover', label: t('mob.teams.switch_discover') },
          ]}
          value={scope}
          onChange={change}
        />
      </View>
      <View style={[styles.flex, scope === 'mine' ? null : styles.hidden]}>
        <TeamsListContent onCreateTeam={onCreateTeam} onOpenTeam={onOpenTeam} reloadKey={reloadKey} />
      </View>
      {discoverVisited ? (
        <View style={[styles.flex, scope === 'discover' ? null : styles.hidden]}>
          <TeamsDiscoverContent onOpenTeam={onOpenTeam} reloadKey={(reloadKey ?? 0) * 1000 + discoverReload} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  hidden: { display: 'none' },
  switchWrap: { paddingHorizontal: spacing.md, paddingBottom: spacing.sm },
});
