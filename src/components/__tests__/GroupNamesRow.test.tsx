import React from 'react';

import GroupNamesRow from '../GroupNamesRow';
import { render, texts } from '../../test-utils/render';
import type { Instance } from '../../test-utils/render';

const names = (count: number): string[] => Array.from({ length: count }, (_, i) => `Group ${i + 1}`);
const items = (root: Instance): Instance[] => root.findAll(n => n.props.testID === 'group-name-item' && typeof n.type === 'string');
const more = (root: Instance): Instance[] => root.findAll(n => n.props.testID === 'group-names-more' && typeof n.type === 'string');

describe('GroupNamesRow', () => {
  it('renders one group as a single row with no "more" line', () => {
    const root = render(<GroupNamesRow names={['Sunday Footballers']} />);
    expect(items(root)).toHaveLength(1);
    expect(texts(root)).toEqual(['Sunday Footballers']);
    expect(more(root)).toHaveLength(0);
  });

  it('renders three groups as three rows with no "more" line', () => {
    const root = render(<GroupNamesRow names={names(3)} />);
    expect(texts(root)).toEqual(['Group 1', 'Group 2', 'Group 3']);
    expect(more(root)).toHaveLength(0);
  });

  it('shows the first three of 25 groups and "+22 more"', () => {
    const root = render(<GroupNamesRow names={names(25)} />);
    expect(items(root)).toHaveLength(3);
    expect(texts(root)).toEqual(['Group 1', 'Group 2', 'Group 3', '+22 more']);
  });

  it('truncates a long name to one line and ignores blank names', () => {
    const root = render(<GroupNamesRow names={['  ', 'A very long group name '.repeat(8)]} />);
    expect(items(root)).toHaveLength(1);
    const text = root.find(n => (n.type as unknown) === 'Text');
    expect(text.props.numberOfLines).toBe(1);
  });

  it('renders nothing for an empty list', () => {
    expect(render(<GroupNamesRow names={[]} />).findAll(n => n.props.testID === 'group-names-row')).toHaveLength(0);
  });
});
