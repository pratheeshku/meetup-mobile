import React from 'react';
import { StyleSheet } from 'react-native';

import { act, pressableLabelled, pressables, render } from '../../test-utils/render';
import OptionChips from '../OptionChips';
import { colors } from '../../theme/tokens';

/** The host `View` rendered inside a chip's Pressable (carries background/border). */
function chipBackground(chip: ReturnType<typeof pressableLabelled>): string | undefined {
  const view = chip.findAll(node => (node.type as unknown) === 'View')[0];
  return StyleSheet.flatten(view.props.style)?.backgroundColor as string | undefined;
}

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

  it('defaults the selected chip background to colors.primary when neither color nor selectedColor is given', () => {
    const root = render(<OptionChips options={OPTIONS} value="a" onChange={jest.fn()} />);
    expect(chipBackground(pressableLabelled(root, 'Alpha'))).toBe(colors.primary);
    expect(chipBackground(pressableLabelled(root, 'Beta'))).not.toBe(colors.primary);
  });

  it('uses selectedColor for every selected chip that has no per-option color', () => {
    const root = render(
      <OptionChips options={OPTIONS} value="a" onChange={jest.fn()} selectedColor="#1B1918" />,
    );
    expect(chipBackground(pressableLabelled(root, 'Alpha'))).toBe('#1B1918');
  });

  it("prefers an option's own color over selectedColor when selected", () => {
    const options = [
      { value: 'a', label: 'Alpha', color: '#2A7B72' },
      { value: 'b', label: 'Beta' },
    ];
    const root = render(
      <OptionChips options={options} value="a" onChange={jest.fn()} selectedColor="#1B1918" />,
    );
    expect(chipBackground(pressableLabelled(root, 'Alpha'))).toBe('#2A7B72');
  });
});
