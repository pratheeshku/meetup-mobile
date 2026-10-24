/**
 * The organizer and committee pop-ups (AD-T6; boards TV2MobPopupOrg, TV2MobPopupCom): picture, display name and
 * nickname of each person, no actions, no email, no number, never an id. One bottom sheet for both: the organizer
 * sheet lists one person, the committee sheet lists the active members.
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useT } from '../../../labels/LabelsContext';
import { colors, spacing, typography } from '../../../theme/tokens';
import type { TournamentPerson } from '../../../types/tournament';
import { CloseIcon } from '../../icons/SharedIcons';
import BottomSheet from '../../skills/BottomSheet';
import UserAvatar from '../../UserAvatar';

const AVATAR = 56;
const CLOSE_BOX = 40;

export default function PeopleSheet({
  title,
  people,
  onClose,
}: {
  title: string;
  people: readonly TournamentPerson[];
  onClose: () => void;
}): React.JSX.Element {
  const t = useT();
  return (
    <BottomSheet onClose={onClose} closeLabel={t('mob.common.close')}>
      <View style={styles.header}>
        <Text style={styles.title} accessibilityRole="header" testID="people-sheet-title">
          {title}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('mob.common.close')}
          onPress={onClose}
          style={styles.close}
          testID="people-sheet-close"
        >
          <CloseIcon size={18} />
        </Pressable>
      </View>
      {people.map(person => (
        <View key={person.user_id} style={styles.row} testID="people-sheet-row">
          <UserAvatar imageUrl={person.avatar_url} name={person.display_name} size={AVATAR} fallback="initials" />
          <View style={styles.text}>
            <Text style={styles.name}>{person.display_name}</Text>
            {person.nickname ? (
              <Text style={styles.nickname}>{t('mob.tournament.v2.sheet_nickname', { nickname: person.nickname })}</Text>
            ) : (
              <Text style={styles.nickname}>{t('mob.user_menu.no_nickname')}</Text>
            )}
          </View>
        </View>
      ))}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md },
  title: { ...typography.h3, color: colors.textPrimary, flex: 1 },
  close: {
    width: CLOSE_BOX,
    height: CLOSE_BOX,
    borderRadius: CLOSE_BOX / 2,
    backgroundColor: colors.track,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm },
  text: { flex: 1, minWidth: 0, marginLeft: spacing.md },
  name: { ...typography.bodyBold, color: colors.textPrimary },
  nickname: { ...typography.caption, color: colors.textSecondary },
});
