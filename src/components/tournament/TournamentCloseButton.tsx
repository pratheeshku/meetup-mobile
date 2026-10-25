/**
 * The X in the tournament view header (DES-MEETUP-ADDENDUM-tournament-registration AD-9, TR-05). It does not replace the system back gesture.
 * No board exists for it; it is the existing cross glyph in a fixed-size touch box.
 */
import React from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { useT } from '../../labels/LabelsContext';
import { colors, sizes } from '../../theme/tokens';
import { CrossIcon } from '../icons/ActionIcons';

export default function TournamentCloseButton({ onPress }: { onPress: () => void }): React.JSX.Element {
  const t = useT();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('mob.reg.close_a11y')}
      onPress={onPress}
      style={styles.box}
      hitSlop={4}
      testID="tournament-close"
    >
      <CrossIcon size={20} color={colors.textPrimary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  box: { width: sizes.touchTarget, height: sizes.touchTarget, alignItems: 'center', justifyContent: 'center' },
});

/** A `headerRight` render function, module-level so it is not a component defined during render (same pattern as `headerAddButton`). */
export function tournamentCloseButton(onPress: () => void): () => React.JSX.Element {
  return () => <TournamentCloseButton onPress={onPress} />;
}
