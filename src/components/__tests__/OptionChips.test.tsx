import React from 'react';

import { act, pressableLabelled, pressables, render } from '../../test-utils/render';
import OptionChips from '../OptionChips';

const OPTIONS = [
  { value: 'a', label: 'Alpha' },
  { value: 'b', label: 'Beta' },
];

describe('OptionChips', () => {
  it('marks only the chosen chip selected; none when value is null', () => {
    const chosen = render(<OptionChips options={OPTIONS} value="b" onChange={jest.fn()} />);
    expect(pressableLabelled(chosen, 'Alpha').props.accessibilityState).toMatchObject({ selected: false });
    expect(pressableLabelled(chosen, 'Beta').props.accessibilityState).toMatchObject({ selected: true });

    const none = render(<OptionChips options={OPTIONS} value={null} onChange={jest.fn()} />);
    expect(pressables(none).every(p => p.props.accessibilityState.selected === false)).toBe(true);
  });

  it('reports the tapped value', () => {
    const onChange = jest.fn();
    const root = render(<OptionChips options={OPTIONS} value={null} onChange={onChange} />);
    act(() => pressableLabelled(root, 'Alpha').props.onPress());
    expect(onChange).toHaveBeenCalledWith('a');
  });

  it('supports multi-select array value', () => {
    const multi = render(<OptionChips options={OPTIONS} value={['a', 'b']} onChange={jest.fn()} />);
    expect(pressableLabelled(multi, 'Alpha').props.accessibilityState).toMatchObject({ selected: true });
    expect(pressableLabelled(multi, 'Beta').props.accessibilityState).toMatchObject({ selected: true });
  });

  it('is inert when disabled', () => {
    const root = render(<OptionChips options={OPTIONS} value={null} onChange={jest.fn()} disabled />);
    expect(pressableLabelled(root, 'Alpha').props.disabled).toBe(true);
  });
});
