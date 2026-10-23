/**
 * Board TournCommitteeAdd: the standard player search (Suggested and Other players, "+" and "−"), people only (a
 * committee member is a user, AD-20: no email rows). People are staged here and applied with "Add n member(s)".
 */
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useT } from '../../../labels/LabelsContext';
import { colors, spacing } from '../../../theme/tokens';
import type { UserSearchResult } from '../../../types/user';
import UserSearchPicker from '../../UserSearchPicker';
import WizardFooter from '../../WizardFooter';
import { StepHeading } from './parts';

export default function CommitteePicker({
  excludeUserIds,
  remaining,
  onDone,
}: {
  excludeUserIds: string[];
  /** How many more people the committee can take. */
  remaining: number;
  onDone: (people: UserSearchResult[]) => void;
}): React.JSX.Element {
  const t = useT();
  const [staged, setStaged] = useState<UserSearchResult[]>([]);
  const full = staged.length >= remaining;
  return (
    <View style={styles.screen}>
      <View style={styles.body}>
        <StepHeading>{t('mob.tw.committee_add')}</StepHeading>
        <UserSearchPicker
          variant="invite"
          selectionMode="staged"
          stagedUserIds={staged.map(person => person.id)}
          excludeUserIds={excludeUserIds}
          placeholder={t('mob.tw.committee_search')}
          entityLabel={t('mob.user_search.entity_player')}
          suggestionContext="players"
          onSelect={user => {
            if (!full) {
              setStaged(list => (list.some(item => item.id === user.id) ? list : [...list, user]));
            }
          }}
          onUnstage={user => setStaged(list => list.filter(item => item.id !== user.id))}
        />
      </View>
      <WizardFooter
        nextLabel={staged.length === 1 ? t('mob.tw.committee_add_one') : t('mob.tw.committee_add_many', { count: staged.length })}
        onNext={() => onDone(staged)}
        nextDisabled={staged.length === 0}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  body: { flex: 1, padding: spacing.md },
});
