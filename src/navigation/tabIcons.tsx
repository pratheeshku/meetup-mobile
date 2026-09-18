/**
 * Emoji tab-bar icons (matching the web app's sidebar icons).
 *
 * Rendered through `tabBarIcon` rather than by prefixing `tabBarLabel`:
 * the tab bar shows react-navigation's placeholder `MissingIcon` above every
 * label when no icon is supplied, so a label-only emoji would show a
 * placeholder glyph *and* an emoji. The label text stays plain ("Home"),
 * which is also what screen readers announce.
 *
 * Tab structure note: there is no separate "Games" tab — events live under
 * Home — so 🎮 is not used here (it appears on the Home dashboard's "My
 * Games" tile instead), and the web's "Discover" has no mobile tab.
 */
import React from 'react';
import { StyleSheet, Text } from 'react-native';

import { opacity } from '../theme/tokens';
import type { AppTabParamList } from './types';

/** `Create` is excluded: the center action button draws its own "+" glyph. */
export type EmojiTabName = Exclude<keyof AppTabParamList, 'Create'>;

export const TAB_EMOJI: Record<EmojiTabName, string> = {
  Home: '🏠',
  Groups: '👥',
  Tournaments: '🏆',
  Profile: '👤',
};

interface TabEmojiProps {
  emoji: string;
  focused: boolean;
  /** Icon size supplied by the tab bar. */
  size: number;
}

/**
 * Emoji glyphs ignore text colour, so the active/inactive distinction the
 * tab bar normally expresses via tint is expressed as opacity instead.
 */
export function TabEmoji({ emoji, focused, size }: TabEmojiProps): React.JSX.Element {
  return (
    <Text
      accessibilityElementsHidden
      importantForAccessibility="no"
      style={[styles.emoji, { fontSize: size }, focused ? null : styles.inactive]}
    >
      {emoji}
    </Text>
  );
}

const styles = StyleSheet.create({
  emoji: { textAlign: 'center' },
  inactive: { opacity: opacity.disabled },
});
