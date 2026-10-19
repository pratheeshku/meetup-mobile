/**
 * Person name block used by every person row (group members, invite search,
 * Added lists): display name first and prominent, nickname smaller below.
 * The nickname is left out when it is empty or the same as the display name.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { StyleProp, TextStyle } from 'react-native';

import { colors, groupView, typography } from '../theme/tokens';

interface PersonNamesProps {
  displayName: string;
  nickname?: string | null;
  /** Larger text for the long-press member card. */
  large?: boolean;
  centered?: boolean;
  nameStyle?: StyleProp<TextStyle>;
}

export default function PersonNames({
  displayName,
  nickname,
  large = false,
  centered = false,
  nameStyle,
}: PersonNamesProps): React.JSX.Element {
  const showNickname = Boolean(nickname) && nickname !== displayName;
  return (
    <View style={styles.block}>
      <Text
        style={[styles.name, large ? styles.nameLarge : null, centered ? styles.centered : null, nameStyle]}
        numberOfLines={1}
      >
        {displayName}
      </Text>
      {showNickname ? (
        <Text style={[styles.nickname, large ? styles.nicknameLarge : null, centered ? styles.centered : null]} numberOfLines={1}>
          {nickname}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { flexShrink: 1, minWidth: 0 },
  name: { ...typography.bodyBold, color: colors.textPrimary },
  nameLarge: { fontSize: 22, fontWeight: '700' },
  nickname: { ...typography.caption, color: groupView.textSecondary },
  nicknameLarge: { fontSize: 16 },
  centered: { textAlign: 'center' },
});
