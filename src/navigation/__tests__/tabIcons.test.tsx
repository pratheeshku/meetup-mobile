/**
 * Emoji tab icons: every tab route must have one (the record is typed on
 * `AppTabParamList`, so a new tab without an emoji is also a type error),
 * and inactive tabs must read as inactive despite emoji ignoring tint.
 */
import React from 'react';
import { StyleSheet } from 'react-native';

import { opacity } from '../../theme/tokens';
import { render } from '../../test-utils/render';
import { TAB_EMOJI, TabEmoji } from '../tabIcons';

describe('TAB_EMOJI', () => {
  it('maps each tab to the emoji specified for it', () => {
    expect(TAB_EMOJI).toEqual({
      Home: '🏠',
      Groups: '👥',
      Tournaments: '🏆',
      Profile: '👤',
    });
  });
});

describe('TabEmoji', () => {
  const hostText = (element: React.ReactElement) =>
    render(element).find(node => (node.type as unknown) === 'Text');

  it('renders the emoji at the size the tab bar supplies', () => {
    const text = hostText(<TabEmoji emoji="🏠" focused size={24} />);
    expect(text.props.children).toBe('🏠');
    expect(StyleSheet.flatten(text.props.style).fontSize).toBe(24);
  });

  it('is fully opaque when focused and dimmed when not', () => {
    const focused = StyleSheet.flatten(hostText(<TabEmoji emoji="🏠" focused size={24} />).props.style);
    const idle = StyleSheet.flatten(hostText(<TabEmoji emoji="🏠" focused={false} size={24} />).props.style);
    expect(focused.opacity).toBeUndefined();
    expect(idle.opacity).toBe(opacity.disabled);
  });

  it('is hidden from screen readers (the tab label carries the meaning)', () => {
    const text = hostText(<TabEmoji emoji="🏠" focused size={24} />);
    expect(text.props.accessibilityElementsHidden).toBe(true);
    expect(text.props.importantForAccessibility).toBe('no');
  });
});
