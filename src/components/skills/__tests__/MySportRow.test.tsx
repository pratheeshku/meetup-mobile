import React from 'react';

import { act, pressableLabelled, render, texts } from '../../../test-utils/render';
import { levelColors } from '../../../theme/tokens';
import MySportRow from '../MySportRow';
import { hostViews, styleOf } from '../../../test-utils/skillControls';

// `useSportDisplayName` fetches the sports list; here it fails, so the raw sport key is shown.
jest.mock('../../../api/sports', () => ({ getSports: jest.fn(() => Promise.reject(new Error('offline'))) }));

describe('MySportRow', () => {
  it('shows the sport, a level pill with the label and dots, and is tappable', () => {
    const onPress = jest.fn();
    const root = render(<MySportRow sport="badminton" skillLevel="Expert" onPress={onPress} />);
    expect(texts(root)).toEqual(['badminton', 'Expert']);
    expect(hostViews(root, 'level-dot-filled')).toHaveLength(3);
    expect(hostViews(root, 'level-dot-empty')).toHaveLength(0);
    const row = pressableLabelled(root, 'badminton, Expert');
    expect(styleOf(row).minHeight as number).toBeGreaterThanOrEqual(44);
    act(() => row.props.onPress());
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('colours the pill by the stored level, and degrades to neutral for an unknown stored value', () => {
    const known = render(<MySportRow sport="badminton" skillLevel="Beginner" onPress={jest.fn()} />);
    const pill = known.findAll(
      node => (node.type as unknown) === 'View' && styleOf(node).borderColor === levelColors.Beginner.border,
    );
    expect(pill.length).toBeGreaterThan(0);

    const unknown = render(<MySportRow sport="badminton" skillLevel="Mystery" onPress={jest.fn()} />);
    expect(hostViews(unknown, 'level-dot-filled')).toHaveLength(0);
    expect(hostViews(unknown, 'level-dot-empty')).toHaveLength(3);
  });
});
